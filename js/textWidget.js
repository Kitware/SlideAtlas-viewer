// ==============================================================================


(function () {
    // Depends on the CIRCLE widget
  'use strict';

  var INACTIVE = 0;
  var DIALOG = 1;
  var DRAG_TEXT = 3;
  var DRAG_ARROW = 4;

  var TEXT_ONLY = 0;
  var HOVER = 1;
  var TEXT_ARROW = 2;
  
  // TODO: Get rid of this layer in the constructor.
  function TextWidget (layer) {
    this.Layer = layer;

    this.Type = 'text';

    this.Text = new SAM.Text();
    this.Text.BackgroundFlag = true;
    this.Arrow = new SAM.Arrow();
    this.ArrowModified = true;
    this.State = INACTIVE;

    this.VisibilityMode = TEXT_ONLY;
    
    // This method gets called if anything is added, deleted or moved.
    this.ModifiedCallback = undefined;
    // This method gets called if the active state of this widget turns on or off.
    // This is used to turn off the pencil button in the Panel.
    this.StateChangeCallback = undefined;
    // This is used by the annotationPanel to transfer draing mode to a new selected widget.
    this.SelectedCallback = undefined;

    // Hack because I do not have the layer here.  Net toset the initial position.
    this.Uninitialized = true;
  }

  TextWidget.prototype.SetModifiedCallback = function (callback) {
    this.ModifiedCallback = callback;
  };

  TextWidget.prototype.SetSelectedCallback = function (callback) {
    this.SelectedCallback = callback;
  };

  // This callback gets called when ever the active state changes,
  // even if caused by an external call. This widget is passed as a argument.
  // This is used to turn off the pencil button in the Panel.
  TextWidget.prototype.SetStateChangeCallback = function (callback) {
    this.StateChangeCallback = callback;
  };

  // Called when the state changes.
  TextWidget.prototype.StateChanged = function () {
    if (this.StateChangeCallback) {
      this.StateChangeCallback(this);
    }
  };

  // Called when widget is modified.
  TextWidget.prototype.Modified = function () {
    if (this.ModifiedCallback) {
      this.ModifiedCallback(this);
    }
  };

  TextWidget.prototype.SetStateToInactive = function () {
    if (this.State === INACTIVE) {
      return;
    }

    this.State = INACTIVE;
    // I want active and selected to be independant.
    //this.Text.SetSelected(false);
    //this.Arrow.SetSelected(false);

    this.StateChanged();

    this.Text.SetSelected(false);
    this.Arrow.SetSelected(false);
    this.Layer.GetParent().css({'cursor': ''});
    // TODO:  Make the caller do this.
    this.Layer.EventuallyDraw();
  };

  TextWidget.prototype.SetStateToDialog = function () {
    if (this.State === DIALOG) {
      return;
    }
    if (!this.Dialog) {
      this.InitializeDialog();
    }
    this.State = DIALOG;
    this.WidgetPropertiesToDialog();
    this.StateChanged();
    this.ShowPropertiesDialog();
  };

  TextWidget.prototype.SetStateToDragText = function () {
    if (this.State === DRAG_TEXT) {
      return;
    }
    this.State = DRAG_TEXT;
    this.Text.SetSelected(true);
    this.Arrow.SetSelected(false);
    this.Layer.GetParent().css({'cursor': 'move'});
    this.StateChanged();
    // TODO:  Make the caller do this.
    this.Layer.EventuallyDraw();
  };

  TextWidget.prototype.SetStateToDragArrow = function () {
    if (this.State === DRAG_ARROW) {
      return;
    }
    this.State = DRAG_ARROW;
    this.Text.SetSelected(false);
    this.Arrow.SetSelected(true);
    this.Layer.GetParent().css({'cursor': 'move'});
    this.StateChanged();
    // TODO:  Make the caller do this.
    this.Layer.EventuallyDraw();
  };

  // Selects or unselects all strokes.
  // Returns true if any selection changed.
  TextWidget.prototype.SetSelected = function (flag) {
    return this.Text.SetSelected(flag) || this.Arrow.SetSelected(flag);
  };

  // Can we delete this?
  TextWidget.prototype.IsEmpty = function () {
    if (this.Text.GetString() === '') {
      return true;
    }
    return false;
  };

  TextWidget.prototype.IsSelected = function () {
    return this.Text.IsSelected() || this.Arrow.IsSelected();
  };
  TextWidget.prototype.SetSelected = function (flag) {
    return this.Text.SetSelected(flag) || this.Arrow.SetSelected(flag);
  };

  TextWidget.prototype.SetCreationCamera = function (cam) {
    // Lets save the zoom level (sort of).
    // Load will overwrite this for existing annotations.
    // This will allow us to expand annotations into notes.
    this.CreationCamera = cam.Serialize();
  };

  TextWidget.prototype.SetPositionToDefault = function () {
    var view = this.Layer.GetView();
    this.Text.UpdateBuffers(view); // Needed to get the bounds.
    this.Text.Offset = [
      0.5 * (this.Text.PixelBounds[0] + this.Text.PixelBounds[1]),
      0.5 * (this.Text.PixelBounds[2] + this.Text.PixelBounds[3])];
    // SHort arrow pointing to the left.
    this.SavedTextOffset = [(this.Text.PixelBounds[0] + this.Text.PixelBounds[1]) * 0.5,
                            -this.Text.PixelBounds[3]];

    // I would like to setup the anchor in the middle of the screen,
    // And have the Anchor in the middle of the text.
    var cam = this.Layer.GetCamera();
    var fp = cam.GetWorldFocalPoint();
    this.Text.Position = [fp[0], fp[1], 0];
    this.ArrowModified = true;
    this.Uninitialized = false;
  };

  // TODO: Change annotation panne so this is not necessary.
  TextWidget.prototype.SetStateToDrawing = function () {
    // Odd  TODO: resolve this method.
    //if (this.State === DIALOG) {
    //  this.SetStateToDialog();
    //}
  };

  // Three state visibility so text can be hidden during calss questions.
  // The combined visibilities is confusing.
  // Global text visibility is passed in as argument.
  // Local visiblity mode is the hover state of this text. (0 text only, 1: hover, 2: both on).
  TextWidget.prototype.Draw = function () {
    if (this.State === DIALOG) {
      // So it does not draw until after the initial dialog is gone.
      return;
    }
    // Get the text bounds and initialize the postion anchor and offset.
    if (this.Uninitialized) {
      this.SetPositionToDefault();
    }
    var view = this.Layer.GetView();
    // TODO:  FIx this . it is hacky.
    // I think bounds are not computable until after the first render or something.
    if (this.Text.PixelBounds[1] === 0) {
      this.Text.UpdateBuffers(view);
      this.ArrowModified = true;
    }
    if (this.ArrowModified) {
      this.UpdateArrow();
    }

    if (this.VisibilityMode !== 0) {
      this.Arrow.Draw(view);
    }
    if (this.VisibilityMode !== 1 || this.Arrow.IsSelected()) {
      this.Text.Draw(view);
      this.Text.Visibility = true;
    } else {
      this.Text.Visibility = false;
    }
  };

  TextWidget.prototype.PasteCallback = function (data, mouseWorldPt) {
    this.Load(data);
        // Place the tip of the arrow at the mose location.
    this.Text.Position[0] = mouseWorldPt[0];
    this.Text.Position[1] = mouseWorldPt[1];
    this.ArrowModified = true;
    this.Layer.EventuallyDraw();
    this.Modified();
  };

  TextWidget.prototype.Serialize = function () {
    if (this.Text === undefined) { return null; }
    var obj = {};
    obj.type = 'text';
    obj.user_note_flag = this.UserNoteFlag;
    obj.color = this.Text.Color;
    obj.size = this.Text.FontSize;
    obj.offset = [-this.Text.Offset[0], -this.Text.Offset[1]];
    obj.position = this.Text.Position;
    obj.string = this.Text.String;
    obj.visibility = this.VisibilityMode;
    obj.backgroundFlag = this.Text.BackgroundFlag;
    obj.creation_camera = this.CreationCamera;

    return obj;
  };

  // Load a widget from a json object (origin MongoDB).
  TextWidget.prototype.Load = function (obj) {
    this.UserNoteFlag = obj.user_note_flag;

    this.Text.String = obj.string;
    var rgb = [parseFloat(obj.color[0]),
      parseFloat(obj.color[1]),
      parseFloat(obj.color[2])];
    this.Text.SetColor(rgb);
    this.Text.SetFontSize(parseFloat(obj.size));
    if (obj.backgroundFlag !== undefined) {
      this.Text.BackgroundFlag = obj.backgroundFlag;
    }
    this.Text.Position = [parseFloat(obj.position[0]),
      parseFloat(obj.position[1]),
      parseFloat(obj.position[2])];

    // I added offest and I have to deal with entries that do not have it.
    if (obj.offset) { // how to try / catch in javascript?
      this.SetTextOffset(parseFloat(obj.offset[0]),
                         parseFloat(obj.offset[1]));
    }

    // How zoomed in was the view when the annotation was created.
    if (obj.creation_camera !== undefined) {
      this.CreationCamera = obj.creation_camera;
    }

    if (obj.visibility !== undefined) {
      this.VisibilityMode = obj.visibility;
    }

    this.Arrow.SetFillColor(rgb);
    this.Arrow.ChooseOutlineColor();
    this.ArrowModified = true;
    this.Uninitialized = false;
  };

  // When the arrow is visible, the text is offset from the position (tip of arrow).
  TextWidget.prototype.SetTextOffset = function (x, y) {
    this.SavedTextOffset = [-x, -y];
      this.Text.Offset = this.SavedTextOffset.slice(0);
    this.ArrowModified = true;
  };

  // When the arrow is visible, the text is offset from the position (tip of arrow).
  TextWidget.prototype.SetPosition = function (x, y) {
    this.Text.Position = [x, y, 0];
    this.ArrowModified = true;
  };

  // Offset is in the middle of the bounds when the shape is not visible.
  TextWidget.prototype.SetVisibilityMode = function (mode) {
    if (mode === this.VisibilityMode) {
      return;
    }
    var modified = true;
    this.ArrowModified = true;
    if (mode === TEXT_ONLY) {
      this.SavedTextOffset = this.Text.Offset.slice(0);
      // Adjust the offset so the anchor is in the center of the text.
      this.Text.Offset = [(this.Text.PixelBounds[0] + this.Text.PixelBounds[1]) * 0.5,
                          (this.Text.PixelBounds[2] + this.Text.PixelBounds[3]) * 0.5];
    }
    if (this.VisibilityMode === TEXT_ONLY) {
      if (this.SavedTextOffset) {
        this.Text.Offset = this.SavedTextOffset.slice(0); 
      } else {
        // SHort arrow pointing to the left.
        this.Text.Offset = [(this.Text.PixelBounds[0] + this.Text.PixelBounds[1]) * 0.5,
                            -this.Text.PixelBounds[3]];
      }
    }
    this.VisibilityMode = mode;
  };

  // Change orientation and length of arrow based on the anchor location.
  TextWidget.prototype.UpdateArrow = function () {
    if (this.Text.PixelBounds[3] === 0) {
      return;
    }
    this.Arrow.Origin = this.Text.Position;

    // Compute the middle of the text bounds.
    var xMid = 0.5 * (this.Text.PixelBounds[0] + this.Text.PixelBounds[1]);
    var yMid = 0.5 * (this.Text.PixelBounds[2] + this.Text.PixelBounds[3]);
    var xRad = 0.5 * (this.Text.PixelBounds[1] - this.Text.PixelBounds[0]);
    var yRad = 0.5 * (this.Text.PixelBounds[3] - this.Text.PixelBounds[2]);

    // Compute the angle of the arrow.
    var dx = this.Text.Offset[0] - xMid;
    var dy = this.Text.Offset[1] - yMid;
    this.Arrow.Orientation = -(180.0 + Math.atan2(dy, dx) * 180.0 / Math.PI);
    // Compute the length of the arrow.
    var length = Math.sqrt(dx * dx + dy * dy);
    // Find the intersection of the vector and the bounding box.
    var min = length;
    var d;
    if (dy !== 0) {
      d = Math.abs(length * yRad / dy);
      if (min > d) { min = d; }
    }
    if (dx !== 0) {
      d = Math.abs(length * xRad / dx);
      if (min > d) { min = d; }
    }
    length = length - min - 5;
    if (length < 5) { length = 5; }
    this.Arrow.Length = length;
    this.Arrow.UpdateBuffers(this.Layer.GetView());
    this.ArrowModified = false;
  };

  // Returns this widget if it is selected, undefined otherwise.
  // TODO: Fix:
  // Mixed behaviors.  Some widgets change their state when selected (like this one).
  // Others jsut change selected states of componennts and leave it to the panel to
  // change their state.
  TextWidget.prototype.SingleSelect = function () {
    if (this.State === DIALOG) {
      return;
    }
    var event = this.Layer.Event;
    var tMouse = this.ScreenPixelToTextPixelPoint(event.offsetX, event.offsetY);

    if (this.Text.PointInText(tMouse[0], tMouse[1])) {
      // A second click brings up the dialog to exit the text.
      if (this.State === DRAG_TEXT) {
        this.SetStateToDialog();
        return this;
      }
      this.SetStateToDragText();
      this.Text.SetSelected(true);
      return this;
    }
    var anchor = this.Text.Offset;
    if (this.Arrow.PointInShape(tMouse[0] - anchor[0], tMouse[1] - anchor[1])) {
      this.SetStateToDragArrow();
      this.Text.SetSelected(true);
      return this;
    }
    this.SetStateToInactive();
    return;
  };

  // Returns true if modified.
  TextWidget.prototype.DeleteSelected = function () {
    if (this.State !== INACTIVE) {
      // layer will see this as an empty widget and delete it.
      this.Text.SetString('');
      return true;
    }
    return false;
  };

  TextWidget.prototype.HandleKeyDown = function () {
    // The dialog consumes all key events.
    if (this.State === DIALOG) {
      return false;
    }

    // Copy
    var event = this.Layer.Event;
    if (event.keyCode === 67 && event.ctrlKey) {
      // control-c for copy
      // The extra identifier is not needed for widgets, but will be
      // needed if we have some other object on the clipboard.
      var clip = {Type: 'TextWidget', Data: this.Serialize()};
      localStorage.ClipBoard = JSON.stringify(clip);
      return false;
    }

    return true;
  };

  TextWidget.prototype.HandleMouseDown = function () {
    if (this.State === INACTIVE) {
      return true;
    }
    var event = this.Layer.Event;
    if (event.which === 1) {
      // LastMouse necessary for dragging.
      var x = event.offsetX;
      var y = event.offsetY;
      console.log("set last mouse (on down)");
      this.LastMouse = [x, y];
      return false;
    }
    return true;
  };

  // returns false when it is finished doing its work.
  TextWidget.prototype.HandleMouseUp = function () {
    if (this.State === INACTIVE) {
      return true;
    }
    if (this.State === DRAG_TEXT || this.State === DRAG_ARROW) {
      this.Modified();
    }
    return false;
  };

  // I need to convert mouse screen point to coordinates of text buffer
  // to see if the mouse position is in the bounds of the text.
  // Screen y vector point down (up is negative).
  // Text coordinate system will match canvas text: origin upper left, Y point down.
  TextWidget.prototype.ScreenPixelToTextPixelPoint = function (x, y) {
    // convert the world arrow tip to screen.
    var cam = this.Layer.GetCamera();
    var textOriginScreenPixelPosition =
            cam.ConvertPointWorldToViewer(this.Text.Position[0], this.Text.Position[1]);
    // Offset to the text)
    x = (x - textOriginScreenPixelPosition[0]) + this.Text.Offset[0];
    y = (y - textOriginScreenPixelPosition[1]) + this.Text.Offset[1];

    return [x, y];
  };

  TextWidget.prototype.HandleMouseMove = function () {
    var event = this.Layer.Event;
    if ((this.VisibilityMode === 0 && this.State === DRAG_TEXT) ||
        this.State === DRAG_ARROW) {
      var cam = this.Layer.GetCamera();
      var w0 = cam.ConvertPointViewerToWorld(this.LastMouse[0], this.LastMouse[1]);
      var w1 = cam.ConvertPointViewerToWorld(event.offsetX, event.offsetY);
      var wdx = w1[0] - w0[0];
      var wdy = w1[1] - w0[1];
      console.log("set last mouse (on drag arrow)");
      this.LastMouse = [event.offsetX, event.offsetY];
      this.Text.Position[0] += wdx;
      this.Text.Position[1] += wdy;
      this.ArrowModified = true;
      this.Layer.EventuallyDraw();
      return false;
    } else if (this.State === DRAG_TEXT) { // Just the text not the anchor glyph
      var dx = event.offsetX - this.LastMouse[0];
      var dy = event.offsetY - this.LastMouse[1];
      console.log("set last mouse (on drag text)");
      this.LastMouse = [event.offsetX, event.offsetY];

      // TODO: Get the Mouse Deltas out of the layer.
      this.Text.Offset[0] -= dx;
      this.Text.Offset[1] -= dy;
      this.ArrowModified = true;
      this.Layer.EventuallyDraw();
      return false;
    }
    return true;
  };

  TextWidget.prototype.HandleTouchPan = function () {
    // We should probably have a handle touch start too.
    if (this.State === INACTIVE) {
      return true;
    }

    this.Layer.MouseDeltaX = this.Layer.MouseX - this.Layer.LastMouseX;
    this.Layer.MouseDeltaY = this.Layer.MouseY - this.Layer.LastMouseY;
    this.HandleMouseMove();
    return false;
  };

  TextWidget.prototype.HandleTouchEnd = function () {
    if (this.State === INACTIVE) {
      return true;
    }
    this.Modified();
    return false;
  };

  TextWidget.prototype.GetActive = function () {
    if (this.State !== INACTIVE) {
      return true;
    }
    return false;
  };

  // This creates the dialog and sets all values to defaults (from local storage).
  TextWidget.prototype.InitializeDialog = function () {
    this.Dialog = new SAM.Dialog(this.Layer.GetParent().parent());
    this.Dialog.Title.text('Text Annotation Editor');
    this.Dialog.Body.css({'margin': '1em 2em'});

    this.Dialog.TextInput =
            $('<textarea>')
            .appendTo(this.Dialog.Body)
            .css({'width': '87%',
                  'height': '8em'});

    this.Dialog.FontDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display': 'table-row'});
    this.Dialog.FontLabel =
            $('<div>')
            .appendTo(this.Dialog.FontDiv)
            .text('Font (px):')
            .css({'display': 'table-cell',
              'text-align': 'left'});
    this.Dialog.FontInput =
            $('<input type="number">')
            .appendTo(this.Dialog.FontDiv)
            .val('12')
            .css({'display': 'table-cell'});

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
            .val('#30ff00')
            .css({'display': 'table-cell'});

    this.Dialog.VisibilityModeDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display': 'table-row'});
    this.Dialog.VisibilityModeLabel =
            $('<div>')
            .appendTo(this.Dialog.VisibilityModeDiv)
            .text('Visibility:')
            .css({'display': 'table-cell',
              'text-align': 'left'});
    this.Dialog.VisibilityModeInputButtons =
            $('<div>')
            .appendTo(this.Dialog.VisibilityModeDiv)
            .css({'display': 'table-cell'});

    this.Dialog.VisibilityModeInputs = [];
    this.Dialog.VisibilityModeInputs[TEXT_ONLY] =
      $('<input type="radio" name="visibilityoptions" value="0">Text only</input>')
      .appendTo(this.Dialog.VisibilityModeInputButtons);

    $('<br>').appendTo(this.Dialog.VisibilityModeInputButtons);

    this.Dialog.VisibilityModeInputs[HOVER] =
      $('<input type="radio" name="visibilityoptions" value="1">Arrow only, text on hover</input>')
      .appendTo(this.Dialog.VisibilityModeInputButtons);

    $('<br>').appendTo(this.Dialog.VisibilityModeInputButtons);

    this.Dialog.VisibilityModeInputs[TEXT_ARROW] =
      $('<input type="radio" name="visibilityoptions" value="2">Arrow and text visible</input>')
      .appendTo(this.Dialog.VisibilityModeInputButtons);

    this.Dialog.VisibilityModeInputs[TEXT_ONLY].attr('checked', 'true')

    
    this.Dialog.BackgroundDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display': 'table-row'});
    this.Dialog.BackgroundLabel =
            $('<div>')
            .appendTo(this.Dialog.BackgroundDiv)
            .text('Background:')
            .css({'display': 'table-cell',
              'text-align': 'left'});
    this.Dialog.BackgroundInput =
            $('<input type="checkbox">')
            .appendTo(this.Dialog.BackgroundDiv)
            .css({'display': 'table-cell'});

    // Get default properties.
    this.VisibilityMode = 2;
    this.Dialog.BackgroundInput.prop('checked', true);
    var hexcolor = SAM.ConvertColorToHex(this.Dialog.ColorInput.val());
    if (localStorage.TextWidgetDefaults) {
      var defaults = JSON.parse(localStorage.TextWidgetDefaults);
      if (defaults.Color) {
        hexcolor = SAM.ConvertColorToHex(defaults.Color);
        this.Text.SetColor(hexcolor);
        this.Arrow.SetFillColor(hexcolor);
      } else {
        this.Arrow.SetFillColor(this.Text.Color);
      }
      if (defaults.FontSize) {
        // font size was wrongly saved as a string.
        this.Text.SetFontSize(parseFloat(defaults.FontSize));
      }
      if (defaults.BackgroundFlag !== undefined) {
        this.Text.BackgroundFlag = defaults.BackgroundFlag;
      }
      if (defaults.VisibilityMode !== undefined) {
        this.VisibilityMode = defaults.VisibilityMode;
      }
    }
  };

  // Can we bind the dialog apply callback to an objects method?
  TextWidget.prototype.ShowPropertiesDialog = function () {
    var self = this;
    this.Dialog.SetApplyCallback(function () { self.DialogApplyCallback();});
    this.Dialog.SetCloseCallback(function () { self.DialogCloseCallback(); });
    this.Dialog.Show(true);
    this.Dialog.TextInput.focus();
  };
 
  TextWidget.prototype.DialogApplyCallback = function () {
    // Transfer properties fromt he dialog GUI to the widget.
    this.DialogPropertiesToWidget();
    // View bindings kept the dialog text input from working.
    if (!this.Layer) {
      return;
    }
    this.SetStateToInactive();
    this.Layer.EventuallyDraw();
  };
    
  TextWidget.prototype.DialogCloseCallback = function () {
    // View bindings keep dialog text input from working.
    if (this.Uninitialized) {
      // This will triger the layer to get rid of the text widget.
      this.Text.SetString('');
    }
    this.SetStateToInactive();
    this.Layer.EventuallyDraw();
  };

  // Fill the dialog values from the widget values.
  TextWidget.prototype.WidgetPropertiesToDialog = function () {
    this.Dialog.ColorInput.val(SAM.ConvertColorToHex(this.Text.Color));
    this.Dialog.FontInput.val(this.Text.GetFontSize().toFixed(0));
    this.Dialog.BackgroundInput.prop('checked', this.Text.BackgroundFlag);
    this.Dialog.TextInput.val(this.Text.String);
    this.Dialog.VisibilityModeInputs[this.VisibilityMode].attr('checked', true);
  };
 
  // Copy the properties of the dialog into the widget
  TextWidget.prototype.DialogPropertiesToWidget = function () {
    var modified = false;

    // Get the string
    this.ApplyLineBreaks();
    var string = this.Dialog.TextInput.val();
    // remove any trailing white space.
    string = string.trim();
    if (string === '') {
      this.Layer.EventuallyDraw();
      this.Layer.RemoveWidget(this);
      // Trigger the changed callback  (should we have a delete callback?)
      this.StateChanged();
      return;
    }
    if (string !== this.Text.GetString()) { modified = true; }
    this.Text.SetString(string);

    // Get the color
    var hexcolor = SAM.ConvertColorToHex(this.Dialog.ColorInput.val());
    if (hexcolor !== this.Text.GetColor()) {
      modified = true;
      this.Text.SetColor(hexcolor);
      this.Arrow.SetFillColor(hexcolor);
      this.Arrow.ChooseOutlineColor();
      this.ArrowModified = true;
    }

    // Get the font size
    var fontSize = parseFloat(this.Dialog.FontInput.val());
    if (fontSize !== this.Text.GetFontSize()) { modified = true; }
    this.Text.SetFontSize(fontSize);

    // Get the visibility mode
    var mode = TEXT_ONLY;
    if (this.Dialog.VisibilityModeInputs[TEXT_ONLY].prop('checked')) {
      if (this.VisibilityMode !== TEXT_ONLY) { modified = true; }
      mode = TEXT_ONLY;
    } else if (this.Dialog.VisibilityModeInputs[HOVER].prop('checked')) {
      if (this.VisibilityMode !== HOVER) { modified = true; }
      mode = HOVER;
    } else {
      if (this.VisibilityMode !== TEXT_ARROW) { modified = true; }
      mode = TEXT_ARROW;
    }
    if (this.VisibilityMode !== mode) {
      // This also changes the anchor if necessary.
      this.SetVisibilityMode(mode);
      modified = true;
    }

    // Background flag is not working for some reasop.
    var backgroundFlag = this.Dialog.BackgroundInput.prop('checked');
    if (backgroundFlag !== this.Text.GetBackgroundFlag()) {
      modified = true;
      this.Text.SetBackgroundFlag(backgroundFlag);
    }

    // Save values in local storage as defaults for next time.
    localStorage.TextWidgetDefaults = JSON.stringify({
      Color: hexcolor,
      FontSize: this.Text.GetFontSize(),
      VisibilityMode: this.VisibilityMode,
      BackgroundFlag: backgroundFlag});

    if (modified) {
      this.Modified();
    }
  };

  // Function to apply line breaks to textarea text.
  TextWidget.prototype.ApplyLineBreaks = function () {
    var oTextarea = this.Dialog.TextInput[0];

    /*
      if (oTextarea.wrap) {
      oTextarea.setAttribute("wrap", "off");
      } else {
      oTextarea.setAttribute("wrap", "off");
      var newArea = oTextarea.cloneNode(true);
      newArea.value = oTextarea.value;
      oTextarea.parentNode.replaceChild(newArea, oTextarea);
      oTextarea = newArea;
      }
    */

    oTextarea.setAttribute('wrap', 'off');
    var strRawValue = oTextarea.value;
    oTextarea.value = '';
    var nEmptyWidth = oTextarea.scrollWidth;
    var nLastWrappingIndex = -1;
    for (var i = 0; i < strRawValue.length; i++) {
      var curChar = strRawValue.charAt(i);
      if (curChar === ' ' || curChar === '-' || curChar === '+') {
        nLastWrappingIndex = i;
      }
      oTextarea.value += curChar;
      if (oTextarea.scrollWidth > nEmptyWidth) {
        var buffer = '';
        if (nLastWrappingIndex >= 0) {
          for (var j = nLastWrappingIndex + 1; j < i; j++) {
            buffer += strRawValue.charAt(j);
          }
          nLastWrappingIndex = -1;
        }
        buffer += curChar;
        oTextarea.value = oTextarea.value.substr(0, oTextarea.value.length - buffer.length);
        oTextarea.value += '\n' + buffer;
      }
    }
    oTextarea.setAttribute('wrap', '');
  };

  SAM.TextWidget = TextWidget;
})();
