// ==============================================================================
// Temporary drawing with a pencil.  It goes away as soon as the camera changes.
// pencil icon (image as html) follows the cursor.
// Middle mouse button (or properties menu item) drops pencil.
// maybe option in properties menu to save the drawing permanently.

// Merging lasso interactor style is with pencil.
// Differences. The previous stroke does not deselect when a new stroke is started/
// When a stroke ends,  A method is called to see if it can be merged with the selected stroke.

(function () {
  // Depends on the CIRCLE widget
  'use strict';

  // Not receiving events. Nothing selected. Just drawing.
  var INACTIVE = 0;

  // Various states for drawing.
  // Pencil up and pencil down.
  var DRAWING_UP = 2;
  var DRAWING_DOWN = 3;
  
  var OPEN = 0;
  var CLOSED = 1;

  function PencilWidget (layer) {
    this.Layer = layer;
    

    this.State = INACTIVE;
      
    // This method gets called if anything is added, deleted or moved.
    this.ModifiedCallback = undefined;
    // This method gets called if the active state of this widget turns on or off.
    // This is used to turn off the pencil button in the Panel.
    this.StateChangeCallback = undefined;
    // This is used by the annotationPanel to transfer draing mode to a new selected widget.
    this.SelectedCallback = undefined;

    this.Type = 'pencil';
    // True when this widget is dedicated to the apple pencil.
    this.StylusOnly = false;

    var self = this;

    this.LineWidth = 0;
    this.Mode = OPEN;
    this.Color = '#00c';
    this.LoadDefaults();
    
    this.Shapes = new SAM.ShapeGroup();
  }

  PencilWidget.prototype.LoadDefaults = function () {
    if (localStorage.PencilWidgetDefaults) {
      var defaults = JSON.parse(localStorage.PencilWidgetDefaults);
      if (defaults.Color) {
        this.Color = defaults.Color;
      }
      if (defaults.LineWidth !== undefined) {
        this.LineWidth = defaults.LineWidth;
      }
      if (defaults.Mode !== undefined) {
        if (defaults.Mode === "open") {
          this.Mode = OPEN;
        } else {
          this.Mode = CLOSED;
        }
      }
    }
  };
  
  PencilWidget.prototype.InitializeDialog = function () {
    this.Dialog = new SAM.Dialog(this.Layer.GetParent().parent());
    var self = this;
    this.Dialog.SetApplyCallback(function () { self.DialogApplyCallback(); });
    // Customize dialog for a pencil.
    this.Dialog.Title.text('Pencil Annotation Editor');
    this.Dialog.Body.css({'margin': '1em 2em'});
    // Color
    this.Dialog.ColorDiv =
      $('<div>')
      .appendTo(this.Dialog.Body)
      .css({'display': 'table-row'});
    this.Dialog.ColorLabel =
      $('<div>')
      .appendTo(this.Dialog.ColorDiv)
      .text('Color:')
      .css({'display': 'table-cell',
            'text-align': 'left'});
    this.Dialog.ColorInput =
      $('<input type="color">')
      .appendTo(this.Dialog.ColorDiv)
      .val(this.Color)
      .css({'display': 'table-cell'});

    // Line Width
    this.Dialog.LineWidthDiv =
      $('<div>')
      .appendTo(this.Dialog.Body)
      .css({'display': 'table-row'});
    this.Dialog.LineWidthLabel =
      $('<div>')
      .appendTo(this.Dialog.LineWidthDiv)
      .text('Line Width:')
      .css({'display': 'table-cell',
            'text-align': 'left'});
    this.Dialog.LineWidthInput =
      $('<input type="number">')
      .appendTo(this.Dialog.LineWidthDiv)
      .val(this.LineWidth)
      .css({'display': 'table-cell'})
      .keypress(function (event) { return event.keyCode !== 13; });
  };
  
  PencilWidget.prototype.SetModifiedCallback = function (callback) {
    this.ModifiedCallback = callback;
  };

  PencilWidget.prototype.SetSelectedCallback = function (callback) {
    this.SelectedCallback = callback;
  };

  // This callback gets called when ever the active state changes,
  // even if caused by an external call. This widget is passed as a argument.
  // This is used to turn off the pencil button in the Panel.
  PencilWidget.prototype.SetStateChangeCallback = function (callback) {
    this.StateChangeCallback = callback;
  };

  // Called when the state changes.
  PencilWidget.prototype.StateChanged = function () {
    if (this.StateChangeCallback) {
      this.StateChangeCallback(this);
    }
  };

  // Called when the state changes.
  PencilWidget.prototype.SelectionChanged = function () {
    if (this.SelectedCallback) {
      (this.SelectedCallback)(this);
    }
  };

  // Can we delete this?
  PencilWidget.prototype.IsEmpty = function () {
    for (var i = 0; i < this.Shapes.GetNumberOfShapes(); ++i) {
      var shape = this.Shapes.GetShape(i);
      if (!shape.IsEmpty()) {
        return false;
      }
    }
    return true;
  };

  // TODO: CLean this up.
  PencilWidget.prototype.SetModeToOpen = function () {
    // For new strokes
    this.Mode = OPEN;
    // For old selected strokes.
    for (var i = 0; i < this.Shapes.GetNumberOfShapes(); ++i) {
      var stroke = this.Shapes.GetShape(i);
      if (stroke.IsSelected()) {
        if (stroke.Closed === true && this.ModifiedCallback()) {
          (this.ModifiedCallback)(this);
        }
        stroke.Closed = false;
        stroke.UpdateBuffers(this.Layer.AnnotationView);
        stroke.Modified()
      }
    }
    this.SaveDefaults();    
  };
  PencilWidget.prototype.SetModeToClosed = function () {
    // Used for future strokes.
    this.Mode = CLOSED;
    // For old selected strokes.
    for (var i = 0; i < this.Shapes.GetNumberOfShapes(); ++i) {
      var stroke = this.Shapes.GetShape(i);
      if (stroke.IsSelected()) {
        if (stroke.Closed === false && this.ModifiedCallback) {
          (this.ModifiedCallback)(this);
        }
        stroke.Closed = true;
        stroke.UpdateBuffers(this.Layer.AnnotationView);
        stroke.Modified();
      }
    }
    this.SaveDefaults();    
  };
  PencilWidget.prototype.IsModeClosed = function () {
    return this.Mode === CLOSED;
  }

  // Not used yet, but might be useful.
  PencilWidget.prototype.SetCreationCamera = function (cam) {
    // Lets save the zoom level (sort of).
    // Load will overwrite this for existing annotations.
    // This will allow us to expand annotations into notes.
    this.CreationCamera = cam.Serialize();
  };

  PencilWidget.prototype.GetActive = function () {
    return this.State !== INACTIVE;
  };

  PencilWidget.prototype.SetActive = function (flag) {
    if (flag && this.State === INACTIVE) {
      this.State = DRAWING_UP;
      this.StateChanged();
    }
    if (!flag &&  this.State !== INACTIVE) {
      this.State = INACTIVE;
      this.StateChanged();
    }
    // TODO: Fix: Single select must be setting the state to inactive without calling this method.
    // Cursor was not changing back.
    if (!flag) {
      this.Layer.GetParent().css({'cursor': ''});
    }
  };

  PencilWidget.prototype.IsStateDrawingDown = function () {
    return this.State === DRAWING_DOWN;
  };
  
  PencilWidget.prototype.SetStateToDrawing = function () {
    if (this.State === DRAWING_UP || this.State === DRAWING_DOWN) {
      return;
    }

    this.State = DRAWING_UP;
    this.StateChanged();

    if (!this.StylusOnly) {
      // Do not use the icon for the apple pencil
      this.Layer.GetParent().css(
        {'cursor': 'url(' + SAM.ImagePathUrl + 'Pencil-icon.png) 0 24,crosshair'});
    }
    this.Layer.EventuallyDraw();
  };

  PencilWidget.prototype.Draw = function () {
    this.Shapes.Draw(this.Layer.GetView());
  };

  PencilWidget.prototype.Serialize = function () {
    var obj = {};
    obj.type = 'pencil';
    obj.shapes = [];
    // Hacky way to include closed flags.
    obj.closedFlags = [];
    for (var i = 0; i < this.Shapes.GetNumberOfShapes(); ++i) {
      // NOTE: Assumes shape is a Polyline.
      var shape = this.Shapes.GetShape(i);
      var points = [];
      for (var j = 0; j < shape.Points.length; ++j) {
        points.push([shape.Points[j][0], shape.Points[j][1]]);
      }
      obj.shapes.push(points);
      obj.closedFlags.push(shape.Closed);
      obj.outlinecolor = shape.OutlineColor;
      obj.linewidth = shape.LineWidth;
    }
    obj.creation_camera = this.CreationCamera;

    return obj;
  };

  // Load a widget from a json object (origin MongoDB).
  PencilWidget.prototype.Load = function (obj) {
    this.LineWidth = parseFloat(obj.linewidth);
    if (obj.linewidth !== undefined) {
      this.LineWidth = parseFloat(obj.linewidth);
    }

    // Shapes use [1,1,1] instead of hex color.
    
    var outlineColor = this.Color;
    if (obj.outlinecolor) {
      outlineColor = SAM.ConvertColorToHex(obj.outlinecolor);
      this.Color = outlineColor;
    }
    for (var n = 0; n < obj.shapes.length; n++) {
      var points = obj.shapes[n];
      var shape = new SAM.Polyline();
      if (obj.closedFlags) {
        shape.Closed = obj.closedFlags[n];
        if (shape.Closed) {
          this.Mode = CLOSED;
        } else {
          this.Mode = OPEN;
        }
      }
      shape.SetOutlineColor(outlineColor);
      shape.FixedSize = false;
      shape.LineWidth = this.LineWidth;
      if (this.Mode === CLOSED) {
        shape.Closed = true;
      }
      this.Shapes.AddShape(shape);
      for (var m = 0; m < points.length; ++m) {
        shape.Points[m] = [points[m][0], points[m][1]];
      }
    }

    // How zoomed in was the view when the annotation was created.
    if (obj.view_height !== undefined) {
      this.CreationCamera = obj.creation_camera;
    }
  };

  // Returns true if something was deleted.
  PencilWidget.prototype.DeleteSelected = function () {
    // Delete all the selected strokes.
    if (this.Shapes.DeleteSelected()) {
      if (this.ModifiedCallback) {
        (this.ModifiedCallback)(this);
      }
      return true;
    }
    return false;
  };

  PencilWidget.prototype.HandleKeyDown = function () {
    if (this.State === INACTIVE) {
      return true;
    }
    if (this.StylusOnly) {
      // I am not sure why the apple pencil needs this.
      return true;
    }
    if (this.State === DRAWING_UP || this.State === DRAWING_DOWN) {
      // escape key (or space or enter) to turn off drawing
      if (event.keyCode === 27 || event.keyCode === 32 || event.keyCode === 13) {
        this.SetActive(false);
        return false;
      }
    }
    return true;
  };

  /*
  PencilWidget.prototype.HandleDoubleClick = function () {
    if (this.State === DRAWING_UP || this.State === DRAWING_DOWN) {
      this.SetActive(false);
      return false;
    }
    if (this.State === SELECTED) {
      this.SetStateToDrawing();
      return false;
    }
    return true;
  };
  */

  PencilWidget.prototype.SetStateToDrawingDown = function (x, y) {
    if (this.State === DRAWING_DOWN) {
      return;
    }

    if (this.State !== DRAWING_UP) {
      // Consider DRAWIN_UP and DRAWING_DOWN as a single state.
      this.StateChanged();
    }

    this.State = DRAWING_DOWN;
    // Open: Unselect the last stroke.
    // Closed:  Keep the last selected because the two might be merged.
    if (this.Mode === OPEN) {
      var numStrokes = this.Shapes.GetNumberOfShapes();
      if (numStrokes > 0) {
        // Trying out cut feature
        //this.Shapes.SetSelectedChild(numStrokes - 1, false);
      }
    }
    // Start a new stroke
    var shape = new SAM.Polyline();
    // Select the current stroke.
    shape.SetSelected(true);
    // Leave the new stroke open unti we stop.
    if (!this.Dialog) {
      this.InitializeDialog();
    }
    shape.SetOutlineColor(this.Color);
    shape.FixedSize = false;
    shape.LineWidth = this.LineWidth;
    // Leave stroke open until it is finished.
    shape.Closed = false;
    this.Shapes.AddShape(shape);

    var pt = this.Layer.GetCamera().ConvertPointViewerToWorld(x, y);
    shape.Points.push([pt[0], pt[1]]); // avoid same reference.
  };

  // Returns the selected stroke or undefined.
  PencilWidget.prototype.SingleSelect = function () {
    // Check to see if a stroke was clicked.
    var x = this.Layer.MouseX;
    var y = this.Layer.MouseY;
    var pt = this.Layer.GetCamera().ConvertPointViewerToWorld(x, y);

    var width = this.Shapes.GetLineWidth();
    // Tolerance: 5 screen pixels.
    var minWidth = 20.0 / this.Layer.GetPixelsPerUnit();
    if (width < minWidth) { width = minWidth; }

    var selectedShape = this.Shapes.SingleSelect(pt, width);
    if (selectedShape) {
      // Change the widget mode to match the selected stroke.
      if (selectedShape.Closed) {
        this.Mode = CLOSED;
      } else {
        this.Mode = OPEN;
      }
      // I do not this this is used anymore.
      this.SelectionChanged();
      return selectedShape;
    }

    return;
  };

  PencilWidget.prototype.HandleMouseDown = function () {
    if (this.State === INACTIVE) {
      return true;
    }
    if (this.StylusOnly) {
      // IPads do not have mice, so this is probably unecessary.
      return true;
    }

    var x = this.Layer.MouseX;
    var y = this.Layer.MouseY;

    // Anticipate dragging (might instead be a click or double click)
    var cam = this.Layer.GetCamera();
    this.LastMouse = cam.ConvertPointViewerToWorld(x, y);

    // if (event.which === 3) {
    //  // Right mouse was pressed.
    //  // Pop up the properties dialog.
    //  if (this.State === ACTIVE) {
    //    this.ShowPropertiesDialog();
    //  } else if (this.State === DRAWING_DOWN || this.State === DRAWING_UP) {
    //    // Undo a stroke
    //    if (this.Shapes.GetNumberOfShapes() > 1) {
    //      this.Shapes.PopShape();
    //      this.Layer.EventuallyDraw();
    //   }
    //  }
    //  return false;
    // }

    return false;
  };

  PencilWidget.prototype.HandleTouchStart = function () {
    if (this.State === INACTIVE) {
      return true;
    }
    if (this.StylusOnly && !this.Layer.Event.pencil) {
      // This allows viewer interaction with touches on the ipad pro..
      return true;
    }

    if (this.Layer.Touches.length !== 1) {
      // We pass one multiple touches
      return true;
    }

    if (this.State === DRAWING_UP) {
      var x = this.Layer.Touches[0][0];
      var y = this.Layer.Touches[0][1];
      this.SetStateToDrawingDown(x, y);
    }
    return false;
  };

  PencilWidget.prototype.HandleStop = function () {
    // A stroke has just been finished.
    var last = this.Shapes.GetNumberOfShapes() - 1;

    if (this.State === DRAWING_DOWN && last >= 0) {
      var spacing = this.Layer.GetCamera().GetSpacing();
      // NOTE: This assume that the shapes are polylines.
      var stroke = this.Shapes.GetShape(last);
      stroke.Decimate(spacing * 0.5);
      stroke.Closed = this.Mode === CLOSED;
      if (stroke.length <= 1) {
        stroke.Points.pop();
        return false;
      }
      if (this.ModifiedCallback) {
        (this.ModifiedCallback)(this);
      }
      // Do not trigger a state change event on drawing up/down transistions.
      this.State = DRAWING_UP;

      // When closed,  the interation is like a lasso.  The last
      // Can be merged with the selected stroke (if they overlap).
      if (this.Mode === CLOSED) {
        this.HandleLassoMerge();
      } else {
        // use intersecting stroke to cut a line.
        this.HandleOpenCut();
      }
    }
    return false;
  };

  PencilWidget.prototype.HandleMouseUp = function () {
    if (this.State === INACTIVE) {
      return true;
    }
    if (this.StylusOnly) {
      // IPads do not have mice, so this is probably unecessary.
      return true;
    }
    // Middle mouse deactivates the widget.
    var event = this.Layer.Event;
    if (event.which === 2) {
      // Middle mouse was pressed.
      this.SetActive(false);
      return false;
    }

    return this.HandleStop();
  };

  PencilWidget.prototype.HandleTouchEnd = function () {
    if (this.StylusOnly && !this.Layer.Event.pencil) {
      // The apple pencil needs to ignore viewer touch events.
      return true;
    }
    if (this.State !== DRAWING_DOWN) {
      return true;
    }
    return this.HandleStop();
  };

  PencilWidget.prototype.HandleMove = function (x, y) {
    if (this.State === DRAWING_UP) {
      this.SetStateToDrawingDown(x, y);
    }

    if (this.State === DRAWING_DOWN) {
      var last = this.Shapes.GetNumberOfShapes() - 1;
      var shape = this.Shapes.GetShape(last);
      var pt = this.Layer.GetCamera().ConvertPointViewerToWorld(x, y);
      shape.Points.push([pt[0], pt[1]]); // avoid same reference.
      shape.Modified();
      this.Layer.EventuallyDraw();
      return false;
    }

    return true;
  };

  PencilWidget.prototype.Modified = function () {
    this.Shapes.Modified();
  };

  PencilWidget.prototype.HandleMouseMove = function () {
    if (this.State === INACTIVE) {
      return true;
    }
    if (this.StylusOnly) {
      // IPads do not have mice, so this is probably unecessary.
      return true;
    }
    var event = this.Layer.Event;
    var x = this.Layer.MouseX;
    var y = this.Layer.MouseY;

    if (event.which === 1) {
      if (this.HandleMove(x, y) === false) {
        return false;
      }
    }

    return false;
  };

  PencilWidget.prototype.HandleTouchMove = function () {
    if (this.State === INACTIVE) {
      return true;
    }
    if (this.StylusOnly && !this.Layer.Event.pencil) {
      // The apple pencil needs to ignore viewer touch events.
      return true;
    }
    if (this.Layer.Touches.length !== 1) {
      return true;
    }

    var x = this.Layer.Touches[0][0];
    var y = this.Layer.Touches[0][1];

    this.HandleMove(x, y);
    return false;
  };

  // Selects or unselects all strokes.
  // Returns true if any selection changed.
  PencilWidget.prototype.SetSelected = function (flag) {
    var ret = this.Shapes.SetSelected(flag);
  
    if (flag) {
      this.SelectionChanged();
    }
    if (!flag) {
      // We can be selected without being active, but we cannot be
      // active without being selected.
      this.SetActive(false);
    }
    
    return ret;
  };

  // Returns true if any strokes are selected.
  PencilWidget.prototype.IsSelected = function () {
    return this.Shapes.IsSelected();
  };

  // Selects all strokes that match the selection
  // TODO: Check all the points in the stroke after the rough bounds check.
  PencilWidget.prototype.ApplySelect = function (selection) {
    var selected = false;
    for (var idx = 0; idx < this.Shapes.GetNumberOfShapes(); ++idx) {
      var shape = this.Shapes.GetShape(idx);
      // first check the bounds (xmin,xmax,ymin,ymax].
      var bds = shape.GetBounds();
      if (selection.WorldPointInSelection(bds[0], bds[2]) &&
          selection.WorldPointInSelection(bds[0], bds[3]) &&
          selection.WorldPointInSelection(bds[1], bds[2]) &&
          selection.WorldPointInSelection(bds[1], bds[3])) {
        // Good enough for now
        shape.SetSelected(true);
        selected = true;
      } else {
        shape.SetSelected(false);
      }
    }
    return selected;;
  };

  // Can we bind the dialog apply callback to an objects method?
  PencilWidget.prototype.ShowPropertiesDialog = function () {
    if (!this.Dialog) {
      this.InitializeDialog();
    }
    this.Dialog.ColorInput.val(this.Color);
    this.Dialog.LineWidthInput.val(this.LineWidth.toFixed(2));

    this.Dialog.Show(true);
  };

  PencilWidget.prototype.DialogApplyCallback = function () {
    this.Color = this.Dialog.ColorInput.val();
    this.LineWidth = parseFloat(this.Dialog.LineWidthInput.val());
    this.Shapes.SetOutlineColor(this.Color);
    this.Shapes.SetLineWidth(parseFloat(this.Dialog.LineWidthInput.val()));
    this.Shapes.UpdateBuffers(this.Layer.AnnotationView);
    this.SetSelected(false);
    if (window.SA) { SA.RecordState(); }
    this.Layer.EventuallyDraw();
    if (this.ModifiedCallback) {
      (this.ModifiedCallback)(this);
    }
    this.SaveDefaults();
  };

  PencilWidget.prototype.SaveDefaults = function () {
    var hexcolor = this.Color;
    var mode = "open";
    if (this.Mode === CLOSED) {
      mode = 'closed';
    }
    localStorage.PencilWidgetDefaults = JSON.stringify(
      {Color: hexcolor,
       LineWidth: this.LineWidth,
       Mode: mode 
      });
  };

  // ====================================================================
  // Lasso merge logic.

  // See if we can merge the last stroke with the selected stroke.
  PencilWidget.prototype.HandleLassoMerge = function () {
    var lastIdx = this.Shapes.GetNumberOfShapes() - 1;
    // This is the one just drawn.
    var stroke2 = this.Shapes.GetShape(lastIdx);
    // Find the selected stroke.
    var found = false;
    for (var stroke1Idx = 0; stroke1Idx < lastIdx; ++stroke1Idx) {
      var stroke1 = this.Shapes.GetShape(stroke1Idx);
      if (stroke1.IsSelected()) {
        found = true;
        break;
      }
    }
    if (!found) {
      // We could not find a second stroke.
      // Just close the last stroke and return.
      stroke2.Closed = true;
      stroke2.UpdateBuffers(this.Layer.AnnotationView);
      this.Layer.EventuallyDraw();
      console.log("first stroke not found");
      return;
    }

    // Now see if they overlap.
    if (this.CombineStrokes(stroke1, stroke2)) {
      console.log("stroke merged");
      // The last stroke has been merged.  Remove it.
      this.Shapes.DeleteChild(lastIdx);
      // Leave the other stroke selected.
      stroke1.UpdateBuffers(this.Layer.AnnotationView);
    } else {
      console.log("no intersection");
      // no intersection.  Keep them both, but leave the new one selected.
      stroke1.SetSelected(false);
      if (this.Mode === CLOSED) {
        stroke2.Closed = true;
      }
      stroke2.UpdateBuffers(this.Layer.AnnotationView);
    }
    this.Layer.EventuallyDraw();
  };

  // Loop is the old, stroke is the new.
  // returns true if merged, false if not.;
  PencilWidget.prototype.CombineStrokes = function (polyLineLoop, polyLineStroke) {
    var loop = polyLineLoop.Points;
    var stroke = polyLineStroke.Points;

    // This algorithm was desinged to have the first point be the same as the last point.
    // To generalize polylineWidgets and lassoWidgets, I changed this and put a closed
    // flag (which implicitely draws the last segment) in polyline.
    // It is easier to temporarily add the extra point and them remove it, than change the algorithm.
    loop.push(loop[0]);

    // Find the first and last intersection points between stroke and loop.
    var intersection0;
    var intersection1;
    for (var i = 1; i < stroke.length; ++i) {
      var pt0 = stroke[i - 1];
      var pt1 = stroke[i];
      var intersections = this.FindSegmentLoopIntersections(pt0, pt1, loop);
      // We are looking for the first and last interestions: so sort.
      intersections.sort(function(a, b){return a.k - b.k});
      for (var j = 0; j < intersections.length; ++j) {
        var intersection = intersections[j];
        if (intersections.length > 0) {
          if (intersection0 === undefined) {
            intersection0 = intersection;
            intersection0.StrokeIdx0 = i-1;
            intersection0.StrokeIdx1 = i;
          } else {
            intersection1 = intersection;
            intersection1.StrokeIdx0 = i-1;
            intersection1.StrokeIdx1 = i;
          }
        }
      }
    }
    
    // If we have two intersections, clip the loop with the stroke.
    if (intersection1 === undefined) {
      // Get rid of that extra duplicated point we added.
      loop.pop();
      return false;
    }

    // Crop the stroke and add the two new intersection points to the front and end.
    var croppedStroke = [intersection0.Point];
    croppedStroke = croppedStroke.concat(stroke.slice(intersection0.StrokeIdx1,
                                                      intersection1.StrokeIdx1));
    croppedStroke.push(intersection1.Point);
      
    // Do we need to reverse the cropped stroke?
    var reverseCroppedStroke = true;

    // Crop the loop into two parts.
    // Build both loops keeing track of their lengths.
    // Keep the longer part.
    var tmp;
    if (intersection1.LoopIdx1 < intersection0.LoopIdx1) {
      tmp = intersection0;
      intersection0 = intersection1;
      intersection1 = tmp;
      reverseCroppedStroke = !reverseCroppedStroke;
    }
    // The middle part.
    var croppedLoop = loop.slice(intersection0.LoopIdx1, intersection1.LoopIdx1);
    // The second part is the combination of the end and start pieces.
    tmp = loop.slice(intersection1.LoopIdx1);
    // Get rid of that extra duplicated point we added.
    tmp.pop();
    // Now add the start piece to the end piece. (it is a loop).
    tmp = tmp.concat(loop.slice(0, intersection0.LoopIdx1));
    if (this.ComputeStrokeLength(tmp) > this.ComputeStrokeLength(croppedLoop)) {
      // If we keep the second part because it is longer, we have to reverse the stroke.
      croppedLoop = tmp;
      reverseCroppedStroke = !reverseCroppedStroke;
    }
    if (reverseCroppedStroke) {
      croppedStroke.reverse();
    }
    polyLineLoop.Points = croppedLoop.concat(croppedStroke);
    
    return true;
  };

  PencilWidget.prototype.ComputeStrokeLength = function (stroke) {
    if (stroke.length === 0) {
      return 0;
    }
    var pt0 = stroke[0];
    var pt1, x, y;
    var length = 0;
    for (var i = 1; i < stroke.length; ++i) {
      pt1 = stroke[i];
      x = pt1[0] - pt0[0];
      y = pt1[1] - pt0[1];
      length += Math.sqrt(x * x + y * y);
    }
    return length;
  };
  
  // Returns all te points that a loop intersects with a single stroke segment.
  // transform all points so p0 is origin and p1 maps to (1,0)
  // Returns an empty array if no intersection,
  // It returns an array of intersections [{Point: newPt, LoopIndex: i}, ...] .
  // (sorted starting with the ones closest to p0).
  // It does not change the loop.
  PencilWidget.prototype.FindSegmentLoopIntersections = function (p0, p1, loop) {
    var intersections = [];
    var p = [(p1[0] - p0[0]), (p1[1] - p0[1])];
    var mag = Math.sqrt(p[0] * p[0] + p[1] * p[1]);
    if (mag <= 0.0) {
      return [];
    }
    p[0] = p[0] / mag;
    p[1] = p[1] / mag;

    var m0 = loop[0];
    var n0 = [(m0[0] - p0[0]) / mag, (m0[1] - p0[1]) / mag];
    var k0 = [(n0[0] * p[0] + n0[1] * p[1]), (n0[1] * p[0] - n0[0] * p[1])];

    for (var i = 1; i < loop.length; ++i) {
      var m1 = loop[i];
      // Avoid an infinite loop inserting points.
      if (p0 === m0 || p0 === m1) {
        continue;
      }
      var n1 = [(m1[0] - p0[0]) / mag, (m1[1] - p0[1]) / mag];
      var k1 = [(n1[0] * p[0] + n1[1] * p[1]), (n1[1] * p[0] - n1[0] * p[1])];
      if ((k1[1] >= 0.0 && k0[1] <= 0.0) || (k1[1] <= 0.0 && k0[1] >= 0.0)) {
        var k = k0[1] / (k0[1] - k1[1]);
        var x = k0[0] + k * (k1[0] - k0[0]);
        if (x > 0 && x <= 1) {
          var newPt = [(m0[0] + k * (m1[0] - m0[0])), (m0[1] + k * (m1[1] - m0[1]))];
          intersections.push({Point: newPt, LoopIdx0: i-1, LoopIdx1: i, k: x});
        }
      }
      m0 = m1;
      n0 = n1;
      k0 = k1;
    }

    return intersections;
  };

  // This is not actually needed!  So it is not used.
  PencilWidget.prototype.IsPointInsideLoop = function (x, y, loop) {
    // Sum up angles.  Inside poitns will sum to 2pi, outside will sum to 0.
    var angle = 0.0;
    var pt0 = loop[loop.length - 1];
    for (var i = 0; i < loop.length; ++i) {
      var pt1 = loop[i];
      var v0 = [pt0[0] - x, pt0[1] - y];
      var v1 = [pt1[0] - x, pt1[1] - y];
      var mag0 = Math.sqrt(v0[0] * v0[0] + v0[1] * v0[1]);
      var mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
      angle += Math.arcsin((v0[0] * v1[1] - v0[1] * v1[0]) / (mag0 * mag1));
    }
    return (angle > 3.14 || angle < -3.14);
  };

  // --------------------------------------------------------------------------------
  // Stuff for eraser.

  // Left turn.
  // Returns "undefined" if zero length segment.
  PencilWidget.prototype.ComputeSegmentNormal = function (pt0, pt1) {
    var dx = pt1[0] - pt0[0];
    var dy = pt1[1] - pt0[1];
    var mag = Math.sqrt(dx * dx + dy * dy);
    if (mag === 0) {
      return;
    }
    return [-dy/mag, dx/mag];
  };

  // We need a fat line. Handle one segment at a time.
  // Output is an loop (array of points) around a thick line with rounded ends.
  // The first and last points are the same.
  PencilWidget.prototype.SegmentToLoop = function (pt1, pt2, radius) {
    var divisions = 8;
    loop = [];
    // Compute a normal to the line segment.
    var n = this.ComputeSegmentNormal(pt1, pt2);
    if (!n) {
      n = [0,1];
      loop.concat(this.EndCap(pt1, n, radius, divisions));
      // Do not duplicate the point in the middle of the circle.
      loop.pop();
      loop.concat(this.EndCap(pt1, n, -radius, divisions));
      return loop;
    }
    loop.concat(this.EndCap(pt1, n, radius, divisions));
    loop.concat(this.EndCap(pt2, n, -radius, divisions));
    return loop;
  };

  // I did not finish this method.
  /*
  // We need a fat line. 
  // Output is an loop (array of points) around a thick line with rounded ends.
  // The first and last points of the output are the same.
  PencilWidget.prototype.StrokeToLoop = function (polyLineStroke, radius) {
    var stroke = polyLineStroke.Points;
    if (stroke.length === 0) {
      return;
    }
    
    // Compute normals for every segment in the loop.
    // (and get rid of 0 length segments).
    var normals = []; // One fewer normals than points.
    var pt0 = stroke[0];
    var points = [pt0]; // Only keep the non zero length segments.    
    for (var i = 1; i < stroke.length; ++i) {
      var pt1 = points[i];
      n = this.ComputeSegmentNormal(pt0, pt1);
      if (n) {
        points.push(pt1);
        normals.push(n);
        pt0 = pt1;
      }
    }

    
    
    pt0 = points[0];
    // First the endcap.
    var loop = this.EndCap(points[0], nommals[0], radius, divisions);
    // Grow both ends of the loop as we add segments?  Maybe

    //  .... Just compute all points niavely and then check inside/ outside of circle box set.
    //  .... Will have to compute partial segments.
    pt1 = points[1];




    
    var divisions = 8;
    var dTheata = Math.PI / divisions;
    
  

    

    // Compute a normal to the line segment.
    var n = [pt2[0] - pt1[0], pt2[1] - pt1[1]];
    var mag = Math.sqrt(n[0] * n[0] + n[1] * n[1]);
    if (mag === 0.0) {
      n = [0,1];
      loop.concat(this.EndCap(pt1, n, radius, divisions));
      // Do not duplicate the point in the middle of the circle.
      loop.pop();
      loop.concat(this.EndCap(pt1, n, -radius, divisions));
      return loop;
    }
    loop.concat(this.EndCap(pt1, n, radius, divisions));
    loop.concat(this.EndCap(pt2, n, -radius, divisions));
    return loop;
  };
  */
  
  // Return half a circle.
  PencilWidget.prototype.EndCap = function (center, n, radius, divisions) {
    points = [];
    for (var i = 0; i <= divisions; ++i) {
      var theta = Math.PI * i / divisions;
      var c = Math.cos(theta);
      var s = Math.sin(theta);
      // Rotate
      var x = center[0] + radius * (c * n[0] - s * n[1]);
      var y = center[1] + radius * (c * n[1] + s * n[0]);
      points.push([x, y]);
    }
    return points;
  };

  // Loop is the old, stroke is the new eraser stroke.
  // returns true if merged, false if not.;
  PencilWidget.prototype.CombineEraserStroke = function (polyLineLoop, polyLineStroke) {
    var loop = polyLineLoop.Points;
    var stroke = polyLineStroke.Points;

    // This algorithm was desinged to have the first point be the same as the last point.
    // To generalize polylineWidgets and lassoWidgets, I changed this and put a closed
    // flag (which implicitely draws the last segment) in polyline.
    // It is easier to temporarily add the extra point and them remove it, than change the algorithm.
    loop.push(loop[0]);

    // TODO: Fix this.  I got in an infinite loop.
    // Inserting points it the array we are iterating over.
    // Find the first and last intersection points between stroke and loop.
    var intersection0;
    var intersection1;
    for (var i = 1; i < stroke.length; ++i) {
      var pt0 = stroke[i - 1];
      var pt1 = stroke[i];
      var intersections = this.FindSegmentLoopIntersections(pt0, pt1, loop);
      // We are looking for the first and last interestions: so sort.
      intersections.sort(function(a, b){return a.k - b.k});
      if (intersections.length > 0) {
        if (intersection0 === undefined) {
          intersection0 = intersections[0];
          intersection0.StrokeIdx0 = i-1;
          intersection0.StrokeIdx1 = i;
        } else {
          var last = intersections.length - 1;
          intersection1 = intersections[last];
          intersection1.StrokeIdx0 = i-1;
          intersection1.StrokeIdx1 = i;
        }
      }
    }
    
    // If we have two intersections, clip the loop with the stroke.
    if (intersection1 === undefined) {
      // Get rid of that extra duplicated point we added.
      loop.pop();
      return false;
    }

    // Crop the stroke and add the two new intersection points to the front and end.
    var croppedStroke = [intersection0.Point];
    croppedStroke = croppedStroke.concat(stroke.slice(intersection0.StrokeIdx1,
                                                      intersection1.StrokeIdx1));
    croppedStroke.push(intersection1.Point);
      
    // Do we need to reverse the cropped stroke?
    var reverseCroppedStroke = true;

    // Crop the loop into two parts.
    // Build both loops keeing track of their lengths.
    // Keep the longer part.
    var tmp;
    if (intersection1.LoopIdx1 < intersection0.LoopIdx1) {
      tmp = intersection0;
      intersection0 = intersection1;
      intersection1 = tmp;
      reverseCroppedStroke = !reverseCroppedStroke;
    }
    // The middle part.
    var croppedLoop = loop.slice(intersection0.LoopIdx1, intersection1.LoopIdx1);
    // The second part is the combination of the end and start pieces.
    tmp = loop.slice(intersection1.LoopIdx1);
    // Get rid of that extra duplicated point we added.
    tmp.pop();
    // Now add the start piece to the end piece. (it is a loop).
    tmp = tmp.concat(loop.slice(0, intersection0.LoopIdx1));
    if (this.ComputeStrokeLength(tmp) > this.ComputeStrokeLength(croppedLoop)) {
      // If we keep the second part because it is longer, we have to reverse the stroke.
      croppedLoop = tmp;
      reverseCroppedStroke = !reverseCroppedStroke;
    }
    if (reverseCroppedStroke) {
      croppedStroke.reverse();
    }
    polyLineLoop.Points = croppedLoop.concat(croppedStroke);
    
    return true;
  };

  // ====================================================================
  // opne cut logic

  //  If stroke crosses selected line, cut it.
  PencilWidget.prototype.HandleOpenCut = function () {
    var lastIdx = this.Shapes.GetNumberOfShapes() - 1;
    // This is the one just drawn.
    var stroke2 = this.Shapes.GetShape(lastIdx);
    // Find the selected stroke.
    var found = false;
    for (var stroke1Idx = 0; stroke1Idx < lastIdx; ++stroke1Idx) {
      var stroke1 = this.Shapes.GetShape(stroke1Idx);
      if (stroke1.IsSelected()) {
        found = true;
        break;
      }
    }
    if (!found) {
      // We could not find a second stroke.
      return;
    }

    // Now see if they overlap.
    for (var i = 1; i < stroke1.Points.length; ++i) {
      var pt0 = stroke1.Points[i - 1];
      var pt1 = stroke1.Points[i];
      var intersections = this.FindSegmentLoopIntersections(pt0, pt1, stroke2.Points);
      if (intersections.length > 0) {
        // Cut the line here.
        stroke2.Points = stroke1.Points.slice(i);
        stroke2.UpdateBuffers(this.Layer.AnnotationView);
        stroke1.Points = stroke1.Points.slice(0,i);
        stroke1.UpdateBuffers(this.Layer.AnnotationView);
        this.Layer.EventuallyDraw();
        this.SelectionChanged();
        return;
      }
    }
    stroke1.SetSelected(false);
    this.Layer.EventuallyDraw();
    this.SelectionChanged();
  };
  
  SAM.PencilWidget = PencilWidget;
})();
