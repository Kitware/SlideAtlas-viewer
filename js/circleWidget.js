
(function () {
  'use strict';

  // ==============================================================================
  // Mouse down defined the center.
  // Drag defines the radius.

  // The circle has just been created and is following the mouse.
  // I can probably merge this state with drag. (mouse up vs down though)
  var NEW_HIDDEN = 0;
  var NEW_DRAG = 1;
  var NEW_DRAG_RADIUS = 2;
  var DRAG = 3; // The whole circle is being dragged.
  var DRAG_RADIUS = 4;
  var DRAG_KEYPOINT = 5;
  var INACTIVE = 6; // Not responding to events at all
  var ACTIVE = 7; // Receive events.  Looking for a hover.
  var HOVER = 8; // Mouse is over the widget.
  var DIALOG = 9; // Properties dialog is up

  var CIRCUMFERENCE = 1;
  var INSIDE = 2;
  var CENTER = 3;

  function CircleWidget (layer) {
    this.Layer = layer;

    // This is to save fields from loaded elements that we ignore.
    // That way we include them when we serialize.
    this.Element = {};
    
    // Get default properties.
    if (localStorage.CircleWidgetDefaults) {
      this.Defaults = JSON.parse(localStorage.CircleWidgetDefaults);
    } else {
      this.Defaults = {};
    }

    // This method gets called if anything is added, deleted or moved.
    this.ModifiedCallback = undefined;
    // This method gets called if the active state of this widget turns on or off.
    // This is used to turn off the pencil button in the Panel.
    this.StateChangeCallback = undefined;
    // This is used by the annotationPanel to transfer draing mode to a new selected widget.
    this.SelectedCallback = undefined;

    // Keep track of annotation created by students without edit
    // permission.
    this.Type = 'circle';

    this.Tolerance = 3.0;
    if (SAM.MOBILE_DEVICE) {
      this.Tolerance = 15.0;
    }

    if (layer === null) {
      return;
    }

    // Lets save the zoom level (sort of).
    // Load will overwrite this for existing annotations.
    // This will allow us to expand annotations into notes.
    this.CreationCamera = layer.GetCamera().Serialize();

    var cam = layer.GetCamera();
    var viewport = layer.GetViewport();
    this.Circle = new SAM.Circle();
    this.Circle.Origin = [0, 0];
    this.Circle.OutlineColor = [0.0, 0.0, 0.0];
    this.Circle.SetOutlineColor('#00ff00');
    this.Circle.Radius = 50 * cam.Height / viewport[3];
    this.Circle.LineWidth = 5.0 * cam.Height / viewport[3];

    if (this.Defaults) {
      if (this.Defaults.Color) {
        this.Circle.OutlineColor = this.Defaults.Color;
      }
      if (this.Defaults.LineWidth !== undefined) {
        // Only use the default if it is reasonable.
        if (this.Defaults.LineWidth === 0) {
          this.Circle.LineWidth = this.Defaults.LineWidth;
        } else {
          var tmp = this.Circle.LineWidth / this.Defaults.LineWidth;
          if (Math.max(tmp, 1 / tmp) < 10) {
            this.Circle.LineWidth = this.Defaults.LineWidth;
          }
        }
      }
      if (this.Defaults.Radius) {
        // Only use the default if it is reasonable.
        tmp = this.Circle.Radius / this.Defaults.Radius;
        if (Math.max(tmp, 1 / tmp) < 10) {
          this.Circle.Radius = this.Defaults.Radius;
        }
      }
    }

    this.Circle.FixedSize = false;

    // Note: If the user clicks before the mouse is in the
    // canvas, this will behave odd.

    // Cross hairs is to show an active center.
    this.Cross = new SAM.Circle();
    this.Cross.SetFillColor([1, 1, 0]);
    this.Cross.SetOutlineColor([0.0, 0.0, 0.0]);
    this.Cross.Radius = 5;
    this.Cross.LineWidth = 1;
    this.Cross.PositionCoordinateSystem = 1;

    this.State = INACTIVE;
  }

  CircleWidget.prototype.SetModifiedCallback = function (callback) {
    this.ModifiedCallback = callback;
  };

  CircleWidget.prototype.SetSelectedCallback = function (callback) {
    this.SelectedCallback = callback;
  };

  // I am divorcing selected from active.
  CircleWidget.prototype.IsSelected = function () {
    return this.Circle && this.Circle.Selected;
  };

  // This callback gets called when ever the active state changes,
  // even if caused by an external call. This widget is passed as a argument.
  // This is used to turn off the pencil button in the Panel.
  CircleWidget.prototype.SetStateChangeCallback = function (callback) {
    this.StateChangeCallback = callback;
  };

  // Called when the state changes.
  CircleWidget.prototype.StateChanged = function () {
    if (this.StateChangeCallback) {
      this.StateChangeCallback(this);
    }
  };

  // Sets state to "NEW" (dragging without mouse pressed
  CircleWidget.prototype.SetStateToDrawing = function () {
    this.State = NEW_HIDDEN;
  };

  // Called when the state changes.
  CircleWidget.prototype.Modified = function () {
    this.SaveDefaults();
    if (this.ModifiedCallback) {
      (this.ModifiedCallback)(this);
    }
  };

  // Called when the state changes.
  CircleWidget.prototype.SelectionChanged = function () {
    if (this.SelectedCallback) {
      (this.SelectedCallback)(this);
    }
  };

  // Not used yet, but might be useful.
  CircleWidget.prototype.SetCreationCamera = function (cam) {
    // Lets save the zoom level (sort of).
    // Load will overwrite this for existing annotations.
    // This will allow us to expand annotations into notes.
    this.CreationCamera = cam.Serialize();
  };

  // Selects the widget if the text is fuly contained in the selection rectangle.
  CircleWidget.prototype.ApplySelect = function (selection) {
    if (!this.Circle) {
      return;
    }
    var radius = this.Circle.Radius;
    var cam = this.Layer.GetCamera();
    var p = cam.ConvertPointWorldToViewer(this.Circle.Origin[0], this.Circle.Origin[1]);

    if (selection.ViewerPointInSelection(p[0] - radius, p[1] - radius) &&
        selection.ViewerPointInSelection(p[0] - radius, p[1] + radius) &&
        selection.ViewerPointInSelection(p[0] + radius, p[1] - radius) &&
        selection.ViewerPointInSelection(p[0] + radius, p[1] + radius)) {
      this.Circle.SetSelected(true);

      return true;
    }
    this.Circle.SetSelected(false);
    return false;
  };

  CircleWidget.prototype.DeleteSelected = function () {
    return this.Circle.DeleteSelected();
  };

  CircleWidget.prototype.IsEmpty = function () {
    if (this.State === NEW_HIDDEN || this.State === NEW_DRAG) {
      return true;
    }
    return this.Circle.IsEmpty();
  };

  CircleWidget.prototype.GetActive = function () {
    return this.State !== INACTIVE;
  };

  CircleWidget.prototype.SetActive = function (flag) {
    if (flag && this.State === INACTIVE) {
      this.State = HOVER;
      // Probably not right, but the widget probably became active because it was selected,
      // and the mouse is over the circle.
      this.Layer.GetParent().css({'cursor': 'move'});
      this.StateChanged();
    }
    if (!flag && this.State !== INACTIVE) {
      this.State = INACTIVE;
      this.StateChanged();
    }
    // TODO: Fix: Single select must be setting the state to inactive without calling this method.
    // Cursor was not changing back.
    if (!flag) {
      this.Layer.GetParent().css({'cursor': ''});
    }
    this.Layer.EventuallyDraw();
  };

  // I am not sure if this is used.  We have multiple selected states.
  // Default to the whole widget selected.
  CircleWidget.prototype.SetSelected = function (flag) {
    this.Circle.SetSelected(flag);

    if (flag && this.SelectedCallback) {
      (this.SelectedCallback)(this);
    }
    if (!flag) {
      // We can be selected without being active, but we cannot be
      // active without being selected.
      this.SetActive(false);
    }
  };

  CircleWidget.prototype.InitPropertiesDialog = function (layer) {
    var self = this;

    this.Dialog = new SAM.Dialog(this.Layer.GetParent().parent());
    this.Dialog.SetApplyCallback(function () { self.DialogApplyCallback(); });
    // Customize dialog for a circle.
    this.Dialog.Title.text('Circle Properties');
    this.Dialog.Body.css({'margin': '1em 2em', 'height': '14em'});
    // Radius
    this.Dialog.RadiusDiv =
            $('<div>')
            .css({'height': '24px'})
            .appendTo(this.Dialog.Body)
            .addClass('sa-view-annotation-modal-div');
    this.Dialog.RadiusLabel =
            $('<div>')
            .appendTo(this.Dialog.RadiusDiv)
            .text('Radius:')
            .addClass('sa-view-annotation-modal-input-label');
    this.Dialog.RadiusInput =
            $('<input type="number">')
            .appendTo(this.Dialog.RadiusDiv)
            .val(10)
            .addClass('sa-view-annotation-modal-input');

    // Center
    this.Dialog.CenterDiv =
            $('<div>')
            .css({'height': '24px'})
            .appendTo(this.Dialog.Body)
            .addClass('sa-view-annotation-modal-div');
    this.Dialog.CenterLabel =
            $('<div>')
            .appendTo(this.Dialog.CenterDiv)
            .text('Center:')
            .addClass('sa-view-annotation-modal-input-label');
    this.Dialog.CenterXInput =
            $('<input type="number">')
            .appendTo(this.Dialog.CenterDiv)
            .css({'width': '30%'})
            .val(0)
            .addClass('sa-view-annotation-modal-input');    
    this.Dialog.CenterYInput =
            $('<input type="number">')
            .appendTo(this.Dialog.CenterDiv)
            .css({'width': '30%'})
            .val(0)
            .addClass('sa-view-annotation-modal-input');
    
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

    // Line Width
    this.Dialog.LineWidthDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .addClass('sa-view-annotation-modal-div');
    this.Dialog.LineWidthLabel =
            $('<div>')
            .appendTo(this.Dialog.LineWidthDiv)
            .text('Line Width:')
            .addClass('sa-view-annotation-modal-input-label');
    this.Dialog.LineWidthInput =
            $('<input type="number">')
            .appendTo(this.Dialog.LineWidthDiv)
            .addClass('sa-view-annotation-modal-input')
            .keypress(function (event) { return event.keyCode !== 13; });

    // Label
    this.Dialog.LabelDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .addClass('sa-view-annotation-modal-div');
    this.Dialog.LabelLabel =
            $('<div>')
            .appendTo(this.Dialog.LabelDiv)
            .text('Label:')
            .addClass('sa-view-annotation-modal-input-label');
    this.Dialog.LabelInput =
            $('<input type="text">')
            .appendTo(this.Dialog.LabelDiv)
            .addClass('sa-view-annotation-modal-input')
            .keypress(function (event) { return event.keyCode !== 13; });

    // Area
    this.Dialog.AreaDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .addClass('sa-view-annotation-modal-div');
    this.Dialog.AreaLabel =
            $('<div>')
            .appendTo(this.Dialog.AreaDiv)
            .text('Area:')
            .addClass('sa-view-annotation-modal-input-label');
    this.Dialog.Area =
            $('<div>')
            .appendTo(this.Dialog.AreaDiv)
            .addClass('sa-view-annotation-modal-input');
  };

  CircleWidget.prototype.ShowPropertiesDialog = function () {
    if (this.Dialog === undefined) {
      this.InitPropertiesDialog();
    }
    this.WidgetPropertiesToDialog();
    var self = this;
    this.Dialog.SetApplyCallback(function () { self.DialogApplyCallback(); });
    this.Dialog.SetCloseCallback(function () { self.DialogCloseCallback(); });
    this.Dialog.Show(true);
    this.State = DIALOG;
  };

  CircleWidget.prototype.DialogApplyCallback = function (layer) {
    // Transfer properties fromt he dialog GUI to the widget.
    this.DialogPropertiesToWidget();
    // View bindings kept the dialog text input from working.
    if (!this.Layer) {
      return;
    }
    this.SetActive(false);
    this.Layer.EventuallyDraw();
    this.SetActive(false);
  };

  CircleWidget.prototype.DialogCloseCallback = function () {
    this.SetActive(false);
    this.Layer.EventuallyDraw();
    this.SetActive(false);
  };

  // Fill the dialog values from the widget values.
  CircleWidget.prototype.WidgetPropertiesToDialog = function () {
    this.Dialog.RadiusInput.val(Math.round(this.Circle.Radius));
    this.Dialog.CenterXInput.val(Math.round(this.Circle.Origin[0]));
    this.Dialog.CenterYInput.val(Math.round(this.Circle.Origin[1]));
    this.Dialog.ColorInput.val(SAM.ConvertColorToHex(this.Circle.OutlineColor));
    this.Dialog.LineWidthInput.val((this.Circle.LineWidth).toFixed(2));
    var label = "";
    if (this.Circle.Children.label && this.Circle.Children.label.String) {
      label = this.Circle.Children['label'].String;
    }
    this.Dialog.LabelInput.val(label);

    var area = (2.0 * Math.PI * this.Circle.Radius * this.Circle.Radius) * 0.25 * 0.25;
    var areaString = '';
    if (this.Circle.FixedSize) {
      areaString += area.toFixed(2);
      areaString += ' pixels^2';
    } else {
      if (area > 1000000) {
        areaString += (area / 1000000).toFixed(2);
        areaString += ' mm^2';
      } else {
        areaString += area.toFixed(2);
        areaString += ' um^2';
      }
    }
    this.Dialog.Area.text(areaString);
  };

  
  // I am having the two shapes share an origin/position point array.
  // That way code that just modifies oring will automatically change label.
  CircleWidget.prototype.SetOrigin = function (xy) {
    this.Circle.Origin = xy;
    if ('label' in this.Circle.Children) {
      this.Circle.Children.label.Position = xy;
    }
  };

  
  // Copy the properties of the dialog into the widget
  CircleWidget.prototype.DialogPropertiesToWidget = function () {
    var modified = false;

    var radius = parseInt(this.Dialog.RadiusInput.val());
    if (radius !== this.Circle.Radius) {
      this.Circle.Radius = radius;
      modified = true;
    }

    var cx = parseInt(this.Dialog.CenterXInput.val());
    var cy = parseInt(this.Dialog.CenterYInput.val());
    if (cx !== this.Circle.Origin[0] || cy !== this.Circle.Origin[1]) {
      this.Circle.Origin[0] = cx;
      this.Circle.Origin[1] = cy;
      modified = true;
    }

    // Get the color
    var hexcolor = SAM.ConvertColorToHex(this.Dialog.ColorInput.val());
    if (hexcolor !== this.Circle.OutlineColor) {
      modified = true;
      this.Circle.SetOutlineColor(hexcolor);
      modified = true;
    }

    var lineWidth = parseFloat(this.Dialog.LineWidthInput.val());
    if (lineWidth !== this.Circle.LineWidth) {
      this.Circle.LineWidth = lineWidth;
      modified = true;
    }

    var label = this.Dialog.LabelInput.val();
    label = label.trim();
    if (label == "") {
      delete this.Circle.Children.label;
    } else {
      if (!this.Circle.Children.label) {
        var text = new SAM.Text()
        text.BackgroundFlag = false;
        text.String = label;
        text.Position = this.Circle.Origin;
        this.Circle.Children["label"] = text;
      }
      this.Circle.Children.label.String = label;
      modified = true;
    }
    
    if (modified) {
      this.Modified();
      this.Circle.UpdateBuffers(this.Layer.AnnotationView);
    }
  };

  CircleWidget.prototype.SaveDefaults = function () {
    // Save values in local storage as defaults for next time.
    this.Defaults.Color = this.Circle.GetOutlineColor();
    this.Defaults.LineWidth = this.Circle.LineWidth;
    this.Defaults.Radius = this.Circle.Radius;

    localStorage.CircleWidgetDefaults = JSON.stringify(this.Defaults);
  };

  CircleWidget.prototype.Draw = function () {
    if (this.State !== NEW_HIDDEN && this.Circle) {
      var view = this.Layer.GetView();
      this.Circle.Draw(view);
      if (this.State === ACTIVE || this.State === HOVER) {
        var origin = this.Circle.Origin;
        var cam = this.Layer.GetCamera();
        var pt = cam.ConvertPointWorldToViewer(origin[0], origin[1]);
        this.Cross.Origin = [pt[0], pt[1]];
        this.Cross.Draw(view);
      }
    }
  };

  CircleWidget.prototype.PasteCallback = function (layer, data, mouseWorldPt) {
    this.Load(data);
    // Place the widget over the mouse.
    // This would be better as an argument.
    this.SetOrigin([mouseWorldPt[0], mouseWorldPt[1]]);
    // TODO: Just have the caller draw.
    layer.EventuallyDraw();
  };

  CircleWidget.prototype.Serialize = function () {
    if (this.Circle === undefined) { return null; }
    var element = this.Element;
    element.type = 'circle';
    element.center = [this.Circle.Origin[0], this.Circle.Origin[1], 0];
    element.lineColor = SAM.ConvertColorToHex(this.Circle.OutlineColor);
    element.radius = this.Circle.Radius;
    element.lineWidth = this.Circle.LineWidth;
    //element.creation_camera = this.CreationCamera;

    if (this.Circle.Children.label && this.Circle.Children.label.String) {
      element.label = {'value': this.Circle.Children.label.String};
    }
    // Serialize the keypoints
    var childKey, child;
    for (childKey in this.Circle.Children) {
      child = this.Circle.Children[childKey];
      if (typeof(child) === "object" && 'Radius' in child) {
        if (! "user" in element) {
          element["user"] = {}
        }
        var user = element["user"];
        if (! "keypoints" in user) {
          user["keypoints"] = []
        }
        var keypoints = user["keypoints"];
        // This is an inefficient schema.  I have to search an array.
        // This will not add a new keypoint.
        for (var i = 0; i < keypoints.length; ++i) {
          var kp = keypoints[i]
          if (kp.category === childKey) {
            kp.xy = child.Origin;
          }
        }
      }
    }
    
    return element;
  };

  // Load a widget from a json object (origin MongoDB).
  // Layer is needed to update the bufferes.
  // TODO: delayed upldating bufferes until the first draw
  CircleWidget.prototype.Load = function (element) {
    this.Element = element;
    this.Circle.Origin[0] = Math.round(parseFloat(element.center[0]));
    this.Circle.Origin[1] = Math.round(parseFloat(element.center[1]));
    if (element['lineColor'] !== undefined) {
      var outlinecolor = SAM.ConvertColor(element.lineColor);
      this.Circle.OutlineColor[0] = parseFloat(outlinecolor[0]);
      this.Circle.OutlineColor[1] = parseFloat(outlinecolor[1]);
      this.Circle.OutlineColor[2] = parseFloat(outlinecolor[2]);
    } else {
      this.Circle.OutlineColor[0] = 0.0;
      this.Circle.OutlineColor[1] = 1.0;
      this.Circle.OutlineColor[2] = 1.0;
    }
    this.Circle.Radius = Math.round(parseFloat(element.radius));
    this.Circle.LineWidth = 0;
    if (element.lineWidth) {
      this.Circle.LineWidth = parseFloat(element.lineWidth);
    }
    this.Circle.FixedSize = false;
    this.Circle.UpdateBuffers(this.Layer.AnnotationView);

    // How zoomed in was the view when the annotation was created.
    if (element.creation_camera !== undefined) {
      this.CreationCamera = element.CreationCamera;
    }

    if ("label" in element) {
      var str = element["label"]["value"]
      var text = new SAM.Text()
      text.BackgroundFlag = false;
      text.String = str;
      text.Position = this.Circle.Origin;
      this.Circle.Children["label"] = text;
    }
    
    if ("user" in element) {
      var user = element['user'];
      if ("keypoints" in user) {
        var keypoints = user['keypoints'];
        for (var idx = 0; idx < keypoints.length; ++idx) {
          var kp = keypoints[idx];
          var circle = new SAM.Circle();
          if (kp["category"] == "nose") {
            circle.SetFillColor([0.0, 1.0, 0]);
          } else if (kp["category"] == "tail") {
            circle.SetFillColor([1.0, 0.0, 0]);
          } else if (kp["category"] == "left_wingtip") {
            circle.SetFillColor([1.0, 0.0, 1.0]);
          } else if (kp["category"] == "right_wingtip") {
            circle.SetFillColor([0.0, 1.0, 1.0]);
          } else {
            circle.SetFillColor([0.8, 0.8, 1]);
          }
          circle.SetOutlineColor([0.0, 0.0, 0.0]);
          circle.Radius = 2;
          circle.LineWidth = 1;
          circle.Origin = kp['xy'];
          this.Circle.Children[kp["category"]] = circle;
        }
      } else if ("network_keypoints" in user) {
        var keypoints = user['network_keypoints'];
        for (var idx = 0; idx < keypoints.length; ++idx) {
          var kp = keypoints[idx];
          var circle = new SAM.Circle();
          if (kp["keypoint_category"] == "nose") {
            circle.SetFillColor([0.5, 1.0, 0.5]);
          } else if (kp["keypoint_category"] == "tail") {
            circle.SetFillColor([1.0, 0.5, 0.5]);
          } else {
            circle.SetFillColor([0.8, 0.8, 1]);
          }
          circle.SetOutlineColor([0.0, 0.0, 0.0]);
          circle.Radius = 2;
          circle.LineWidth = 1;
          circle.Origin = kp['xy'];
          this.Circle.Children[kp["keypoint_category"]] = circle;
        }
      }
    }
  };

  CircleWidget.prototype.HandleKeyDown = function (keyCode) {
    if (this.State === INACTIVE) {
      return true;
    }

    // The dialog consumes all key events.
    if (this.State === DIALOG) {
      return false;
    }

    // Escape key
    if (event.keyCode === 27) {
      if (this.State === NEW_DRAG) {
        // Circle has not been placed. Delete the circle.
        this.Layer.DeleteSelected();
      }
      this.SetActive(false);
      return false;
    }

    // Copy
    if (event.keyCode === 67 && event.ctrlKey) {
      // control-c for copy
      // The extra identifier is not needed for widgets, but will be
      // needed if we have some other object on the clipboard.
      var clip = {Type: 'CircleWidget', Data: this.Serialize()};
      localStorage.ClipBoard = JSON.stringify(clip);
      return false;
    }

    return true;
  };

  CircleWidget.prototype.HandleMouseDown = function (layer) {
    if (this.State !== HOVER && this.State !== NEW_DRAG) {
      return true;
    }

    var event = layer.Event;
    if (event.which !== 1) {
      return false;
    }
    var cam = layer.GetCamera();
    if (this.State === NEW_DRAG) {
      // We need the viewer position of the circle center to drag radius.
      this.OriginViewer =
                cam.ConvertPointWorldToViewer(this.Circle.Origin[0],
                                              this.Circle.Origin[1]);
      this.State = NEW_DRAG_RADIUS;
    }
    if (this.State === HOVER) {
      var circlePart = this.MouseOverWhichPart(layer.Event);
      // Determine behavior from active radius.
      if (typeof(circlePart) === "object") {
        this.State = DRAG_KEYPOINT;
        this.KeyPoint = circlePart;
      } else if (circlePart === CENTER) {
        this.State = DRAG;
      } else if (circlePart === CIRCUMFERENCE) {
        this.OriginViewer =
                    cam.ConvertPointWorldToViewer(this.Circle.Origin[0],
                                                  this.Circle.Origin[1]);
        this.State = DRAG_RADIUS;
      }
    }
    return false;
  };

  // returns false when it is finished doing its work.
  CircleWidget.prototype.HandleMouseUp = function (layer) {
    if (this.State === INACTIVE) {
      return true;
    }

    if (this.State === NEW_DRAG_RADIUS) {
      this.SetActive(false);
      this.Modified();
      this.Layer.EventuallyDraw();
    }

    if (this.State === DRAG || this.State === DRAG_RADIUS ||
        this.State === DRAG_KEYPOINT) {
      this.State = HOVER;
      this.Modified();
      this.Layer.EventuallyDraw();
      this.KeyPoint = undefined;
    }

    var event = layer.Event;
    if (this.State === HOVER && event.which === 3) {
      // Right mouse was pressed.
      // Pop up the properties dialog.
      // Which one should we popup?
      // Add a ShowProperties method to the widget. (With the magic of javascript).
      this.ShowPropertiesDialog();
    }

    return false;
  };

  // returns false when it is finished doing its work.
  CircleWidget.prototype.HandleMouseClick = function () {
    if (this.State === INACTIVE) {
      return true;
    }
    if (this.State === NEW_DRAG || this.State === NEW_DRAG_RADIUS) {
      this.SetActive(false);
      this.Modified();
      // A click to place bring up another circle for automatic / fast annotation.
      var widget = new SAM.CircleWidget(this.Layer);
      this.Layer.AddWidget(widget);
      widget.SetCreationCamera(this.Layer.GetCamera());
      widget.SetStateToDrawing();

      return false;
    }
    return true;
  };

  CircleWidget.prototype.HandleMouseMove = function (layer) {
    if (this.State === INACTIVE) {
      return true;
    }

    var event = layer.Event;
    var x = this.Layer.MouseX;
    var y = this.Layer.MouseY;

    // Hover logic.
    if (this.State === ACTIVE || this.State === HOVER) {
      var circlePart = this.MouseOverWhichPart(layer.Event);
      if (this.Circle.FillColor !== undefined && circlePart === INSIDE) {
        // Mouse if over a child keypoint.
        this.State = HOVER;
        this.Layer.GetParent().css({'cursor': 'move'});
        return false;
      }
      if (this.Circle.FillColor !== undefined && circlePart === INSIDE) {
        this.State = HOVER;
        this.Layer.GetParent().css({'cursor': 'move'});
        return false;
      }
      if (circlePart === CIRCUMFERENCE || circlePart === CENTER) {
        this.State = HOVER;
        this.Layer.GetParent().css({'cursor': 'move'});
        return false;
      }
      if (typeof(circlePart) === "object" && 'Radius' in circlePart) {
        this.State = HOVER;
        this.Layer.GetParent().css({'cursor': 'move'});
        return false;
      }
      this.State = ACTIVE;
      this.Layer.GetParent().css({'cursor': ''});
      return true;
    }

    // Hack to fix weird state where mouse up is not called.
    if (event.which === 0 &&
        (this.State === NEW_DRAG_RADIUS || this.State === DRAG_RADIUS ||
         this.State === DRAG || this.State === DRAG_KEYPOINT)) {
      return this.HandleMouseUp(event);
    }

    if (event.which === 0 && this.State === ACTIVE) {
      this.SetActive(this.CheckActive(event));
      return false;
    }

    var cam = layer.GetCamera();
    if (this.State === NEW_HIDDEN) {
      this.State = NEW_DRAG;
    }
    if (this.State === NEW_DRAG || this.State === DRAG) {
      if (SA && SA.notesWidget) { SA.notesWidget.MarkAsModified(); } // hack
      this.SetOrigin(cam.ConvertPointViewerToWorld(x, y));
      layer.EventuallyDraw();
    }

    if (this.State === DRAG_RADIUS || this.State === NEW_DRAG_RADIUS) {
      var viewport = layer.GetViewport();
      cam = layer.GetCamera();
      var dx = x - this.OriginViewer[0];
      var dy = y - this.OriginViewer[1];
      // Change units from pixels to world.
      this.Circle.Radius = Math.sqrt(dx * dx + dy * dy) * cam.Height / viewport[3];
      this.Circle.UpdateBuffers(layer.AnnotationView);
      if (SA && SA.notesWidget) { SA.notesWidget.MarkAsModified(); } // hack
      layer.EventuallyDraw();
    }

    if (this.State === DRAG_KEYPOINT) {
      if (SA && SA.notesWidget) { SA.notesWidget.MarkAsModified(); } // hack
      this.KeyPoint.Origin = cam.ConvertPointViewerToWorld(x, y);
      layer.EventuallyDraw();
    }

    if (this.State === INACTIVE) {
      this.CheckActive(event);
    }
    return false;
  };

  CircleWidget.prototype.HandleTouchPan = function (layer) {
    if (this.State === INACTIVE) {
      return true;
    }

    var event = layer.Event;
    var cam = layer.GetCamera();
    // TODO: Last mouse should net be in layer.
    var w0 = cam.ConvertPointViewerToWorld(layer.LastMouseX,
                                           layer.LastMouseY);
    var w1 = cam.ConvertPointViewerToWorld(event.offsetX, event.offsetY);

    // This is the translation.
    var dx = w1[0] - w0[0];
    var dy = w1[1] - w0[1];

    this.Circle.Origin[0] += dx;
    this.Circle.Origin[1] += dy;
    layer.EventuallyDraw();
    return false;
  };

  CircleWidget.prototype.HandleTouchPinch = function (layer) {
    if (this.State === INACTIVE) {
      return true;
    }

    this.Circle.Radius *= layer.PinchScale;
    this.Circle.UpdateBuffers(layer.AnnotationView);
    if (SA && SA.notesWidget) { SA.notesWidget.MarkAsModified(); } // hack
    layer.EventuallyDraw();
    return false;
  };

  CircleWidget.prototype.HandleTouchEnd = function (layer) {
    if (this.State === INACTIVE) {
      return true;
    }

    this.SetActive(false);
    return false;
  };

  // Returns the selected stroke or undefined.
  CircleWidget.prototype.SingleSelect = function () {
    if (this.State === NEW_HIDDEN || this.State === NEW_DRAG || this.State === DIALOG) {
      return false;
    }

    var circlePart = this.MouseOverWhichPart(this.Layer.Event);

    if (this.Circle.FillColor !== undefined && circlePart === INSIDE) {
      this.Circle.SetSelectede(true);
      return this;
    }
    if (circlePart === CIRCUMFERENCE || circlePart === CENTER) {
      this.Circle.SetSelected(true);
      return this;
    }
    // Handle clicking on the keypoints.
    if (typeof(circlePart) === "object") {
      this.Circle.SetSelected(true);
      return this;
    }

    this.Circle.SetSelected(false);
    return false;
  };

  // Returns true or false.  Point is in viewer coordinates.
  CircleWidget.prototype.MouseOverWhichPart = function (event) {
    var pt = [event.offsetX, event.offsetY];
    var c, r, child, childKey;
    
    // Check the children (keypoints).
    for (childKey in this.Circle.Children) {
      child = this.Circle.Children[childKey];
      if (typeof(child) === "object" && 'Radius' in child) {
        // Assume the child is a circle.
        c = child.Origin;
        r = child.Radius;
        if (!this.FixedSize) {
          var cam = this.Layer.GetCamera();
          c = cam.ConvertPointWorldToViewer(c[0], c[1]);
          r = cam.ConvertScaleWorldToViewer(r);
        }
        var dx = pt[0] - c[0];
        var dy = pt[1] - c[1];
        var d = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(d) < r + this.Tolerance) {
          return child;
        }
      }
    }
    
    c = this.Circle.Origin;
    r = this.Circle.Radius;
    var lineWidth = this.Circle.LineWidth;
    // Do the comparison in view coordinates.
    if (!this.FixedSize) {
      var cam = this.Layer.GetCamera();
      c = cam.ConvertPointWorldToViewer(c[0], c[1]);
      r = cam.ConvertScaleWorldToViewer(r);
      lineWidth = cam.ConvertScaleWorldToViewer(lineWidth);
    }

    var dx = pt[0] - c[0];
    var dy = pt[1] - c[1];

    var d = Math.sqrt(dx * dx + dy * dy);

    if (Math.abs(d - r) < this.Tolerance + lineWidth) {
      return CIRCUMFERENCE;
    }
    if (d < (2 * this.Tolerance + lineWidth)) {
      return CENTER;
    }
    if (d < r) {
      return INSIDE;
    }
    return 0;
  };

  SAM.CircleWidget = CircleWidget;
})();
