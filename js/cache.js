(function () {
  'use strict';

  // I am adding a levels with grids to index tiles in addition
  // to the tree.  Eventually I want to get rid fo the tree.
  // I am trying to get rid of the roots now.

  // A stripped down source object.
  // A source object must have a getTileUrl method.
  // It can have any instance variables it needs to
  // compute the URL.
  SA.SlideAtlasSource = function () {
    this.Prefix = undefined;

    // Higher levels are higher resolution.
    // x, y, slide are integer indexes of tiles in the grid.
    this.getTileUrl = function (level, x, y, z) {
      var name = this.Prefix + 't';
      while (level > 0) {
        --level;
        var cx = (x >> level) & 1;
        var cy = (y >> level) & 1;
        var childIdx = cx + (2 * cy);
        if (childIdx === 0) { name += 'q'; }
        if (childIdx === 1) { name += 'r'; }
        if (childIdx === 2) { name += 't'; }
        if (childIdx === 3) { name += 's'; }
      }
      name = name + '.jpg';
      return name;
    };
  };

  SA.GigamacroSource = function () {
    this.Prefix = 'http://www.gigamacro.com/content/AMNH/unit_box_test2_05-01-2015/zoomify/';
    this.GridSizeDebug = [[1, 1], [2, 2], [4, 3], [7, 5], [14, 9], [28, 17], [56, 34]];

    this.setDimensions = function (xDim, yDim) {
      this.Dimensions = [xDim, yDim];
      this.GridSize = [];
      this.Levels = 0;
      while (true) {
        var gridLevelDim = [Math.ceil(xDim / 256), Math.ceil(yDim / 256)];
        this.GridSize.splice(0, 0, gridLevelDim);
        this.Levels += 1;
        if (gridLevelDim[0] === 1 && gridLevelDim[1] === 1) {
          return;
        }
        xDim = xDim / 2;
        yDim = yDim / 2;
      }
    };

    // Higher levels are higher resolution.
    // x, y, slide are integer indexes of tiles in the grid.
    this.getTileUrl = function (level, x, y, z) {
      var g = this.GridSize[level];
      if (x < 0 || x >= g[0] || y < 0 || y >= g[1]) {
        return '';
      }
      var num = y * g[0] + x;
      for (var i = 0; i < level; ++i) {
        g = this.GridSize[i];
        num += g[0] * g[1];
      }
      var tileGroup = Math.floor(num / 256);
      var name = this.Prefix + 'TileGroup' + tileGroup + '/' + level + '-' + x + '-' + y + '.jpg';
      return name;
    };
  };

  // Our subdivision of leaves is arbitrary.
  SA.IIIFSource = function () {
    this.Prefix = 'http://ids.lib.harvard.edu/ids/view/Converter?id=834753&c=jpgnocap';
    alert('Hard coded tile size');
    this.TileSize = 256;

    this.setDimensions = function (xDim, yDim) {
      this.Dimensions = [xDim, yDim];
      this.GridSize = [];
      this.Levels = 0;
      while (true) {
        var gridLevelDim = [Math.ceil(xDim / 256), Math.ceil(yDim / 256)];
        this.Levels += 1;
        if (gridLevelDim[0] === 1 && gridLevelDim[1] === 1) {
          return;
        }
        xDim = xDim / 2;
        yDim = yDim / 2;
      }
    };

    // Higher levels are higher resolution. (0 is the root).
    // x, y, slide are integer indexes of tiles in the grid.
    this.getTileUrl = function (level, x, y, z) {
      // compute the dimensions of this resolution.
      var x0 = x * 256;
      var y0 = y * 256;
      var x1 = x0 + 256;
      var y1 = y0 + 256;
      // crop the tile
      var res = this.Levels - level - 1;
      var dx = this.Dimensions[0] >> res;
      var dy = this.Dimensions[1] >> res;
      if (x1 > dx) { x1 = dx; }
      if (y1 > dy) { y1 = dy; }
      dx = x1 - x0;
      dy = y1 - y0;
      // Compute the scale.
      res = 1.0 / (1 << res);

      var name = this.Prefix + '&s=' + res + '&r=0&x=' + x0 + '&y=' + y0 + '&w=' + dx + '&h=' + dy;
      return name;
    };
  };

  SA.DanielSource = function () {
    this.Prefix = 'http://dragon.krash.net:2009/data/1';
    this.MinLevel = 0;
    this.MaxLevel = 7;

    // Higher levels are higher resolution.
    // x, y, slide are integer indexes of tiles in the grid.
    this.getTileUrl = function (level, x, y, z) {
      if (z < this.MinLevel) { return ''; }
      if (z > this.MaxLevel) { return ''; }
      var name = this.Prefix + level + '-' + x + '-' + y;
      return name;
    };
  };

// ==============================================================================

  SA.FindCache = function (image) {
    // Look through existing caches and reuse one if possible
    for (var i = 0; i < SA.Caches.length; ++i) {
      if (SA.Caches[i].Image._id === image._id) {
        return SA.Caches[i];
      }
    }
    var cache = new SA.Cache();
    cache.SetImageData(image);

    return cache;
  };

// ==============================================================================
  var CacheLevel = function (xGridDim, yGridDim) {
    this.Tiles = new Array(xGridDim * yGridDim);
    this.GridDims = [xGridDim, yGridDim];
  };
  // No bounds checking.
  CacheLevel.prototype.SetTile = function (tile) {
    this.Tiles[tile.X + (tile.Y * this.GridDims[0])] = tile;
    return tile;
  };
  CacheLevel.prototype.GetTile = function (x, y) {
    return this.Tiles[x + (y * this.GridDims[0])];
  };

// ==============================================================================
  function Cache () {
    //  this.UseIIP = Boolean(image.filename !== undefined && image.filename.split(".")[1] === 'ptif');
    this.UseIIP = false;
    this.Levels = [];

    // Keep a global list for pruning tiles.
    SA.Caches.push(this);
    this.NumberOfSections = 1;
  }

  Cache.prototype.destructor = function () {
  };

  Cache.prototype.GetImageData = function () {
    return this.Image;
  };

  // This is specific for slideAtlas images.
  Cache.prototype.SetImageData = function (image) {
    if (!image.TileWidth) {
      image.TileWidth = 256;
    }
    if (!image.TileHeight) {
      image.TileHeight = image.TileWidth;
    }

    this.Image = image;

    if (image.copyright === undefined) {
      image.copyright = 'Copyright 2017. All Rights Reserved.';
    }

    this.Levels = new Array(image.levels);
    for (var i = 0; i < image.levels; ++i) {
      var level = image.levels - 1 - i;
      this.Levels[i] = new CacheLevel(
            Math.ceil(image.dimensions[0] / (image.TileWidth << level)),
            Math.ceil(image.dimensions[1] / (image.TileHeight << level)));
    }

    if (!this.TileSource) {
      // TODO:  This should not be here.
      // Source should be initialized someplace else.
      // Other sources have to overwrite this default.
      this.TileSource = new SA.SlideAtlasSource();
      this.TileSource.Prefix = '/tile?img=' + image._id + '&db=' + image.database + '&name=';
    }
    this.Warp = null;
    this.RootSpacing = [1 << (image.levels - 1), 1 << (image.levels - 1), 10.0];

    if (image.type && image.type === 'stack') {
      this.NumberOfSections = image.dimensions[2];
      this.TileDimensions = [image.dimensions[0], image.dimensions[1]];
      var qTile;
      for (var slice = 1; slice <= this.NumberOfSections; ++slice) {
        qTile = this.GetTile(slice, 0, 0);
        qTile.LoadQueueAdd();
      }
      SA.LoadQueueUpdate();
    } else {
      this.TileDimensions = [image.TileWidth, image.TileHeight];
      this.NumberOfSections = 1;
    }
  };

  Cache.prototype.SetTileSource = function (source) {
    var w = source.width;
    var h = source.height;
    this.TileSource = source;
    // Make an id for the image so it can be reused.
    var image = {levels: source.maxLevel + 1,
      dimensions: [w, h],
      bounds: [0, w - 1, 0, h - 1]};
    if (source.bounds) {
      image.bounds = source.bounds;
    }
    if (source.TileWidth) {
      image.TileWidth = source.TileWidth;
    }
    if (source.TileHeight) {
      image.TileHeight = source.TileHeight;
    }

    if (source.filename) {
      image.filename = source.filename;
      image.label = source.filename;
    }
    this.SetImageData(image);
  };

  Cache.prototype.GetLeafSpacing = function () {
    return this.RootSpacing[0] / (1 << (this.Image.levels - 1));
  };

  Cache.prototype.GetBounds = function () {
    if (this.Image && this.Image.bounds) {
      return this.Image.bounds;
    }
    return [0, 10000, 0, 10000];
  };

  // This method converts a point in image coordinates to a point in world coordinates.
  Cache.prototype.ImageToWorld = function (imagePt) {
    if (this.Warp) {
      return this.Warp.ImageToWorld(imagePt);
    }
    // Just shift by the origin.
    // Assume spacing is 1.
    // This should be a simple matrix version of warp.
    return [imagePt[0] + this.Origin[0], imagePt[1] + this.Origin[1]];
  };

  // This method converts a point in world coordinates to a point in cache-image coordinates.
  Cache.prototype.WorldToImage = function (worldPt) {
    if (this.Warp) {
      return this.Warp.WorldToImage(worldPt);
    }
    // Just shift by the origin.
    // Assume spacing is 1.
    // TODO:
    // This should be a simple matrix version of warp.
    return [worldPt[0] - this.Origin[0], worldPt[1] - this.Origin[1]];
  };

  Cache.prototype.GetSource = function () {
    return this.Source;
  };

  Cache.prototype.LoadRoots = function (callback) {
    var qTile;
    if (this.Image.dimensions === undefined) {
      return;
    }
    // Callback handled by the loaded which deletes the callback after it
    // is executed.
    this.LoadTileCallback = callback;
    if (this.Image.dimensions.length < 3) {
      qTile = this.GetTile(0, 0, 0);
      qTile.LoadQueueAdd();
    } else {
      for (var slice = 1; slice <= this.Image.dimensions[2]; ++slice) {
        qTile = this.GetTile(slice, 0, 0);
        qTile.LoadQueueAdd();
      }
    }
    SA.LoadQueueUpdate();
  };

  // ------ I think this method really belongs in the view! -----------
  // This could get expensive because it is called so often.
  // Eventually I want a quick coverage test to exit early.
  // iPad flag includes low resolution ancestors to get rid of white lines between tiles.
  // Tiles is actually the return value.  It is not used for anything else.
  Cache.prototype.ChooseTiles = function (camera, slice, tiles) {
    // I am prioritizing tiles in the queue by time stamp.
    // Loader sets the the tiles time stamp.
    // Time stamp only progresses after a whole render.
    SA.AdvanceTimeStamp();

    // I am putting this here to avoid deleting tiles
    // in the rendering list.
    SA.Prune();

    // Pick a level to display.
    // var fast = document.getElementById("fast").checked;
    // level 0 is the root.  This chooses too high a level (resolution).
    // WHen I fixed it, the snap between levels was too noticable.
    // THis must be a problem with creation of the pyramid!!!!!
    var canvasHeight = camera.GetViewportHeight();
    var tmp = this.TileDimensions[1] * this.RootSpacing[1] / camera.GetHeight();
    // if (fast) {
    //  tmp = tmp * 0.5;
    // }
    tmp = tmp * canvasHeight / this.TileDimensions[1];
    var level = 0;
    while (tmp > 1.0) {
      ++level;
      tmp = tmp * 0.5;
    }
    if (level >= this.Image.levels) {
      level = this.Image.levels - 1;
    }
    // Alternative code
    // var level = this.Image.levels - 1; // The highest resolution / leaves
    // var canvasHeight = camera.ViewportHeight;
    // // At the current level(0), each screen pixel covers this many image
    // // pixels. If this is above 1, then we would render too many pixels.
    // var pixelRatio = camera.Height / camera.ViewportHeight;
    // while (pixelRatio > 1.1 && level > 0) { // a little slop.
    //    pixelRatio = pixelRatio * 0.5;
    //    level = level - 1;
    // }

    // TODO: Have camera return world bounds and compute this stuff internally.
    var bounds = camera.GetImageBounds();

    // Some logic for progressive rendering is in the loader:
    // Do not load a tile if its parent is not loaded.

    var tile;
    var tileIds;
    tiles = [];
    // TODO: Make a "GetVisibleTiles" method.
    // Render all tiles from low res to high.
    // Although this is extra work, it covers up cracks.
    // Rendering just level 0 (root) should be enough, but that
    // messed up progressive rendering logic in section.js.
    // Just do this until I unify the progressive rendering
    // Probably in this method. (check is loaded).
    for (var i = level; i >= 0; --i) {
      tileIds = this.GetVisibleTileIds(i, bounds);
      for (var j = 0; j < tileIds.length; ++j) {
        tile = this.GetTile(slice, i, tileIds[j]);
        // If the tile is loaded or loading,
        // this does nothing.
        if (tile) {
          tile.LoadQueueAdd();
          tiles.push(tile);
        }
      }
    }

    SA.LoadQueueUpdate();

    return tiles;
  };

  // Get ids of all visible tiles (including ones that have not been
  // loaded yet.)
  Cache.prototype.GetVisibleTileIds = function (level, bounds) {
    // Intersect the view bounds with the image bounds.
    // The ptif reader gives wrong times when out of bounds.
    if (this.Image.bounds) {
      bounds[0] = Math.max(bounds[0], this.Image.bounds[0]);
      bounds[1] = Math.min(bounds[1], this.Image.bounds[1]);
      bounds[2] = Math.max(bounds[2], this.Image.bounds[2]);
      bounds[3] = Math.min(bounds[3], this.Image.bounds[3]);
    }

    var idList = [];
    var dim = 1 << level;
    var bds = [];
    bds[0] = Math.floor(bounds[0] * dim / (this.TileDimensions[0] * this.RootSpacing[0]));
    bds[1] = Math.ceil(bounds[1] * dim / (this.TileDimensions[0] * this.RootSpacing[0])) - 1.0;
    bds[2] = Math.floor(bounds[2] * dim / (this.TileDimensions[1] * this.RootSpacing[1]));
    bds[3] = Math.ceil(bounds[3] * dim / (this.TileDimensions[1] * this.RootSpacing[1])) - 1.0;
    // I am allowing level 0 to have a grid of tiles (not just one root).
    // This will not work for the trsq tile names, but is used for grid
    // indexing of tiles that every other server uses.
    // This will only work NOW for the y axis (the case I am trying to
    // solve).  To work for the z axis, tile indexing has to change.
    // Javascript currently can handle 16 levels safely (32 bits) with the
    // current indexing scheme.

    /*
    var id;
    for (var y = bds[2]; y <= bds[3]; ++y) {
      for (var x = bds[0]; x <= bds[1]; ++x) {
        id = x | (y << level);
        idList.push(id);
      }
    }
    */
    // Experiment: Lets try sorting from middle to outside to simulate
    // fovia sorted request priority.
    // Reverse order of priority.
    var cx = Math.floor((bds[0] + bds[1]) * 0.5);
    var cy = Math.floor((bds[2] + bds[3]) * 0.5);
    var radius = Math.max((cx - bds[0]), (bds[1] - cx), (cy - bds[2]), (bds[3] - cy));
    var x, y, i;
    while (radius > 0) {
      for (i = -radius; i < radius; ++i) {
        x = cx - radius;
        y = cy - i;
        if (x >= bds[0] && x <= bds[1] && y >= bds[2] && y <= bds[3]) {
          idList.push(x | (y << level));
        }
        x = cx + i;
        y = cy - radius;
        if (x >= bds[0] && x <= bds[1] && y >= bds[2] && y <= bds[3]) {
          idList.push(x | (y << level));
        }
        x = cx + radius;
        y = cy + i;
        if (x >= bds[0] && x <= bds[1] && y >= bds[2] && y <= bds[3]) {
          idList.push(x | (y << level));
        }
        x = cx - i;
        y = cy + radius;
        if (x >= bds[0] && x <= bds[1] && y >= bds[2] && y <= bds[3]) {
          idList.push(x | (y << level));
        }
      }
      radius -= 1;
    }
    // Add the special case center.
    idList.push(cx | (cy << level));
    return idList;
  };

// I do not think this ever gets called.  No class calls this method.
  Cache.prototype.GetTileIdContainingPoint = function (level, wPt) {
    var dim = 1 << level;
    var xIdx = Math.floor(wPt[0] * dim);
    var yIdx = Math.floor(wPt[1] * dim);
    if (xIdx < 0) { xIdx = 0; }
    if (xIdx >= dim) { xIdx = dim - 1; }
    if (yIdx < 0) { yIdx = 0; }
    if (yIdx >= dim) { yIdx = dim - 1; }
    var id = xIdx | (yIdx << level);
    return id;
  };

// Set parent to be minimum of children.
  Cache.prototype.UpdateBranchTimeStamp = function (tile) {
    var min = SA.GetCurrentTime();
    if (tile.Children[0] !== null) {
      if (tile.Children[0].BranchTimeStamp < min) {
        min = tile.Children[0].BranchTimeStamp;
      }
    }
    if (tile.Children[1] !== null) {
      if (tile.Children[1].BranchTimeStamp < min) {
        min = tile.Children[1].BranchTimeStamp;
      }
    }
    if (tile.Children[2] !== null) {
      if (tile.Children[2].BranchTimeStamp < min) {
        min = tile.Children[2].BranchTimeStamp;
      }
    }
    if (tile.Children[3] !== null) {
      if (tile.Children[3].BranchTimeStamp < min) {
        min = tile.Children[3].BranchTimeStamp;
      }
    }
    if (min === SA.GetCurrentTime()) { // no children
      min = tile.TimeStamp;
    }
    if (min !== tile.BranchTimeStamp) {
      tile.BranchTimeStamp = min;
      if (tile.Parent !== null) {
        this.UpdateBranchTimeStamp(tile.Parent);
      }
    }
  };

  Cache.prototype.GetTile = function (slice, level, id) {
    // Separate x and y.
    var dim = 1 << level;
    var x = id & (dim - 1);
    var y = id >> level;

    return this.RecursiveGetTile(level, x, y, slice);
  };

  Cache.prototype.RecursiveGetTile = function (level, x, y, z) {
    if (!this.Levels[level]) { return null; }
    var tile = this.Levels[level].GetTile(x, y);
    if (tile) {
      return tile;
    }
    tile = new SA.Tile(x, y, z, level,
                       this.TileSource.getTileUrl(level, x, y, z),
                       this);
    this.Levels[level].SetTile(tile);
    if (level > 0) {
      var parent = this.RecursiveGetTile(level - 1, x >> 1, y >> 1, z);
      // I do not know if this is still valid.
      // This is to fix a bug. Root.BranchTime larger
      // than all children BranchTimeStamps.  When
      // long branch is added, node never gets updated.
      if (parent.Children[0] === null && parent.Children[1] === null &&
            parent.Children[2] === null && parent.Children[3] === null) {
        parent.BranchTimeStamp = SA.GetCurrentTime();
      }
      var cx = x & 1;
      var cy = y & 1;
      var childIdx = cx + (2 * cy);
      parent.Children[childIdx] = tile;
      tile.Parent = parent;
    }
    return tile;
  };

  // Find the oldest tile, remove it from the tree and return it to be recycled.
  // This also prunes texture maps.
  // SA.PruneTimeTiles and SA.PruneTimeTextures are compared with used time of tile.
  Cache.prototype.PruneTiles = function () {
    for (var i = 0; i < this.Levels[0].Tiles.length; ++i) {
      var node = this.Levels[0].Tiles[i];
      if (node !== null) {
        if (node.BranchTimeStamp < SA.PruneTimeTiles || node.BranchTimeStamp < SA.PruneTimeTextures) {
          var count = this.RecursivePruneTiles(node);
          if (count > 0) {
            console.log('prune ' + count + ' from ' + this.Image.label);
          }
        }
      }
    }
  };

  Cache.prototype.RecursivePruneTiles = function (node) {
    var leaf = true;
    var count = 0;

    for (var i = 0; i < 4; ++i) {
      var child = node.Children[i];
      if (child !== null) {
        leaf = false;
        if (child.BranchTimeStamp < SA.PruneTimeTiles ||
          child.BranchTimeStamp < SA.PruneTimeTextures) {
          count += this.RecursivePruneTiles(child);
        }
      }
    }
    if (leaf && node.Parent !== null) { // Roots have null parents.  Do not prune roots.
      if (node.BranchTimeStamp < SA.PruneTimeTextures) {
        // when using webgl, texture memery was a more limited resource.
        node.DeleteTexture();
      }
      if (node.BranchTimeStamp < SA.PruneTimeTiles) {
        if (node.LoadState === 1) {
          SA.LoadQueueRemove(node);
        }
        var parent = node.Parent;
        // nodes will always have parents because we do not steal roots.
        if (parent.Children[0] === node) {
          parent.Children[0] = null;
        } else if (parent.Children[1] === node) {
          parent.Children[1] = null;
        } else if (parent.Children[2] === node) {
          parent.Children[2] = null;
        } else if (parent.Children[3] === node) {
          parent.Children[3] = null;
        }
        node.Parent = null;
        this.UpdateBranchTimeStamp(parent);
        node.destructor();
        count += 1;
      }
    }
    return count;
  };

  SA.Cache = Cache;
})();
