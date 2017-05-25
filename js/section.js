// ==============================================================================
// Section Object
// Leftover from Connectome.
// Sections were a montage of multiple images (transformed and cropped)

// I have just started implementing an API for a section transformation.
// Use the same API as the canvas transform,
// TODO: Generatlize to mesh based transformation. 
//   A transformation for each cache. 
//   (but not stored in the cache.  Sections can share a cache.)



(function () {
  'use strict';

  var SLICE = 0;

  function Section () {
    // Warping to align this section with previous / next.
    // This is only a matrix transformation.
    this.Matrix = mat4.create();
    mat4.identity(this.Matrix);
    // The list of caches is really just a list of images in the montage.
    this.Caches = [];
    // For debugging stitching.
    this.Markers = [];
    this.Transform = [1,0,0,1,0,0];
  };

  Section.prototype.GetNumberOfCaches = function () {
    return this.Caches.length;
  };

  Section.prototype.GetCache = function (idx) {
    if (idx < 0 || idx >= this.Caches.length) {
      return undefined;
    }
    return this.Caches[idx];
  };

  Section.prototype.SetCache = function (cache) {
    if (cache === undefined) {
      this.Caches = [];
    } else {
      this.Caches = [cache];
    }
    this.Bounds = undefined;
  };

  // Set the tranform for cache 0.  Same api as html canvas transform.
  // This tranform is applied before the camera.  It converts world to image
  // coordinates.
  Section.prototype.SetTransform = function (m00, m10, m01, m11, m02, m12) {
    this.Transform = [m00, m10, m01, m11, m02, m12];
  };

  Section.prototype.AddCache = function (cache) {
    if (cache) {
      this.Caches.push(cache);
      this.Bounds = undefined;
    }
  };

  // For limiting interaction.
  Section.prototype.GetBounds = function () {
    if (this.Bounds === undefined) {
      this.ComputeBounds();
    }
    return this.Bounds;
  };

  // For limiting interaction.
  Section.prototype.ComputeBounds = function () {
    this.Bounds = [0, 10000, 0, 10000];

    for (var cIdx = 0; cIdx < this.Caches.length; ++cIdx) {
      var cache = this.Caches[cIdx];
      var bds = cache.GetBounds();
      if (cIdx === 0) {
        this.Bounds = [bds[0], bds[1], bds[2], bds[3]];
      } else {
        if (bds[0] < this.Bounds[0]) {
          this.Bounds[0] = bds[0];
        }
        if (bds[1] > this.Bounds[1]) {
          this.Bounds[1] = bds[1];
        }
        if (bds[2] < this.Bounds[2]) {
          this.Bounds[2] = bds[2];
        }
        if (bds[3] < this.Bounds[3]) {
          this.Bounds[3] = bds[3];
        }
      }
    }
  };

  // Size of a pixel at the highest resolution.
  Section.prototype.GetLeafSpacing = function () {
    if (!this.LeafSpacing) {
      for (var cIdx = 0; cIdx < this.Caches.length; ++cIdx) {
        var cache = this.Caches[cIdx];
        var spacing = cache.GetLeafSpacing();
        if (!this.LeafSpacing || spacing < this.LeafSpacing) {
          this.LeafSpacing = spacing;
        }
      }
    }
    return this.LeafSpacing;
  };

  Section.prototype.LoadRoots = function () {
    for (var cIdx = 0; cIdx < this.Caches.length; ++cIdx) {
      var cache = this.Caches[cIdx];
      if (cache) {
        cache.LoadRoots();
      }
    }
  };

  Section.prototype.FindImage = function (imageCollectionName) {
    for (var i = 0; i < this.Caches.length; ++i) {
      var cache = this.Caches[i];
      if (cache.Image._id === imageCollectionName) {
        return cache;
      }
    }
    return null;
  };

  // I do not like passing in the whole view.
  // Could we get away with just passing the camera?
  // No, we need the viewport too.
  // Could the viewport be part of the camera?
  // Returns true if all the tiles to render were available.
  // False implies that the user shoudl render again.
  Section.prototype.Draw = function (view) {
    var finishedRendering = true;
    //view.Camera.SetTransform(this.Transform);
    view.Camera.SectionTransform = this.Transform;
    view.Camera.ComputeMatrix();
    var m = view.Camera.GetImageMatrix();

    if (view.gl) {
      // Draw tiles.
      var program = view.ShaderProgram;
      var gl = view.gl;
      gl.viewport(view.Viewport[0], view.Viewport[1],
                        view.Viewport[2], view.Viewport[3]);
      gl.uniformMatrix4fv(program.pMatrixUniform, false, m);
    } else {
      // The camera maps the world coordinate system to (-1->1, -1->1).
      var h = 1.0 / m[15];
      view.Context2d.transform(m[0] * h, m[1] * h,
                               m[4] * h, m[5] * h,
                               m[12] * h, m[13] * h);
    }

    for (var i = 0; i < this.Caches.length; ++i) {
      var cache = this.Caches[i];
      // Select the tiles to render first.
      this.Tiles = cache.ChooseTiles(view.Camera, SLICE, view.Tiles);
      // Trying to get rid of flashing by putting the clear closer to the draw.
      if (this.Tiles.length > 1 && view.ClearPending) {
        view.Clear();
        view.ClearPending = undefined;
      }

      // For the 2d viewer, the order the tiles are drawn is very important.
      // Low-resolution tiles have to be drawn first.  Make a new sorted array.
      // The problem is that unloaded tiles fall back to rendering parents.
      // Make  copy (although we could just destroy the "Tiles" array which is not really used again).
      var tiles = this.Tiles.slice(0);
      var loadedTiles = [];
      var j = 0;
      while (j < tiles.length) { // We add tiles in the loop so we need a while.
        var tile = tiles[j];
        if (tile.LoadState === 3) {
          loadedTiles.push(tile);
        } else {
          if (tiles[j].LoadState < 3) {
            // Keep rendering until we have all the tiles.
            finishedRendering = false;
          }
          // if (tile.Parent) { // Queue up the parent.
          //   Note: Parents might be added multiple times by different siblings.
          //   Ok, lets render the whole tree (low res first) to
          //   cover cracks.  This is done in choose tiles.
          //   This is not needed for prgressive rendering then.
          //   tiles.push(tile.Parent);
          // }
        }
        ++j;
      }

      // Reverse order to render low res tiles first.
      for (j = loadedTiles.length - 1; j >= 0; --j) {
        loadedTiles[j].Draw(program, view);
      }
    }
    return finishedRendering;
  };

  Section.prototype.LoadTilesInView = function (view) {
    for (var i = 0; i < this.Caches.length; ++i) {
      var cache = this.Caches[i];
      // Select the tiles to render first.
      // This also adds the tiles returned to the loading queue.
      this.Tiles = cache.ChooseTiles(view.Camera, SLICE, view.Tiles);
    }
  };

  // The above will load the first ancestor not loaded and will stop.
  // I need to pre load the actual high res tiles for connectome.
  Section.prototype.LoadTilesInView2 = function (view) {
    for (var cIdx = 0; cIdx < this.Caches.length; ++cIdx) {
      var cache = this.Caches[cIdx];
      // Select the tiles to load (loading is a byproduct).
      var tiles = cache.ChooseTiles(view.Camera, SLICE);
      for (var i = 0; i < tiles.length; ++i) {
        tiles[i].LoadState = 1;
        // Add the tile at the front of the queue.
        SA.LoadQueue.push(tiles[i]);
      }
    }
    SA.LoadQueueUpdate();
  };

  // This load tiles in the view like draw but does not render them.
  // I want to preload tiles in the next section.
  Section.prototype.LoadTilesInView = function (view) {
    for (var cIdx = 0; cIdx < this.Caches.length; ++cIdx) {
      var cache = this.Caches[cIdx];
      // Select the tiles to load (loading is a byproduct).
      cache.ChooseTiles(view.Camera, SLICE);
    }
  };

  SA.Section = Section;
})();
