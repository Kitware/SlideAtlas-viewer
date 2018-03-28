// No rotation for now. No direct interaction for now.
// No properties dialog for now.
// Only the world / slide conrdinate system supported.
// Does nto supprot fixed size

// How are we going to store them in girder annotations?

(function () {
  // Depends on the CIRCLE widget
  'use strict';

  // use shape api, bu this is simpler so do not subclass.
  function RectSet () {
    this.Scale = 1.0;
    // a single array [x,y,x,y,x,y...]
    this.Centers = [];
    this.Widths = [];
    this.Heights = [];
    this.Labels = [];
    this.Confidences = [];
    this.Vectors = [];
    this.Visibilities = undefined;
    // Hack to hide rects below a specific confidence.
    this.Threshold = 0.0;

    // Add metadata to be stored for a given rectangle
    this.Metadata = [];
    // For now, one can be active.  Highlight one
    this.ActiveIndex = -1;
  }

  RectSet.prototype.GetLength = function () {
    return this.Widths.length;
  };

  RectSet.prototype.GetCenter = function (idx) {
    idx = idx << 1;
    return [this.Centers[idx], this.Centers[idx + 1]];
  };

  RectSet.prototype.SetCenter = function (idx, pt) {
    idx = idx * 2;
    this.Centers[idx] = pt[0];
    this.Centers[idx + 1] = pt[1];
  };

  // Set the size (width,height) of all the rectangles.
  RectSet.prototype.SetShape = function (shape) {
    for (var i = 0; i < this.Widths.length; ++i) {
      this.Widths[i] = shape[0];
      this.Heights[i] = shape[1];
    }
  };

  // Set the size (width,height) of all the rectangles.
  RectSet.prototype.SetScale = function (scale) {
    var k = scale / this.Scale;
    this.Scale = scale;
    for (var i = 0; i < this.Widths.length; ++i) {
      this.Widths[i] *= k;
      this.Heights[i] *= k;
    }
  };

  RectSet.prototype.SetMetadata = function (idx, metadataObj) {
    this.Metadata[idx] = metadataObj;
  };

  RectSet.prototype.GetMetadata = function (idx) {
    return this.Metadata[idx];
  };

  // Helper for ground truth.
  RectSet.prototype.CopyRectangle = function (source, inIdx, outIdx) {
    if (outIdx === undefined) {
      outIdx = this.Labels.length;
    }
    var inTmp = inIdx * 2;
    var outTmp = outIdx * 2;
    this.Centers[outTmp] = source.Centers[inTmp];
    this.Centers[outTmp + 1] = source.Centers[inTmp + 1];
    this.Widths[outIdx] = source.Widths[inIdx];
    this.Heights[outIdx] = source.Heights[inIdx];
    this.Labels[outIdx] = source.Labels[inIdx];
    this.Confidences[outIdx] = source.Confidences[inIdx];
    this.Metadata[outIdx] = source.Metadata[inIdx];
  };

  RectSet.prototype.AddRectangle = function (center, width, height) {
    var outIdx = this.Labels.length;
    this.Centers[outIdx * 2] = center[0];
    this.Centers[outIdx * 2 + 1] = center[1];
    this.Widths[outIdx] = width;
    this.Heights[outIdx] = height;
    this.Labels[outIdx] = '';
    this.Confidences[outIdx] = 1.0;
    // Default Metadata is empty
    this.Metadata[outIdx] = {};
    return this.Widths.length - 1;
  };

  RectSet.prototype.DeleteRectangle = function (index) {
    if (index < 0 || index >= this.Widths.length) {
      return;
    }

    this.Centers.splice(2 * index, 2);
    this.Widths.splice(index, 1);
    this.Heights.splice(index, 1);
    this.Labels.splice(index, 1);
    this.Confidences.splice(index, 1);
    this.Metadata.splice(index, 1);
    if (this.ActiveIndex === index) {
      this.ActiveIndex = -1;
    }
  };

  RectSet.prototype.SetOutlineColor = function (c) {
    this.Color = SAM.ConvertColorToHex(c);
  };

  // do not worry about webGl for now.  Only canvas drawing.
  // webgl would support more rects I assume.
  RectSet.prototype.Draw = function (view) {
    // 2d Canvas ( saving is probably not necessary ) -----------
    view.Context2d.save();

    // We only support image coordinate system for now.
    var cam = view.GetCamera();
    var t = cam.GetImageToViewerTransform();
    view.Context2d.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);

    var pixelSize = cam.ConvertScaleViewerToImage(1);
    var cIdx = 0;
    var x, y, vx, vy;

    // draw the vectors
    view.Context2d.beginPath();
    for (var i = 0; i < this.Vectors.length; ++i) {
      if ((!this.Visibilities || this.Visibilities[i]) &&
          (this.Confidences[i] >= this.Threshold)) {
        vx = this.Vectors[cIdx];
        x = this.Centers[cIdx++];
        vy = this.Vectors[cIdx];
        y = this.Centers[cIdx++];

        view.Context2d.moveTo(x, y);
        view.Context2d.lineTo(x + vx, y + vy);
      } else {
        cIdx += 2;
      }
    }
    view.Context2d.strokeStyle = '#ff00ff';
    view.Context2d.lineWidth = pixelSize * 3;
    view.Context2d.stroke();

    cIdx = 0;
    view.Context2d.lineWidth = pixelSize * 2;
    for (i = 0; i < this.Widths.length; ++i) {
      if ((!this.Visibilities || this.Visibilities[i]) &&
          (this.Confidences[i] >= this.Threshold)) {
        var hw = this.Widths[i] / 2;
        var hh = this.Heights[i] / 2;
        x = this.Centers[cIdx++];
        y = this.Centers[cIdx++];

        view.Context2d.beginPath();
        if (this.LabelColors && this.LabelColors[this.Labels[i]]) {
          view.Context2d.strokeStyle = this.LabelColors[this.Labels[i]];
        } else if (this.Color) {
          view.Context2d.strokeStyle = this.Color;
        } else {
          if (this.Confidences[i] === 0) {
            view.Context2d.strokeStyle = '#ff0000';
          } else {
            var r = Math.floor(this.Confidences[i] * 255);
            view.Context2d.strokeStyle = '#' + r.toString(16) + 'ff00';
          }
        }
        view.Context2d.moveTo(x - hw, y - hh);
        view.Context2d.lineTo(x + hw, y - hh);
        view.Context2d.lineTo(x + hw, y + hh);
        view.Context2d.lineTo(x - hw, y + hh);
        view.Context2d.lineTo(x - hw, y - hh);

        view.Context2d.stroke();

        if (i === this.ActiveIndex) {
          // mark the rectangle
          view.Context2d.beginPath();
          view.Context2d.strokeStyle = '#00ffff';
          view.Context2d.moveTo((x - hw), y);
          view.Context2d.lineTo((x - hw / 2), y);
          view.Context2d.moveTo((x + hw), y);
          view.Context2d.lineTo((x + hw / 2), y);
          view.Context2d.moveTo(x, (y - hh));
          view.Context2d.lineTo(x, (y - hh / 2));
          view.Context2d.moveTo(x, (y + hh));
          view.Context2d.lineTo(x, (y + hh / 2));
          view.Context2d.stroke();
        }
      } else {
        cIdx += 2;
      }
    }

    view.Context2d.restore();
  };

  function RectSetWidget (layer, newFlag) {
    this.Visibility = true;
    // Keep track of annotation created by students without edit
    // permission.
    this.UserNoteFlag = !SA.Edit;

    if (layer === null) {
      return;
    }

    this.Shape = new RectSet();
    if (layer) {
      layer.AddWidget(this);
    }
    this.Active = false;
  }

  RectSetWidget.prototype.GetLength = function () {
    return this.Shape.Widths.length;
  };

  // Prioritizing by confidence does not work because they all have such high (equal) confidences.
  // Lets prioritize by area instead
  RectSetWidget.prototype.ComputeVisibilities = function (layer) {
    var rectSet = this.Shape;
    if (rectSet.Visibilities === undefined) {
      rectSet.Visibilities = Array(rectSet.Confidences.length);
      rectSet.Hash = new SAM.SpatialHash();
      var bds = layer.GetViewer().GetOverViewBounds();
      rectSet.Hash.Build(rectSet, bds);
    }
    var visibilities = rectSet.Visibilities;
    visibilities.fill(true);

    // Rectangles are reverse sorted by confidnece
    for (var i = 0; i < visibilities.length; ++i) {
      if (visibilities[i] === true && rectSet.Confidences[i] >= rectSet.Threshold) {
        var width = rectSet.Widths[i];
        var height = rectSet.Heights[i];
        var area1 = width * height;
        var center = rectSet.GetCenter(i);
        // Get all the other rects overlapping this one.
        var indexes = rectSet.Hash.GetOverlapping(center, width, height, 0.3);
        for (var j = 0; j < indexes.length; ++j) {
          var rect2Idx = indexes[j];
          if (rect2Idx !== i && visibilities[rect2Idx] &&
              rectSet.Confidences[rect2Idx] >= rectSet.Threshold) {
            // which should we hide?  Look at area to decide
            var area2 = rectSet.Widths[rect2Idx] * rectSet.Heights[rect2Idx];
            if (area1 < area2) {
              visibilities[i] = false;
            } else {
              visibilities[rect2Idx] = false;
            }
          }
        }
      }
    }
  };

  // note: this assumes rects are squares.
  // I assume that the annotations are fixed and do not change after this
  // is called.  This can be called multiple times
  // (when threshold or size changes).
  // Remove overlapping annoations (visibility = false).
  // greedy: first supresses later)
  RectSetWidget.prototype.ComputeVisibilitiesConfidence = function (layer) {
    var rectSet = this.Shape;
    if (rectSet.Visibilities === undefined) {
      rectSet.Visibilities = Array(rectSet.Confidences.length);
      rectSet.Hash = new SAM.SpatialHash();
      var bds = layer.GetViewer().GetOverViewBounds();
      rectSet.Hash.Build(rectSet, bds);
    }
    var visibilities = rectSet.Visibilities;
    visibilities.fill(false);

    // Rectangles are reverse sorted by confidnece
    for (var i = 0; i < visibilities.length; ++i) {
      if (visibilities[i] === false && rectSet.Confidences[i] >= rectSet.Threshold) {
        var width = rectSet.Widths[i];
        var height = rectSet.Heights[i];
        var center = rectSet.GetCenter(i);
        // Get all the other rects overlapping this one.
        var indexes = rectSet.Hash.GetOverlapping(center, width, height, 0.3);
        var alone = true;
        for (var j = 0; j < indexes.length; ++j) {
          var rect2Idx = indexes[j];
          // Odd: Make them visible one by one.
          if (rect2Idx < i && visibilities[rect2Idx]) {
            // found a visibile neighbor.
            alone = false;
          }
        }
        visibilities[i] = alone;
      }
    }
  };

  // Change the visiblities and colors to indicate change.
  // This assume that the visibilities have been computed already.
  // and hash has been built too.
  RectSet.prototype.ChangeDetectionVisibilities = function (rectSet1, rectSet2,
                                                            overlapThresh) {
    var visibilities1 = rectSet1.Visibilities;
    var visibilities2 = rectSet2.Visibilities;

    for (var i = 0; i < visibilities1.length; ++i) {
      if (visibilities1[i]) {
        var c = rectSet1.GetCenter(i);
        var w = rectSet1.Widths[i];
        var h = rectSet1.Widths[i];
        var indexes = rectSet2.Hash.GetOverlapping(c, w, h, 0.3);
        for (var j = 0; j < indexes.length; ++j) {
          visibilities2[indexes[j]] = false;
          visibilities1[i] = false;
        }
      }
    }
  };

  // Sort by confidences
  // Note: Not used yet.
  RectSetWidget.prototype.Sort = function (lowToHigh) {
    // Create an array to sort that also keeps the indexes.
    var sortable = new Array(this.Confidences.length);
    var reverse = 1;
    if (lowToHigh) {
      reverse = -1;
    }
    for (var i = 0; i < sortable.length; ++i) {
      sortable[i] = {conf: reverse * this.Confidences[i], idx: i};
    }
    sortable.sort(function (a, b) {
      if (a.conf > b.conf) {
        return 1;
      }
      if (a.conf < b.conf) {
        return -1;
      }
      // a must be equal to b
      return 0;
    });
    // Update all arrays.
    var newConfidences = new Array(this.Confidences.length);
    var newCenters = new Array(this.Centers.length);
    var newLabels = new Array(this.Centers.length);
    var newMetadata = new Array(this.Metadata.length);
    for (i = 0; i < newConfidences.length; ++i) {
      var i2 = sortable[i].idx;
      newLabels[i] = this.Labels[i2];
      newMetadata[i] = this.Metadata[i2];
      newConfidences[i] = this.Confidences[i2];
      i2 = i2 * 2;
      newCenters[2 * i] = this.Centers[i2];
      newCenters[2 * i + 1] = this.Centers[i2 + 1];
    }
    this.Centers = newCenters;
    this.Confidences = newConfidences;
    this.Labels = newLabels;
    this.Metadata = newMetadata;
  };

  // Threshold above is the only option for now.
  RectSetWidget.prototype.SetThreshold = function (threshold) {
    this.Shape.Threshold = threshold;
  };

  RectSetWidget.prototype.Draw = function (layer) {
    if (this.Visibility) {
      this.Shape.Draw(layer.GetView());
    }
  };

  RectSetWidget.prototype.Serialize = function () {
    if (this.Shape === undefined) { return null; }

    var obj = {type: 'rect_set'};
    if (this.UserNoteFlag !== undefined) {
      obj.user_note_flag = this.UserNoteFlag;
    }
    if (this.Shape.Color) {
      obj.color = SAM.ConvertColor(this.Shape.Color);
    }
    if (this.Label) {
      obj.label = this.Label;
    }
    var num = this.Shape.Widths.length;
    obj.confidences = new Array(num);
    obj.widths = new Array(num);
    obj.heights = new Array(num);
    obj.labels = new Array(num);
    obj.metadata = new Array(num);
    obj.centers = new Array(num * 2);
    for (var i = 0; i < num; ++i) {
      obj.widths[i] = this.Shape.Widths[i];
      obj.heights[i] = this.Shape.Heights[i];
      obj.confidences[i] = this.Shape.Confidences[i];
      obj.centers[i] = this.Shape.Centers[i];
      obj.centers[i + num] = this.Shape.Centers[i + num];
      obj.labels[i] = this.Shape.Labels[i];
      obj.metadata[i] = this.Shape.Metadata[i];
    }
    return obj;
  };

  // Load a widget from a json object (origin MongoDB).
  RectSetWidget.prototype.Load = function (obj) {
    this.UserNoteFlag = obj.user_note_flag;
    if (obj.label) {
      this.Label = obj.label;
    }
    if (obj.color) {
      this.Shape.Color = [
        parseFloat(obj.color[0]),
        parseFloat(obj.color[1]),
        parseFloat(obj.color[2])];
    }
    var num = obj.widths.length;
    this.Shape.Confidences = new Array(num);
    this.Shape.Labels = new Array(num);
    this.Shape.Widths = new Array(num);
    this.Shape.Heights = new Array(num);
    this.Shape.Centers = new Array(num * 2);
    if (obj.vectors) {
      this.Shape.Vectors = new Array(num * 2);
    }
    this.Shape.Metadata = new Array(num);
    for (var i = 0; i < num; ++i) {
      this.Shape.Widths[i] = parseFloat(obj.widths[i]);
      this.Shape.Heights[i] = parseFloat(obj.heights[i]);
      this.Shape.Confidences[i] = parseFloat(obj.confidences[i]);
      if (obj.labels) {
        this.Shape.Labels[i] = obj.labels[i];
      } else {
        this.Shape.Labels[i] = '';
      }
      if (obj.metadata) {
        this.Shape.Metadata[i] = obj.metadata[i];
      } else {
        this.Shape.Metadata[i] = {};
      }
      this.Shape.Centers[i] = parseFloat(obj.centers[i]);
      this.Shape.Centers[i + num] = parseFloat(obj.centers[i + num]);
      if (obj.vectors) {
        this.Shape.Vectors[i] = parseFloat(obj.vectors[i]);
        this.Shape.Vectors[i + num] = parseFloat(obj.vectors[i + num]);
      }
    }
  };

  RectSetWidget.prototype.HandleDoubleClick = function (layer) {
    return true;
  };

  RectSetWidget.prototype.HandleMouseUp = function (layer) {
    return true;
  };

  RectSetWidget.prototype.HandleMouseMove = function (layer) {
    return true;
  };

  RectSetWidget.prototype.HandleMouseWheel = function (layer) {
    return true;
  };

  RectSetWidget.prototype.HandleTouchPan = function (layer) {
    return true;
  };

  RectSetWidget.prototype.HandleTouchPinch = function (layer) {
    return true;
  };

  RectSetWidget.prototype.HandleTouchEnd = function (layer) {
    return true;
  };

  RectSetWidget.prototype.CheckActive = function (layer) {
    return this.Active;
  };

  // Multiple active states. Active state is a bit confusing.
  RectSetWidget.prototype.GetActive = function () {
    return this.Active;
  };

  RectSetWidget.prototype.RemoveFromLayer = function (layer) {
    if (layer) {
      layer.RemoveWidget(this);
    }
    layer = null;
  };

  RectSetWidget.prototype.Deactivate = function (layer) {
  };

  RectSetWidget.prototype.PlacePopup = function (layer) {
  };

  RectSetWidget.prototype.ShowPropertiesDialog = function (layer) {
  };

  SAM.RectSetWidget = RectSetWidget;
  SAM.RectSet = RectSet;
})();
