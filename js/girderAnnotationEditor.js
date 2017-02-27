// ==============================================================================
// Collection widget, No serialize or load.
// Manage 3 annotation sets,  detection, positives (ground truth) and false positives.
// Sort the detections into the positive annotations.
// These will be stored in three different rect sets.
// Create my own layer.

// We might make this a widget (and forward methods like draw) so we can
// handle mouse events.

(function () {
  'use strict';

  // action states
  var KEY_UP = 0;
  var KEY_DOWN = 1;
  var KEY_USED_ADVANCE = 2;
  var KEY_USED_NO_ADVANCE = 3;

  function GirderAnnotationEditor (parent, layer, itemId, classes) {
    this.ActiveClassIndex = 0;
    this.Layer = layer;
    this.ItemId = itemId;
    this.CreateClasses(classes);

    // Combined key click action.
    this.ActionState = KEY_UP;

    this.InitializeGui(parent, 'GirderAnnotationEditor');

    this.Layer.AddWidget(this);
    // Mode: stepping through ( and processing events).
    this.IteratorIndex = -1;
    // Hover selection
    this.HighlightedRect = {widget: undefined, idx: -1};

    // active class is highlighted in the gui.
    // It is the class used for clicks
    this.SetActiveClassIndex(0);
  }

  GirderAnnotationEditor.prototype.CreateClasses = function (classNames) {
    var numClasses = classNames.length;
    this.Classes = [];
    for (var i = 0; i < numClasses; ++i) {
      var classObj = {label: classNames[i],
                      index:i};
      this.Classes.push(classObj);
      // assign colors to the labels
      // detections will be yellow
      // Detection class is yellow.
      if (i === 0) {
        classObj.color = '#FFFF00';
      } else if (i === 1) { // Second (false positive) is red
        classObj.color = '#FF0000';
      } else if (i == 2) { // last (true positive) is green
        classObj.color = '#00FF00';
      } else {
        // the rest will range from purple to cyan
        var k = (i - 3) / (numClasses - 4);
        this.Classes[i].color = SAM.ConvertColorToHex([k, 1 - k, 1]);
      }
      this.RequestAnnotationFromName(classObj);
    }
  };

  GirderAnnotationEditor.prototype.RequestAnnotationFromName = function (classObj) {
    if (!window.girder) {
      window.alert("Could not find girder client");
      return;
    }
    var self = this;
    girder.rest.restRequest({
      path: 'annotation?itemId='+this.ItemId+'&name='+classObj.label+'&limit=1',
      method: 'GET'
    }).done(function (data) {
      if (data.length > 0) {
        // The annotation exists.  Reuest it.
        classObj.annotation_id = data[0]['_id'];
        self.RequestAnnotationFromId(classObj);
      } else {
        // Annotation does not exist yet.  Make it.
        var annot = {'elements': [],
                     'annot.name':  classObj.label};
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

  GirderAnnotationEditor.prototype.RequestAnnotationFromId = function (classObj) {
    if (!window.girder) {
      window.alert("Could not find girder client");
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
  GirderAnnotationEditor.prototype.LoadAnnotation = function (data, classObj) {
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
    var bds = this.Layer.GetViewer().GetOverViewBounds();
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
    this.Layer.EventuallyDraw();
  };

  // Use the last size, or one from the active widgets.
  // Limit by sensible sizes for the viewer.
  GirderAnnotationEditor.prototype.GetSquareSize = function () {
    //if (localStorage.GirderAnnotationEditorDefaults) {
    //  var defaults = JSON.parse(localStorage.GirderAnnotationEditorDefaults);
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
    var cam = this.Layer.GetCamera();
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
  GirderAnnotationEditor.prototype.SetActiveClassIndex = function (idx) {
    if (idx < 0 || idx >= this.Classes.length) {
      return false;
    }
    this.Classes[this.ActiveClassIndex].gui
            .css({'background-color': '#FFF'});
    this.ActiveClassIndex = idx;
    this.Classes[idx].gui
            .css({'background-color': '#DEF'});
    this.SetCursorColor(this.Layer.GetCanvasDiv(), this.Classes[idx].color);
    if (!this.IteratorClass) {
      var selectedClass = this.Classes[idx];
      this.ActiveLabel.text(selectedClass.label);
    }
    return false;
  };

  GirderAnnotationEditor.prototype.GetActive = function () {
    // return this.IteratorIndex > -1;
    return true;
  };

  GirderAnnotationEditor.prototype.Draw = function (view) {
    for (var i = 0; i < this.Classes.length; ++i) {
      if (this.Classes[i].widget) {
        this.Classes[i].widget.Draw(view);
      }
    }
  };

  // Highlight on hover.
  GirderAnnotationEditor.prototype.HandleMouseMove = function (event) {
    if (event.which !== 0) { return true; }
    var confThresh = this.GetConfidenceThreshold();
    var cam = this.Layer.GetCamera();
    var pt = cam.ConvertPointViewerToWorld(event.offsetX, event.offsetY);
    var best;
    for (var i = 0; i < this.Classes.length; ++i) {
      if (this.Classes[i].widget) {
        var tmp = this.Classes[i].widget.Hash.Get(pt, confThresh);
        if (tmp) {
          if (!best || tmp.dist < best.dist) {
            tmp.classObj = this.Classes[i];
            best = tmp;
          }
        }
      }
    }

    if (best) {
      this.SetHighlightedRect(best.classObj, best.index);
    } else {
      this.SetHighlightedRect({}, -1);
    }

    return true;
  };

  // Make the annotation larger and smaller with the mouse wheel.
  GirderAnnotationEditor.prototype.HandleMouseWheel = function (event) {
    var rectIdx = this.HighlightedRect.idx;
    if (rectIdx == -1) {
      return true;
    }

    // A rectangle is highlighted
    var rectWidget = this.HighlightedRect.widget;
    var rectSet = rectWidget.Shape;

    // We want to accumulate the target, but not the duration.
    var tmp = 0;
    if (event.deltaY) {
      tmp = event.deltaY;
    } else if (event.wheelDelta) {
      tmp = event.wheelDelta;
    }
    // Wheel event seems to be in increments of 3.
    // depreciated mousewheel had increments of 120....
    // Initial delta cause another bug.
    // Lets restrict to one zoom step per event.
    if (tmp > 0) {
      rectSet.Widths[rectIdx] /= 0.9;
      rectSet.Heights[rectIdx] /= 0.9;
      this.SquareSize = rectSet.Heights[rectIdx];
    } else if (tmp < 0) {
      rectSet.Widths[rectIdx] *= 0.9;
      rectSet.Heights[rectIdx] *= 0.9;
      this.SquareSize = rectSet.Heights[rectIdx];
    }
    // Ignore rebuilding the hash for now.
    this.Layer.EventuallyDraw();
    return false;
  };

  // Stepping through the detection sequence.
  // -1 is none
  GirderAnnotationEditor.prototype.SetIteratorIndex = function (idx) {
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
  GirderAnnotationEditor.prototype.SetHighlightedRect = function (classObj, idx) {
    var widget = classObj.widget;
    // No change,  just return.
    if (this.HighlightedRect && this.HighlightedRect.idx === idx && this.HighlightedRect.widget === widget) {
      return;
    }

    // Remove the highlight from the previous.
    if (this.HighlightedRect.idx > -1) {
      this.HighlightedRect.widget.Shape.ActiveIndex = -1;
      this.HighlightedRect.idx = -1;
    }

    if (this.IteratorClass && idx === -1) {
      // Unset => go back to the default current rect.
      widget = this.IteratorClass.widget;
      idx = this.IteratorIndex;
    }

    if (idx > -1) {
      // Add the new highlight.
      widget.Shape.ActiveIndex = idx;
      this.HighlightedRect = {widget: widget, idx: idx};
      // A selected rect has to respond to keys that change its label.
      this.Layer.GetViewer().Focus();
    }
    this.Layer.EventuallyDraw();
  };

  // Actions are taken on key up.  Key down sets up a modifier in case a
  // mouse click is handled before the keyup.  This is only necesary when
  // iterating.  Mouse click changes the class label and advances.  The
  // keydown determines the label.
  GirderAnnotationEditor.prototype.HandleKeyDown = function (event) {
    var rectIdx = this.HighlightedRect.idx;
    var rectSet;
    if (rectIdx > -1) {
      // A rectangle is highlighted
      var rectWidget = this.HighlightedRect.widget;
      rectSet = rectWidget.Shape;
      // Up and down arrows make the annotation large and smaller.
      // Ignore rebuilding the hash for now.
      if (event.keyCode === 38) { // Up arrow
        // Just keep the viewew from processing the mouse down.
        // Our action is on mouse up.
        return false;
      }
      if (event.keyCode === 40) { // Down arrow
        // Just keep the viewew from processing the mouse down.
        // Our action is on mouse up.
        return false;
      }
    }
    // This state keeps mouse up from advancing when key is down.
    if (this.IteratorClass) {
      if (this.ActionState !== KEY_UP) {
        return false;
      }
      if (event.keyCode > 48 && event.keyCode < 48 + this.Classes.length) {
        this.ActionState = KEY_DOWN;
      }
    }
    var valid = this.SetActiveClassIndex(event.keyCode - 48);
        // Keep the viewer from panning on the arrows when iterating.
    if (valid || this.IteratorClass) {
      return false;
    }

    // Let the viewer pan with arrows.
    return true;
  };

  GirderAnnotationEditor.prototype.HandleKeyUp = function (event) {
    var self = this;

    // Handle the complex decision to adavance or not.
    // If the key only modified a click, do not advance.
    if (this.IteratorClass) {
      // Mouse click (with key modifier) was used to add an annotation
      // outside the sequence and no advancement is necessary.
      if (this.ActionState === KEY_USED_NO_ADVANCE) {
        this.ActionState = KEY_UP;
        return false;
      }
      // Mouse click (with key modifier) was used to recenter an
      // annotation inside the sequences. We need to advance.
      if (this.ActionState === KEY_USED_ADVANCE) {
        // Just advance to the next
        setTimeout(function () { self.ChangeCurrent(1); }, 300);
        this.ActionState = KEY_UP;
        return false;
      }
      this.ActionState = KEY_UP;
      // Escape key stops iteration.
      if (event.keyCode === 27) { // escape
        this.Stop();
        return false;
      }
    }

    var rectIdx = this.HighlightedRect.idx;
    var rectSet;
    if (rectIdx > -1) {
      // A rectangle is highlighted
      var rectWidget = this.HighlightedRect.widget;
      rectSet = rectWidget.Shape;

      // Change the class of the highlighted rect.
      var classIdx = event.keyCode - 48;
      if (classIdx >= 0 && classIdx < this.Classes.length) {
        var classLabel = this.Classes[classIdx].label;
        // set a class label of a single detection
        rectSet.Labels[rectIdx] = classLabel;
        this.Layer.EventuallyDraw();
        // Automatically move to the next, to save clicks.
        if (this.IteratorClass &&
            rectWidget === this.IteratorClass.widget && rectIdx === this.IteratorIndex) {
          setTimeout(function () { self.ChangeCurrent(1); }, 300);
        }
        return false;
      }

      // Up and down arrows make the annotation large and smaller.
      // Ignore rebuilding the hash for now.
      if (event.keyCode === 38) { // Up arrow
        rectSet.Widths[rectIdx] /= 0.9;
        rectSet.Heights[rectIdx] /= 0.9;
        this.SquareSize = rectSet.Widths[rectIdx];
        this.Layer.EventuallyDraw();
        return false;
      }
      if (event.keyCode === 40) { // Down arrow
        rectSet.Widths[rectIdx] *= 0.9;
        rectSet.Heights[rectIdx] *= 0.9;
        this.SquareSize = rectSet.Widths[rectIdx];
        this.Layer.EventuallyDraw();
        return false;
      }

      // Delete applies to the selected / highlighted rect.
      if (event.keyCode === 46) { // Delete key
        // remove the rectangle
        rectSet.DeleteRectangle(rectIdx);
        // Rebuild the hash.
        // I could do this incrementally but I am lazy.
        var bds = this.Layer.GetViewer().GetOverViewBounds();
        rectWidget.Hash.Build(rectWidget.Shape, bds);
        // Deleted rect was in the detection set while iterating
        if (this.IteratorClass &&
            rectWidget === this.IteratorClass.widget) {
          // If we deleted a rect before the current, ...
          if (rectIdx < this.IteratorIndex) {
            this.SetIteratorIndex(this.IteratorIndex - 1);
          } else if (rectIdx === this.IteratorIndex) {
            // Animate to the next (rectIdx does not actually
            // change). Hack to find next under threshold
            this.IteratorIndex -= 1;
            // hack to get the next to highlight
            this.HighlightedRect.idx -= 1;
            setTimeout(function () { self.ChangeCurrent(1); }, 300);
          }
        }
        this.Layer.EventuallyDraw();
        return false;
      }
    }

    // Forward and backward.
    if (this.IteratorClass) {
      rectSet = this.IteratorClass.widget.Shape;
      var index = this.IteratorIndex;
      if (event.keyCode === 40) {
        // down cursor key
        // Move to the previous without a label
        while (index < rectSet.Widths.length) {
          if (rectSet.Labels[index] === 'detection') {
            this.SetIteratorIndex(index);
            return false;
          }
          index += 1;
        }
        // Got to end without finding one.
        this.Layer.DeactivateWidget(this);
        return false;
      } else if (event.keyCode === 37) {
        // Left cursor key
        this.ChangeCurrent(-1);
        return false;
      } else if (event.keyCode === 39) {
        // Right cursor key
        this.ChangeCurrent(1);
        return false;
      }
    }

    return true;
  };

  // Animate to the new current rect.
  GirderAnnotationEditor.prototype.UpdateActiveView = function () {
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

    var viewer = this.Layer.GetViewer();
    // viewer.ZoomTarget = this.Layer.GetCamera().GetHeight();
    viewer.RollTarget = this.Layer.GetCamera().Roll;
    viewer.TranslateTarget = rectSet.GetCenter(this.IteratorIndex);
    viewer.AnimateLast = new Date().getTime();
    viewer.AnimateDuration = 200.0;
    viewer.EventuallyRender(true);
  };

  // Forward = 1, backward = -1
  GirderAnnotationEditor.prototype.ChangeCurrent = function (direction) {
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
        this.SetIteratorIndex(index);
        return;
      }
    }
  };

  GirderAnnotationEditor.prototype.HandleClick = function (event) {
    if (event.which !== 1) {
      return true;
    }
    // Compute the new center
    var cam = this.Layer.GetCamera();
    var pt = cam.ConvertPointViewerToWorld(event.offsetX, event.offsetY);
    var classIdx = this.ActiveClassIndex;
    var classLabel = this.Classes[classIdx].label;
    var rectIdx = this.HighlightedRect.idx;
    var rectWidget = this.HighlightedRect.widget;
    var rectSet;
    var rectSize = this.GetSquareSize();

    // If the click is inside the current detection, reposition it.
    if (rectWidget) {
      rectSet = rectWidget.Shape;
      var c = rectSet.GetCenter(rectIdx);
      var dx = Math.abs(pt[0] - c[0]);
      var dy = Math.abs(pt[1] - c[1]);
      if (rectIdx > -1 && rectIdx < rectSet.GetLength() &&
                dx < rectSize / 2 && dy < rectSize / 2) {
        rectSet.Labels[rectIdx] = classLabel;
        rectSet.SetCenter(rectIdx, pt);
        // Assume 100% confidence when the user sets the class.
        rectSet.Confidences[rectIdx] = 1.0;
        this.Layer.EventuallyDraw();
        // Advance if user clicked on the one iterating rectangle
        if (this.IteratorClass &&
            rectWidget === this.IteratorClass.widget && rectIdx === this.IteratorIndex) {
          var self = this;
          // If a key is being used as amodified, stop advaning twice.
          // SHould we advance on the mouse up or key up?
          // Lets try mouse up.
          // work right
          if (this.ActionState === KEY_DOWN) {
            this.ActionState = KEY_USED_NO_ADVANCE;
          }
          setTimeout(function () { self.ChangeCurrent(1); }, 300);
        }
        return false;
      }
    }

    // Add a new annotation
    // Click defaults to the last class.
    if (classIdx >= 0 && classIdx < this.Classes.length) {
      rectWidget = this.Classes[classIdx].widget;
      rectSet = rectWidget.Shape;
      var rectIdx = rectSet.AddRectangle(pt, rectSize, rectSize);
      rectSet.Labels[rectIdx] = classLabel;
      // incrementally update the hash here.
      rectWidget.Hash.Add(pt, rectSize, rectSize, rectIdx);
      // Make the new rect active so it will resize with events.
      this.SetHighlightedRect(this.Classes[classIdx], rectIdx);
      this.Layer.EventuallyDraw();
      // Keep the key up (if a key is pressed) from advancing
      if (this.ActionState === KEY_DOWN) {
        this.ActionState = KEY_USED_NO_ADVANCE;
        return false;
      }
    }

    return false;
  };

  GirderAnnotationEditor.prototype.CheckActive = function (event) {
    // return this.GetActive();
    // Changing to alwasy acive so annotations can be changed and added
    // in the waiting state.
    return true;
  };

  // Initialize the gui / dom
  GirderAnnotationEditor.prototype.InitializeGui = function (parent, label) {
    var self = this;

    // The wrapper div that controls a single layer.
    var layerControl = $('<div>')
      .appendTo(parent)
      .css({
        'border': '1px solid #CCC',
        'width': '100%'
      });

    this.ActiveLabel = $('<div>')
      .appendTo(layerControl)
      .prop('title', 'Start sorting detections')
      .attr('contenteditable', 'false')
      .text('');

    var buttonContainer = $('<p>')
      .appendTo(layerControl);
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
      .appendTo(layerControl)
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
      .css({ 'float': 'right',
             'position': 'relative',
             'left': '-50%',
             'text-align': 'left'});
    $('<div>')
      .appendTo(confWrapper)
      .html('100%')
      .css({ 'float': 'right' });

    var classContainer = $('<p>')
      .appendTo(layerControl);
    for (var i = 0; i < this.Classes.length; ++i) {
      this.MakeClassButton(classContainer, i);
    }
  };

  GirderAnnotationEditor.prototype.MakeClassButton = function (classContainer, index) {
    var self = this;
    var classObj = this.Classes[index];
    classObj.gui = $('<div>')
            .appendTo(classContainer)
            .text((index).toString() + ': ' + classObj.label)
            .css({'color': classObj.color})
            .click(function () { self.SetActiveClassIndex(index); });
  };

  GirderAnnotationEditor.prototype.UpdateHash = function () {
    var bds = this.Layer.GetViewer().GetOverViewBounds();
    for (var i = 0; i < this.Classes.length; ++i) {
      var widget = this.Classes[i].widget;
      widget.Hash.Build(widget.Shape, bds);
    }
  };

  GirderAnnotationEditor.prototype.GetConfidenceThreshold = function () {
    return parseInt(this.Slider.val()) / 100.0;
  };

  // Confidence threshold slider.
  GirderAnnotationEditor.prototype.SliderCallback = function () {
    var visValue = this.GetConfidenceThreshold();
    for (var i = 0; i < this.Classes.length; ++i) {
      if (this.Classes[i].widget) {
        this.Classes[i].widget.SetThreshold(visValue);
      }
    }
    this.Layer.EventuallyDraw();
    // In case we are iterating and the curent becomes invisible.
    this.CheckIteratorVisibility();
  };

  GirderAnnotationEditor.prototype.CheckIteratorVisibility = function () {
    if ( ! this.IteratorClass || index < 0) {
      return;
    }
    // In case the first is not visible.
    var rectSet = this.IteratorClass.widget.Shape;
    var index = this.IteratorIndex;
    var confThresh = this.GetConfidenceThreshold();
    if (rectSet.Confidences[index] < confThresh) {
      this.ChangeCurrent(1);
    }
  };

  GirderAnnotationEditor.prototype.Stop = function () {
    this.SetIteratorIndex(-1);
    this.InteractorClass = undefined;
    this.StartStopButton
      .text('Start')
      .css({'background-color': '#5F5'})
      .prop('title', 'Start sorting detections');
  };

  // Start iterating over the selected class.
  GirderAnnotationEditor.prototype.Start = function () {
    this.Layer.GetViewer().Focus();
    // zoom in
    var viewer = this.Layer.GetViewer();
    viewer.ZoomTarget = 500;
    this.IteratorClass = this.Classes[this.ActiveClassIndex];
    if (this.IteratorClass.widget.Shape.GetLength() < 1) {
      window.alert("No annotations in " + this.IteratorClass.label);
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
  };

  // Stop iterating.
  GirderAnnotationEditor.prototype.StartStop = function () {
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
  GirderAnnotationEditor.prototype.SplitDetections = function () {
    // Build an object to make indexing classes easier.
    var shapes = {};
    for (var i = 0; i < this.Classes.length; ++i) {
      shapes[this.Classes[i].label] = this.Classes[i];
      // Create a new rectSet for each class.
      // Best way to deal with the shuffle.
      this.Classes[i].newRectSet = new SAM.RectSet();
      this.Classes[i].newRectSet.LabelColors = this.Classes[i].widget.Shape.LabelColors;
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

  GirderAnnotationEditor.prototype.Save = function () {
    this.SplitDetections();
    var annotation;

    if (window.girder) {
      // Save in the database
      for (var i = 0; i < this.Classes.length; ++i) {
        var widget = this.Classes[i].widget;
        annotation = this.Classes[i].annotation;
        annotation.elements = this.RectSetToGirderElements(widget);
        SA.PushProgress();
        girder.rest.restRequest({
          path: 'annotation/' + this.Classes[i].annotation_id,
          method: 'PUT',
          data: JSON.stringify(annotation),
          contentType: 'application/json'
        }).done(function () { SA.PopProgress(); });
      }
      this.Layer.EventuallyDraw();
    }
  };

  // Converts rectSetWidget into girder annotation elements.
  // returns an elements array.
  GirderAnnotationEditor.prototype.RectSetToGirderElements = function (rectSetWidget) {
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
  GirderAnnotationEditor.prototype.SetActive = function (active) {
    if (active === this.Active) {
      return;
    }
    this.Active = active;
    this.Layer.EventuallyDraw();
  };

  GirderAnnotationEditor.prototype.SetCursorColor = function (element, color) {
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

  SAM.GirderAnnotationEditor = GirderAnnotationEditor;

  // 2d
  // I am extending the annotations from simple points to rectangles with
  // different sizes.  Each item will be added to multiple bins.
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
    var x,y;
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

  // Returns the index of the best rect for the point selected..
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
      if (dx < w / 2 && dy < h / 2 && confThresh < conf) {
        var dist = Math.max(dx, dy);
        if (!best || dist <= best.dist) {
          best = {dist: dist,
                  index: rectIdx,
                  center: [cx, cy],
                  width: w,
                  height: h};
        }
      }
    }
    return best;
  };
})();

