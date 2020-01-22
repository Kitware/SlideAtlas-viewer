// ==============================================================================
// Camera Object
// - View coordinates are leftover from WebGL.
// TODO:  Matrix cleanup:



window.SAM = window.SAM || {};

(function () {
  'use strict';

  // Image->world->viewer
  // Internally: Keep image to world, world->view, Viewport (view->viewer)
  function Camera () {
    // WorldToView:  Transforms "Volume" to view [-1->1]
    this.WorldToViewTransform = undefined;
    // WorldToImage:  WorldToImageTransform X ImageToViewTransofrm = WorldToViewTransform
    // Since we use ImageToView to render:
    //   ImageToView = WorldToImage^-1 X WorldToView
    // This transformation is from global/world to slide coordinate system.
    // It may be better to Store the inverse ImageToWorldTransform
    //this.WorldToImageTransform = [1, 0, 0, 1, 0, 0];
    this.ImageToWorldTransform = [1, 0, 0, 1, 0, 0];
    // Interaction changes world to image matrix.
    // For aligning sections
    this.AlignmentInteraction = false;
    
    // Better managmenet of layers and sub layers.
    // Assign a range of the z buffer  for the view to use exclusively.
    // The full range is -1->1.  -1 is in front.
    this.ZRange = [-1.0, 1.0];
    this.WorldRoll = 0;
    
    this.Height = 16000;
    this.Width = this.Height * 1.62;
    this.WorldFocalPoint = [128.0 * 64.0, 128.0 * 64.0];

    // for drawing the view bounds.
    this.Points = [];
    this.Buffer = null;
    this.CreateBuffer();
    this.Mirror = false;

    // When rotating, I want to stop at 0, 90, 180, and 270.
    this.RollStopFlag = false;
    this.RollStopCounter = 0.0;

    // Placeholders
    this.ViewportWidth = 162;
    this.ViewportHeight = 100;
  }

  // This transformation is from global/world to slide coordinate system.
  // This trasform is shared with the section so copy by reference is important.
  //Camera.prototype.SetWorldToImageTransform = function (trans) {
  //  this.WorldToImageTransform = trans;
  //};
  Camera.prototype.SetImageToWorldTransform = function (trans) {
    this.ImageToWorldTransform = trans;
  };

  Camera.prototype.GetImageToWorldTransform = function () {
    return this.ImageToWorldTransform;
  };
  Camera.prototype.GetWorldToViewTransform = function () {
    if ( this.WorldToViewTransform === undefined) {
      this.UpdateWorldToViewTransform();
    }
    return this.WorldToViewTransform;
  };
  Camera.prototype.GetWorldToImageTransform = function () {
    return SAM.InvertTransform(this.ImageToWorldTransform);
  };
  Camera.prototype.GetImageToViewTransform = function () {
    var i2w = this.GetImageToWorldTransform();
    var w2v = this.GetWorldToViewTransform();
    return SAM.ConcatTransforms([i2w, w2v]);
  };

  // WebGL used this matrix.  (not used currently)
  Camera.prototype.GetImageMatrix = function() {
    var imageToViewMatrix = mat4.create();
    mat4.identity(imageToViewMatrix);
    var i2v = this.GetImageToViewTransform();
    // I am not sure exaclty how z Worked.  This is probably wrong.
    // Z range loks like output.  Domain?
    imageToViewMatrix[0] = i2v[0];
    imageToViewMatrix[1] = i2v[1];
    imageToViewMatrix[4] = i2v[2];
    imageToViewMatrix[5] = i2v[3];
    imageToViewMatrix[10] = (this.ZRange[1] - this.ZRange[0]);
    imageToViewMatrix[12] = i2v[4];
    imageToViewMatrix[13] = i2v[5];
    imageToViewMatrix[14] = this.ZRange[0];

    return imageToViewMatrix;
  };

  // Uses focalpoint, height and roll to compute the world to view transform.
  Camera.prototype.UpdateWorldToViewTransform = function () {
    var fp = this.GetWorldFocalPoint();
    var roll = this.GetWorldRoll();
    var s = Math.sin(roll);
    var c = Math.cos(roll);

    var yScale = this.ViewportHeight / this.Height;
    var xScale = yScale
    if (this.Mirror) { xScale = -xScale; }

    var w2v0 = c * xScale;
    var w2v1 = s * yScale;
    var w2v2 = -s * xScale;
    var w2v3 = c * yScale;

    // fp -> center
    var xCenter = this.ViewportWidth / 2.0;
    var yCenter = this.ViewportHeight / 2.0;
    var w2v4 = xCenter - (w2v0 * fp[0] + w2v2 * fp[1]);
    var w2v5 = yCenter - (w2v1 * fp[0] + w2v3 * fp[1]);
    this.WorldToViewTransform = [w2v0, w2v1, w2v2, w2v3, w2v4, w2v5];
  };  
  
  Camera.prototype.AlignmentInteractionOff = function() {
    this.AlignmentInteraction = false;
  };
  
  Camera.prototype.AlignmentInteractionOn = function() {
    this.AlignmentInteraction = true;
  };

  Camera.prototype.GetViewportHeight = function () {
    return this.ViewportHeight;
  };

  Camera.prototype.GetViewportWidth = function () {
    return this.ViewportWidth;
  };

  // Spacing of pixels of the screen.
  Camera.prototype.GetSpacing = function () {
    return this.GetHeight() / this.ViewportHeight;
  };

  // Copies the world view but not the slide to world transform.
  Camera.prototype.WorldCopy = function (inCam) {
    if (inCam.ZRange) { this.ZRange = inCam.ZRange.slice(0); }
    this.WorldRoll = inCam.WorldRoll;
    this.Height = inCam.Height;
    this.Width = inCam.Width;
    this.SetWorldFocalPoint(inCam.WorldFocalPoint);
    if (inCam.ViewportWidth) { this.ViewportWidth = inCam.ViewportWidth; }
    if (inCam.ViewportHeight) { this.ViewportHeight = inCam.ViewportHeight; }
    this.WorldToViewTransform = undefined;
  };
  
  
  Camera.prototype.DeepCopy = function (inCam) {
    this.ImageToWorldTransform = inCam.ImageToWorldTransform.slice(0);
    this.WorldCopy(inCam);
  };

  Camera.prototype.SetViewport = function (viewport) {
    if (10 * viewport[3] < viewport[2]) {
      // alert('Unusual viewport ' + viewport[3]);
      return;
    }
    this.ViewportWidth = viewport[2];
    this.ViewportHeight = viewport[3];
    this.Width = this.Height * this.ViewportWidth / this.ViewportHeight;
    this.WorldToViewTransform = undefined;
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
    this.WorldToViewTransform = undefined;
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

  // Legacy: What a pain. Used by "Shape"
  Camera.prototype.GetImageRoll = function () {
    // Create a world up vector.
    var x = Math.cos(this.WorldRoll);
    var y = Math.sin(this.WorldRoll);
    // Transform to image coordinate system.
    var t = this.GetWorldToImageTransform();
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
    return SAM.ApplyTransform(this.GetWorldToImageTransform(), this.WorldFocalPoint);
  };

  // This is in global/world coordinate system.
  Camera.prototype.SetWorldFocalPoint = function (fp) {
    if (isNaN(fp[0]) || isNaN(fp[1])) {
      return;
    }
    this.WorldFocalPoint[0] = fp[0];
    this.WorldFocalPoint[1] = fp[1];
    // Ignore z on purpose.
  };

  // View is in screen pixel coordinates.
  Camera.prototype.ConvertPointViewToImage = function (x, y) {
    // Convert to world coordinate system
    // Compute focal point from inverse overview camera.
    var image2viewer = this.GetImageToViewTransform();
    var viewer2image = SAM.InvertTransform(image2viewer);

    return SAM.TransformPoint(viewer2image, x, y);
  };

  // View is in screen pixel coordinates.
  Camera.prototype.ConvertPointViewToWorld = function (x, y) {
    // Convert to world coordinate system
    // Compute focal point from inverse overview camera.
    var w2v = this.GetWorldToViewTransform();
    var v2w = SAM.InvertTransform(w2v);

    return SAM.TransformPoint(v2w, x, y);
  };

  Camera.prototype.ConvertPointWorldToView = function (x, y) {
    var w2v = this.GetWorldToViewTransform();

    return SAM.TransformPoint(w2v, x, y);
  };

  Camera.prototype.ConvertScaleViewToImage = function (dist) {
    // It looks like ImageToViewMatrix is scaled to height so to keep things
    // simple ....
    return this.Height / this.ViewportHeight;
  };

  Camera.prototype.ConvertScaleWorldToView = function (dist) {
    // It looks like ImageToViewMatrix is scaled to width so to keep things
    // simple ....
    return this.ViewportHeight / this.Height;
  };

  // dx, dy are in viewer coordinates.
  Camera.prototype.HandleTranslate = function (dx, dy) {
    var w2v = this.GetWorldToViewTransform();
    var v2w = SAM.InvertTransform(w2v);
    if (this.AlignmentInteraction) {
      var translate = [1,0,0,1,-dx,-dy];
      var i2w = this.GetImageToWorldTransform();

      var imageToWorld = SAM.ConcatTransforms([i2w, w2v, translate, v2w]);
      // ImageToWorldTransform is shared with the section.
      // Make sure this function operates in place on the ImageToWorldTransform.
      // TODO: fix this  ================ This is broken ====================
      SAM.CopyTransform(this.ImageToWorldTransform, imageToWorld);

      return;
    }

    // Convert view vector to world vector.
    vw = SAM.TransformVector(dx,dy);
    this.Translate(vw[0], vw[1], 0.0);
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

    if (this.AlignmentInteraction) {
      // This is actually pretty easy.
      // Final world to view is T^-1 W.  Prepend with rotation matrix.
      // T_new = T R^-1  (R^-1  is just rotation with negative angle).
      // Only the translation part is complicated.
      // R^-1 = [c, s, -s, c, x - c*x + s*y, y = c*x - s*y]
      // Now just multiply transforms.
      x = this.WorldFocalPoint[0];
      y = this.WorldFocalPoint[1];
      // This transform is shared with the section.
      // Make sure this is an inplace operation.
      var c = Math.cos(dRoll);
      var s = Math.sin(dRoll);
      var dx = x - (s * y) - (c * x); 
      var dy = y - (c * y) + (s * x);
      var rotate = [c, s, -s, c, -dx, -dy]
      SAM.CopyTransform(this.ImageToWorldTransform,
                        SAM.ConcatTransforms([this.ImageToWorldTransform, rotate]));
      return;
    }

    this.IncrementRollWithStops(dRoll);
  };

  Camera.prototype.IncrementRollWithStops = function (dRoll) {
    // Keep roll in radians.
    var newRoll = this.WorldRoll + dRoll;
    // Logic for 90 degree stops
    var rad90 = Math.PI * 0.5;

    // How long to stop in units radians.
    var stopDuration = rad90 / 9; // 10 degrees
    var quadrant = ((Math.floor(this.WorldRoll / rad90) % 4) + 4) % 4;
    var newQuadrant = ((Math.floor(newRoll / rad90) % 4) + 4) % 4;
    // Are we going to pass a stop?
    if (!this.RollStopFlag && quadrant !== newQuadrant) {
      // Yes, compute the stop angle.
      var stopAngle = 0;
      if (Math.abs(quadrant - newQuadrant) < 2) {
        stopAngle = (((quadrant + newQuadrant) / 2.0) + 0.5) * rad90;
      }
      this.RollStopFlag = true;
      // Rotate upto the stop (update dRoll) and let remaining cases execute..
      dRoll -= (this.WorldRoll - stopAngle);
      // Handle the 360->0 boundaries.
      var rad360 = Math.PI * 2.0;
      while (dRoll > Math.PI) {
        dRoll -= rad360;
      }
      while (dRoll < -Math.PI) {
        dRoll += rad360;
      }
      this.WorldRoll = stopAngle;
      if (dRoll > 0) {
        this.RollStopCounter = 0;
      } else {
        this.RollStopCounter = stopDuration;
      }
      dRoll = 0;
    }
    // If we are at a stop, advance the stop by dRoll.
    if (this.RollStopFlag) {
      this.RollStopCounter += dRoll;
      console.log('roll stop counter: ' + this.RollStopCounter);
      dRoll = 0;
      if (this.RollStopCounter < 0.0) {
        this.RollStopFlag = false;
        dRoll = this.RollStopCounter;
      }
      if (this.RollStopCounter > stopDuration) {
        this.RollStopFlag = false;
        dRoll = this.RollStopCounter - stopDuration;
      }
    }
    // Handle normal rotation.
    this.WorldRoll += dRoll;

    this.WorldToViewTransform = undefined;
  };

  Camera.prototype.Translate = function (dx, dy, dz) {
    if (isNaN(dx) || isNaN(dy) || isNaN(dz)) {
      return;
    }
    // I will leave this as an exception.
    // Everything else uses SetWorldFocalPoint([x,y]);
    this.WorldFocalPoint[0] += dx;
    this.WorldFocalPoint[1] += dy;
    this.WorldToViewTransform = undefined;
  };

  Camera.prototype.GetHeight = function () {
    return this.Height;
  };

  Camera.prototype.SetHeight = function (height) {
    if (isNaN(height)) {
      return;
    }
    this.Height = height;
    // Width tracks height.
    this.Width = height * this.ViewportWidth / this.ViewportHeight;
    this.WorldToViewTransform = undefined;
  };

  Camera.prototype.GetWidth = function () {
    return this.Width;
  };

  Camera.prototype.SetWidth = function (width) {
    if (isNaN(width)) {
      return;
    }
    this.Width = width;
    // Width tracks height.
    this.Height = width * this.ViewportHeight / this.ViewportWidth;
  };

  // In radians
  Camera.prototype.SetWorldRoll = function (roll) {
    this.WorldRoll = roll;
    this.WorldToViewTransform = undefined;
  };

  // Image coordinates.
  Camera.prototype.GetImageBounds = function () {
    var w = this.ViewportWidth;
    var h = this.ViewportHeight;

    var pt = this.ConvertPointViewToImage(0, 0);
    var sBds = [pt[0], pt[0], pt[1], pt[1]];
    pt = this.ConvertPointViewToImage(w, h);
    sBds[0] = Math.min(sBds[0], pt[0]);
    sBds[1] = Math.max(sBds[1], pt[0]);
    sBds[2] = Math.min(sBds[2], pt[1]);
    sBds[3] = Math.max(sBds[3], pt[1]);

    return sBds;
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

    var fp = this.GetWorldFocalPoint();
    var rx = this.GetWidth() * 0.5;
    var ry = this.GetHeight() * 0.5;

    // To handle rotation, I need to pass the center through
    // the overview camera matrix. Coordinate system is -1->1
    var w2v = overviewCam.GetWorldToViewTransform();
    var newCx = (fp[0] * w2v[0] + fp[1] * w2v[2] + w2v[4]);
    var newCy = (fp[0] * w2v[1] + fp[1] * w2v[3] + w2v[5]);

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
      // Scale width and height from world to viewport.
      rx = rx * viewport[3] / overviewCam.GetHeight();
      ry = ry * viewport[3] / overviewCam.GetHeight();

      // The 2d canvas was left in world coordinates.
      var ctx = overview.Context2d;
      /*
        ctx.beginPath();
        //ctx.strokeStyle='#E500E5';
        ctx.rect(this.WorldFocalPoint[0]-(0.5*width),
                 this.WorldFocalPoint[1]-(0.5*height),width,height);
        //ctx.fillStyle='#E500E5';
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
    return [x, y];
  };

  SAM.TransformBounds = function (t, bds) {
    var pt, out;
    pt = SAM.ApplyTransform(t, [bds[0], bds[2]]);
    out = [pt[0], pt[0], pt[1], pt[1]];
    pt = SAM.ApplyTransform(t, [bds[1], bds[2]]);
    out[0] = Math.min(out[0], pt[0]);
    out[1] = Math.max(out[1], pt[0]);
    out[2] = Math.min(out[2], pt[1]);
    out[3] = Math.max(out[3], pt[1]);
    pt = SAM.ApplyTransform(t, [bds[0], bds[3]]);
    out[0] = Math.min(out[0], pt[0]);
    out[1] = Math.max(out[1], pt[0]);
    out[2] = Math.min(out[2], pt[1]);
    out[3] = Math.max(out[3], pt[1]);
    pt = SAM.ApplyTransform(t, [bds[1], bds[3]]);
    out[0] = Math.min(out[0], pt[0]);
    out[1] = Math.max(out[1], pt[0]);
    out[2] = Math.min(out[2], pt[1]);
    out[3] = Math.max(out[3], pt[1]);
    return out;
  };

  SAM.MultiplyTransforms = function (t1, t2) {
    return [
      (t1[0] * t2[0]) + (t1[2] * t2[1]),
      (t1[1] * t2[0]) + (t1[3] * t2[1]),
      (t1[0] * t2[2]) + (t1[2] * t2[3]),
      (t1[1] * t2[2]) + (t1[3] * t2[3]),
      (t1[0] * t2[4]) + (t1[2] * t2[5]) + t1[4],
      (t1[1] * t2[4]) + (t1[3] * t2[5]) + t1[5]];
  };

  SAM.ConcatTransforms = function (trans_list) {
    if (trans_list.length == 0) {
      return [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    }
    var tmp = trans_list[0];
    var idx;
    for (idx = 1; idx < trans_list.length; ++idx) {
      tmp = SAM.MultiplyTransforms(trans_list[idx], tmp);
    }
      
    return tmp;
  };

  SAM.InvertTransform = function (t) {
    var p = (t[0] * t[3]) - (t[1] * t[2]);
    var q = (t[2] * t[5]) - (t[3] * t[4]);
    var s = (t[0] * t[5]) - (t[1] * t[4]);
    var inv = [t[3] / p, -t[1] / p, -t[2] / p, t[0] / p, q / p, -s / p];
    return inv;
  };

  SAM.LogTransform = function(trans, label) {
    console.log(label + ': [' + trans[0] + ', ' + trans[1] + ', ' + trans[2] + ', ' + trans[3] + ', ' + trans[4] + ', ' + trans[5] + ']');
  };
  
  SAM.TransformPoint = function(trans, x, y) {
    var xNew = (x * trans[0] + y * trans[2] + trans[4])
    var yNew = (x * trans[1] + y * trans[3] + trans[5])
    return [xNew, yNew];
  };
  
  SAM.TransformVector = function(trans, x, y) {
    var xNew = (x * trans[0] + y * trans[2])
    var yNew = (x * trans[1] + y * trans[3])
    return [xNew, yNew];
  };
  
  SAM.CopyTransform = function (out_trans, in_trans) {
    var idx;
    for (idx = 0; idx < 6; ++idx){
      out_trans[idx] = in_trans[idx];
    }
  };
})();
