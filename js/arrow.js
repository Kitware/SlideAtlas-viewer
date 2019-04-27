(function () {
  'use strict';

  function Arrow () {
    SAM.Shape.call(this);
    this.Width = 10; // width of the shaft and size of the head
    this.Length = 50; // Length of the arrow in pixels
    this.Orientation = 45.0; // in degrees, counter clockwise, 0 is left
    this.Origin = [10000, 10000]; // Tip position in world coordinates.
    this.OutlineColor = [0, 0, 0];
    this.ZOffset = -0.1;
  }
  Arrow.prototype = new SAM.Shape();

  Arrow.prototype.destructor = function () {
    // Get rid of the buffers?
  };

  // This has to be in viewer coordinates bedcause we do not have the camera.
  // Point is in world coordinates.
  // Point origin is anchor and units pixels.
  Arrow.prototype.PointInShape = function (x, y) {
    // Rotate point so arrow lies along the x axis.
    var tmp = -(this.Orientation * Math.PI / 180.0);
    var ct = Math.cos(tmp);
    var st = Math.sin(tmp);
    var xNew = x * ct + y * st;
    var yNew = -x * st + y * ct;

    // Now we have to scale from global pixels to screen pixels.
    tmp = this.Width / 2.0;
    // Had to bump the y detection up by 3x because of unclickability on the iPad.
    if (xNew > 0.0 && xNew < this.Length * 1.3 && yNew < tmp * 3 && yNew > -tmp * 3) {
      return true;
    }
  };

  Arrow.prototype.UpdateBuffers = function (view) {
    this.PointBuffer = [];
    var cellData = [];
    var hw = this.Width * 0.5;
    var w2 = this.Width * 2.0;

    this.Matrix = mat4.create();
    mat4.identity(this.Matrix);

    this.PointBuffer.push(0.0);
    this.PointBuffer.push(0.0);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(w2);
    this.PointBuffer.push(this.Width);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(w2);
    this.PointBuffer.push(hw);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(this.Length);
    this.PointBuffer.push(hw);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(this.Length);
    this.PointBuffer.push(-hw);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(w2);
    this.PointBuffer.push(-hw);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(w2);
    this.PointBuffer.push(-this.Width);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(0.0);
    this.PointBuffer.push(0.0);
    this.PointBuffer.push(0.0);

    if (view.gl) {
      // Now create the triangles
      cellData.push(0);
      cellData.push(1);
      cellData.push(2);

      cellData.push(0);
      cellData.push(2);
      cellData.push(5);

      cellData.push(0);
      cellData.push(5);
      cellData.push(6);

      cellData.push(2);
      cellData.push(3);
      cellData.push(4);

      cellData.push(2);
      cellData.push(4);
      cellData.push(5);

      this.VertexPositionBuffer = view.gl.createBuffer();
      view.gl.bindBuffer(view.gl.ARRAY_BUFFER, this.VertexPositionBuffer);
      view.gl.bufferData(view.gl.ARRAY_BUFFER, new Float32Array(this.PointBuffer), view.gl.STATIC_DRAW);
      this.VertexPositionBuffer.itemSize = 3;
      this.VertexPositionBuffer.numItems = this.PointBuffer.length / 3;

      this.CellBuffer = view.gl.createBuffer();
      view.gl.bindBuffer(view.gl.ELEMENT_ARRAY_BUFFER, this.CellBuffer);
      view.gl.bufferData(view.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cellData), view.gl.STATIC_DRAW);
      this.CellBuffer.itemSize = 1;
      this.CellBuffer.numItems = cellData.length;
    }
  };

  // Polar is a pain.
  // This positions the tail a point in viewer coordinates.
  // This only works for world coordinat system, constant size, constant orientation.
  Arrow.prototype.SetTailViewer = function (x, y, cam) {
    var dx, dy;
    if (this.FixedSize) {
      var tipViewer = cam.ConvertPointWorldToViewer(this.Origin[0], this.Origin[1]);
      dx = x - tipViewer[0];
      dy = y - tipViewer[1];
    } else {
      var tailWorld = cam.ConvertPointViewerToWorld(x, y);
      dx = tailWorld[0] - this.Origin[0];
      dy = tailWorld[1] - this.Origin[1];
    }
    this.Length = Math.sqrt(dx * dx + dy * dy);
    this.Orientation = -Math.atan2(dy, dx) * 180.0 / Math.PI;
  };

  // Polar is a pain.
  // This positions the tail a point in viewer coordinates.
  // This only works for world coordinat system, constant size, constant orientation.
  Arrow.prototype.GetTailViewer = function (cam) {
    var theta = -this.Orientation * Math.PI / 180.0;
    var x, y;
    if (this.FixedSize) {
      var tipViewer = cam.ConvertPointWorldToViewer(this.Origin[0], this.Origin[1]);
      x = tipViewer[0] + this.Length * Math.cos(theta);
      y = tipViewer[1] + this.Length * Math.sin(theta);
      return [x, y];
    } else {
      x = this.Origin[0] + this.Length * Math.cos(theta);
      y = this.Origin[1] + this.Length * Math.sin(theta);
      var tailViewer = cam.ConvertPointWorldToViewer(x, y);
      return tailViewer;
    }
  };

  SAM.Arrow = Arrow;
})();
