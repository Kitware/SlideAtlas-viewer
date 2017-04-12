// ==============================================================================
// A gui for that controls layers in multiple viewers.

(function () {
  'use strict';

  function LayerView (parent, label) {
    this.Layers = [];
    this.Label = label;
    this.Color = [Math.random(), Math.random(), Math.random()];

    this.Initialize(parent, label);
    this.SetSizeScale(1.0);

    this.Changeflag = false;
  }

  LayerView.prototype.AddLayer = function (layer) {
    var self = this;
    // For the stack viewer.  The layer gets loaded with another view,
    // We hve to apply the color and threshold.
    layer.LoadCallback = function () {
      self.UpdateLayer(layer);
    };

    this.Layers.push(layer);
    if (this.VisibilityCheckBox && this.Slider) {
      this.UpdateLayer(layer);
    }
  };

  // Initialize the gui / dom
  LayerView.prototype.Initialize = function (parent, label) {
    var self = this;

    // The wrapper div that controls a single layer.
    var layerControl = $('<div>')
      .appendTo(parent)
      .css({'border': '1px solid #CCC', 'width': '100%'});

    var leftWrapper = $('<div>')
      .appendTo(layerControl)
      .css({
        'width': '80%',
        'border-right': '1px solid #CCC',
        'height': '100%',
        'display': 'inline-block'});
    // the sub-div that holds the direct toggle and the label.
    var toggleWrapper = $('<div>')
      .appendTo(leftWrapper)
      .css({
        'border-bottom': '1px solid #CCC',
        'width': '100%',
        'float': 'top' });

    this.VisibilityCheckBox = $('<input type="checkbox">')
      .appendTo(toggleWrapper)
      .css({'display': 'inline-block'})
      .on('change',
          function () {
            self.VisibilityCheckCallback();
          })
      .prop('checked', true);

    $('<div>')
      .appendTo(toggleWrapper)
      .css({
        'display': 'inline-block',
        'margin-left': '1em'})
      .html(label);

    this.ChangeCheckBox = $('<input type="checkbox">')
      .appendTo(toggleWrapper)
      .css({
        'display': 'inline-block',
        'float': 'right'})
      .on('change',
          function () {
            self.ChangeCheckCallback();
          })
      .prop('checked', false);

    // Wrapper for the confidence slider.
    var confWrapper = $('<div>')
      .appendTo(leftWrapper)
      .css({'width': '100%'});

    this.Slider = $('<input type="range" min="0" max="100">')
      .appendTo(confWrapper)
      .on('input',
          function () {
            self.SliderCallback();
          });

    $('<div>')
      .appendTo(confWrapper)
      .html('0%')
      .css({ 'float': 'left' });

    $('<div>')
      .appendTo(confWrapper)
      .html('100%')
      .css({ 'float': 'right' });

    var colorWrapper = $('<div>')
      .appendTo(layerControl)
      .css({
        'padding': '5px',
        'height': '100%',
        'width': '20%',
        'display': 'inline-block'});
    this.ColorInput = $('<input type="color">')
      .appendTo(colorWrapper)
      .css({'width': '100%'})
      .val(SAM.ConvertColorToHex(this.Color))
      .change(function () {
        self.ColorCallback();
      });

    this.SizeScaleInput = $('<input type="number">').appendTo(colorWrapper)
      .css({'width': '100%'})
      .prop('title', 'Change the size of the detections')
      .on('change', function () { self.SizeScaleCallback(); });
  };

  LayerView.prototype.SetSizeScale = function (sizeScale) {
    this.SizeScaleInput.val((Math.round(sizeScale * 100)).toString());
    // not used this.RectSizeScale = sizeScale;
    // This might not be necessary. Change event might trigger it for us.
    this.SizeScaleCallback();
  };

  LayerView.prototype.SizeScaleCallback = function () {
    this.Color = SAM.ConvertColor(this.ColorInput.val());
    for (var i = 0; i < this.Layers.length; ++i) {
      this.UpdateLayer(this.Layers[i]);
    }
  };

  LayerView.prototype.ColorCallback = function () {
    this.Color = SAM.ConvertColor(this.ColorInput.val());
    for (var i = 0; i < this.Layers.length; ++i) {
      this.UpdateLayer(this.Layers[i]);
    }
  };

  LayerView.prototype.VisibilityCheckCallback = function () {
    var checked = this.VisibilityCheckBox.prop('checked');
    for (var i = 0; i < this.Layers.length; ++i) {
      this.Layers[i].SetVisibility(checked);
      this.Layers[i].EventuallyDraw();
    }
  };

  LayerView.prototype.ChangeCheckCallback = function () {
    this.ChangeFlag = this.ChangeCheckBox.prop('checked');
    for (var i = 0; i < this.Layers.length; ++i) {
      this.UpdateLayer(this.Layers[i]);
      this.Layers[i].EventuallyDraw();
    }
    if (this.ChangeFlag) {
      var set1 = this.Layers[0].WidgetList[0].Shape;
      var set2 = this.Layers[1].WidgetList[0].Shape;
      set1.ChangeDetectionVisibilities(set1, set2);
      set1.SetOutlineColor('#FF0000');
      set2.SetOutlineColor('#00FF00');
    }
  };

  LayerView.prototype.SliderCallback = function () {
    for (var i = 0; i < this.Layers.length; ++i) {
      this.UpdateLayer(this.Layers[i]);
    }
  };

  LayerView.prototype.UpdateLayer = function (layer) {
    var checked = this.VisibilityCheckBox.prop('checked');
    layer.SetVisibility(checked);
    if (checked) {
      var sizeScale = parseInt(this.SizeScaleInput.val() / 100);
      var visValue = parseInt(this.Slider.val()) / 100.0;
      for (var wIndex = 0; wIndex < layer.WidgetList.length; wIndex++) {
        var widget = layer.WidgetList[wIndex];
        widget.SetThreshold(visValue);
        widget.Shape.SetOutlineColor(this.Color);
        widget.Shape.SetScale(sizeScale);
        widget.ComputeVisibilities();
      }
    }
    layer.EventuallyDraw();
  };

  SA.LayerView = LayerView;
})();
