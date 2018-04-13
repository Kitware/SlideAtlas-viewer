// ==============================================================================
// This widget will first be setup to define an arrow.
// Layer will forward events to the arrow.
// TODO: I need to indicate that the base of the arrow has different active
// state than the rest.

(function () {
  'use strict';

  // The arrow has just been created and is following the mouse.
  // I have to differentiate from DRAG because
  // dragging while just created cannot be relative.  It places the tip on the mouse.
  var NEW = 0;
  var DRAG = 1; // The whole arrow is being dragged.
  var DRAG_TAIL = 3;
  var INACTIVE = 4; // The normal (resting) state.
  var ACTIVE = 5; // Mouse is over the widget and it is receiving events.
  var PROPERTIES_DIALOG = 6; // Properties dialog is up

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
    this.Shape = new SAM.Arrow();
    this.Shape.Origin = [0, 0];
    this.Shape.SetFillColor([0.0, 0.0, 0.0]);
    this.Shape.OutlineColor = [1.0, 1.0, 1.0];
    this.Shape.Length = 50;
    this.Shape.Width = 8;
    // Note: If the user clicks before the mouse is in the
    // canvas, this will behave odd.
    this.TipPosition = [0, 0];
    this.TipOffset = [0, 0];
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

  ArrowWidget.prototype.GetActive = function () {
    return this.Shape.Selected;
  };

  // Sets state to "NEW"
  ArrowWidget.prototype.SetStateToDrawing = function () {
    if (this.Layer) {
      //this.StateChanged();
      this.State = NEW;
      return;
    }
    this.State = INACTIVE;
  };

  ArrowWidget.prototype.SetStateToInactive = function () {
    if (this.State === INACTIVE) {
      return;
    }
    this.StateChanged();
    this.State = INACTIVE;
  };

  ArrowWidget.prototype.Draw = function () {
    this.Shape.Draw(this.Layer.GetView());
  };

  ArrowWidget.prototype.Serialize = function () {
    if (this.Shape === undefined) {
      return null;
    }

    var obj = {};
    obj.type = 'arrow';
    obj.origin = this.Shape.Origin;
    obj.fillcolor = this.Shape.FillColor;
    obj.outlinecolor = this.Shape.OutlineColor;
    obj.length = this.Shape.Length;
    obj.width = this.Shape.Width;
    obj.orientation = this.Shape.Orientation;
    obj.fixedsize = this.Shape.FixedSize;
    obj.fixedorientation = this.Shape.FixedOrientation;

    return obj;
  };

  // Load a widget from a json object (origin MongoDB).
  ArrowWidget.prototype.Load = function (obj) {
    this.Shape.Origin = [parseFloat(obj.origin[0]), parseFloat(obj.origin[1])];
    this.TipPosition = [parseFloat(obj.origin[0]), parseFloat(obj.origin[1])];
    this.Shape.FillColor = [parseFloat(obj.fillcolor[0]), parseFloat(obj.fillcolor[1]), parseFloat(obj.fillcolor[2])];
    this.Shape.OutlineColor = [parseFloat(obj.outlinecolor[0]), parseFloat(obj.outlinecolor[1]), parseFloat(obj.outlinecolor[2])];
    this.Shape.Length = parseFloat(obj.length);
    this.Shape.Width = parseFloat(obj.width);
    this.Shape.Orientation = parseFloat(obj.orientation);

    if (obj.fixedsize === undefined) {
      this.Shape.FixedSize = true;
    } else {
      this.Shape.FixedSize = (obj.fixedsize === 'true');
    }

    if (obj.fixedorientation === undefined) {
      this.Shape.FixedOrientation = true;
    } else {
      this.Shape.FixedOrientation = (obj.fixedorientation === 'true');
    }

    this.Shape.UpdateBuffers(this.Layer.AnnotationView);
  };

  // When we toggle fixed size, we have to convert the length of the arrow
  // between viewer and world.
  ArrowWidget.prototype.SetFixedSize = function (fixedSizeFlag) {
    if (this.Shape.FixedSize === fixedSizeFlag) {
      return;
    }
    var pixelsPerUnit = this.Layer.GetPixelsPerUnit();

    if (fixedSizeFlag) {
      // Convert length from world to viewer.
      this.Shape.Length *= pixelsPerUnit;
      this.Shape.Width *= pixelsPerUnit;
    } else {
      this.Shape.Length /= pixelsPerUnit;
      this.Shape.Width /= pixelsPerUnit;
    }
    this.Shape.FixedSize = fixedSizeFlag;
    this.Shape.UpdateBuffers(this.Layer.AnnotationView);
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
  ArrowWidget.prototype.SetSelected = function (flag) {
    this.Shape.SetSelected(flag);
    if (flag && this.SelectedCallback) {
      (this.SelectedCallback)(this);
    }
    if (!flag && this.State != INACTIVE) {
      this.State = INACTIVE;
      this.StateChanged();
    }
  };
  
  // Returns true if the mouse is over the arrow.
  ArrowWidget.prototype.SingleSelect = function () {
    return this.CheckActive();
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
    if (this.State === ACTIVE) {
      var cam = this.Layer.GetCamera();
      if (this.ActiveTail) {
        this.TipPosition = cam.ConvertPointWorldToViewer(this.Shape.Origin[0], this.Shape.Origin[1]);
        this.State = DRAG_TAIL;
      } else {
        var tipPosition = cam.ConvertPointWorldToViewer(this.Shape.Origin[0], this.Shape.Origin[1]);
        this.TipOffset[0] = tipPosition[0] - this.Layer.MouseX;
        this.TipOffset[1] = tipPosition[1] - this.Layer.MouseY;
        this.State = DRAG;
      }
    }
    return false;
  };

  // returns false when it is finished doing its work.
  ArrowWidget.prototype.HandleMouseUp = function (layer) {
    if (this.State === INACTIVE) {
      return true;
    }
    if (this.State === DRAG_TAIL) {
      this.State = INACTIVE;
      this.StateChanged();
      this.Modified();
      return false;
    }
    var event = layer.Event;
    if (this.State === ACTIVE && event.which === 3) {
      // Right mouse was pressed.
      // Pop up the properties dialog.
      // Which one should we popup?
      // Add a ShowProperties method to the widget. (With the magic of javascript).
      this.State = PROPERTIES_DIALOG;
      this.ShowPropertiesDialog();
    } else if (this.State !== PROPERTIES_DIALOG) {
      this.SetActive(false);
    }
    return false;
  };

  ArrowWidget.prototype.HandleMouseMove = function (layer) {
    if (this.State === INACTIVE) {
      return true;
    }
    var event = layer.Event;    
    var x = this.Layer.MouseX;
    var y = this.Layer.MouseY;

    if (this.Layer.MouseDown === false && this.State === ACTIVE) {
      return false;
    }

    if (this.State === NEW || this.State === DRAG) {
      var cam = this.Layer.GetCamera();
      this.Shape.Origin = cam.ConvertPointViewerToWorld(x + this.TipOffset[0], y + this.TipOffset[1]);
      this.Layer.EventuallyDraw();
    }

    if (this.State === DRAG_TAIL) {
      var dx = x - this.TipPosition[0];
      var dy = y - this.TipPosition[1];
      if (!this.Shape.FixedSize) {
        var pixelsPerUnit = this.Layer.GetPixelsPerUnit();
        dx /= pixelsPerUnit;
        dy /= pixelsPerUnit;
      }
      this.Shape.Length = Math.sqrt(dx * dx + dy * dy);
      this.Shape.Orientation = -Math.atan2(dy, dx) * 180.0 / Math.PI;
      this.Shape.UpdateBuffers(this.Layer.AnnotationView);
      this.Layer.EventuallyDraw();
    }
    return false;
  };

  // Return points 1 and 2 in view (screen) coordinates.
  ArrowWidget.prototype.GetViewPoints = function () {
    var cam = this.Layer.GetCamera();
    var pt1 = this.Shape.Origin;
    pt1 = cam.ConvertPointWorldToViewer(pt1[0], pt1[1]);
    
    var tmp = -this.Shape.Orientation * Math.PI / 180.0;
    var dx = this.Shape.Length * Math.cos(tmp);
    var dy = this.Shape.Length * Math.sin(tmp);

    var pt2 = [pt1[0] + dx, pt1[1] + dy];
    return [pt1, pt2];
  };

  // TODO: Repurpose for dragging
  ArrowWidget.prototype.CheckActive = function () {
    var viewport = this.Layer.GetViewport();
    var cam = this.Layer.GetCamera();
    // TODO: Should not be accessing this without a getter.
    var m = cam.ImageMatrix;
    // Compute tip point in screen coordinates.
    var x = this.Shape.Origin[0];
    var y = this.Shape.Origin[1];
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
    var tmp = -this.Shape.Orientation * Math.PI / 180.0;
    var ct = Math.cos(tmp);
    var st = Math.sin(tmp);
    xNew = x * ct + y * st;
    yNew = -x * st + y * ct;

    var length = this.Shape.Length;
    var halfWidth = this.Shape.Width / 2.0;
    if (!this.Shape.FixedSize) {
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
      this.Shape.Length = 0;
      return true;
    }
    return false;
  };

  ArrowWidget.prototype.IsEmpty = function () {
    return this.Shape.Length < this.Shape.Width / 4;
  };
  
  // We have three states this widget is active.
  // First created and following the mouse (actually two, head or tail following). Color nbot active.
  // Active because mouse is over the arrow.  Color of arrow set to active.
  // Active because the properties dialog is up. (This is how dialog know which widget is being edited).
  ArrowWidget.prototype.GetActive = function () {
    return this.Shape.Selected;
  };
  ArrowWidget.prototype.IsSelected = function () {
    return this.GetActive();
  };

  ArrowWidget.prototype.SetActive = function (flag) {
    if (flag === this.GetActive()) {
      return;
    }

    this.Shape.Selected = flag;
    this.Layer.EventuallyDraw();
  };
  
  // I need this because old schemes cannot use "Load"
  ArrowWidget.prototype.SetColor = function (hexColor) {
    this.Shape.SetFillColor(hexColor);
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
    //this.SetStateToInactive();
    this.SetActive(false);
    this.Layer.EventuallyDraw();
  };
    
  ArrowWidget.prototype.DialogCloseCallback = function () {
    this.SetActive(false);
    this.Layer.EventuallyDraw();
  };

  // Fill the dialog values from the widget values.
  ArrowWidget.prototype.WidgetPropertiesToDialog = function () {
    this.Dialog.ColorInput.val(SAM.ConvertColorToHex(this.Shape.FillColor));
    this.Dialog.WidthInput.val((this.Shape.Width).toFixed(2));
  };
 
  // Copy the properties of the dialog into the widget
  ArrowWidget.prototype.DialogPropertiesToWidget = function () {
    var modified = false;

    // Get the color
    var hexcolor = SAM.ConvertColorToHex(this.Dialog.ColorInput.val());
    if (hexcolor !== this.Shape.FillColor) {
      modified = true;
      this.Shape.SetFillColor(hexcolor);
      this.Shape.ChooseOutlineColor();
      modified = true;
    }

    var width = parseFloat(this.Dialog.WidthInput.val());
    if (width !== this.Shape.Width) {
      this.Shape.Width = width;
      modified = true;
    }

    if (modified) {
      // Save values in local storage as defaults for next time.
      localStorage.ArrowWidgetDefaults = JSON.stringify({
        Color: hexcolor,
        Width: width});
      this.Modified();
      this.Shape.UpdateBuffers(this.Layer.AnnotationView);
    }
  };  
  
  SAM.ArrowWidget = ArrowWidget;
})();
