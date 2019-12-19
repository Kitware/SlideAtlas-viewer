// Since there is already a rectangle widget (for axis aligned rectangle)
// renaming this as Rect, other possible name is OrientedRectangle

(function () {
  'use strict';

  // Bits for WhichDrag (not the best way to encode this state).
  var DRAG_X0 = 1;
  var DRAG_X1 = 2;
  var DRAG_Y0 = 4;
  var DRAG_Y1 = 8;
  var SYMMETRIC = 16; // Lock the position of the center
  // var ASPECT = 32;    // Lock the aspect ratio
  // These two are only used alone.  However, they are drag features.
  var CENTER = 64;
  var ROTATE = 128;

  var NEW = 0;         // Newly created and waiting to be placed.
  var INACTIVE = 1;    // Not resposnsive tp mouse events
  var ACTIVE = 2;      // Mouse is receiving move events, but mouse is not over.
  var HOVER = 3;       // Mouse is over the widget and it is receiving events.
  var DRAG = 4;        // Mouse is down and dragging part of widget. Modified by WhichDrag.
  var DIALOG = 5;      // Properties dialog is up

  // enum for part identification.
  var CORNER = 0;
  var EDGE = 1;

  // Remember the last size to use for the next.
  var DEFAULT_WIDTH = -1;
  var DEFAULT_HEIGHT = -1;

  var DEFAULT_LABEL;

  function Rect () {
    SAM.Shape.call(this);

    this.Width = 50;
    this.Height = 50;
    this.Orientation = 0; // Angle with respect to x axis ?
    this.Origin = new Array(2); // Center in world coordinates.
    this.Origin.fill(10000);
    this.OutlineColor = new Array(3);
    this.OutlineColor.fill(0);
    this.PointBuffer = [];
  }

  Rect.prototype = new SAM.Shape();

  Rect.prototype.destructor = function () {
    // Get rid of the buffers?
  };

  // Rect.prototype.Draw = function(view) {
  //   if (this.Image) {
  //     view.Context2d.drawImage(this.Image, 0,0);
  //   }
  //   SAM.Shape.prototype.Draw.call(this, view);
  // }

  Rect.prototype.UpdateBuffers = function (view) {
    this.PointBuffer = [];

    this.Matrix = mat4.create();
    mat4.identity(this.Matrix);
    mat4.rotateZ(this.Matrix, this.Orientation / 180.0 * 3.14159);

    this.PointBuffer.push(1 * this.Width / 2.0);
    this.PointBuffer.push(1 * this.Height / 2.0);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(-1 * this.Width / 2.0);
    this.PointBuffer.push(1 * this.Height / 2.0);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(-1 * this.Width / 2.0);
    this.PointBuffer.push(-1 * this.Height / 2.0);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(1 * this.Width / 2.0);
    this.PointBuffer.push(-1 * this.Height / 2.0);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(1 * this.Width / 2.0);
    this.PointBuffer.push(1 * this.Height / 2.0);
    this.PointBuffer.push(0.0);
  };

  function RectWidget (layer) {
    if (layer === null) {
      return null;
    }
    this.Layer = layer;
    this.Type = 'rect';
    this.Visibility = true;
    // Keep track of annotation created by students without edit
    // permission.
    this.UserNoteFlag = !SA.Edit;

    // This method gets called if the active state of this widget turns on or off.
    // This is used to turn off the pencil button in the Panel.
    this.StateChangeCallback = undefined;
    // This is used by the annotationPanel to transfer draing mode to a new selected widget.
    this.SelectedCallback = undefined;

    this.Tolerance = 0.05;
    if (SAM.detectMobile()) {
      this.Tolerance = 0.1;
    }

    var cam = this.Layer.GetCamera();
    var viewport = this.Layer.GetViewport();
    this.Shape = new Rect();
    // TODO: Correct the mix or orientation and rotation.
    this.Shape.Orientation = cam.GetImageRotation();
    this.Shape.Origin.fill(0);
    this.Shape.SetOutlineColor([0.0, 0.0, 0.0]);
    if (DEFAULT_WIDTH > 0) {
      this.Shape.Height = DEFAULT_HEIGHT;
      this.Shape.Width = DEFAULT_WIDTH;
    } else {
      this.Shape.Height = 50.0 * cam.Height / viewport[3];
      this.Shape.Width = 50.0 * cam.Height / viewport[3];
    }
    this.Shape.LineWidth = 0;
    this.Shape.FixedSize = false;

    // This is a handle for translation.
    this.CenterCircle = new SAM.Circle();
    this.CenterCircle.SetFillColor([1, 1, 0]);
    this.CenterCircle.SetOutlineColor([0.0, 0.0, 0.0]);
    this.CenterCircle.Radius = 5;
    this.CenterCircle.LineWidth = 1;
    this.CenterCircle.PositionCoordinateSystem = 1;

    this.Rotatable = true;

    // Circle is a handle for rotation.
    this.RotateCircle = new SAM.Circle();
    this.RotateCircle.SetFillColor([1, 1, 0]);
    this.RotateCircle.SetOutlineColor([0.0, 0.0, 0.0]);
    this.RotateCircle.Radius = 5;
    this.RotateCircle.LineWidth = 1;
    this.RotateCircle.PositionCoordinateSystem = 1;

    // Get default properties.
    if (localStorage.RectWidgetDefaults) {
      var defaults = JSON.parse(localStorage.RectWidgetDefaults);
      if (defaults.Color) {
        this.Shape.SetOutlineColor(defaults.Color);
      }
    }

    if (DEFAULT_LABEL) {
      var text = new SAM.Text();
      text.BackgroundFlag = false;
      text.String = DEFAULT_LABEL;
      text.Position = this.Circle.Origin;
      this.Circle.Children['label'] = text;
    }

    // Note: If the user clicks before the mouse is in the
    // canvas, this will behave odd.

    this.Layer.GetParent().css({'cursor': 'default'});
    this.State = INACTIVE;
    this.WhichDrag = 0;      // Bits
  }

  RectWidget.prototype.SetOrigin = function (x, y) {
    this.Shape.Origin[0] = x;
    this.Shape.Origin[1] = y;
    if (this.Shape.Children.Label) {
      this.Shape.Children.Label = this.Shape.Origin;
    }
  };

  // Not used yet, but might be useful.
  RectWidget.prototype.SetCreationCamera = function (cam) {
    // Lets save the zoom level (sort of).
    // Load will overwrite this for existing annotations.
    // This will allow us to expand annotations into notes.
    this.CreationCamera = cam.Serialize();
  };

  RectWidget.prototype.SetModifiedCallback = function (callback) {
    this.ModifiedCallback = callback;
  };

  // Called when the widget is modified.
  RectWidget.prototype.Modified = function () {
    if (this.ModifiedCallback) {
      this.ModifiedCallback(this);
    }
  };

  RectWidget.prototype.SetSelectedCallback = function (callback) {
    this.SelectedCallback = callback;
  };

  // This callback gets called when ever the active state changes,
  // even if caused by an external call. This widget is passed as a argument.
  // This is used to turn off the pencil button in the Panel.
  RectWidget.prototype.SetStateChangeCallback = function (callback) {
    this.StateChangeCallback = callback;
  };

  // Called when the state changes.
  RectWidget.prototype.StateChanged = function () {
    if (this.StateChangeCallback) {
      this.StateChangeCallback(this);
    }
  };

  // Bad name "drawing".  New widget dragging.
  RectWidget.prototype.SetStateToDrawing = function () {
    this.State = NEW;
    this.Shape.Visibility = false;
    // Do not render mouse "cursor" unti it moves and we know its location.
    this.Visibility = false;
    this.Layer.GetParent().css({'cursor': 'move'});
  };

  // Returns true if selected
  // This is sort of ugly.  Change it to delete directly if possible.
  // Return value will let the layer clean up.
  RectWidget.prototype.DeleteSelected = function () {
    return this.Shape.DeleteSelected();
  };

  RectWidget.prototype.IsEmpty = function () {
    if (this.State === NEW) {
      return true;
    }
    return this.Shape.IsEmpty();
  };

  // I am divorcing selected from active.
  RectWidget.prototype.IsSelected = function () {
    return this.Shape.Selected;
  };

  RectWidget.prototype.SetSelected = function (flag) {
    this.Shape.SetSelected(flag);
    if (flag && this.SelectedCallback) {
      (this.SelectedCallback)(this);
    }
    if (!flag) {
      // We can be selected without being active, but we cannot be
      // active without being selected.
      this.SetActive(false);
    }
  };

  // Selects the widget if the shape is fuly contained in the selection rectangle.
  RectWidget.prototype.ApplySelect = function (selection) {
    var pts = this.GetCornerPoints();
    var bds = [pts[0][0], pts[0][0], pts[0][1], pts[0][1]];
    for (var i = 1; i < 4; ++i) {
      bds[0] = Math.min(bds[0], pts[i][0]);
      bds[1] = Math.max(bds[1], pts[i][0]);
      bds[2] = Math.min(bds[2], pts[i][1]);
      bds[3] = Math.max(bds[3], pts[i][1]);
    }
    if (selection.ViewerPointInSelection(bds[0], bds[2]) &&
        selection.ViewerPointInSelection(bds[0], bds[3]) &&
        selection.ViewerPointInSelection(bds[1], bds[2]) &&
        selection.ViewerPointInSelection(bds[1], bds[3])) {
      this.SetSelected(true);
      return true;
    }
    this.SetSelected(false);
    return false;
  };

  // Tolerance in screen pixels
  RectWidget.prototype.GetTolerance = function () {
    var width = this.Shape.GetLineWidth();
    // Tolerance: 5 screen pixels.
    var minWidth = 20.0 / this.Layer.GetPixelsPerUnit();
    if (width < minWidth) { width = minWidth; }
    return width;
  };

  // Returns true if the mouse is over the rectangle.
  RectWidget.prototype.HandleSelect = function () {
    if (this.State === DIALOG) {
      return;
    }
    // Check to see if a stroke was clicked.
    // var x = this.Layer.MouseX;
    // var y = this.Layer.MouseY;
    var z = this.Layer.ZTime;
    if (this.Shape.Origin.length > 2 && this.Shape.Origin[2] !== z) {
      return false;
    }

    // var pt = this.Layer.GetCamera().ConvertPointViewerToWorld(x, y);

    var part = this.PointOnWhichPart();
    if (part !== undefined) {
      this.SetSelected(true);
      return true;
    } else {
      this.SetSelected(false);
    }

    return false;
  };

  // Threshold above is the only option for now.
  RectWidget.prototype.SetThreshold = function (threshold) {
    if (this.confidence !== undefined) {
      this.Visibility = this.confidence >= threshold;
    }
  };

  RectWidget.prototype.Draw = function () {
    if (this.Visibility === false) {
      return;
    }
    var view = this.Layer.GetView();
    if (this.Layer.ZTime !== undefined && this.Shape.Origin.length > 2) {
      if (this.Layer.ZTime !== this.Shape.Origin[2]) {
        return;
      }
    }
    this.Shape.Draw(view);
    if (this.State !== INACTIVE && this.State !== NEW && this.State !== DRAG) {
      var pts = this.GetCornerPoints();
      this.CenterCircle.Origin = pts[4];
      this.CenterCircle.Draw(view);
      // var cam = this.Layer.GetCamera();
      if (this.Rotatable) {
        this.RotateCircle.Origin = pts[0];
        this.RotateCircle.Draw(view);
      }
    }
  };

  RectWidget.prototype.PasteCallback = function (data, layer, mouseWorldPt) {
    this.Load(data);
    // Place the widget over the mouse.
    // This would be better as an argument.
    this.SetOrigin(mouseWorldPt[0], mouseWorldPt[1]);
    layer.EventuallyDraw();
    this.Modified();
  };

  RectWidget.prototype.Serialize = function () {
    if (this.Shape === undefined) { return null; }
    var obj = {
      'type': 'rectangle',
      'center': this.Shape.Origin,
      'width': this.Shape.Width,
      'height': this.Shape.Height,
      'rotation': this.Shape.GetOrientation(),
      // caller might handle this already.
      'lineWidth': this.Shape.LineWidth,
      'lineColor': SAM.ConvertColorToHex(this.Shape.OutlineColor)
    };
    if (obj.center.length === 2) {
      obj.center.push(0);
    }

    if (this.Shape.Children.label && this.Shape.Children.label.String) {
      obj.label = {'value': this.Shape.Children.label.String};
    }
    if ('UserImageUrl' in this.Shape) {
      obj.user = {'imageUrl': this.Shape.UserImageUrl};
    }

    return obj;
  };

  // Load a widget from a json object (origin MongoDB).
  RectWidget.prototype.Load = function (obj) {
    this.UserNoteFlag = obj.user_note_flag;
    this.SetOrigin(parseFloat(obj.center[0]),
                   parseFloat(obj.center[1]));
    if (obj.center.length > 2) {
      this.Shape.Origin[2] = parseFloat(obj.center[2]);
    }

    if (obj.lineColor) {
      this.Shape.OutlineColor = SAM.ConvertColor(obj.lineColor);
    }
    this.Shape.Width = parseFloat(obj.width);
    if (obj.confidence) {
      this.confidence = parseFloat(obj.confidence);
    }
    if (obj.height) {
      this.Shape.Height = parseFloat(obj.height);
    }
    if (obj.rotation) {
      this.Shape.Orientation = parseFloat(obj.rotation);
    }
    if (obj.lineWidth !== undefined) {
      this.Shape.LineWidth = parseFloat(obj.lineWidth);
    }
    this.Shape.FixedSize = false;
    this.Shape.UpdateBuffers(this.Layer.AnnotationView);

    // How zoomed in was the view when the annotation was created.
    if (obj.creation_camera !== undefined) {
      this.CreationCamera = obj.CreationCamera;
    }

    if ('label' in obj) {
      var str = obj['label']['value'];
      // I universally inserted label "test" before the label was rendered.
      if (str !== 'test') {
        var text = new SAM.Text();
        text.BackgroundFlag = false;
        text.String = str;
        text.Position = this.Shape.Origin;
        this.Shape.Children['label'] = text;
      }
    }

    if ('user' in obj) {
      var user = obj.user;
      if ('imageUrl' in user) {
        this.Shape.UserImageUrl = user.imageUrl;
        this.Shape.Image = new Image();
        var self = this;
        $(self.Shape.Image).one('load', function () {
          var width = self.Shape.Image.width;
          var height = self.Shape.Image.height;
          var hiddenCanvas = $('<canvas width=' + width + '  height=' + height + '>');
          var ctx = hiddenCanvas[0].getContext('2d');
          ctx.drawImage(self.Shape.Image, 0, 0);
          ctx.beginPath();
          ctx.lineWidth = '100';
          ctx.strokeStyle = 'blue';
          ctx.arc(500, 500, 300, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.clearRect(200, 200, 300, 300);
          self.Shape.Image.src = hiddenCanvas[0].toDataURL();
        });

        this.Shape.Image.src = user.imageUrl;
        // On loaded, render?
      }
    }
  };

  RectWidget.prototype.SetVisibility = function (vis) {
    this.Visibility = vis;
    this.Layer.EventuallyDraw();
  };

  RectWidget.prototype.HandleKeyDown = function (layer) {
    if (layer.Event.keyCode === 86) {
      this.Visibility = !this.Visibility;
      layer.EventuallyDraw();
      return true;
    }

    if (!this.Visibility || this.State === INACTIVE) {
      return true;
    }

    // The dialog consumes all key events.
    if (this.State === DIALOG) {
      return false;
    }

    var event = layer.Event;
    if (this.State === NEW) {
      // escape key (or space or enter) to turn off drawing
      if (event.keyCode === 27 || event.keyCode === 32 || event.keyCode === 13) {
        this.Modified();
        this.Deactivate();
                // this widget was temporary, All rects created have been copied.
        this.Layer.RemoveWidget(this);
        return false;
      }
    }

    // Copy
    if (event.keyCode === 67 && event.ctrlKey) {
      // control-c for copy
      // The extra identifier is not needed for widgets, but will be
      // needed if we have some other object on the clipboard.
      var clip = {Type: 'RectWidget', Data: this.Serialize()};
      localStorage.ClipBoard = JSON.stringify(clip);
      return false;
    }

    return true;
  };

  RectWidget.prototype.HandleMouseDown = function (layer) {
    if (!this.Visibility || this.State === INACTIVE) {
      return true;
    }
    if (this.State === NEW) {
      this.WhichDrag = DRAG_X0 + DRAG_Y0 + SYMMETRIC;
    }
    if (this.State === HOVER) {
      // var part = this.PointOnWhichPart();
      this.State = DRAG;
      this.LastMouse = layer.GetMouseWorld();
      // Which drag is already set by mouse move.
    }

    return false;
  };

  RectWidget.prototype.HandleMouseMove = function (layer) {
    if (this.State === INACTIVE) {
      return true;
    }
    var event = layer.Event;

    // Dragging is complicated enough that we have to compute reactangle
    // from the mouse movement vector (and not contraints).
    var worldPt0 = this.LastMouseWorld;
    var worldPt1 = this.Layer.GetMouseWorld();
    if (worldPt0 === undefined) {
      worldPt0 = worldPt1;
    }
    this.LastMouseWorld = worldPt1;
    var dx = worldPt1[0] - worldPt0[0];
    var dy = worldPt1[1] - worldPt0[1];
    var x = worldPt1[0] - this.Shape.Origin[0];
    var y = worldPt1[1] - this.Shape.Origin[1];

    // Mouse moving with no button pressed:
    if (event.which === 0) {
      // This keeps the rectangle from being drawn in the wrong place
      // before we get our first event.
      if (this.State === NEW) {
        this.Shape.Visibility = true;
        this.WhichDrag = CENTER;
        // THis is ignored until the mouse is pressed.
        this.Visibility = true;
        // Center follows mouse.
        this.SetOrigin(worldPt1[0], worldPt1[1]);
        this.Layer.EventuallyDraw();
        return false;
      }
      if (this.State === ACTIVE || this.State === HOVER) {
        var part = this.PointOnWhichPart();
        if (part === undefined) {
          this.State = ACTIVE;
          this.Layer.GetParent().css({'cursor': ''});
          return false;
        }
        this.State = HOVER;
        if (part[0] === CORNER) {
          switch (part[1]) {
            case 0:
              if (this.Rotatable) {
                this.Layer.GetParent().css({'cursor': 'pointer'});
                this.WhichDrag = ROTATE;
              } else {
                this.Layer.GetParent().css({'cursor': 'nw-resize'});
                this.WhichDrag = DRAG_X0 + DRAG_Y0;
              }
              break;
            case 1:
              this.Layer.GetParent().css({'cursor': 'ne-resize'});
              this.WhichDrag = DRAG_X1 + DRAG_Y0;
              break;
            case 2:
              this.Layer.GetParent().css({'cursor': 'se-resize'});
              this.WhichDrag = DRAG_X1 + DRAG_Y1;
              break;
            case 3:
              this.Layer.GetParent().css({'cursor': 'sw-resize'});
              this.WhichDrag = DRAG_X0 + DRAG_Y1;
              break;
            case 4:
              this.Layer.GetParent().css({'cursor': 'move'});
              this.WhichDrag = CENTER;
          }
        }
        if (part[0] === EDGE) {
          switch (part[1]) {
            case 0:
              this.Layer.GetParent().css({'cursor': 'ns-resize'});
              this.WhichDrag = DRAG_Y0;
              break;
            case 1:
              this.Layer.GetParent().css({'cursor': 'ew-resize'});
              this.WhichDrag = DRAG_X1;
              break;
            case 2:
              this.Layer.GetParent().css({'cursor': 'ns-resize'});
              this.WhichDrag = DRAG_Y1;
              break;
            case 3:
              this.Layer.GetParent().css({'cursor': 'ew-resize'});
              this.WhichDrag = DRAG_X0;
              break;
          }
        }
        return false;
      }
    }

    if (event.which !== 1) { return false; }

    // For transforming between world and box coordinate systems.
    var rotation = this.Shape.GetRotation();
    var c = Math.cos(rotation);
    var s = Math.sin(rotation);
    if (this.State === NEW || this.State === DRAG) {
      if (this.WhichDrag & CENTER) {
        // Special case with no modifiers.  Just translate the whole rectangle.
        this.SetOrigin(worldPt1[0], worldPt1[1]);
        this.Layer.EventuallyDraw();
        this.Modified();
        return false;
      }
      if (this.WhichDrag & ROTATE) {
        // Special case with no modifiers.  Just translate the whole rectangle.
        // Compute two vectors, then rotate to align them.
        var v0 = [-this.Shape.Width, -this.Shape.Height];
        var mag = Math.sqrt(v0[0] * v0[0] + v0[1] * v0[1]);
        v0[0] = v0[0] / mag;
        v0[1] = v0[1] / mag;
        var v1 = [x, y];
        mag = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
        v1[0] = v1[0] / mag;
        v1[1] = v1[1] / mag;
        c = v0[0] * v1[0] + v0[1] * v1[1];
        s = v0[0] * v1[1] - v0[1] * v1[0];
        this.Shape.Orientation = -Math.atan2(s, c) * 180 / Math.PI;
        this.Layer.EventuallyDraw();
        this.Modified();
        return false;
      }
      if (this.WhichDrag & SYMMETRIC) {
        var rx = c * x - s * y;
        var ry = s * x + c * y;
        if (this.WhichDrag & (DRAG_X1 + DRAG_X0)) {
          this.Shape.Width = 2 * rx;
        }
        if (this.WhichDrag & (DRAG_Y1 + DRAG_Y0)) {
          this.Shape.Height = 2 * ry;
        }
      } else {
        // Draging when not symmetric is a pain.
        // ------ This is not finihsed. -----------
        // Rotate mouse vector to be in rectangles coordinate system.
        // Position of the mouse in box coordinates.
        // Constrain the mouse vector based on axes being modified.
        // Transform the detla mouse to rectangle coordinate system.
        var rdx = (c * dx) - (s * dy);
        var rdy = (s * dx) + (c * dy);
        if (this.WhichDrag & DRAG_X1) {
          this.Shape.Width += rdx;
        } else if (this.WhichDrag & DRAG_X0) {
          this.Shape.Width -= rdx;
        } else {
          // This axis is not being maodified.  Ignore it.
          rdx = 0;
        }
        if (this.WhichDrag & DRAG_Y1) {
          this.Shape.Height += rdy;
        } else if (this.WhichDrag & DRAG_Y0) {
          this.Shape.Height -= rdy;
        } else {
          // This axis is not being maodified.  Ignore it.
          rdy = 0;
        }
        // Rotate the constrained mouse back to world coordinate system.
        dx = (c * rdx) + (s * rdy);
        dy = (-s * rdx) + (c * rdy);
        // Center is moving half as fast as the mouse.
        this.SetOrigin(this.Shape.Origin[0] + dx / 2.0,
                       this.Shape.Origin[1] + dy / 2.0);
      }
    }

    DEFAULT_WIDTH = this.Shape.Width;
    DEFAULT_HEIGHT = this.Shape.Height;
    this.Modified();
    this.Shape.UpdateBuffers();
    this.Layer.EventuallyDraw();
    return false;
  };

  // returns false when it is finished doing its work.
  RectWidget.prototype.HandleMouseUp = function () {
    if (!this.Visibility || this.State === INACTIVE) {
      return true;
    }
    if (this.State === NEW) {
      this.SetActive(false);
    }
    if (this.State === DRAG) {
      this.State = HOVER;
    }
    // Interaction can make these negative.
    this.Shape.Width = Math.abs(this.Shape.Width);
    this.Shape.Height = Math.abs(this.Shape.Height);
    this.Layer.EventuallyDraw();

    return false;
  };

  // returns false when it is finished doing its work.
  RectWidget.prototype.HandleMouseClick = function () {
    if (!this.Visibility || this.State === INACTIVE) {
      return true;
    }
    if (this.State === NEW) {
      this.SetActive(false);
      this.Modified();
      return false;
    }
    return true;
  };

  // Multiple active states. Active state is a bit confusing.
  RectWidget.prototype.GetActive = function () {
    if (this.State === INACTIVE) {
      return false;
    }
    return true;
  };

  RectWidget.prototype.SetActive = function (flag) {
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

  // Can we bind the dialog apply callback to an objects method?
  RectWidget.prototype.ShowPropertiesDialog = function () {
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

  RectWidget.prototype.DialogApplyCallback = function () {
    this.DialogPropertiesToWidget();
    this.SetActive(false, this.Layer);
    this.Layer.EventuallyDraw();
  };

  RectWidget.prototype.DialogCloseCallback = function () {
    this.SetActive(false);
    this.Layer.EventuallyDraw();
  };

  // Fill the dialog values from the widget values.
  RectWidget.prototype.WidgetPropertiesToDialog = function () {
    this.Dialog.ColorInput.val(SAM.ConvertColorToHex(this.Shape.OutlineColor));
    this.Dialog.LineWidthInput.val((this.Shape.LineWidth).toFixed(2));

    var label = '';
    if (this.Shape.Children.label && this.Shape.Children.label.String) {
      label = this.Shape.Children['label'].String;
    }
    this.Dialog.LabelInput.val(label);

    var area = this.Shape.Width * this.Shape.Height;
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
  };

  // Copy the properties of the dialog into the widget
  RectWidget.prototype.DialogPropertiesToWidget = function () {
    var modified = true;

    var hexcolor = this.Dialog.ColorInput.val();
    this.Shape.SetOutlineColor(hexcolor);
    this.Shape.LineWidth = parseFloat(this.Dialog.LineWidthInput.val());
    this.Shape.UpdateBuffers(this.Layer.AnnotationView);

    var label = this.Dialog.LabelInput.val();
    label = label.trim();
    if (label === '') {
      DEFAULT_LABEL = undefined;
      delete this.Shape.Children.label;
    } else {
      if (!this.Shape.Children.label) {
        var text = new SAM.Text();
        text.BackgroundFlag = false;
        text.String = label;
        text.Position = this.Shape.Origin;
        this.Shape.Children['label'] = text;
        DEFAULT_LABEL = label;
      }
      this.Shape.Children.label.String = label;
      modified = true;
    }

    if (modified) {
      // Save values in local storage as defaults for next time.
      localStorage.RectWidgetDefaults = JSON.stringify({
        Color: hexcolor,
        Width: this.Shape.LineWidth});
      this.Modified();
      this.Shape.UpdateBuffers(this.Layer.AnnotationView);
    }
  };

  // Get Corner points in the viewer coordinate system.
  // [ uperLeft, upperRight, lowerRight, lowerRight]
  RectWidget.prototype.GetCornerPoints = function () {
    var cam = this.Layer.GetCamera();
    var theta = this.Shape.GetRotation();
    var c = Math.cos(theta);
    var s = Math.sin(theta);
    var origin = this.Shape.Origin;
    var rw = this.Shape.Width / 2.0;
    var rh = this.Shape.Height / 2.0;

    var x, y;
    x = c * rw + s * rh;
    y = -s * rw + c * rh;
    var pt0 = [origin[0] - x, origin[1] - y];
    pt0 = cam.ConvertPointWorldToViewer(pt0[0], pt0[1]);
    var pt2 = [origin[0] + x, origin[1] + y];
    pt2 = cam.ConvertPointWorldToViewer(pt2[0], pt2[1]);

    rw = -rw;
    x = c * rw + s * rh;
    y = -s * rw + c * rh;
    var pt1 = [origin[0] - x, origin[1] - y];
    pt1 = cam.ConvertPointWorldToViewer(pt1[0], pt1[1]);
    var pt3 = [origin[0] + x, origin[1] + y];
    pt3 = cam.ConvertPointWorldToViewer(pt3[0], pt3[1]);

    var pt4 = [
      (pt0[0] + pt2[0]) * 0.5,
      (pt0[1] + pt2[1]) * 0.5];

    return [pt0, pt1, pt2, pt3, pt4];
  };

  // Points are order upperLeft, uuperRight, lowerRight, lowerLeft, center
  RectWidget.prototype.PointOnWhichPart = function () {
    var dx, dy;
    var event = this.Layer.Event;
    var x = event.offsetX;
    var y = event.offsetY;
    var tolerance = this.Shape.LineWidth + 3;
    var cornerTolerance2 = (tolerance + 2) * (tolerance + 2);
    var corners = this.GetCornerPoints();
    // First, check the corners.
    for (var i = 0; i < 5; ++i) {
      var corner = corners[i];
      dx = x - corner[0];
      dy = y - corner[1];
      if (dx * dx + dy * dy < cornerTolerance2) {
        return [CORNER, i];
      }
    }
    // Now check the edges.
    var corner0 = corners[3];
    for (i = 0; i < 4; ++i) {
      var corner1 = corners[i];
      if (this.Shape.IntersectPointLine([x, y], corner0, corner1, tolerance) !== undefined) {
        // Chance the edge index to start on top edge (=0).
        return [EDGE, (i + 3) % 4];
      }
      corner0 = corner1;
    }
    return undefined;
  };

  RectWidget.prototype.InitPropertiesDialog = function () {
    var self = this;
    this.Dialog = new SAM.Dialog(this.Layer.GetParent().parent());
    this.Dialog.SetApplyCallback(function () { self.DialogApplyCallback(); });
    // Customize dialog for a circle.
    this.Dialog.Title.text('Rect Annotation Editor');
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
            .val('#30ff00')
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
            .css({'display': 'table-cell'})
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
            .css({'display': 'table-row'});
    this.Dialog.AreaLabel =
            $('<div>')
            .appendTo(this.Dialog.AreaDiv)
            .text('Area:')
            .css({'display': 'table-cell',
              'text-align': 'left'});
    this.Dialog.Area =
            $('<div>')
            .appendTo(this.Dialog.AreaDiv)
            .css({'display': 'table-cell'});

    // Bounds
    this.Dialog.BoundsDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display': 'table-row'});
    this.Dialog.BoundsLabel =
            $('<div>')
            .appendTo(this.Dialog.BoundsDiv)
            .text('Bounds:')
            .css({'display': 'table-cell',
              'text-align': 'left'});
    this.Dialog.Bounds =
            $('<div>')
            .appendTo(this.Dialog.BoundsDiv)
            .css({'display': 'table-cell'});
  };

  SAM.Rect = Rect;
  SAM.RectWidget = RectWidget;
})();
