// ==============================================================================
// A gui for vigilant that controls layers in multiple viewers.

(function () {
  'use strict';

  function LayerView (parent, label) {
    this.Layers = [];
    this.Label = label;
    this.Color = [Math.random(), Math.random(), Math.random()];

    this.Initialize(parent, label);
  }

  LayerView.prototype.AddLayer = function (layer) {
    var self = this;
        // For the stack viewer.  The layer gets loaded with another view,
        // We hve to apply the color and threshold.
    layer.LoadCallback = function () {
      self.UpdateLayer(layer);
    };

    this.Layers.push(layer);
    if (this.CheckBox && this.Slider) {
      this.UpdateLayer(layer);
    }
  };

    // Initialize the gui / dom
  LayerView.prototype.Initialize = function (parent, label) {
    var self = this;

        // The wrapper div that controls a single layer.
    var layerControl = $('<div>')
            .appendTo(parent)
            .css({
              'border': '1px solid #CCC',
              'width': '100%',
              'height': '65px'
            });

        // the sub-div that holds the direct toggle and the label.
    var toggleWrapper = $('<div>')
            .appendTo(layerControl)
            .css({
              'border': '1px solid #CCC',
              'width': '20%',
              'height': '100%',
              'float': 'left'
            });

    this.CheckBox = $('<input type="checkbox">')
            .appendTo(toggleWrapper)
            .on('change',
                function () {
                  self.CheckCallback();
                })
            .prop('checked', true);

    var layerLabel = $('<div>')
            .appendTo(toggleWrapper)
            .html(label);

        // Wrapper for the confidence slider.
    var confWrapper = $('<div>')
            .appendTo(layerControl)
            .css({
              'border': '1px solid #CCC',
              'width': '60%',
              'height': '100%',
              'float': 'left'
            });

    this.Slider = $('<input type="range" min="0" max="100">')
            .appendTo(confWrapper)
            .on('input',
                function () {
                  self.SliderCallback();
                });
        // this.Slider[0].min = 75;

    var minLabel = $('<div>')
            .appendTo(confWrapper)
            .html('0%')
            .css({ 'float': 'left' });

    var maxLabel = $('<div>')
            .appendTo(confWrapper)
            .html('100%')
            .css({ 'float': 'right' });

    var colorWrapper = $('<div>')
            .appendTo(layerControl)
            .css({
              'border': '1px solid #CCC',
              'width': '20%',
              'padding': '5px',
              'height': '100%',
              'float': 'left'
            });
    this.ColorInput = $('<input type="color">')
            .appendTo(colorWrapper)
            .val(SAM.ConvertColorToHex(this.Color))
            .change(function () {
              self.ColorCallback();
            });
  };

  LayerView.prototype.ColorCallback = function () {
    this.Color = SAM.ConvertColor(this.ColorInput.val());
    for (var i = 0; i < this.Layers.length; ++i) {
      this.UpdateLayer(this.Layers[i]);
    }
  };

  LayerView.prototype.CheckCallback = function () {
    var checked = this.CheckBox.prop('checked');
    for (var i = 0; i < this.Layers.length; ++i) {
      this.Layers[i].SetVisibility(checked);
      this.Layers[i].EventuallyDraw();
    }
  };

  LayerView.prototype.SliderCallback = function () {
    for (var i = 0; i < this.Layers.length; ++i) {
      this.UpdateLayer(this.Layers[i]);
    }
  };

  LayerView.prototype.UpdateLayer = function (layer) {
    var checked = this.CheckBox.prop('checked');
    layer.SetVisibility(checked);
    if (checked) {
      var visValue = parseInt(this.Slider.val()) / 100.0;
      for (var wIndex = 0; wIndex < layer.WidgetList.length; wIndex++) {
        var widget = layer.WidgetList[wIndex];
        widget.SetThreshold(visValue);
        widget.Shape.SetOutlineColor(this.Color);
      }
    }
    layer.EventuallyDraw();
  };

  SA.LayerView = LayerView;
})();

