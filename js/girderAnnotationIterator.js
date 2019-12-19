// ==============================================================================
// Iterate over ractangle annotations.
// Right now, add an arrow for each.

// Load arrows on page load and next image.
// Save arrows on next image.

// TODO: Merge this with annotation editor.  Copied from that class, and much of the code is the same.

(function () {
  'use strict';

  // action states
  var KEY_UP = 0;
  // var KEY_DOWN = 1;
  // var KEY_USED_ADVANCE = 2;
  // var KEY_USED_NO_ADVANCE = 3;

  var GirderAnnotationIterator = function (parent, viewer, itemId, classes) {
    // when iterating, only show the current rect.
    this.HighlightedRect = new SAM.Rect();
    this.HighlightedRect.OutlineColor = [1, 1, 0];

    // quick hack to add arrows.
    this.ArrowMode = true;

    // Make an anntoation layer a helper object.
    this.ViewerParent = viewer.GetDiv();
    this.Layer = new SAM.AnnotationLayer(this.ViewerParent);
    this.Layer.SetCamera(viewer.GetCamera());
    viewer.AddLayer(this);

    if (this.ArrowMode) {
      this.ArrowLayer = new SAM.AnnotationLayer(this.ViewerParent);
      this.ArrowLayer.SetCamera(viewer.GetCamera());
      this.LoadItemArrows(itemId, 'plane-nose', this.ArrowLayer);
    }

    this.Viewer = viewer;
    this.ActiveClassIndex = 0;
    this.ItemId = itemId;
    this.CreateClasses(classes);

    // Combined key click action.
    this.ActionState = KEY_UP;

    this.InitializeGui(parent, 'GirderAnnotationIterator');

    // Mode: stepping through ( and processing events).
    this.IteratorIndex = -1;

    // active class is highlighted in the gui.
    // It is the class used for clicks
    this.SetActiveClassIndex(0);
  };

  // Since we have to make forwarding methods, just use the layer as a helper object.
  GirderAnnotationIterator.prototype.EventuallyDraw = function () {
    if (!this.RenderPending) {
      this.RenderPending = true;
      var self = this;
      window.requestAnimationFrame(
        function () {
          self.RenderPending = false;
          self.Draw();
        });
    }
    // this.Layer.EventuallyDraw();
  };
  GirderAnnotationIterator.prototype.GetView = function () {
    return this.Layer.GetView();
  };
  GirderAnnotationIterator.prototype.GetCamera = function () {
    return this.Layer.GetCamera();
  };
  GirderAnnotationIterator.prototype.Remove = function () {
    // We are moving to the next slide in the folder and this object is being
    // discarded. Save the arrows.
    // this.Save();

    this.LayerControl.remove();
    this.InstructionsHeading.remove();
    this.InstructionsUL.remove();

    this.Layer.Remove();
    if (this.ArrowLayer) {
      this.ArrowLayer.Remove();
    }
    this.Viewer.RemoveLayer(this);
  };
  GirderAnnotationIterator.prototype.UpdateSize = function () {
    this.Layer.UpdateSize();
    if (this.ArrowLayer) {
      this.ArrowLayer.UpdateSize();
    }
  };

  GirderAnnotationIterator.prototype.CreateClasses = function (classNames) {
    var numClasses = classNames.length;
    this.Classes = [];
    for (var i = 0; i < numClasses; ++i) {
      var classObj = {
        label: classNames[i],
        index: i};
      this.Classes.push(classObj);
      // assign colors to the labels
      // detections will be yellow
      // Detection class is yellow.
      if (i === 0) {
        classObj.color = '#FFFF00';
      } else if (i === 1) { // Second (false positive) is red
        classObj.color = '#FF0000';
      } else if (i === 2) { // last (true positive) is green
        classObj.color = '#00FF00';
      } else {
        // the rest will range from purple to cyan
        var k = (i - 3) / (numClasses - 4);
        this.Classes[i].color = SAM.ConvertColorToHex([k, 1 - k, 1]);
      }
      this.RequestAnnotationFromName(classObj);
    }
  };

  GirderAnnotationIterator.prototype.RequestAnnotationFromName = function (classObj) {
    if (!window.girder) {
      window.alert('Could not find girder client');
      return;
    }
    var self = this;
    girder.rest.restRequest({
      url: 'annotation?itemId=' + this.ItemId + '&name=' + classObj.label + '&limit=1',
      method: 'GET'
    }).done(function (data) {
      if (data.length > 0) {
        // The annotation exists.  Reuest it.
        classObj.annotation_id = data[0]['_id'];
        self.RequestAnnotationFromId(classObj);
      } else {
        // Annotation does not exist yet.  Make it.
        var annot = {
          'elements': [],
          'name': classObj.label};
        // Make a new annotation in the database.
        girder.rest.restRequest({
          url: 'annotation?itemId=' + self.ItemId,
          method: 'POST',
          contentType: 'application/json',
          data: JSON.stringify(annot)
        }).done(function (retAnnot) {
          // This has the girder id.
          classObj.annotation_id = retAnnot['_id'];
          self.LoadAnnotation(retAnnot, classObj);
        });
      }
    });
  };

  GirderAnnotationIterator.prototype.RequestAnnotationFromId = function (classObj) {
    if (!window.girder) {
      window.alert('Could not find girder client');
      return;
    }
    var self = this;
    girder.rest.restRequest({
      url: 'annotation/' + classObj.annotation_id,
      method: 'GET',
      contentType: 'application/json'
    }).done(function (data) {
      self.LoadAnnotation(data, classObj);
    });
  };

  // TODO: Share this code (to parse girder data) with girderWidget.
  GirderAnnotationIterator.prototype.LoadAnnotation = function (data, classObj) {
    // Used for saving the annotation back to girder.
    classObj.annotation = data.annotation;

    // Put all the rectangles into one set.
    var setObj = {};
    setObj.type = 'rect_set';
    setObj.centers = [];
    setObj.widths = [];
    setObj.heights = [];
    setObj.confidences = [];
    setObj.labels = [];

    var annot = data.annotation;
    for (var i = 0; i < annot.elements.length; ++i) {
      var element = annot.elements[i];

      if (element.type === 'rectangle') {
        setObj.widths.push(element.width);
        setObj.heights.push(element.height);
        setObj.centers.push(element.center[0]);
        setObj.centers.push(element.center[1]);
        if (element.scalar === undefined) {
          element.scalar = 1.0;
        }
        setObj.confidences.push(element.scalar);
        // ignore the database label because we use our own
        setObj.labels.push(classObj.label);
      }
    }

    var widget = new SAM.RectSetWidget();
    widget.Load(setObj);
    widget.Hash = new SpatialHash();
    var bds = this.Viewer.GetOverViewBounds();
    widget.Hash.Build(widget.Shape, bds);

    // We want to color by labels (not widget)
    var shape = widget.Shape;
    if (!shape.LabelColors) {
      shape.LabelColors = {};
      // Colors setup in contructor.
      for (i = 0; i < this.Classes.length; ++i) {
        shape.LabelColors[this.Classes[i].label] = this.Classes[i].color;
      }
    }

    classObj.widget = widget;
    widget.Shape.SetOutlineColor(classObj.color);
    this.EventuallyDraw();
  };

  // Use the last size, or one from the active widgets.
  // Limit by sensible sizes for the viewer.
  GirderAnnotationIterator.prototype.GetSquareSize = function () {
    // if (localStorage.GirderAnnotationIteratorDefaults) {
    //   var defaults = JSON.parse(localStorage.GirderAnnotationIteratorDefaults);
    var size = 64;
    if (this.SquareSize) {
      // Default to the last size applied
      size = this.SquareSize;
    } else if (this.Classes.length > 0) {
      // Look to previous annotations for a size/
      var classObj = this.Classes[this.ActiveClassIndex];
      if (classObj.widget) {
        var rectSet = classObj.widget.Shape;
        if (rectSet.Heights.length > 0) {
          size = rectSet.Heights[0];
        }
      }
    }
    // Constrain the size to be visible.
    var cam = this.GetCamera();
    var viewHeight = cam.GetHeight();
    if (size > viewHeight / 0.75) {
      size = viewHeight / 0.75;
      this.SquareSize = size;
    }
    // Use pixel size to limit the smaller rect.
    var viewPixelSize = cam.GetSpacing();
    if (size < viewPixelSize * 10) {
      size = viewPixelSize * 10;
      this.SquareSize = size;
    }

    return size;
  };

  // Returns true if it was a valid class index.
  GirderAnnotationIterator.prototype.SetActiveClassIndex = function (idx) {
    if (idx < 0 || idx >= this.Classes.length) {
      return false;
    }
    this.Classes[this.ActiveClassIndex].gui
            .css({'background-color': '#FFF'});
    this.ActiveClassIndex = idx;
    this.Classes[idx].gui
            .css({'background-color': '#DEF'});
    this.SetCursorColor(this.ViewerParent, this.Classes[idx].color);
    if (!this.IteratorClass) {
      var selectedClass = this.Classes[idx];
      this.ActiveLabel.text(selectedClass.label);
    }
    return false;
  };

  GirderAnnotationIterator.prototype.GetActive = function () {
    // return this.IteratorIndex > -1;
    return true;
  };

  // TODO: Clean this up.  Probably put the widgets in the layer.
  GirderAnnotationIterator.prototype.Draw = function () {
    this.Layer.Draw();
    var view = this.Layer.GetView();
    this.HighlightedRect.Draw(view);
    if (this.ArrowLayer) {
      this.ArrowLayer.Draw();
    }

    for (var i = 0; i < this.Classes.length; ++i) {
      if (this.Classes[i].widget) {
        this.Classes[i].widget.Draw(this.Layer);
      }
    }
  };

  GirderAnnotationIterator.prototype.HandleMouseDown = function (event) {
    if (this.ArrowLayer) {
      return this.ArrowLayer.HandleMouseDown(event);
    }
    return true;
  };

  GirderAnnotationIterator.prototype.HandleMouseUp = function (event) {
    if (this.ArrowLayer) {
      return this.ArrowLayer.HandleMouseUp(event);
    }
    return true;
  };

  GirderAnnotationIterator.prototype.HandleMouseClick = function (event) {
    // We even give inactive layers a chance to claim the selection.
    // It is a way to find which group a mark belongs to.
    var selectedWidget = this.ArrowLayer.HandleSelect(event);
    if (selectedWidget === this.SelectedWidget) {
      return;
    }
    if (this.SelectedWidget) {
      this.SelectedWidget.SetActive(false);
      this.SelectedWidget.SetSelected(false);
    }
    if (selectedWidget) {
      selectedWidget.SetActive(true);
      this.SelectedWidget = selectedWidget;
      return false;
    }
    this.SelectedWidget = undefined;
    return true;
  };

  // Highlight on hover.
  GirderAnnotationIterator.prototype.HandleMouseMove = function (event) {
    if (this.ArrowLayer) {
      return this.ArrowLayer.HandleMouseMove(event);
    }
    return true;
  };

  // Make the annotation larger and smaller with the mouse wheel.
  // TODO: Remove this legacy function
  GirderAnnotationIterator.prototype.HandleMouseWheel = function (event) {
    return true;
  };

  // Stepping through the detection sequence.
  // -1 is none
  GirderAnnotationIterator.prototype.SetIteratorIndex = function (idx) {
    // Highlight the current
    this.SetHighlightedRect(this.IteratorClass, idx);
    this.IteratorIndex = idx;
    if (idx === -1) {
      this.IteratorClass = undefined;
    }
    // Animate to put this rec in the middle of the view.
    this.UpdateActiveView();
  };

  // The highlighted rect (sometimes the same as the
  // iteration index / rect).
  GirderAnnotationIterator.prototype.SetHighlightedRect = function (classObj, idx) {
    var widget = classObj.widget;
    var rectSet = widget.Shape;

    widget.Visibility = false;
    this.HighlightedRect.Visibility = true;
    this.HighlightedRect.Width = rectSet.Widths[idx];
    this.HighlightedRect.Height = rectSet.Heights[idx];
    this.HighlightedRect.Orientation = 0; // rectSet.Orientations[idx];
    var x = rectSet.Centers[idx * 2];
    var y = rectSet.Centers[idx * 2 + 1];
    this.HighlightedRect.Origin = [x, y];
    // this.OutlineColor = [0, 0, 0];
    this.HighlightedRect.UpdateBuffers();

    this.EventuallyDraw();
  };

  GirderAnnotationIterator.prototype.HandleKeyDown = function (event) {
    if (this.IteratorClass) {
      return false;
    }
    if (this.ArrowLayer) {
      return this.ArrowLayer.HandleMouseUp(event);
    }
    return true;
  };

  GirderAnnotationIterator.prototype.HandleKeyUp = function (event) {
    if (this.IteratorClass) {
      // iterating
      if (event.keyCode === 46 || event.keyCode === 8) { // delete key
        if (this.ArrowLayer) {
          this.ArrowLayer.DeleteSelected();
          this.ArrowLayer.EventuallyDraw();
        }
        event.preventDefault();
        return false;
      }

      // Escape key stops iteration.
      if (event.keyCode === 27) { // escape
        this.Stop();
        return false;
      }

      // Forward and backward.
      if (this.IteratorClass) {
        if (event.keyCode === 37) {
          // Left cursor key
          this.ChangeCurrent(-1);
          return false;
        } else if (event.keyCode === 39 || event.keyCode === 32) {
          // Right cursor key (or space bar)
          this.ChangeCurrent(1);
          return false;
        }
      }
    }

    if (this.ArrowLayer) {
      return this.ArrowLayer.HandleMouseUp(event);
    }
    return true;
  };

  // Animate to the new current rect.
  GirderAnnotationIterator.prototype.UpdateActiveView = function () {
    if (this.IteratorClass === undefined ||
        this.IteratorClass.widget === undefined) {
      return true;
    }

    var rectSet = this.IteratorClass.widget.Shape;

    // Change the index / confidence label.
    var idx = this.IteratorIndex;
    if (idx < 0) {
      var selectedClass = this.Classes[this.ActiveClassIndex];
      this.ActiveLabel.text(selectedClass.label);
      return;
    } else {
      this.ActiveLabel.text(idx.toString() + ' of ' +
                            rectSet.Labels.length.toString() + ', ' +
                            rectSet.Confidences[idx].toPrecision(2) +
                            ', ' + rectSet.Labels[idx]);
    }

    var viewer = this.Viewer;
    // viewer.ZoomTarget = this.Layer.GetCamera().GetHeight();
    viewer.RollTarget = this.GetCamera().GetWorldRoll();
    viewer.TranslateTarget = rectSet.GetCenter(this.IteratorIndex);
    viewer.AnimateLast = new Date().getTime();
    viewer.AnimateDuration = 200.0;
    viewer.EventuallyRender(true);
  };

  GirderAnnotationIterator.prototype.HandleArrowFinished = function (widget) {
    this.ArrowWidget = undefined;
  };

  GirderAnnotationIterator.prototype.StartArrow = function (widget) {
    if (this.SelectedWidget) {
      this.SelectedWidget.SetActive(false);
      this.SelectedWidget.SetSelected(false);
    }
    var self = this;
    if (!this.ArrowWidget) {
      this.ArrowWidget = new SAM.ArrowWidget(this.ArrowLayer);
      this.ArrowWidget.SetColor('#00ffff');
      this.ArrowWidget.Arrow.Width = 2.0;
      this.ArrowLayer.AddWidget(this.ArrowWidget);
      this.ArrowWidget.SetStateToDrawing();
      this.ArrowWidget.SetStateChangeCallback(
        function (widget) { self.HandleArrowFinished(widget); });
    }
  };

  GirderAnnotationIterator.prototype.LoadItemArrows = function (itemId, name, layer) {
    var self = this;
    girder.rest.restRequest({
      url: 'annotation?itemId=' + itemId + '&name=' + name + '&limit=1',
      method: 'GET'
    }).done(function (data) {
      if (data.length > 0) {
        // The annotation exists.  Reuest it.
        self.ArrowAnnotationId = data[0]['_id'];
        girder.rest.restRequest({
          url: 'annotation/' + self.ArrowAnnotationId,
          method: 'GET',
          contentType: 'application/json'
        }).done(function (data) {
          self.LoadAnnotationArrows(data);
        });
      } else {
        // Annotation does not exist yet.  Make an empty one.
        var annot = {
          'elements': [],
          'name': name};
        self.ArrowAnnotation = annot;
        // Make a new annotation in the database.
        girder.rest.restRequest({
          url: 'annotation?itemId=' + itemId,
          method: 'POST',
          contentType: 'application/json',
          data: JSON.stringify(annot)
        }).done(function (retAnnot) {
          // This has the girder id.
          self.ArrowAnnotationId = retAnnot['_id'];
        });
      }
    });
  };

  // TODO: Share this code (to parse girder data) with girderWidget.
  GirderAnnotationIterator.prototype.LoadAnnotationArrows = function (data, classObj) {
    // Used for saving the annotation back to girder.
    this.ArrowAnnotation = data.annotation;

    var annot = data.annotation;
    for (var i = 0; i < annot.elements.length; ++i) {
      var element = annot.elements[i];
      var dx = element.points[1][0] - element.points[0][0];
      var dy = element.points[1][1] - element.points[0][1];
      var length = Math.sqrt(dx * dx + dy * dy);
      var orientation = Math.atan2(dy, dx) * 180 / Math.PI;

      if (element.type === 'arrow') {
        var obj = {
          origin: element.points[0],
          length: length,
          width: element.lineWidth,
          orientation: orientation,
          fillcolor: SAM.ConvertColor(element.fillColor),
          outlinecolor: SAM.ConvertColor(element.lineColor)
        };
        var widget = new SAM.ArrowWidget(this.ArrowLayer);
        widget.Load(obj);
        this.ArrowLayer.AddWidget(widget);
      }
    }

    this.EventuallyDraw();
  };

  // Forward = 1, backward = -1
  GirderAnnotationIterator.prototype.ChangeCurrent = function (direction) {
    if (this.IteratorClass.widget === undefined) {
      return true;
    }
    var rectSet = this.IteratorClass.widget.Shape;
    var index = this.IteratorIndex;
    var confThresh = this.GetConfidenceThreshold();

    // loop to skip rects below the threshold
    while (true) {
      index += direction;
      if (index < 0 || index >= rectSet.Widths.length) {
        this.Stop();
        return;
      }
      if (rectSet.Confidences[index] >= confThresh) {
        if (this.ArrowMode) {
          this.StartArrow();
        }
        this.SetIteratorIndex(index);
        return;
      }
    }
  };

  GirderAnnotationIterator.prototype.HandleClick = function (event) {
    return true;
  };

  // Initialize the gui / dom
  GirderAnnotationIterator.prototype.InitializeGui = function (parent, label) {
    var self = this;

    // The wrapper div that controls a single layer.
    this.LayerControl = $('<div>')
      .appendTo(parent)
      .css({
        'border': '1px solid #CCC',
        'width': '100%'
      });

    this.ActiveLabel = $('<div>')
      .appendTo(this.LayerControl)
      .prop('title', 'Start sorting detections')
      .attr('contenteditable', 'false')
      .text('');

    var buttonContainer = $('<p>')
      .appendTo(this.LayerControl);
    this.StartStopButton = $('<button>')
      .appendTo(buttonContainer)
      .text('Start')
      .css({'background-color': '#5F5'})
      .prop('title', 'Start sorting detections')
      // .button()
      .css({'width': '5em'})
      .on('click', function () { self.StartStop(); });
    $('<button>')
      .appendTo(buttonContainer)
      .text('Save')
      .prop('title', 'Save annotations to server')
      .click(function () { self.Save(); });

    // Wrapper for the confidence slider.
    var confWrapper = $('<div>')
      .appendTo(this.LayerControl)
      .css({
        'border': '1px solid #CCC',
        'width': '100%',
        'height': '50px'
      });

    this.Slider = $('<input type="range" min="0" max="100">')
      .appendTo(confWrapper)
      .on('input',
          function () {
            self.SliderCallback();
          });

    $('<div>')
      .appendTo(confWrapper)
      .html('0%')
      .css({ 'float': 'left' });
    $('<div>')
      .appendTo(confWrapper)
      .html('Confidence')
      .css({
        'float': 'right',
        'position': 'relative',
        'left': '-50%',
        'text-align': 'left'});
    $('<div>')
      .appendTo(confWrapper)
      .html('100%')
      .css({ 'float': 'right' });

    var classContainer = $('<p>')
      .appendTo(this.LayerControl);
    for (var i = 0; i < this.Classes.length; ++i) {
      this.MakeClassButton(classContainer, i);
    }

    // Instructions
    this.InstructionsHeading = $('<h4>')
      .appendTo(parent)
      .text('Instructions');
    this.InstructionsUL = $('<ul>')
      .appendTo(parent);
    var browsingLI = $('<li>')
      .appendTo(this.InstructionsUL)
      .text('Browsing');
    var browsingUL = $('<ul>')
      .appendTo(browsingLI);
    $('<li>')
      .appendTo(browsingUL)
      .text('Arrow keys: pan screen');
    $('<li>')
      .appendTo(browsingUL)
      .text('Left mouse drag: pan');
    $('<li>')
      .appendTo(browsingUL)
      .text('Scroll wheel: zoom');
    $('<li>')
      .appendTo(browsingUL)
      .text('"<" button: previous image');
    $('<li>')
      .appendTo(browsingUL)
      .text('">" button: next image');
    $('<li>')
      .appendTo(browsingUL)
      .text('"Start" button: iterate over all planes');

    var iteratingLI = $('<li>')
      .appendTo(this.InstructionsUL)
      .text('Iterating');
    var iteratingUL = $('<ul>')
      .appendTo(iteratingLI);
    $('<li>')
      .appendTo(iteratingUL)
      .text('Space bar: advance to next plane');
    $('<li>')
      .appendTo(iteratingUL)
      .text('Right arrow key: advance to next plane');
    $('<li>')
      .appendTo(iteratingUL)
      .text('Left arrow key: back to previos plane');
    $('<li>')
      .appendTo(iteratingUL)
      .text('A new arrow is automatically triggerd when you advance');
    $('<li>')
      .appendTo(iteratingUL)
      .text("Mouse down: place the arrow's tip");
    $('<li>')
      .appendTo(iteratingUL)
      .text("Drag with mouse down: place the arrow's base");
    $('<li>')
      .appendTo(iteratingUL)
      .text('Mouse up: finish the arrow');
    $('<li>')
      .appendTo(iteratingUL)
      .text('Click on an arrow to make it dragable');
  };

  GirderAnnotationIterator.prototype.MakeClassButton = function (classContainer, index) {
    var self = this;
    var classObj = this.Classes[index];
    classObj.gui = $('<div>')
            .appendTo(classContainer)
            .text((index).toString() + ': ' + classObj.label)
            .css({'color': classObj.color})
            .click(function () { self.SetActiveClassIndex(index); });
  };

  GirderAnnotationIterator.prototype.UpdateHash = function () {
    var bds = this.Viewer.GetOverViewBounds();
    for (var i = 0; i < this.Classes.length; ++i) {
      var widget = this.Classes[i].widget;
      widget.Hash.Build(widget.Shape, bds);
    }
  };

  GirderAnnotationIterator.prototype.GetConfidenceThreshold = function () {
    return parseInt(this.Slider.val()) / 100.0;
  };

  // Confidence threshold slider.
  GirderAnnotationIterator.prototype.SliderCallback = function () {
    var visValue = this.GetConfidenceThreshold();
    for (var i = 0; i < this.Classes.length; ++i) {
      if (this.Classes[i].widget) {
        this.Classes[i].widget.SetThreshold(visValue);
      }
    }
    this.EventuallyDraw();
    // In case we are iterating and the curent becomes invisible.
    this.CheckIteratorVisibility();
  };

  GirderAnnotationIterator.prototype.CheckIteratorVisibility = function () {
    if (!this.IteratorClass || this.IteratorIndex < 0) {
      return;
    }
    // In case the first is not visible.
    var rectSet = this.IteratorClass.widget.Shape;
    var confThresh = this.GetConfidenceThreshold();
    if (rectSet.Confidences[this.IteratorIndex] < confThresh) {
      this.ChangeCurrent(1);
    }
  };

  GirderAnnotationIterator.prototype.Stop = function () {
    this.SetIteratorIndex(-1);
    this.InteractorClass = undefined;
    this.StartStopButton
      .text('Start')
      .css({'background-color': '#5F5'})
      .prop('title', 'Start sorting detections');
  };

  // Start iterating over the selected class.
  GirderAnnotationIterator.prototype.Start = function () {
    this.Viewer.Focus();
    // zoom in
    var viewer = this.Viewer;
    viewer.ZoomTarget = 500;
    this.IteratorClass = this.Classes[this.ActiveClassIndex];
    if (this.IteratorClass.widget.Shape.GetLength() < 1) {
      window.alert('No annotations in ' + this.IteratorClass.label);
      this.IteratorClass = undefined;
      return;
    }
    this.SetIteratorIndex(0);
    // In case the first is not visible.
    this.CheckIteratorVisibility();
    this.StartStopButton
      .text('Stop')
      .css({'background-color': '#F55'})
      .prop('title', 'Stop sorting detections');

    if (this.ArrowMode) {
      this.StartArrow();
    }
  };

  // Stop iterating.
  GirderAnnotationIterator.prototype.StartStop = function () {
    if (this.IteratorClass) {
      // Currently interating: Stop action
      this.Stop();
    } else {
      // Not interating yet:  Start action
      this.Start();
    }
  };

  // Move labeled rects in detections to classes.
  // Called before annotations are saved to the database
  GirderAnnotationIterator.prototype.SplitDetections = function () {
    // Build an object to make indexing classes easier.
    var shapes = {};
    for (var i = 0; i < this.Classes.length; ++i) {
      shapes[this.Classes[i].label] = this.Classes[i];
      // Create a new rectSet for each class.
      // Best way to deal with the shuffle.
      this.Classes[i].newRectSet = new SAM.RectSet();
      this.Classes[i].newRectSet.LabelColors = this.Classes[i].widget.Shape.LabelColors;
      this.Classes[i].newRectSet.Threshold = this.Classes[i].widget.Shape.Threshold;
    }

    for (i = 0; i < this.Classes.length; ++i) {
      var inRectSet = this.Classes[i].widget.Shape;
      for (var inIdx = 0; inIdx < inRectSet.GetLength(); ++inIdx) {
        var label = inRectSet.Labels[inIdx];
        var outRectSet = shapes[label].newRectSet;
        outRectSet.CopyRectangle(inRectSet, inIdx,
                                 outRectSet.GetLength());
      }
    }

    // Now keep the new rect sets and dispose of the old.
    for (i = 0; i < this.Classes.length; ++i) {
      this.Classes[i].widget.Shape = this.Classes[i].newRectSet;
      delete this.Classes[i].newRectSet;
    }

    this.UpdateHash();
  };

  GirderAnnotationIterator.prototype.Save = function () {
    // Save arrows in the database
    var annotation = this.ArrowAnnotation;
    annotation.elements = this.ArrowLayerToGirderElements(this.ArrowLayer);
    SA.PushProgress();
    girder.rest.restRequest({
      url: 'annotation/' + this.ArrowAnnotationId,
      method: 'PUT',
      data: JSON.stringify(annotation),
      contentType: 'application/json'
    }).done(function () { SA.PopProgress(); });
  };

  // returns an elements array.
  GirderAnnotationIterator.prototype.ArrowLayerToGirderElements = function (layer) {
    var returnElements = [];

    for (var idx = 0; idx < layer.GetNumberOfWidgets(); ++idx) {
      var widget = layer.GetWidget(idx).Serialize();
      var pt1 = [widget.origin[0], widget.origin[1], 0];
      var pt2 = [widget.origin[0], widget.origin[1], 0];
      var theta = widget.orientation * Math.PI / 180.0;
      pt2[0] += widget.length * Math.cos(theta);
      pt2[1] += widget.length * Math.sin(theta);
      var points = [pt1, pt2];
      var element = {
        'type': 'arrow',
        'lineWidth': widget.width,
        'fillColor': SAM.ConvertColorToHex(widget.fillcolor),
        'lineColor': SAM.ConvertColorToHex(widget.outlinecolor),
        'points': points};
      returnElements.push(element);
    }
    return returnElements;
  };

  // Converts rectSetWidget into girder annotation elements.
  // returns an elements array.
  GirderAnnotationIterator.prototype.RectSetToGirderElements = function (rectSetWidget) {
    var returnElements = [];

    var widget = rectSetWidget.Serialize();
    var num = widget.widths.length;
    for (var j = 0; j < num; ++j) {
      var element = {'type': 'rectangle',
        'label': {'value': widget.labels[j]},
        'center': [widget.centers[2 * j], widget.centers[2 * j + 1], 0],
        'height': widget.heights[j],
        'width': widget.widths[j],
        'rotation': 0,
        'scalar': widget.confidences[j]};
      returnElements.push(element);
    }
    return returnElements;
  };

  // Now we are always active.  We have interaction state === ITERATING to
  // indicate cycling through annotations one by one.
  GirderAnnotationIterator.prototype.SetActive = function (active) {
    if (active === this.Active) {
      return;
    }
    this.Active = active;
    this.EventuallyDraw();
  };

  GirderAnnotationIterator.prototype.SetCursorColor = function (element, color) {
    // create off-screen canvas
    var cursor = document.createElement('canvas');
    var ctx = cursor.getContext('2d');

    cursor.width = 16;
    cursor.height = 24;

    // draw an arrow

    // ctx.lineWidth = 1;
    ctx.moveTo(0, 18);
    ctx.lineTo(0, 0); // tip
    ctx.lineTo(12, 12);
    ctx.lineTo(7, 13);
    ctx.lineTo(11, 21);
    ctx.lineTo(8, 22);
    ctx.lineTo(4, 14);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // set image as cursor (modern browsers can take PNGs as cursor).
    element[0].style.cursor = 'url(' + cursor.toDataURL() + '), auto';
  };

  // 2d
  // I am extending the annotations from simple points to rectangles with
  // different sizes.  Each item will be added to multiple bins.
  // This serves two purposes.
  // Given a point, find the (best) picked renctanlge.
  // Given a rectangle find all rectangle that overlap
  function SpatialHash () {
    // Must be initialized before use.
  }

  SpatialHash.prototype.Initialize = function (bounds, size) {
    this.Origin = [bounds[0], bounds[2]];
    this.BinSize = Math.sqrt((bounds[1] - bounds[0]) * (bounds[3] - bounds[2]) / (size + 1));
    this.XDim = Math.ceil((bounds[1] - bounds[0]) / this.BinSize);
    this.YDim = Math.ceil((bounds[3] - bounds[2]) / this.BinSize);
    this.Grid = new Array(this.YDim);
    for (var y = 0; y < this.YDim; ++y) {
      var row = new Array(this.XDim);
      for (var x = 0; x < this.XDim; ++x) {
        row[x] = [];
      }
      this.Grid[y] = row;
    }
  };

  SpatialHash.prototype.Add = function (center, w, h, idx) {
    var x, y;
    x = center[0] - (w / 2);
    var col1 = Math.floor((x - this.Origin[0]) / this.BinSize);
    col1 = Math.max(Math.min(col1, this.XDim - 1), 0);
    x = center[0] + (w / 2);
    var col2 = Math.floor((x - this.Origin[0]) / this.BinSize);
    col2 = Math.max(Math.min(col2, this.XDim - 1), 0);

    y = center[1] - (h / 2);
    var row1 = Math.floor((y - this.Origin[1]) / this.BinSize);
    row1 = Math.max(Math.min(row1, this.YDim - 1), 0);
    y = center[1] + (h / 2);
    var row2 = Math.floor((y - this.Origin[1]) / this.BinSize);
    row2 = Math.max(Math.min(row2, this.YDim - 1), 0);

    for (var r = row1; r <= row2; ++r) {
      for (var c = col1; c <= col2; ++c) {
        this.Grid[r][c].push(idx);
      }
    }
  };

  // This object does not detect when the rect widget changes.
  SpatialHash.prototype.Build = function (rectSet, bounds) {
    this.RectSet = rectSet;
    var numRects = rectSet.GetLength();
    this.Initialize(bounds, numRects);
    for (var idx = 0; idx < numRects; ++idx) {
      var tmp = idx << 1;
      this.Add([rectSet.Centers[tmp], rectSet.Centers[tmp + 1]],
               rectSet.Widths[idx], rectSet.Heights[idx], idx);
    }
  };

  // Returns the index of the best rect for the point selected.
  // Returns -1 if there are no rects containing the point.
  SpatialHash.prototype.Get = function (pt, confThresh) {
    // Find binds touching this square.
    // Transform bounds to grid indexes  (keep in range).
    var x = Math.max(Math.min(
      Math.floor((pt[0] - this.Origin[0]) / this.BinSize), this.XDim - 1), 0);
    var y = Math.max(Math.min(
      Math.floor((pt[1] - this.Origin[1]) / this.BinSize), this.YDim - 1), 0);

    var bin = this.Grid[y][x];

    // Find the closest entry to location in these bins.
    var best;
    for (var i = 0; i < bin.length; ++i) {
      var rectIdx = bin[i];
      var conf = this.RectSet.Confidences[rectIdx];
      var w = this.RectSet.Widths[rectIdx];
      var h = this.RectSet.Heights[rectIdx];
      var cx = this.RectSet.Centers[rectIdx << 1];
      var cy = this.RectSet.Centers[(rectIdx << 1) + 1];
      var dx = Math.abs(cx - pt[0]);
      var dy = Math.abs(cy - pt[1]);
      if (dx < w / 2 && dy < h / 2 && confThresh <= conf) {
        var dist = Math.max(dx, dy);
        if (!best || dist <= best.dist) {
          best = {
            dist: dist,
            index: rectIdx,
            center: [cx, cy],
            width: w,
            height: h};
        }
      }
    }
    return best;
  };

  // For changed detection
  // Returns a list of all rectangles that overlap the input rectangle by
  // the specified threshold fraction.
  SpatialHash.prototype.GetOverlapping = function (center, width, height,
                                                   overlapThresh) {
    var overlapping = [];
    var hw1 = width / 2;
    var hh1 = height / 2;
    var cx1 = center[0];
    var cy1 = center[1];
    var area1 = width * height;

    // Loop over bins touching the input rectangle
    var x, y;
    x = center[0] - hw1;
    var col1 = Math.floor((x - this.Origin[0]) / this.BinSize);
    col1 = Math.max(Math.min(col1, this.XDim - 1), 0);
    x = center[0] + hw1;
    var col2 = Math.floor((x - this.Origin[0]) / this.BinSize);
    col2 = Math.max(Math.min(col2, this.XDim - 1), 0);

    y = center[1] - hh1;
    var row1 = Math.floor((y - this.Origin[1]) / this.BinSize);
    row1 = Math.max(Math.min(row1, this.YDim - 1), 0);
    y = center[1] + hh1;
    var row2 = Math.floor((y - this.Origin[1]) / this.BinSize);
    row2 = Math.max(Math.min(row2, this.YDim - 1), 0);

    for (var r = row1; r <= row2; ++r) {
      for (var c = col1; c <= col2; ++c) {
        var bin = this.Grid[r][c];
        // compare all the rectangles referenced by this bin
        for (var i = 0; i < bin.length; ++i) {
          var rectIdx = bin[i];
          var hw2 = this.RectSet.Widths[rectIdx] / 2;
          var hh2 = this.RectSet.Heights[rectIdx] / 2;
          var area2 = hw2 * hh2 * 4.0;
          var cx2 = this.RectSet.Centers[rectIdx << 1];
          var cy2 = this.RectSet.Centers[(rectIdx << 1) + 1];
          // Compute the intersection.
          var xMin = Math.max(cx1 - hw1, cx2 - hw2);
          var xMax = Math.min(cx1 + hw1, cx2 + hw2);
          var yMin = Math.max(cy1 - hh1, cy2 - hh2);
          var yMax = Math.min(cy1 + hh1, cy2 + hh2);
          var dx = Math.max(0, xMax - xMin);
          var dy = Math.max(0, yMax - yMin);
          var overlap = (dx * dy) / Math.min(area1, area2);
          if (overlap > overlapThresh) {
            var found = false;
            // SHould be few overlapping.  Linear search should be fine.
            for (var j = 0; j < overlapping.length && !found; ++j) {
              if (overlapping[j] === rectIdx) {
                found = true;
              }
            }
            if (!found) {
              overlapping.push(rectIdx);
            }
          }
        }
      }
    }

    return overlapping;
  };

  SAM.SpatialHash = SpatialHash;
  SAM.GirderAnnotationIterator = GirderAnnotationIterator;
})();
