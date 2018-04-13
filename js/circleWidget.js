
(function () {
  'use strict';

  // ==============================================================================
  // Mouse down defined the center.
  // Drag defines the radius.

  // The circle has just been created and is following the mouse.
  // I can probably merge this state with drag. (mouse up vs down though)
  var NEW_HIDDEN = 0;
  var NEW_DRAGGING = 1;
  var DRAG = 2; // The whole arrow is being dragged.
  var DRAG_RADIUS = 3;
  var WAITING = 4; // The normal (resting) state.
  var ACTIVE = 5; // Mouse is over the widget and it is receiving events.
  var PROPERTIES_DIALOG = 6; // Properties dialog is up

  function CircleWidget (layer) {
    this.Layer = layer;
    // Keep track of annotation created by students without edit
    // permission.
    this.Type = 'circle';

    this.Tolerance = 0.05;
    if (SAM.MOBILE_DEVICE) {
      this.Tolerance = 0.1;
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
    this.Shape = new SAM.Circle();
    this.Shape.Origin = [0, 0];
    this.Shape.OutlineColor = [0.0, 0.0, 0.0];
    this.Shape.SetOutlineColor('#00ff00');
    this.Shape.Radius = 50 * cam.Height / viewport[3];
    this.Shape.LineWidth = 5.0 * cam.Height / viewport[3];
    this.Shape.FixedSize = false;

    // Note: If the user clicks before the mouse is in the
    // canvas, this will behave odd.

    this.State = WAITING;
  }


  CircleWidget.prototype.InitializeDialog = function (layer) {
    var self = this;

    this.Dialog = new SAM.Dialog(function () { self.DialogApplyCallback(layer); });
    // Customize dialog for a circle.
    this.Dialog.Title.text('Circle Annotation Editor');
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

    // Get default properties.
    if (localStorage.CircleWidgetDefaults) {
      var defaults = JSON.parse(localStorage.CircleWidgetDefaults);
      if (defaults.Color) {
        this.Dialog.ColorInput.val(SAM.ConvertColorToHex(defaults.Color));
      }
      if (defaults.LineWidth) {
        this.Dialog.LineWidthInput.val(defaults.LineWidth);
      }
    }
  }

  
  // TODO: Do this initialization outside
  // layer.AddWidget(this);
  // if (newFlag) {
  //  this.State = NEW_HIDDEN;
  //  layer.ActivateWidget(this);
  //  return;
  // }

  CircleWidget.prototype.Draw = function () {
    if (this.State !== NEW_HIDDEN) {
      this.Shape.Draw(this.Layer.GetView());
    }
  };

  CircleWidget.prototype.PasteCallback = function (layer, data, mouseWorldPt) {
    this.Load(data);
    // Place the widget over the mouse.
    // This would be better as an argument.
    this.Shape.Origin = [mouseWorldPt[0], mouseWorldPt[1]];
    // TODO: Just have the caller draw.
    layer.EventuallyDraw();
  };

  CircleWidget.prototype.Serialize = function () {
    if (this.Shape === undefined) { return null; }
    var obj = {};
    obj.type = 'circle';
    obj.origin = this.Shape.Origin;
    obj.outlinecolor = this.Shape.OutlineColor;
    obj.radius = this.Shape.Radius;
    obj.linewidth = this.Shape.LineWidth;
    obj.creation_camera = this.CreationCamera;
    return obj;
  };

  // Load a widget from a json object (origin MongoDB).
  // Layer is needed to update the bufferes.
  // TODO: delayed upldating bufferes until the first draw
  CircleWidget.prototype.Load = function (obj) {
    this.Shape.Origin[0] = parseFloat(obj.origin[0]);
    this.Shape.Origin[1] = parseFloat(obj.origin[1]);
    this.Shape.OutlineColor[0] = parseFloat(obj.outlinecolor[0]);
    this.Shape.OutlineColor[1] = parseFloat(obj.outlinecolor[1]);
    this.Shape.OutlineColor[2] = parseFloat(obj.outlinecolor[2]);
    this.Shape.Radius = parseFloat(obj.radius);
    this.Shape.LineWidth = parseFloat(obj.linewidth);
    this.Shape.FixedSize = false;
    this.Shape.UpdateBuffers(this.Layer.AnnotationView);

    // How zoomed in was the view when the annotation was created.
    if (obj.creation_camera !== undefined) {
      this.CreationCamera = obj.CreationCamera;
    }
  };

  CircleWidget.prototype.HandleKeyDown = function (keyCode) {
    // The dialog consumes all key events.
    if (this.State === PROPERTIES_DIALOG) {
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
    if (layer.which !== 1) {
      return false;
    }
    var cam = layer.GetCamera();
    if (this.State === NEW_DRAGGING) {
      // We need the viewer position of the circle center to drag radius.
      this.OriginViewer =
                cam.ConvertPointWorldToViewer(this.Shape.Origin[0],
                                              this.Shape.Origin[1]);
      this.State = DRAG_RADIUS;
    }
    if (this.State === ACTIVE) {
      // Determine behavior from active radius.
      if (this.NormalizedActiveDistance < 0.5) {
        this.State = DRAG;
      } else {
        this.OriginViewer =
                    cam.ConvertPointWorldToViewer(this.Shape.Origin[0],
                                                  this.Shape.Origin[1]);
        this.State = DRAG_RADIUS;
      }
    }
    return false;
  };

  // returns false when it is finished doing its work.
  CircleWidget.prototype.HandleMouseUp = function (layer) {
    if (this.State === DRAG ||
             this.State === DRAG_RADIUS) {
      this.SetActive(false);

      if (window.SA) { SA.RecordState(); }
    }
    return false;
  };

  CircleWidget.prototype.HandleMouseMove = function (layer) {
    var x = layer.offsetX;
    var y = layer.offsetY;

    var event = layer.Event;
    // Hack to fix weird state where mouse up is not called.
    if (event.which === 0 && (this.State === DRAG_RADIUS || this.State === DRAG)) {
      return this.HandleMouseUp(event);
    }

    if (event.which === 0 && this.State === ACTIVE) {
      this.SetActive(this.CheckActive(event));
      return false;
    }

    var cam = layer.GetCamera();
    if (this.State === NEW_HIDDEN) {
      this.State = NEW_DRAGGING;
    }
    if (this.State === NEW_DRAGGING || this.State === DRAG) {
      if (SA && SA.notesWidget) { SA.notesWidget.MarkAsModified(); } // hack
      this.Shape.Origin = cam.ConvertPointViewerToWorld(x, y);
      layer.EventuallyDraw();
    }

    if (this.State === DRAG_RADIUS) {
      var viewport = layer.GetViewport();
      cam = layer.GetCamera();
      var dx = x - this.OriginViewer[0];
      var dy = y - this.OriginViewer[1];
      // Change units from pixels to world.
      this.Shape.Radius = Math.sqrt(dx * dx + dy * dy) * cam.Height / viewport[3];
      this.Shape.UpdateBuffers(layer.AnnotationView);
      if (SA && SA.notesWidget) { SA.notesWidget.MarkAsModified(); } // hack
      layer.EventuallyDraw();
    }

    if (this.State === WAITING) {
      this.CheckActive(event);
    }
    return false;
  };

  CircleWidget.prototype.HandleTouchPan = function (layer) {
    var event = layer.Event;
    var cam = layer.GetCamera();
    // TODO: Last mouse should net be in layer.
    var w0 = cam.ConvertPointViewerToWorld(layer.LastMouseX,
                                           layer.LastMouseY);
    var w1 = cam.ConvertPointViewerToWorld(event.offsetX, event.offsetY);

    // This is the translation.
    var dx = w1[0] - w0[0];
    var dy = w1[1] - w0[1];

    this.Shape.Origin[0] += dx;
    this.Shape.Origin[1] += dy;
    layer.EventuallyDraw();
    return false;
  };

  CircleWidget.prototype.HandleTouchPinch = function (layer) {
    this.Shape.Radius *= layer.PinchScale;
    this.Shape.UpdateBuffers(layer.AnnotationView);
    if (SA && SA.notesWidget) { SA.notesWidget.MarkAsModified(); } // hack
    layer.EventuallyDraw();
    return false;
  };

  CircleWidget.prototype.HandleTouchEnd = function (layer) {
    this.SetActive(false);
    return false;
  };

  CircleWidget.prototype.CheckActive = function (layer) {
    if (this.State === NEW_HIDDEN ||
            this.State === NEW_DRAGGING) {
      return true;
    }

    var event = layer.Event;
    var dx = event.offsetX;
    var dy = event.offsetY;

    // change dx and dy to vector from center of circle.
    if (this.FixedSize) {
      dx = event.offsetX - this.Shape.Origin[0];
      dy = event.offsetY - this.Shape.Origin[1];
    } else {
      dx = event.worldX - this.Shape.Origin[0];
      dy = event.worldY - this.Shape.Origin[1];
    }

    var d = Math.sqrt(dx * dx + dy * dy) / this.Shape.Radius;
    var active = false;
    var lineWidth = this.Shape.LineWidth / this.Shape.Radius;
    this.NormalizedActiveDistance = d;

    if (this.Shape.FillColor === undefined) { // Circle
      if ((d < (1.0 + this.Tolerance + lineWidth) && d > (1.0 - this.Tolerance)) ||
                d < (this.Tolerance + lineWidth)) {
        active = true;
      }
    } else { // Disk
      if ((d < (1.0 + this.Tolerance + lineWidth) && d > (this.Tolerance + lineWidth)) ||
          (d < lineWidth)) {
        active = true;
      }
    }

    return active;
  };

  CircleWidget.prototype.ShowPropertiesDialog = function () {
    this.Dialog.ColorInput.val(SAM.ConvertColorToHex(this.Shape.OutlineColor));

    this.Dialog.LineWidthInput.val((this.Shape.LineWidth).toFixed(2));

    var area = (2.0 * Math.PI * this.Shape.Radius * this.Shape.Radius) * 0.25 * 0.25;
    var areaString = '';
    if (this.Shape.FixedSize) {
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

    this.Dialog.Show(true);
  };

  CircleWidget.prototype.DialogApplyCallback = function (layer) {
    var hexcolor = this.Dialog.ColorInput.val();
    this.Shape.SetOutlineColor(hexcolor);
    this.Shape.LineWidth = parseFloat(this.Dialog.LineWidthInput.val());
    this.Shape.UpdateBuffers(layer.AnnotationView);
    this.SetActive(false);
    if (window.SA) { SA.RecordState(); }

    // TODO: See if anything has changed.
    layer.EventuallyDraw();

    localStorage.CircleWidgetDefaults = JSON.stringify({Color: hexcolor, LineWidth: this.Shape.LineWidth});
    if (SA && SA.notesWidget) { SA.notesWidget.MarkAsModified(); } // hack
  };

  SAM.CircleWidget = CircleWidget;
})();
