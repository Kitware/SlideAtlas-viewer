// This widget just implements a 1 time selection of a rectangle on the screen.
// It draws the rectangle as a dom box (not in the canvas).
// I made it a first class widget and make it active (events are fowarded).
// I will choose the second, but this widget is meant to be
// temporary and not serialize to database.
// Since the rectangle may not be axis aligned withthe world, I added
// methods to check if a point is in the rectangle.

(function () {
  'use strict';

  var INACTIVE = 0;     // Normal inactive resting state.
  var START = 1;        // waiting for the first mouse down to place point1.
  var DRAG = 2;         // Mouse is down and user is dragging point2.
  var FINISH = 3;       // Mouse is up and the rectangle is finished.

  function RectSelectWidget (layer) {
    this.Layer = layer;
    SAM.Shape.call(this);

    this.State = INACTIVE;

    this.Point1 = undefined;
    this.Point2 = undefined;

    this.Rectangle = $('<div>')
      .css({
        'position': 'absolute',
        'border': '1px dashed #FF0'})
      .hide();
    this.FinishCallback = undefined;
    this.Camera = new SAM.Camera();
  }

  RectSelectWidget.prototype.SetFinishCallback = function (callback) {
    this.FinishCallback = callback;
  };

  // TODO: GET RID OF THIS (USE SetActive instead)
  // Starts the process of dragging a rectangle (just changes the cursor.
  RectSelectWidget.prototype.SetStateToDrawing = function () {
    this.State = START;
    this.Layer.GetParent().css({'cursor': 'nw-resize'});
  };

  // Starts the process of dragging a rectangle (just changes the cursor.
  RectSelectWidget.prototype.SetActive = function (flag) {
    if (!flag && this.State !== INACTIVE) {
      this.State = INACTIVE;
      this.Layer.GetParent().css({'cursor': ''});
    }
    if (flag && this.State === INACTIVE) {
      this.State = START;
      this.Layer.GetParent().css({'cursor': 'nw-resize'});
    }
  };

  RectSelectWidget.prototype.Draw = function () {
    if (this.State === DRAG) {
      var x = Math.min(this.Point1[0], this.Point2[0]);
      var y = Math.min(this.Point1[1], this.Point2[1]);
      var w = Math.abs(this.Point1[0] - this.Point2[0]);
      var h = Math.abs(this.Point1[1] - this.Point2[1]);
      this.Rectangle
        .css({
          'left': x.toString() + 'px',
          'top': y.toString() + 'px',
          'width': w.toString() + 'px',
          'height': h.toString() + 'px'})
        .show();
    }
  };

  RectSelectWidget.prototype.HandleMouseDown = function () {
    // Should we allow multiple selections, or a single use?
    if (this.State !== START) {
      return true;
    }
    this.State = DRAG;
    this.Rectangle.appendTo(this.Layer.GetParent());
    var event = this.Layer.Event;
    var x = event.offsetX;
    var y = event.offsetY;
    this.Point1 = [x, y];
    this.Point2 = [x, y];
    this.Draw();
    return false;
  };

  RectSelectWidget.prototype.HandleMouseMove = function () {
    if (this.State !== DRAG) {
      return true;
    }
    var event = this.Layer.Event;
    var x = event.offsetX;
    var y = event.offsetY;
    this.Point2 = [x, y];
    this.Draw();
    return false;
  };

  RectSelectWidget.prototype.HandleMouseUp = function () {
    if (this.State !== DRAG) {
      return true;
    }
    this.State = FINISH;
    this.Layer.GetParent().css({'cursor': ''});
    this.Rectangle.hide().remove();
    // Compute the world coordinates of the points.
    var x1 = Math.min(this.Point1[0], this.Point2[0]);
    var y1 = Math.min(this.Point1[1], this.Point2[1]);
    var x2 = Math.max(this.Point1[0], this.Point2[0]);
    var y2 = Math.max(this.Point1[1], this.Point2[1]);

    this.Point1 = [x1, y1];
    this.Point2 = [x2, y2];

    this.Camera.DeepCopy(this.Layer.GetCamera());
    if (this.FinishCallback) {
      this.FinishCallback(this);
    }
    return false;
  };

  RectSelectWidget.prototype.ViewerPointInSelection = function (x, y) {
    if (x > this.Point1[0] && x < this.Point2[0] &&
        y > this.Point1[1] && y < this.Point2[1]) {
      return true;
    }
    return false;
  };

  RectSelectWidget.prototype.WorldPointInSelection = function (x, y) {
    var viewerPt = this.Camera.ConvertPointWorldToViewer(x, y);
    return this.ViewerPointInSelection(viewerPt[0], viewerPt[1]);
  };

  SAM.RectSelectWidget = RectSelectWidget;
})();
