// ==============================================================================
// Change detection which uses slide-atlas' spatial hash
// I modified the has to take an array or rectangle structures rather than
// the rectSetWidget.

(function () {
  'use strict';

  window.testChangeDetection = function () {
    var rectSet1 = [
      {point1: [0.0, 0.0], point2: [10.0, 5.0], confidence: 0.2},
      {point1: [100.0, 0.0], point2: [110.0, 5.0], confidence: 0.3},
      {point1: [200.0, 0.0], point2: [210.0, 5.0], confidence: 0.4},
      {point1: [300.0, 0.0], point2: [310.0, 5.0], confidence: 0.5},
      {point1: [300.0, 0.0], point2: [310.0, 5.0], confidence: 0.6},
      {point1: [300.0, 0.0], point2: [310.0, 5.0], confidence: 0.7},
      {point1: [300.0, 0.0], point2: [310.0, 5.0], confidence: 0.8}];

    var rectSet2 = [
      {point1: [0.0, 0.0], point2: [10.0, 5.0], confidence: 0.2},
      {point1: [100.0, 1.0], point2: [110.0, 6.0], confidence: 0.3},
      {point1: [200.0, 2.0], point2: [210.0, 7.0], confidence: 0.4},
      {point1: [300.0, 3.0], point2: [310.0, 8.0], confidence: 0.5},
      {point1: [300.0, 4.0], point2: [310.0, 9.0], confidence: 0.6},
      {point1: [300.0, 5.0], point2: [310.0, 10.0], confidence: 0.7},
      {point1: [300.0, 6.0], point2: [310.0, 11.0], confidence: 0.8}];

    var results = ChangeDetection(rectSet1, rectSet2, 0.5, 0.25);
    console.log(results);
  };

  // rectSet is [{point1: [x1,y1], points: [x2,y2], confidence: c}, ...]
  //   x1 <= x2 and y1 <= y2
  // Returns {arivals: rectSet, departures: rectSet, unchanged: rectSet}
  // I just resuse the rects in the input sets.
  var ChangeDetection = function (rectSet1, rectSet2, overlapThresh, confidenceThresh) {
    var rectHash = new SpatialHash();
    rectHash.Build(rectSet2);
    // Make a copy of the second rect set to keep track of arrivals.
    var copy2 = rectSet2.slice(0);

    var departures = [];
    var arrivals = [];
    var unchanged = [];
    for (var i = 0; i < rectSet1.length; ++i) {
      var rect1 = rectSet1[i];
      if (rect1.confidence > confidenceThresh) {
        var overlapping = rectHash.GetOverlapping(rect1, overlapThresh, confidenceThresh);
        if (overlapping.length === 0) {
          // Rect1 has no corresponding rect in rectSet2.
          departures.push(rect1);
        } else {
          // Arbitrarily take the unchanged from restSet1.
          unchanged.push(rect1);
        }
        for (var j = 0; j < overlapping.length; ++j) {
          // remove all rects that have not changed to compute arrivals.
          copy2[overlapping[j].index] = undefined;
        }
      }
    }
    // Now fill in the departures from the ones leftover.
    for (i = 0; i < copy2.length; ++i) {
      if (copy2[i]) {
        arrivals.push(copy2[i]);
      }
    }
    return {arrivals: arrivals, departures: departures, unchanged: unchanged};
  };

  // 2d
  // I am extending the annotations from simple points to rectangles with
  // different sizes.  Each item will be added to multiple bins.
  // This serves two purposes.
  // Given a point, find the (best) picked renctanlge.
  // Given a rectangle find all rectangle that overlap

  // rectSet is [{point1: [x1,y1], points: [x2,y2], confidence: c}, ...]
  //   x1 <= x2 and y1 <= y2

  function SpatialHash () {
    // Must be initialized before use.
  }

  SpatialHash.prototype.Initialize = function (bounds, size) {
    this.Origin = [bounds[0], bounds[2]];
    this.BinSize = Math.sqrt((bounds[1] - bounds[0]) * (bounds[3] - bounds[2]) / (size + 1));
    this.XDim = Math.ceil((bounds[1] - bounds[0]) / this.BinSize);
    this.YDim = Math.ceil((bounds[3] - bounds[2]) / this.BinSize);
    this.Grid = new Array(this.YDim);
    for (var y = 0; y < this.YDim; ++y) {
      var row = new Array(this.XDim);
      for (var x = 0; x < this.XDim; ++x) {
        row[x] = [];
      }
      this.Grid[y] = row;
    }
  };

  SpatialHash.prototype.Add = function (rect, idx) {
    var x, y;
    x = rect.point1[0];
    var col1 = Math.floor((x - this.Origin[0]) / this.BinSize);
    col1 = Math.max(Math.min(col1, this.XDim - 1), 0);
    x = rect.point2[0];
    var col2 = Math.floor((x - this.Origin[0]) / this.BinSize);
    col2 = Math.max(Math.min(col2, this.XDim - 1), 0);

    y = rect.point1[1];
    var row1 = Math.floor((y - this.Origin[1]) / this.BinSize);
    row1 = Math.max(Math.min(row1, this.YDim - 1), 0);
    y = rect.point2[1];
    var row2 = Math.floor((y - this.Origin[1]) / this.BinSize);
    row2 = Math.max(Math.min(row2, this.YDim - 1), 0);

    for (var r = row1; r <= row2; ++r) {
      for (var c = col1; c <= col2; ++c) {
        this.Grid[r][c].push(idx);
      }
    }
  };

  SpatialHash.prototype.ComputeBounds = function (rectSet) {
    if (rectSet.length <= 0) {
      return undefined;
    }
    var rect = rectSet[0];
    var bds = [rect.point1[0], rect.point1[1], rect.point2[0], rect.point2[1]];
    for (var i = 1; i < rectSet.length; ++i) {
      rect = rectSet[i];
      bds[0] = Math.min(bds[0], rect.point1[0]);
      bds[1] = Math.min(bds[1], rect.point1[1]);
      bds[2] = Math.min(bds[2], rect.point1[2]);
      bds[3] = Math.min(bds[3], rect.point1[3]);
    }
    return bds;
  };

  // This object does not detect when the rect widget changes.
  SpatialHash.prototype.Build = function (rectSet) {
    this.RectSet = rectSet;
    var numRects = rectSet.GetLength();
    var bounds = this.ComputeBounds(rectSet);
    this.Initialize(bounds, numRects);
    for (var idx = 0; idx < numRects; ++idx) {
      var rect = rectSet[idx];
      this.Add(rect, idx);
    }
  };

  // I used this to select rectangels from the gui..
  // Returns the index of the best rect for the point selected.
  // Returns -1 if there are no rects containing the point.
  /*
  SpatialHash.prototype.Get = function (pt, confThresh) {
    if (this.RectSet.length === 0) {
      return undefined;
    }
    // Find binds touching this square.
    // Transform bounds to grid indexes  (keep in range).
    var x = Math.max(Math.min(
      Math.floor((pt[0] - this.Origin[0]) / this.BinSize), this.XDim - 1), 0);
    var y = Math.max(Math.min(
      Math.floor((pt[1] - this.Origin[1]) / this.BinSize), this.YDim - 1), 0);

    var bin = this.Grid[y][x];

    // Find the closest entry to location in these bins.
    var best;
    for (var i = 0; i < bin.length; ++i) {
      var rectIdx = bin[i];
      var r = this.RectSet[rectIdx];
      var conf = r.confidence;
      var w = r.point2[0] - r.point1[0];
      var h = r.point2[1] - r.point1[1];
      var cx = r.point1[0] + (0.5 * w);
      var cy = r.point1[0] + (0.5 * w);
      var dx = Math.abs(cx - pt[0]);
      var dy = Math.abs(cy - pt[1]);
      if (dx < w / 2 && dy < h / 2 && confThresh <= conf) {
        var dist = Math.max(dx, dy);
        if (!best || dist <= best.dist) {
          best = {
            dist: dist,
            index: rectIdx,
            rect: r};
        }
      }
    }
    return best.rect;
  };
  */

  // For changed detection
  // Return a list of overlapping rect as:
  // {index; rectIdx, overlap: 0.5}
  // Only considers rectangles with confidence greater than confidenceThresh.
  SpatialHash.prototype.GetOverlapping = function (rect1,
                                                   overlapThreshold,
                                                   confidenceThresh) {
    var overlapping = [];
    var width1 = rect1.point2[0] - rect1.point1[0];
    var height1 = rect1.point2[1] - rect1.point1[1];

    // Loop over bins touching the input rectangle
    var x, y;
    x = rect1.point1[0];
    var col1 = Math.floor((x - this.Origin[0]) / this.BinSize);
    col1 = Math.max(Math.min(col1, this.XDim - 1), 0);
    x = rect1.point2[0];
    var col2 = Math.floor((x - this.Origin[0]) / this.BinSize);
    col2 = Math.max(Math.min(col2, this.XDim - 1), 0);

    y = rect1.point1[1];
    var row1 = Math.floor((y - this.Origin[1]) / this.BinSize);
    row1 = Math.max(Math.min(row1, this.YDim - 1), 0);
    y = rect1.point2[1];
    var row2 = Math.floor((y - this.Origin[1]) / this.BinSize);
    row2 = Math.max(Math.min(row2, this.YDim - 1), 0);

    for (var r = row1; r <= row2; ++r) {
      for (var c = col1; c <= col2; ++c) {
        var bin = this.Grid[r][c];
        // compare all the rectangles referenced by this bin
        for (var i = 0; i < bin.length; ++i) {
          var rect2Idx = bin[i];
          var rect2 = this.RectSet[rect2Idx];
          if (rect1.confidence > confidenceThresh) {
            var width2 = rect2.point2[0] - rect1.point1[0];
            var height2 = rect2.point2[1] - rect1.point1[1];
            // Compute the intersection.
            var xMin = Math.max(rect1.point1[0], rect2.point1[0]);
            var xMax = Math.min(rect1.point2[0], rect2.point2[0]);
            var yMin = Math.max(rect1.point1[1], rect2.point1[1]);
            var yMax = Math.min(rect1.point2[1], rect2.point2[1]);
            var dx = Math.max(0, xMax - xMin);
            var dy = Math.max(0, yMax - yMin);
            var overlap = (2.0 * dx * dy) /
              ((width1 * height1) + (width2 * height2));
            if (overlap > overlapThreshold) {
              overlapping.push({overlap: overlap, index: rect2Idx});
            }
          }
        }
      }
    }

    return overlapping;
  };

  window.SpatialHash = SpatialHash;
})();
