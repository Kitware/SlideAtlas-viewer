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

  var GirderArrowIterator = function (parent, viewer, itemId, classes, annotating, type) {
    // when iterating, only show the current rect.
    this.HighlightedRect = new SAM.Rect();
    this.HighlightedRect.OutlineColor = [1, 1, 0];
    this.IterationType = type;

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
      this.LoadItemArrows(itemId, annotating, this.ArrowLayer);
    }

    this.Viewer = viewer;
    this.ActiveClassIndex = 0;
    this.ItemId = itemId;
    this.CreateClasses(classes);

    // Combined key click action.
    this.ActionState = KEY_UP;

    this.InitializeGui(parent, 'GirderArrowIterator');

    // Mode: stepping through ( and processing events).
    this.IteratorIndex = -1;

    // active class is highlighted in the gui.
    // It is the class used for clicks
    this.SetActiveClassIndex(0);
  };

  // Since we have to make forwarding methods, just use the layer as a helper object.
  GirderArrowIterator.prototype.EventuallyDraw = function () {
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
  GirderArrowIterator.prototype.GetView = function () {
    return this.Layer.GetView();
  };
  GirderArrowIterator.prototype.GetCamera = function () {
    return this.Layer.GetCamera();
  };
  GirderArrowIterator.prototype.Remove = function () {
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
  GirderArrowIterator.prototype.UpdateSize = function () {
    this.Layer.UpdateSize();
    if (this.ArrowLayer) {
      this.ArrowLayer.UpdateSize();
    }
  };

  GirderArrowIterator.prototype.CreateClasses = function (classNames) {
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

  GirderArrowIterator.prototype.RequestAnnotationFromName = function (classObj) {
    if (!window.girder) {
      window.alert('Could not find girder client');
      return;
    }
    var self = this;
    girder.rest.restRequest({
      path: 'annotation?itemId=' + this.ItemId + '&name=' + classObj.label + '&limit=1',
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
          path: 'annotation?itemId=' + self.ItemId,
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

  GirderArrowIterator.prototype.RequestAnnotationFromId = function (classObj) {
    if (!window.girder) {
      window.alert('Could not find girder client');
      return;
    }
    var self = this;
    girder.rest.restRequest({
      path: 'annotation/' + classObj.annotation_id,
      method: 'GET',
      contentType: 'application/json'
    }).done(function (data) {
      self.LoadAnnotation(data, classObj);
    });
  };

  // TODO: Share this code (to parse girder data) with girderWidget.
  GirderArrowIterator.prototype.LoadAnnotation = function (data, classObj) {
    // Used for saving the annotation back to girder.
    classObj.annotation = data.annotation;

    // Keep a separate array for iteration.  It is not rendered directly, right now.
    // It is only used to focus the viewer on a region.
    classObj.iterationArray = [];

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

      if (element.type === this.IterationType) {
        if (element.type === 'rectangle') {
          var center = [element.center[0], element.center[1]];
          var rect = {
            width: element.width,
            height: element.height,
            center: center,
            orientation: element.rotation};
          classObj.iterationArray.push(rect);
        } else if (element.type === 'arrow') {
          var pt0 = element.points[0];
          var pt1 = element.points[1];
          var dy = pt1[1] - pt0[1];
          pt1 = [pt1[0], pt0[1] - dy];
          var dx = pt1[0] - pt0[0];
          dy = pt1[1] - pt0[1];
          var length = Math.sqrt(dx * dx + dy * dy);
          var orientation = Math.atan2(-dy, dx);
          center = [(pt0[0] + pt1[0]) / 2, (pt0[1] + pt1[1]) / 2];
          rect = {width: length, height: length, center: center, orientation: orientation};
          classObj.iterationArray.push(rect);
        }
      }

      // Not sure if we will need this in the future.
      // Right now, it is rendered before iteration.
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

  // Returns true if it was a valid class index.
  GirderArrowIterator.prototype.SetActiveClassIndex = function (idx) {
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

  // TODO: Clean this up.  Probably put the widgets in the layer.
  GirderArrowIterator.prototype.Draw = function () {
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

  GirderArrowIterator.prototype.HandleMouseDown = function (event) {
    if (this.ArrowLayer) {
      return this.ArrowLayer.HandleMouseDown(event);
    }
    return true;
  };

  GirderArrowIterator.prototype.HandleMouseUp = function (event) {
    if (this.ArrowLayer) {
      return this.ArrowLayer.HandleMouseUp(event);
    }
    return true;
  };

  GirderArrowIterator.prototype.HandleMouseClick = function (event) {
    // We even give inactive layers a chance to claim the selection.
    // It is a way to find which group a mark belongs to.
    var selectedWidget = this.ArrowLayer.SingleSelect(event, false);
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
  GirderArrowIterator.prototype.HandleMouseMove = function (event) {
    if (this.ArrowLayer) {
      return this.ArrowLayer.HandleMouseMove(event);
    }
    return true;
  };

  // Make the annotation larger and smaller with the mouse wheel.
  // TODO: Remove this legacy function
  GirderArrowIterator.prototype.HandleMouseWheel = function (event) {
    return true;
  };

  // Stepping through the detection sequence.
  // -1 is none
  GirderArrowIterator.prototype.SetIteratorIndex = function (idx) {
    // Highlight the current
    this.SetHighlightedRect(this.IteratorClass, idx);
    this.IteratorIndex = idx;
    if (idx === -1) {
      this.IteratorClass = undefined;
    }
    // Animate to put this rec in the middle of the view.
    this.UpdateActiveView();
  };

  // Put the "current" rectangle at the location of the iteration.
  GirderArrowIterator.prototype.SetHighlightedRect = function (classObj, idx) {
    if (idx < 0) {
      this.HighlightedRect.Visibility = false;
      return;
    }

    var element = classObj.iterationArray[idx];

    this.HighlightedRect.Visibility = true;
    this.HighlightedRect.Width = element.width;
    this.HighlightedRect.Height = element.height;
    this.HighlightedRect.Orientation = element.orientation * 180 / Math.PI;
    this.HighlightedRect.Origin = [element.center[0], element.center[1]];
    this.HighlightedRect.UpdateBuffers();

    this.EventuallyDraw();
  };

  GirderArrowIterator.prototype.HandleKeyDown = function (event) {
    if (this.IteratorClass) {
      return false;
    }
    if (this.ArrowLayer) {
      return this.ArrowLayer.HandleMouseUp(event);
    }
    return true;
  };

  GirderArrowIterator.prototype.HandleKeyUp = function (event) {
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
  GirderArrowIterator.prototype.UpdateActiveView = function () {
    var idx = this.IteratorIndex;
    if (idx < 0) {
      var selectedClass = this.Classes[this.ActiveClassIndex];
      this.ActiveLabel.text(selectedClass.label);
      return;
    }

    if (this.IteratorClass === undefined ||
        this.IteratorClass.iterationArray === undefined) {
      return true;
    }
    var iterationArray = this.IteratorClass.iterationArray;
    var rect = iterationArray[idx];

    // Change the index / confidence label.
    this.ActiveLabel.text(idx.toString() + ' of ' +
                          iterationArray.length.toString() + ', ');

    var viewer = this.Viewer;
    // viewer.ZoomTarget = this.Layer.GetCamera().GetHeight();
    // Radians
    var oldRoll = viewer.GetCamera().GetWorldRoll();
    // Put the plane nose up.
    var newRoll = rect.orientation + (Math.PI / 2);
    // Find the shortest path
    while (newRoll - oldRoll > Math.PI) {
      newRoll -= 2 * Math.PI;
    }
    while (oldRoll - newRoll > Math.PI) {
      newRoll += 2 * Math.PI;
    }
    viewer.RollTarget = newRoll;
    viewer.TranslateTarget = [rect.center[0], rect.center[1]];
    viewer.AnimateLast = new Date().getTime();
    viewer.AnimateDuration = 200.0;
    viewer.EventuallyRender(true);
  };

  GirderArrowIterator.prototype.HandleArrowFinished = function (widget) {
    this.ArrowWidget = undefined;
  };

  GirderArrowIterator.prototype.StartArrow = function (widget) {
    if (this.SelectedWidget) {
      this.SelectedWidget.SetActive(false);
      this.SelectedWidget.SetSelected(false);
    }
    var self = this;
    if (!this.ArrowWidget) {
      this.ArrowWidget = new SAM.ArrowWidget(this.ArrowLayer);
      this.ArrowWidget.SetColor('#00ff0f');
      this.ArrowWidget.Arrow.Width = 1.5;
      this.ArrowLayer.AddWidget(this.ArrowWidget);
      this.ArrowWidget.SetStateToDrawing();
      this.ArrowWidget.SetStateChangeCallback(
        function (widget) { self.HandleArrowFinished(widget); });
    }
  };

  GirderArrowIterator.prototype.LoadItemArrows = function (itemId, name, layer) {
    var self = this;
    girder.rest.restRequest({
      path: 'annotation?itemId=' + itemId + '&name=' + name + '&limit=1',
      method: 'GET'
    }).done(function (data) {
      if (data.length > 0) {
        // The annotation exists.  Reuest it.
        self.ArrowAnnotationId = data[0]['_id'];
        girder.rest.restRequest({
          path: 'annotation/' + self.ArrowAnnotationId,
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
          path: 'annotation?itemId=' + itemId,
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
  GirderArrowIterator.prototype.LoadAnnotationArrows = function (data, classObj) {
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
  GirderArrowIterator.prototype.ChangeCurrent = function (direction) {
    if (this.IteratorClass.iterationArray === undefined) {
      return true;
    }
    var length = this.IteratorClass.iterationArray.length;
    var index = this.IteratorIndex;
    // var rect = this.IteratorClass.iterationArray[index];

    // loop to skip rects below the threshold
    index += direction;
    if (index < 0 || index >= length) {
      this.Stop();
      return;
    }
    if (this.ArrowMode) {
      this.StartArrow();
    }
    this.SetIteratorIndex(index);
  };

  GirderArrowIterator.prototype.HandleClick = function (event) {
    return true;
  };

  // Initialize the gui / dom
  GirderArrowIterator.prototype.InitializeGui = function (parent, label) {
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

  GirderArrowIterator.prototype.MakeClassButton = function (classContainer, index) {
    var self = this;
    var classObj = this.Classes[index];
    classObj.gui = $('<div>')
            .appendTo(classContainer)
            .text((index).toString() + ': ' + classObj.label)
            .css({'color': classObj.color})
            .click(function () { self.SetActiveClassIndex(index); });
  };

  GirderArrowIterator.prototype.Stop = function () {
    this.SetIteratorIndex(-1);
    this.InteractorClass = undefined;
    this.StartStopButton
      .text('Start')
      .css({'background-color': '#5F5'})
      .prop('title', 'Start sorting detections');
  };

  // Start iterating over the selected class.
  GirderArrowIterator.prototype.Start = function () {
    this.Viewer.Focus();
    // zoom in
    var viewer = this.Viewer;
    viewer.ZoomTarget = 500;
    this.IteratorClass = this.Classes[this.ActiveClassIndex];
    if (this.IteratorClass.iterationArray.length < 1) {
      window.alert('No annotations in ' + this.IteratorClass.label);
      this.IteratorClass = undefined;
      return;
    }
    this.SetIteratorIndex(0);
    this.StartStopButton
      .text('Stop')
      .css({'background-color': '#F55'})
      .prop('title', 'Stop sorting detections');

    if (this.ArrowMode) {
      this.StartArrow();
    }
  };

  // Stop iterating.
  GirderArrowIterator.prototype.StartStop = function () {
    if (this.IteratorClass) {
      // Currently interating: Stop action
      this.Stop();
    } else {
      // Not interating yet:  Start action
      this.Start();
    }
  };

  GirderArrowIterator.prototype.Save = function () {
    if (this.ArrowAnnotation === undefined) {
      return;
    }
    // Save arrows in the database
    var annotation = this.ArrowAnnotation;
    annotation.elements = this.ArrowLayerToGirderElements(this.ArrowLayer);
    SA.PushProgress();
    girder.rest.restRequest({
      path: 'annotation/' + this.ArrowAnnotationId,
      method: 'PUT',
      data: JSON.stringify(annotation),
      contentType: 'application/json'
    }).done(function () { SA.PopProgress(); });
  };

  // returns an elements array.
  GirderArrowIterator.prototype.ArrowLayerToGirderElements = function (layer) {
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

  // Now we are always active.  We have interaction state === ITERATING to
  // indicate cycling through annotations one by one.
  GirderArrowIterator.prototype.SetActive = function (active) {
    if (active === this.Active) {
      return;
    }
    this.Active = active;
    this.EventuallyDraw();
  };

  GirderArrowIterator.prototype.SetCursorColor = function (element, color) {
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

  SAM.GirderArrowIterator = GirderArrowIterator;
})();
