// ==============================================================================
// Subclass of view that renders tiled images.

(function () {
  'use strict';

  function TileView (parent, useWebGL) {
    SAM.View.call(this, parent, useWebGL);

    // connectome : default section so we cen set cache
    this.DefaultSection = new SA.Section();
    this.Section = this.DefaultSection;

    this.Tiles = []; // Not really used

    if (useWebGL) {
      this.gl = this.Canvas[0].getContext('webgl') || this.Canvas[0].getContext('experimental-webgl');
    }
    if (this.gl) {
      // Probably need a canvas object that keep track of
      // initialization (shared between layers).
      SA.initWebGL(this);
    } else {
      this.Context2d = this.Canvas[0].getContext('2d');
    }
  }
  TileView.prototype = new SAM.View();

  TileView.prototype.GetBounds = function () {
    return this.Section.GetBounds();
  };
  TileView.prototype.GetLeafSpacing = function () {
    return this.Section.GetLeafSpacing();
  };

  TileView.prototype.SetSection = function (section) {
    this.Section = section;
    if (section.Transform) {
      this.GetCamera().SetWorldToImageTransform(section.Transform);
    } else {
      this.GetCamera().SetWorldToImageTransform([1, 0, 0, 1, 0, 0]);
    }
  };

  TileView.prototype.AddCache = function (cache) {
    if (cache === undefined) { return; }
    if (this.Section === undefined) {
      this.Section = this.DefaultSection;
    }
    this.Section.Caches.push(cache);
  };

  // Non connectome API, simple.
  // Just use the default section.
  TileView.prototype.SetCache = function (cache) {
    this.Section = this.DefaultSection;
    if (!cache) {
      this.Section.Caches = [];
    } else {
      this.Section.Caches = [cache];
    }
  };

  TileView.prototype.GetCache = function () {
    // connectome: This makes less sense with a section with many caches.
    // TODO: try to get rid of this
    return this.Section.Caches[0];
  };

  // Not used at the moment
  TileView.prototype.Draw = function (masterView) {
    if (masterView) {
      var cam = masterView.Camera;
      if (this.Transform) {
        this.Transform.ForwardTransformCamera(cam, this.Camera);
      } else {
        this.Camera.WorldCopy(cam);
      }
    }

    if (this.gl) {
      var gl = this.gl;
      gl.clear(SA.GL.COLOR_BUFFER_BIT | SA.GL.DEPTH_BUFFER_BIT);
      var program = SA.imageProgram;
      gl.useProgram(program);
      gl.clearColor(1.0, 1.0, 1.0, 1.0);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      // gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    }

    return this.DrawTiles();
  };

  // I want only the annotation to create a mask image.
  // Note: Tile in the list may not be loaded yet.
  // Returns true if all the tiles to render were available.
  // False implies that the user shoudl render again.
  TileView.prototype.DrawTiles = function () {
    // Download view is not visible, but still needs to render tiles.
    // This causes black/blank download images
    // if ( ! this.CanvasDiv.is(':visible') ) {
    //    return;
    // }
    // console.time("  ViewDraw");
    if (this.gl) {
      return this.Section.Draw(this);
    } else {
      this.ClearPending = true;
      // Clear the canvas to start drawing.
      this.Context2d.fillStyle = '#ffffff';
      // this.Context2d.fillRect(0,0,this.Viewport[2],this.Viewport[3]);

      
      // Start with a transform that flips the y axis.
      // This is an issue later because the images will be upside down.
      /////this.Context2d.setTransform(1, 0, 0, -1, 0, this.Viewport[3]);

      // Map (-1->1, -1->1) to the viewport.
      // Origin of the viewport does not matter because drawing is relative
      // to this view's canvas.
      /////this.Context2d.transform(0.5 * this.Viewport[2], 0.0,
      /////                               0.0, 0.5 * this.Viewport[3],
      /////                               0.5 * this.Viewport[2],
      /////                               0.5 * this.Viewport[3]);

      return this.Section.Draw(this);
    }
  };

  SA.TileView = TileView;
})();
