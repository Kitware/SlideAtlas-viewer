// ==============================================================================
// This widget will first be setup to define an arrow.
// Layer will forward events to the arrow.
// TODO: Active hover: circles cursor.

(function () {
  'use strict';

  // The arrow has just been created and is following the mouse.
  // I have to differentiate from DRAG because
  // dragging while just created cannot be relative.  It places the tip on the mouse.
  var NEW = 0;
  var DRAG = 1; // The whole arrow is being dragged.
  var DRAG_TIP = 3;
  var DRAG_TAIL = 4;
  var INACTIVE = 5; // The normal (resting) state.
  var ACTIVE = 6; // Mouse is receiving events.
  var HOVER = 7;  // Mouse is over the widget
  var DIALOG = 8; // Properties dialog is up

  // We might get rid of the new flag by passing in a null layer.
  function ArrowWidget (layer) {
    if (layer === null) {
      return null;
    }
    this.Layer = layer;
    this.Type = 'arrow';
    this.State = INACTIVE;
    
    // This method gets called if the active state of this widget turns on or off.
    // This is used to turn off the pencil button in the Panel.
    this.StateChangeCallback = undefined;
    // This is used by the annotationPanel to transfer draing mode to a new selected widget.
    this.SelectedCallback = undefined;
    
    // Wait to create this until the first move event.
    this.Arrow = new SAM.Arrow();
    this.Arrow.Origin = [0, 0];
    this.Arrow.SetFillColor([0.0, 0.0, 0.0]);
    this.Arrow.OutlineColor = [1.0, 1.0, 1.0];
    this.Arrow.Length = 50;
    this.Arrow.Width = 8;
    // Note: If the user clicks before the mouse is in the
    // canvas, this will behave odd.
    this.TipPosition = [0, 0];
    this.TipOffset = [0, 0];

    // Circle is to show an active tip and base.
    this.CircleTip = new SAM.Circle();
    this.CircleTip.SetFillColor();
    this.CircleTip.SetOutlineColor([0.0, 0.0, 0.0]);
    this.CircleTip.Radius = 5;
    this.CircleTip.LineWidth = 1;
    this.CircleTip.PositionCoordinateSystem = 1; //Shape.VIEWER;
    //this.Circle.ZOffset = -0.05;

    this.CircleTail = new SAM.Circle();
    this.CircleTail.SetFillColor();
    this.CircleTail.SetOutlineColor([0.0, 0.0, 0.0]);
    this.CircleTail.Radius = 5;
    this.CircleTail.PositionCoordinateSystem = 1; //Shape.VIEWER;
  }

  // Not used yet, but might be useful.
  ArrowWidget.prototype.SetCreationCamera = function (cam) {
    // Lets save the zoom level (sort of).
    // Load will overwrite this for existing annotations.
    // This will allow us to expand annotations into notes.
    this.CreationCamera = cam.Serialize();
  };


  ArrowWidget.prototype.SetModifiedCallback = function (callback) {
    this.ModifiedCallback = callback;
  };

  // Called when the widget is modified.
  ArrowWidget.prototype.Modified = function () {
    if (this.ModifiedCallback) {
      this.ModifiedCallback(this);
    }
  };

  ArrowWidget.prototype.SetSelectedCallback = function (callback) {
    this.SelectedCallback = callback;
  };

  // This callback gets called when ever the active state changes,
  // even if caused by an external call. This widget is passed as a argument.
  // This is used to turn off the pencil button in the Panel.
  ArrowWidget.prototype.SetStateChangeCallback = function (callback) {
    this.StateChangeCallback = callback;
  };

  // Called when the state changes.
  ArrowWidget.prototype.StateChanged = function () {
    if (this.StateChangeCallback) {
      this.StateChangeCallback(this);
    }
  };

  // Sets state to "NEW"
  ArrowWidget.prototype.SetStateToDrawing = function () {
    //if (this.Layer) {
      //this.StateChanged();
      this.State = NEW;
      return;
    //}
    //this.State = INACTIVE;
  };

  ArrowWidget.prototype.GetActive = function () {
    if (this.State === INACTIVE) {
      return false;
    }
    return true;
  };

  ArrowWidget.prototype.SetActive = function (flag) {
    if (flag === this.GetActive()) {
      return;
    }

    if (flag) {
      this.State = ACTIVE;
    } else {
      this.State = INACTIVE;
    }
    this.StateChanged();
    this.Layer.EventuallyDraw();
  };

  ArrowWidget.prototype.Draw = function () {
    var view = this.Layer.GetView();
    this.Arrow.Draw(view);
    if (this.State !== INACTIVE) {
      var pts = this.GetViewPoints();
      this.CircleTip.Origin = pts[0]; 
      this.CircleTail.Origin = pts[1];
      this.CircleTip.Draw(view);
      this.CircleTail.Draw(view);
    }
  };

  ArrowWidget.prototype.Serialize = function () {
    if (this.Arrow === undefined) {
      return null;
    }

    var obj = {};
    obj.type = 'arrow';
    obj.origin = this.Arrow.Origin;
    obj.fillcolor = this.Arrow.FillColor;
    obj.outlinecolor = this.Arrow.OutlineColor;
    obj.length = this.Arrow.Length;
    obj.width = this.Arrow.Width;
    obj.orientation = this.Arrow.Orientation;
    obj.fixedsize = this.Arrow.FixedSize;
    obj.fixedorientation = this.Arrow.FixedOrientation;

    return obj;
  };

  // Load a widget from a json object (origin MongoDB).
  ArrowWidget.prototype.Load = function (obj) {
    this.Arrow.Origin = [parseFloat(obj.origin[0]), parseFloat(obj.origin[1])];
    this.TipPosition = [parseFloat(obj.origin[0]), parseFloat(obj.origin[1])];
    this.Arrow.FillColor = [parseFloat(obj.fillcolor[0]), parseFloat(obj.fillcolor[1]), parseFloat(obj.fillcolor[2])];
    this.Arrow.OutlineColor = [parseFloat(obj.outlinecolor[0]), parseFloat(obj.outlinecolor[1]), parseFloat(obj.outlinecolor[2])];
    this.Arrow.Length = parseFloat(obj.length);
    this.Arrow.Width = parseFloat(obj.width);
    this.Arrow.Orientation = parseFloat(obj.orientation);

    if (obj.fixedsize === undefined) {
      this.Arrow.FixedSize = true;
    } else {
      this.Arrow.FixedSize = (obj.fixedsize === 'true');
    }

    if (obj.fixedorientation === undefined) {
      this.Arrow.FixedOrientation = true;
    } else {
      this.Arrow.FixedOrientation = (obj.fixedorientation === 'true');
    }

    this.Arrow.UpdateBuffers(this.Layer.AnnotationView);
  };

  // When we toggle fixed size, we have to convert the length of the arrow
  // between viewer and world.
  ArrowWidget.prototype.SetFixedSize = function (fixedSizeFlag) {
    if (this.Arrow.FixedSize === fixedSizeFlag) {
      return;
    }
    var pixelsPerUnit = this.Layer.GetPixelsPerUnit();

    if (fixedSizeFlag) {
      // Convert length from world to viewer.
      this.Arrow.Length *= pixelsPerUnit;
      this.Arrow.Width *= pixelsPerUnit;
    } else {
      this.Arrow.Length /= pixelsPerUnit;
      this.Arrow.Width /= pixelsPerUnit;
    }
    this.Arrow.FixedSize = fixedSizeFlag;
    this.Arrow.UpdateBuffers(this.Layer.AnnotationView);
    this.Layer.EventuallyDraw();
  };

  // Selects the widget if the arrow is fuly contained in the selection rectangle.
  ArrowWidget.prototype.ApplySelect = function (selection) {
    var viewPts = this.GetViewPoints();
    if (selection.ViewerPointInSelection(viewPts[0][0], viewPts[0][1]) &&
        selection.ViewerPointInSelection(viewPts[1][0], viewPts[1][1])) {
      this.SetSelected(true);
      return true;
    }
    this.SetSelected(false);
    return false;
  };

  // Returns true if the mouse is over the arrow.
  ArrowWidget.prototype.SingleSelect = function () {
    if (this.State === DIALOG) {
      return;
    }
    var event = this.Layer.Event;
    var x = event.offsetX;
    var y = event.offsetY;
    var pts = this.GetViewPoints();
    x = x - pts[0][0];
    y = y - pts[0][1];
    if (this.Arrow.PointInShape(x,y)) {
      this.Arrow.Selected = true;
      return this;
    } else {
      this.Arrow.Selected = false;
      return;
    }
  };

  ArrowWidget.prototype.HandleMouseDown = function (layer) {
    if (this.State === INACTIVE) {
      return true;
    }
    var event = layer.Event;
    if (event.which !== 1) {
      return false;
    }
    if (this.State === NEW) {
      this.TipPosition = [this.Layer.MouseX, this.Layer.MouseY];
      this.State = DRAG_TAIL;
    }
    if (this.State === HOVER) {
      if (this.CircleTip.Selected) {
        this.State = DRAG_TIP;
      } else if (this.CircleTail.Selected) {
        this.State = DRAG_TAIL;
      } else {
        this.State = DRAG;
      }
      var x = event.offsetX;
      var y = event.offsetY;
      var cam = this.Layer.GetCamera();
      this.LastMouseWorld = cam.ConvertPointViewerToWorld(x, y);
    }
    return false;
  };

  ArrowWidget.prototype.HandleMouseUp = function (layer) {
    if (this.State === INACTIVE) {
      return true;
    }
    var event = layer.Event;
    if (this.State === ACTIVE && event.which === 3) {
      // Right mouse was pressed.
      // Pop up the properties dialog.
      // Which one should we popup?
      // Add a ShowProperties method to the widget. (With the magic of javascript).
      this.State = DIALOG;
      this.ShowPropertiesDialog();
    }
    this.State = HOVER;
    this.Modified();
    return false;
  };

  ArrowWidget.prototype.HandleMouseMove = function (layer) {
    if (this.State === INACTIVE) {
      return true;
    }
    var event = layer.Event;    
    var x = this.Layer.MouseX;
    var y = this.Layer.MouseY;

    // Hover logic.
    if (this.State === ACTIVE || this.State === HOVER) {
      var pts = this.GetViewPoints();
      var cursor = '';
      var tx = x - pts[0][0];
      var ty = y - pts[0][1];
      if (this.Arrow.IsSelected() && this.Arrow.PointInShape(tx, ty)) {
        cursor = 'move';
        this.State = HOVER;
      } else {
        this.State = ACTIVE;
      }
      this.Layer.GetParent().css({'cursor': cursor});
      // Now deal with control point hovering.
      var dx = x - this.CircleTip.Origin[0];
      var dy = y - this.CircleTip.Origin[1];
      if (dx * dx + dy * dy < Math.pow(this.CircleTip.Radius, 2)) {
        this.CircleTip.Selected = true;
        this.CircleTip.SetFillColor([1,1,0]);
      } else {
        this.CircleTip.Selected = false;
        this.CircleTip.SetFillColor();
      }
      var dx = x - this.CircleTail.Origin[0];
      var dy = y - this.CircleTail.Origin[1];
      if (dx * dx + dy * dy < Math.pow(this.CircleTail.Radius, 2)) {
        this.CircleTail.Selected = true;
        this.CircleTail.SetFillColor([1,1,0]);
      } else {
        this.CircleTail.Selected = false;
        this.CircleTail.SetFillColor();
      }
      this.Layer.EventuallyDraw();
      return false;
    }

    if (event.which != 1) {
      return false;
    }
    
    var cam = this.Layer.GetCamera();
    var mouseWorld = cam.ConvertPointViewerToWorld(x, y);
    if (this.State === NEW) {
      // Just have the tip follow the mouse.
      this.Arrow.Origin = mouseWorld;
    } else if (this.State === DRAG) {
      // Tip follows its relative position to the mouse.
      var dx = mouseWorld[0] - this.LastMouseWorld[0];
      var dy = mouseWorld[1] - this.LastMouseWorld[1];
      this.Arrow.Origin[0] += dx;
      this.Arrow.Origin[1] += dy;
    } else if (this.State === DRAG_TAIL) {
      // Tail follows mouse, but tip stays fixed.
      this.Arrow.SetTailViewer(x, y, cam);
      this.Arrow.UpdateBuffers(this.Layer.AnnotationView);
    } else if (this.State === DRAG_TIP) {
      // Tip follows mouse, but tail does not move.
      var tailViewer = this.Arrow.GetTailViewer(cam);
      this.Arrow.Origin = mouseWorld;
      this.Arrow.SetTailViewer(tailViewer[0], tailViewer[1], cam);
      this.Arrow.UpdateBuffers(this.Layer.AnnotationView);
    }
    this.LastMouseWorld = mouseWorld;
    this.Layer.EventuallyDraw();
    return false;
  };

  // Return points 1 and 2 in view (screen) coordinates.
  ArrowWidget.prototype.GetViewPoints = function () {
    var cam = this.Layer.GetCamera();
    var pt1 = this.Arrow.Origin;
    pt1 = cam.ConvertPointWorldToViewer(pt1[0], pt1[1]);
    
    var tmp = -this.Arrow.Orientation * Math.PI / 180.0;
    var dx = this.Arrow.Length * Math.cos(tmp);
    var dy = this.Arrow.Length * Math.sin(tmp);

    var pt2 = [pt1[0] + dx, pt1[1] + dy];

    console.log("arrow (" + pt1[0] + ", " + pt1[1] + "), (" + pt2[0] + ", " + pt2[1] + ")");
    return [pt1, pt2];
  };

  // TODO: Repurpose for dragging
  ArrowWidget.prototype.CheckActive = function () {
    var viewport = this.Layer.GetViewport();
    var cam = this.Layer.GetCamera();
    // TODO: Should not be accessing this without a getter.
    var m = cam.ImageMatrix;
    // Compute tip point in screen coordinates.
    var x = this.Arrow.Origin[0];
    var y = this.Arrow.Origin[1];
    // Convert from world coordinate to view (-1->1);
    var h = (x * m[3] + y * m[7] + m[15]);
    var xNew = (x * m[0] + y * m[4] + m[12]) / h;
    var yNew = (x * m[1] + y * m[5] + m[13]) / h;
    // Convert from view to screen pixel coordinates.
    xNew = (xNew + 1.0) * 0.5 * viewport[2] + viewport[0];
    yNew = (yNew + 1.0) * 0.5 * viewport[3] + viewport[1];
    yNew = viewport[3] - yNew
    
    console.log("origin: " + xNew + ", " + yNew + ", mouse: " + this.Layer.MouseX + ", " + this.Layer.MouseY)
    
    // Use this point as the origin.
    x = this.Layer.MouseX - xNew;
    y = this.Layer.MouseY - yNew;
    // Rotate so arrow lies along the x axis.
    var tmp = -this.Arrow.Orientation * Math.PI / 180.0;
    var ct = Math.cos(tmp);
    var st = Math.sin(tmp);
    xNew = x * ct + y * st;
    yNew = -x * st + y * ct;

    var length = this.Arrow.Length;
    var halfWidth = this.Arrow.Width / 2.0;
    if (!this.Arrow.FixedSize) {
      var pixelsPerUnit = this.Layer.GetPixelsPerUnit();
      length *= pixelsPerUnit;
      halfWidth *= pixelsPerUnit;
    }

    this.ActiveTail = false;
    if (xNew > 0.0 && xNew < length && yNew > -halfWidth && yNew < halfWidth) {
      this.SetActive(true);
      // Save the position along the arrow to decide which drag behavior to use.
      if (xNew > length - halfWidth) {
        this.ActiveTail = true;
      }
      return true;
    } else {
      this.SetActive(false);
      return false;
    }
  };

  // Returns true if selected
  // This is sort of ugly.  Change it to delete directly if possible.
  // Return value will let the layer clean up.
  ArrowWidget.prototype.DeleteSelected = function () {
    if (this.IsSelected()) {
      // layer will see this as an empty widget and delete it.
      this.Arrow.Length = 0;
      return true;
    }
    return false;
  };

  ArrowWidget.prototype.IsEmpty = function () {
    return this.Arrow.Length < this.Arrow.Width / 4;
  };
  
  // I am divorcing selected from active.
  ArrowWidget.prototype.IsSelected = function () {
    return this.Arrow.Selected;
  };

  ArrowWidget.prototype.SetSelected = function (flag) {
    this.Arrow.SetSelected(flag);
    if (flag && this.SelectedCallback) {
      (this.SelectedCallback)(this);
    }
    //if (!flag && this.State != INACTIVE) {
    //  this.State = INACTIVE;
    //  this.StateChanged();
    //}
  };
  
  // I need this because old schemes cannot use "Load"
  ArrowWidget.prototype.SetColor = function (hexColor) {
    this.Arrow.SetFillColor(hexColor);
    this.Layer.EventuallyDraw();
  };

  ArrowWidget.prototype.InitPropertiesDialog = function () {
    var self = this;
    this.Dialog = new SAM.Dialog(this.Layer.GetParent().parent());
    this.Dialog.SetApplyCallback(function () { self.DialogApplyCallback(); });
    // Customize dialog for a circle.
    this.Dialog.Title.text('Arrow Properties');
    this.Dialog.Body.css({'margin': '1em 2em'});
    // Color
    this.Dialog.ColorDiv =
            $('<div>')
            .css({'height': '24px'})
            .appendTo(this.Dialog.Body)
            .addClass('sa-view-annotation-modal-div');
    this.Dialog.ColorLabel =
            $('<div>')
            .appendTo(this.Dialog.ColorDiv)
            .text('Color:')
            .addClass('sa-view-annotation-modal-input-label');
    this.Dialog.ColorInput =
            $('<input type="color">')
            .appendTo(this.Dialog.ColorDiv)
            .val('#30ff00')
            .addClass('sa-view-annotation-modal-input');

    // Width
    this.Dialog.WidthDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .addClass('sa-view-annotation-modal-div');
    this.Dialog.WidthLabel =
            $('<div>')
            .appendTo(this.Dialog.WidthDiv)
            .text('Shaft Width:')
            .addClass('sa-view-annotation-modal-input-label');
    this.Dialog.WidthInput =
            $('<input type="number">')
            .appendTo(this.Dialog.WidthDiv)
            .addClass('sa-view-annotation-modal-input')
            .keypress(function (event) { return event.keyCode !== 13; });

    // Get default properties.
    if (localStorage.ArrowWidgetDefaults) {
      var defaults = JSON.parse(localStorage.ArrowWidgetDefaults);
      if (defaults.Color) {
        this.Dialog.ColorInput.val(SAM.ConvertColorToHex(defaults.Color));
      }
      if (defaults.Width) {
        this.Dialog.WidthInput.val(defaults.Width);
      }
    }
  };

  // Can we bind the dialog apply callback to an objects method?
  ArrowWidget.prototype.ShowPropertiesDialog = function () {
    if (this.Dialog === undefined) {
      this.InitPropertiesDialog();
    }
    this.WidgetPropertiesToDialog();
    var self = this;
    this.Dialog.SetApplyCallback(function () { self.DialogApplyCallback();});
    this.Dialog.SetCloseCallback(function () { self.DialogCloseCallback(); });
    this.Dialog.Show(true);
  };

  ArrowWidget.prototype.DialogApplyCallback = function () {
    // Transfer properties fromt he dialog GUI to the widget.
    this.DialogPropertiesToWidget();
    // View bindings kept the dialog text input from working.
    if (!this.Layer) {
      return;
    }
    this.SetActive(false);
    this.Layer.EventuallyDraw();
  };
    
  ArrowWidget.prototype.DialogCloseCallback = function () {
    this.SetActive(false);
    this.Layer.EventuallyDraw();
  };

  // Fill the dialog values from the widget values.
  ArrowWidget.prototype.WidgetPropertiesToDialog = function () {
    this.Dialog.ColorInput.val(SAM.ConvertColorToHex(this.Arrow.FillColor));
    this.Dialog.WidthInput.val((this.Arrow.Width).toFixed(2));
  };
 
  // Copy the properties of the dialog into the widget
  ArrowWidget.prototype.DialogPropertiesToWidget = function () {
    var modified = false;

    // Get the color
    var hexcolor = SAM.ConvertColorToHex(this.Dialog.ColorInput.val());
    if (hexcolor !== this.Arrow.FillColor) {
      modified = true;
      this.Arrow.SetFillColor(hexcolor);
      this.Arrow.ChooseOutlineColor();
      modified = true;
    }

    var width = parseFloat(this.Dialog.WidthInput.val());
    if (width !== this.Arrow.Width) {
      this.Arrow.Width = width;
      modified = true;
    }

    if (modified) {
      // Save values in local storage as defaults for next time.
      localStorage.ArrowWidgetDefaults = JSON.stringify({
        Color: hexcolor,
        Width: width});
      this.Modified();
      this.Arrow.UpdateBuffers(this.Layer.AnnotationView);
    }
  };  
  
  SAM.ArrowWidget = ArrowWidget;
})();
