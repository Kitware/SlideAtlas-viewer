// ==============================================================================
// Camera Object
// Set the viewport separately

window.SAM = window.SAM || {};

(function () {
  'use strict';

  function Camera () {
    // This transformation is from global/world to slide coordinate system
    this.WorldToImageTransform = [1,0,0,1,0,0];

    // Better managmenet of layers and sub layers.
    // Assign a range of the z buffer  for the view to use exclusively.
    // The full range is -1->1.  -1 is in front.
    this.ZRange = [-1.0, 1.0];
    this.WorldRoll = 0;
    this.WorldMatrix = mat4.create();
    this.ImageMatrix = mat4.create();
    this.Height = 16000;
    this.Width = this.Height * 1.62;
    this.WorldFocalPoint = [128.0 * 64.0, 128.0 * 64.0];
    this.ComputeMatrix();
    // for drawing the view bounds.
    this.Points = [];
    this.Buffer = null;
    this.CreateBuffer();
    this.Mirror = false;

    // Placeholders
    this.ViewportWidth = 162;
    this.ViewportHeight = 100;
  }

  // This transformation is from global/world to slide coordinate system
  Camera.prototype.SetWorldToImageTransform = function (trans) {
    this.WorldToImageTransform = trans;
    this.ComputeMatrix();
  };

  Camera.prototype.GetViewportHeight = function () {
    return this.ViewportHeight;
  };

  // Spacing of pixels of the screen.
  Camera.prototype.GetSpacing = function () {
    return this.GetHeight() / this.ViewportHeight;
  };

  Camera.prototype.DeepCopy = function (inCam) {
    if (inCam.ZRange) { this.ZRange = inCam.ZRange.slice(0); }
    this.WorldRoll = inCam.WorldRoll;
    this.Height = inCam.Height;
    this.Width = inCam.Width;
    this.SetWorldFocalPoint(inCam.WorldFocalPoint);
    if (inCam.ViewportWidth) { this.ViewportWidth = inCam.ViewportWidth; }
    if (inCam.ViewportHeight) { this.ViewportHeight = inCam.ViewportHeight; }
    this.ComputeMatrix();
  };

  Camera.prototype.SetViewport = function (viewport) {
    if (10 * viewport[3] < viewport[2]) {
      // alert("Unusual viewport " + viewport[3]);
      return;
    }
    this.ViewportWidth = viewport[2];
    this.ViewportHeight = viewport[3];
    this.Width = this.Height * this.ViewportWidth / this.ViewportHeight;
    this.ComputeMatrix();
  };

  Camera.prototype.Serialize = function () {
    var obj = {};
    obj.WorldFocalPoint = [this.WorldFocalPoint[0], this.WorldFocalPoint[1]];
    obj.WorldRoll = this.WorldRoll;
    obj.Height = this.GetHeight();
    obj.Width = this.GetWidth();
    return obj;
  };

  Camera.prototype.Load = function (obj) {
    this.SetWorldFocalPoint(obj.FocalPoint);
    this.WorldRoll = obj.Roll;
    this.Height = obj.Height;
    if (obj.Width) {
      this.Width = obj.Width;
    } else {
      this.Width = this.Height * this.ViewportWidth / this.ViewportHeight;
    }

    // Width is computed from height and aspect.
    this.ComputeMatrix();
  };

  // Roll is in Radians
  // Rotation is in Degrees
  Camera.prototype.GetWorldRotation = function () {
    return this.WorldRoll * 180.0 / 3.1415926535;
  };

  Camera.prototype.GetImageRotation = function () {
    return this.GetImageRoll() * 180.0 / 3.1415926535;
  };

  Camera.prototype.GetWorldRoll = function () {
    return this.WorldRoll;
  };

  // Legacy: What a pain.
  Camera.prototype.GetImageRoll = function () {
    // Create a world up vector.
    var x = Math.cos(this.WorldRoll);
    var y = Math.sin(this.WorldRoll);
    // Transform to image coordinate system.
    var t = this.WorldToImageTransform;
    var imx = (t[0] * x) + (t[2] * y);
    var imy = (t[1] * x) + (t[3] * y);
    // Now normalize.
    var mag = Math.sqrt(imx * imx + imy * imy);
    imx = imx / mag;
    imy = imy / mag;
    // Now convert back into radians.
    return Math.atan2(imy, imx);
  };

  Camera.prototype.GetWorldFocalPoint = function () {
    // Copy to avoid bugs because arrays are shared.
    // These are nasty to find.
    return [this.WorldFocalPoint[0], this.WorldFocalPoint[1]];
  };

  Camera.prototype.GetImageFocalPoint = function () {
    return SAM.ApplyTransform(this.WorldToImageTransform, this.WorldFocalPoint);
  };

  // This is in global/world coordinate system.
  Camera.prototype.SetWorldFocalPoint = function (fp) {
    if (isNaN(fp[0]) || isNaN(fp[1])) {
      console.log('Camera 1');
      return;
    }
    this.WorldFocalPoint[0] = fp[0];
    this.WorldFocalPoint[1] = fp[1];
    // Ignore z on purpose.
  };

  // View is in screen pixel coordinates.
  Camera.prototype.ConvertPointViewerToImage = function (x, y) {
    // Convert to world coordinate system
    // Compute focal point from inverse overview camera.
    var m = this.ImageMatrix;
    x = x / this.ViewportWidth;
    y = y / this.ViewportHeight;
    x = (x * 2.0 - 1.0) * m[15];
    y = (1.0 - y * 2.0) * m[15];
    var det = m[0] * m[5] - m[1] * m[4];
    var xNew = (x * m[5] - y * m[4] + m[4] * m[13] - m[5] * m[12]) / det;
    var yNew = (y * m[0] - x * m[1] - m[0] * m[13] + m[1] * m[12]) / det;

    return [xNew, yNew];
  };

  // View is in screen pixel coordinates.
  Camera.prototype.ConvertPointViewerToWorld = function (x, y) {
    // Convert to world coordinate system
    // Compute focal point from inverse overview camera.
    var m = this.WorldMatrix;
    x = x / this.ViewportWidth;
    y = y / this.ViewportHeight;
    x = (x * 2.0 - 1.0) * m[15];
    y = (1.0 - y * 2.0) * m[15];
    var det = m[0] * m[5] - m[1] * m[4];
    var xNew = (x * m[5] - y * m[4] + m[4] * m[13] - m[5] * m[12]) / det;
    var yNew = (y * m[0] - x * m[1] - m[0] * m[13] + m[1] * m[12]) / det;

    return [xNew, yNew];
  };

  Camera.prototype.ConvertPointWorldToViewer = function (x, y) {
    var m = this.WorldMatrix;

    // Convert from world coordinate to view (-1->1);
    var h = (x * m[3] + y * m[7] + m[15]);
    var xNew = (x * m[0] + y * m[4] + m[12]) / h;
    var yNew = (x * m[1] + y * m[5] + m[13]) / h;
    // Convert from view to screen pixel coordinates.
    xNew = (1.0 + xNew) * 0.5 * this.ViewportWidth;
    yNew = (1.0 - yNew) * 0.5 * this.ViewportHeight;

    return [xNew, yNew];
  };

  // dx, dy are in view coordinates [-0.5,0.5].
  // The camera world matrix converts world to view.
  Camera.prototype.HandleTranslate = function (dx, dy) {
    // Convert view vector to world vector.
    // We could invert the matrix to get the transform, but this is easier for now.....
    var s = Math.sin(this.WorldRoll);
    var c = Math.cos(this.WorldRoll);
    var w = this.GetWidth();

    if (this.Mirror) {
      dy = -dy;
    }

    // Scale to world.
    dx = dx * w;
    dy = dy * w;
    // Rotate
    var rx = dx * c + dy * s;
    var ry = dy * c - dx * s;

    this.Translate(rx, ry, 0.0);
  };

  // x,y are in display coordiantes (origin at the center).
  // dx,dy are in the same coordinates system (scale).
  // Scale does not matter because we only care about rotation.
  Camera.prototype.HandleRoll = function (x, y, dx, dy) {
    // Avoid divide by zero / singularity
    if (x === 0 && y === 0) {
      return;
    }
    // Orthogonal (counter clockwise) dot dVect.
    var dRoll = -y * dx + x * dy;
    // Remove magnitude of location.
    // Scale by R to get correct angle.
    dRoll = dRoll / (x * x + y * y);
    if (this.Mirror) {
      dRoll = -dRoll;
    }
    // Keep roll in radians.
    this.WorldRoll += dRoll;

    this.ComputeMatrix();
  };

  Camera.prototype.Translate = function (dx, dy, dz) {
    if (isNaN(dx) || isNaN(dy) || isNaN(dz)) {
      console.log('Camera 2');
      return;
    }
    // I will leave this as an exception.
    // Everything else uses SetWorldFocalPoint([x,y]);
    this.WorldFocalPoint[0] += dx;
    this.WorldFocalPoint[1] += dy;
    this.ComputeMatrix();
  };

  Camera.prototype.GetHeight = function () {
    return this.Height;
  };

  Camera.prototype.SetHeight = function (height) {
    if (isNaN(height)) {
      console.log('Camera 3');
      return;
    }
    this.Height = height;
    // Width tracks height.
    this.Width = height * this.ViewportWidth / this.ViewportHeight;
  };

  Camera.prototype.GetWidth = function () {
    return this.Width;
  };

  Camera.prototype.SetWidth = function (width) {
    if (isNaN(width)) {
      console.log('Camera 4');
      return;
    }
    this.Width = width;
    // Width tracks height.
    this.Height = width * this.ViewportHeight / this.ViewportWidth;
  };

  // In radians
  Camera.prototype.SetWorldRoll = function (roll) {
    this.WorldRoll = roll;
  };

  // Image coordinates.
  Camera.prototype.GetImageBounds = function () {
    var w = this.GetWidth();
    var h = this.GetHeight();

    var pt = this.ConvertPointViewerToImage(0, 0);
    var sBds = [pt[0], pt[0], pt[1], pt[1]];
    pt = this.ConvertPointViewerToImage(w, h);
    sBds[0] = Math.min(sBds[0], pt[0]);
    sBds[1] = Math.max(sBds[1], pt[0]);
    sBds[2] = Math.min(sBds[2], pt[1]);
    sBds[3] = Math.max(sBds[3], pt[1]);

    return sBds;
  };

  // World Matrix (world -> view)?
  Camera.prototype.GetWorldMatrix = function () {
    return this.WorldMatrix;
  };

  // Image Matrix (slide -> view)?
  Camera.prototype.GetImageMatrix = function () {
    return this.ImageMatrix;
  };

  // Camera matrix transforms points into camera coordinate system
  // X:(-1->1)
  // Y:(-1->1) (-1 is bottom)
  // Z:(-1->1) (-1 is front)
  // Image may not have a perfect matrix in the future We may support
  // nonlinear slide to world transformationss
  Camera.prototype.ComputeMatrix = function () {
    var fp = this.GetWorldFocalPoint();
    var roll = this.GetWorldRoll();
    var s = Math.sin(roll);
    var c = Math.cos(roll);
    var x = fp[0];
    var y = fp[1];
    var z = 10;
    var w = this.GetWidth();
        // var ht = this.GetHeight();  The iPad got this wrong?????
    var ht = this.Height;

    if (w < 0) { return; }

    if (this.Mirror) { ht = -ht; }

    mat4.identity(this.WorldMatrix);

    this.WorldMatrix[0] = c;
    this.WorldMatrix[1] = -s * w / ht;
    this.WorldMatrix[4] = -s;
    this.WorldMatrix[5] = -c * w / ht;
    this.WorldMatrix[9] = 0;
    this.WorldMatrix[10] = (this.ZRange[1] - this.ZRange[0]) * 0.5;
    this.WorldMatrix[12] = -c * x + s * y;
    this.WorldMatrix[13] = -(w / ht) * (-s * x - c * y);
    this.WorldMatrix[14] = -z + (this.ZRange[1] + this.ZRange[0]) * 0.25 * w;
    this.WorldMatrix[15] = 0.5 * w;

    // Now the ImageMatrix.  In the future slide to world transform will be
    // more general so the matrix will not capture the entire
    // transformation.
    var slideToWorld = SAM.InvertTransform(this.WorldToImageTransform);

    mat4.identity(this.ImageMatrix);
    this.ImageMatrix[0] = this.WorldMatrix[0];
    this.ImageMatrix[1] = this.WorldMatrix[1];
    this.ImageMatrix[4] = this.WorldMatrix[4];
    this.ImageMatrix[5] = this.WorldMatrix[5];
    this.ImageMatrix[9] = this.WorldMatrix[9];
    this.ImageMatrix[10] = this.WorldMatrix[10];
    this.ImageMatrix[12] = this.WorldMatrix[12];
    this.ImageMatrix[13] = this.WorldMatrix[13];
    this.ImageMatrix[14] = this.WorldMatrix[14];
    this.ImageMatrix[15] = this.WorldMatrix[15];

    // Concatenate the section mmatrix.
    
    var m0 = this.ImageMatrix[0];
    var m1 = this.ImageMatrix[1];
    var m4 = this.ImageMatrix[4];
    var m5 = this.ImageMatrix[5];
    this.ImageMatrix[0] = (m0 * slideToWorld[0]) + (m4 * slideToWorld[1]);
    this.ImageMatrix[1] = (m1 * slideToWorld[0]) + (m5 * slideToWorld[1]);
    this.ImageMatrix[4] = (m0 * slideToWorld[2]) + (m4 * slideToWorld[3]);
    this.ImageMatrix[5] = (m1 * slideToWorld[2]) + (m5 * slideToWorld[3]);
    this.ImageMatrix[12] += (m0 * slideToWorld[4]) + (m4 * slideToWorld[5]);
    this.ImageMatrix[13] += (m1 * slideToWorld[4]) + (m5 * slideToWorld[5]);
  };

  // Currenly assumes parallel projection and display z range = [-1,1].
  // Also no rotation!
  // a.k.a. This method does not work.
  Camera.prototype.DisplayToWorld = function (x, y, z) {
    var scale = this.Height / this.ViewportHeight;
    x = x - (0.5 * this.ViewportWidth);
    y = y - (0.5 * this.ViewportHeight);
    var worldPt = [];
    worldPt[0] = this.WorldFocalPoint[0] + (x * scale);
    worldPt[1] = this.WorldFocalPoint[1] + (y * scale);
    worldPt[2] = 10 + (z * this.Height * 0.5);

    return worldPt;
  };

  Camera.prototype.AddPoint = function (x, y, z) {
    this.Points.push(x);
    this.Points.push(y);
    this.Points.push(z);
  };

  Camera.prototype.CreateBuffer = function (gl) {
    if (gl) {
      if (this.Buffer !== null) {
        gl.deleteBuffer(this.Buffer);
      }
      this.Buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.Buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.Points),
                          gl.STATIC_DRAW);
    }
  };

  // Getting rid of this.
  Camera.prototype.UpdateBuffer = function () {
    this.Points = [];
    var cx = this.WorldFocalPoint[0];
    var cy = this.WorldFocalPoint[1];
    var rx = this.GetWidth() * 0.5;
    var ry = this.GetHeight() * 0.5;
    this.AddPoint(cx - rx, cy - ry);
    this.AddPoint(cx + rx, cy - ry);
    this.AddPoint(cx + rx, cy + ry);
    this.AddPoint(cx - rx, cy + ry);
    this.AddPoint(cx - rx, cy - ry);
    this.CreateBuffer();
  };

  // Camera is already set.
  Camera.prototype.Draw = function (overview, gl) {
    var overviewCam = overview.Camera;
    var viewport = overview.Viewport;

    var c = this.GetWorldFocalPoint();
    var rx = this.GetWidth() * 0.5;
    var ry = this.GetHeight() * 0.5;

    // To handle rotation, I need to pass the center through
    // the overview camera matrix. Coordinate system is -1->1
    var newCx = (c[0] * overviewCam.WorldMatrix[0] + c[1] * overviewCam.WorldMatrix[4] +
                     overviewCam.WorldMatrix[12]) / overviewCam.WorldMatrix[15];
    var newCy = (c[0] * overviewCam.WorldMatrix[1] + c[1] * overviewCam.WorldMatrix[5] +
                     overviewCam.WorldMatrix[13]) / overviewCam.WorldMatrix[15];

    if (gl) { /*
            // I having trouble using the overview camera, so lets just compute
            // the position of the rectangle here.
            var ocx = overviewCam.WorldFocalPoint[0];
            var ocy = overviewCam.WorldFocalPoint[1];
            var orx = overviewCam.GetWidth() * 0.5;
            var ory = overviewCam.GetHeight() * 0.5;

            program = SA.polyProgram;
            gl.useProgram(program);
            gl.uniform3f(program.colorUniform, 0.9, 0.0, 0.9);

            gl.viewport(viewport[0],viewport[1],viewport[2],viewport[3]);
            mat4.identity(pMatrix);
            gl.uniformMatrix4fv(program.pMatrixUniform, false, pMatrix);

            var viewFrontZ = overviewCam.ZRange[0]+0.001;

            mat4.identity(mvMatrix);
            //mvMatrix[12] = ((cx-rx)-ocx)/orx;
            //mvMatrix[13] = ((cy-ry)-ocy)/ory;
            mvMatrix[12] = newCx-(rx/orx);
            mvMatrix[13] = newCy-(ry/ory);
            mvMatrix[14] = viewFrontZ;
            mvMatrix[0] = 2*rx/orx;
            mvMatrix[5] = 2*ry/ory;

            gl.bindBuffer(gl.ARRAY_BUFFER, SA.squareOutlinePositionBuffer);
            gl.vertexAttribPointer(program.vertexPositionAttribute,
                                   SA.squareOutlinePositionBuffer.itemSize,
                                   gl.FLOAT, false, 0, 0);
            gl.uniformMatrix4fv(program.mvMatrixUniform, false, mvMatrix);
            gl.drawArrays(gl.LINE_STRIP, 0,
            SA.squareOutlinePositionBuffer.numItems);
            */
    } else {
      // Transform focal point from -1->1 to viewport
      newCx = (1.0 + newCx) * viewport[2] * 0.5;
      newCy = (1.0 - newCy) * viewport[3] * 0.5;
      // Scale width and height from world to viewport.
      rx = rx * viewport[3] / overviewCam.GetHeight();
      ry = ry * viewport[3] / overviewCam.GetHeight();

      // The 2d canvas was left in world coordinates.
      var ctx = overview.Context2d;
      /*
        ctx.beginPath();
        //ctx.strokeStyle="#E500E5";
        ctx.rect(this.WorldFocalPoint[0]-(0.5*width),
                 this.WorldFocalPoint[1]-(0.5*height),width,height);
        //ctx.fillStyle="#E500E5";
        //ctx.fillRect(this.WorldFocalPoint[0]-(0.5*width),
                       this.WorldFocalPoint[1]-(0.5*height),width,height);
        ctx.stroke();
      */
      ctx.save();
      // ctx.setTransform(1,0,0,1,0,0);
      // Now that the while slide / overview canvas is rotating
      // We have to rotate the rectangle.
      var c = Math.cos(this.WorldRoll);
      var s = Math.sin(this.WorldRoll);
      ctx.setTransform(c, -s, +s, c,
                       (1 - c) * newCx - s * newCy,
                       (1 - c) * newCy + s * newCx);

      ctx.strokeStyle = '#4011E5';
      ctx.beginPath();
      ctx.rect(newCx - rx, newCy - ry, 2 * rx, 2 * ry);
      ctx.stroke();
      ctx.restore();
    }
  };

  SAM.Camera = Camera;

  // Transform utilites.
  SAM.ApplyTransform = function (t, pt) {
    var x = (t[0] * pt[0]) + (t[2] * pt[1]) + t[4];
    var y = (t[1] * pt[0]) + (t[3] * pt[1]) + t[5];
    return [x,y];
  };

  SAM.MultiplyTransforms = function (t1, t2) {
    return [(t1[0] * t2[0]) + (t1[2] * t2[1]),
            (t1[1] * t2[0]) + (t1[3] * t2[1]),
            (t1[0] * t2[2]) + (t1[2] * t2[3]),
            (t1[1] * t2[2]) + (t1[3] * t2[3]),
            (t1[0] * t2[4]) + (t1[2] * t2[5]) + t1[4],
            (t1[1] * t2[4]) + (t1[3] * t2[5]) + t1[5]];
  };

  SAM.InvertTransform = function (t) {
    var p = (t[0] * t[3]) - (t[1] * t[2]);
    var q = (t[2] * t[5]) - (t[3] * t[4]);
    var s = (t[0] * t[5]) - (t[1] * t[4]);
    var inv = [t[3]/p, -t[1]/p, -t[2]/p, t[0]/p, q/p, -s/p]
    return inv;
  };

  /*
  SAM.InvertTransform = function (t) {
    var p = (t[0] * t[3]) + (t[1] * t[2]);
    var q = (t[0] * t[5]) + (t[1] * t[4]);
    var inv = [
      (p + (t[1] * t[2])) / (p * t[0]),
      -t[1] / p,
      -(t[0] * t[2]) / (p * t[0]),
      t[0] / p,
      ((q * t[2]) - (p * t[4])) / (p * t[0]),
      -q / p]
    return inv;
  };
  */

})();
