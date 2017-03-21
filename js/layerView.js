//==============================================================================
// A gui for that controls layers in multiple viewers.

(function () {
  "use strict";

  function LayerView (parent, label) {
    this.Layers = [];
    this.Label = label;
    this.Color = [Math.random(),Math.random(),Math.random()];

    this.Initialize(parent,label);
    this.SetSize(80);

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
    var layer_control = $('<div>')
      .appendTo(parent)
      .css({ 'border': '1px solid #CCC', 'width': '100%'});

    var left_wrapper = $('<div>')
      .appendTo(layer_control)
      .css({ 'width': '80%',
             'border-right': '1px solid #CCC', 
             'width': '80%',
             'height': '100%',
             'display':'inline-block'});
    // the sub-div that holds the direct toggle and the label.
    var toggle_wrapper = $('<div>')
      .appendTo(left_wrapper)
      .css({ 'border-bottom': '1px solid #CCC', 
             'width': '100%',
             'float': 'top' });

    this.VisibilityCheckBox = $('<input type="checkbox">')
      .appendTo(toggle_wrapper)
      .css({'display':'inline-block'})
      .on('change',
          function(){
            self.VisibilityCheckCallback();
          })
      .prop('checked', true);

    var layer_label = $('<div>')
      .appendTo(toggle_wrapper)
      .css({'display':'inline-block',
            'margin-left':'1em'})
      .html(label);

    this.ChangeCheckBox = $('<input type="checkbox">')
      .appendTo(toggle_wrapper)
      .css({'display':'inline-block',
            'float':'right'})
      .on('change',
          function(){
            self.ChangeCheckCallback();
          })
      .prop('checked', false);

    // Wrapper for the confidence slider.
    var conf_wrapper = $('<div>')
      .appendTo(left_wrapper)
      .css({'width': '100%'});

    this.Slider = $('<input type="range" min="0" max="100">')
      .appendTo(conf_wrapper)
      .on('input',
          function(){
            self.SliderCallback();
          });
    //this.Slider[0].min = 75;

    var min_label = $('<div>')
      .appendTo(conf_wrapper)
      .html("0%")
      .css({ 'float': 'left' });

    var max_label = $('<div>')
      .appendTo(conf_wrapper)
      .html("100%")
      .css({ 'float': 'right' });

    var color_wrapper = $('<div>')
      .appendTo(layer_control)
      .css({ 'padding':'5px',
             'height': '100%',
             'width':  '20%',
             'display':'inline-block'});
    this.ColorInput = $('<input type="color">')
      .appendTo(color_wrapper)
      .css({'width':'100%'})
      .val(SAM.ConvertColorToHex(this.Color))
      .change(function () {
        self.ColorCallback();
      });

    this.SizeInput = $('<input type="number">').appendTo(color_wrapper)
      .css({'width':'100%'})
      .prop('title', "Change the size of the detections")
      .on('change', function(){self.SizeCallback();});
  };

  LayerView.prototype.SetSize = function (size) {
    this.SizeInput.val(size.toString());
    this.RectSize = size;
    // This might not be necessary. Change event might trigger it for us.
    this.SizeCallback();
  };

  LayerView.prototype.SizeCallback = function () {
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
      set1.SetOutlineColor("#FF0000");
      set2.SetOutlineColor("#00FF00");
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
      var size = parseInt(this.SizeInput.val());
      var vis_value = parseInt(this.Slider.val()) / 100.0;
      for (var w_index = 0; w_index < layer.WidgetList.length; w_index++){
        var widget = layer.WidgetList[w_index];
        widget.SetThreshold(vis_value);
        widget.Shape.SetOutlineColor(this.Color);
        widget.Shape.SetShape([size,size]);
      }
      widget.ComputeVisibilities();
    }
    layer.EventuallyDraw();
  };

  SA.LayerView = LayerView;

})();

