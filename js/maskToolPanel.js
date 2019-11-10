// Split off from annotationToolPanel.js
// This is for mask tools: draw and erase.

(function () {
  'use strict';

  // Parent is the viewer.Div
  // TODO: Simplify the args.
  function MaskToolPanel (layerPanel) {
    this.LayerPanel = layerPanel;
    // Any new layers created have to know the viewer.
    this.Viewer = layerPanel.Viewer;

    this.Parent = this.Viewer.GetDiv();

    // -----------------------------------------------------

    // CSS maybe?
    this.Margin = layerPanel.Margin;
    this.ToolDivHeight = layerPanel.ToolDivHeight;

    // If we have write access, this creates markup tools.
    this.ToolPanel = $('<div>')
      .appendTo(this.Parent.parent())
      .hover(function () { $(this).css({'opacity': '1'}); },
             function () { $(this).css({'opacity': '0.6'}); })
      .css({
        'position': 'absolute',
        'background-color': '#fff',
        'border': '1px solid #666666',
        'left': '3px',
        'top': (5 * this.Margin) + 'px',
        'opacity': '0.6',
        'z-index': '300'})
      .draggable()
      .hide();

    this.ToolDiv = $('<div>')
      .appendTo(this.ToolPanel);

    this.OptionsDiv = $('<div>')
      .appendTo(this.ToolPanel)
      .attr('id', 'saAnnotationTools');

    this.InitializeTools();
  }

  MaskToolPanel.prototype.SetLayerGui = function (layerGui) {
    this.LayerGui = layerGui;
  };

  MaskToolPanel.prototype.Hide = function () {
    this.ToolPanel.hide();
  };

  MaskToolPanel.prototype.Show = function () {
    this.ToolPanel.show();
  };

  MaskToolPanel.prototype.InitializeTools = function () {
    // Radio buttons for tools. (One active at a time).
    this.CursorButton = this.AddToolRadioButton('cursor_arrow.png', 'CursorOn');
    this.PaintButton = this.AddToolRadioButton('paint64.png', 'PaintButtonOn');
    this.EraseButton = this.AddToolRadioButton('eraser64.png', 'EraseButtonOn');

    this.CursorButton.css({
      'border': '2px solid #333',
      'background-color': '#bcf'});

    // Default just lets the viewer handle the events.
    this.ActiveToolButton = this.CursorButton;
  };

  MaskToolPanel.prototype.AddToolRadioButton = function (imageFile, onCallbackName) {
    var self = this;
    var button = $('<img>')
        .appendTo(this.ToolDiv)
        .css({
          'border': '2px solid #ccc',
          'margin': '1px',
          'background-color': '#fff',
          'width': '28px',
          'height': '28px'
        })
        .attr('type', 'image')
        .attr('src', SA.ImagePathUrl + imageFile)
      .on('click touchstart',
          function () {
            self.ToolRadioButtonCallback(button);
            return false;
          })
      // To block the viewer moving.
      .on('mousedown mousemove mouseup touchmove touchend',
          function () { return false; });
      // On off functionality
    if (onCallbackName) {
      button.on(
        'radio-on',
        function () {
          self.LayerPanel.WithEditingLayerCall(
            function (annotObj) {
              (self[onCallbackName])(annotObj);
            });
        });
    }
    return button;
  };

  // Change the state of the Radio GUI, but do not trigger side effects (PencidOn ...)
  MaskToolPanel.prototype.HighlightRadioToolButton = function (pressedButton) {
    if (pressedButton === this.ActiveToolButton) {
      return false;
    }
    // Turn off the old one. We have to do this by turning on the cursor.
    this.ActiveToolButton
      .css({
        'border': '2px solid #ccc',
        'background-color': '#fff'});
    // Turn on the new one.
    pressedButton.css({
      'border': '2px solid #222',
      'background-color': '#cdf'});
    this.ActiveToolButton = pressedButton;
  };

  // General for the radio
  // This assumes button is in the ToolRadioButtons list.
  MaskToolPanel.prototype.ToolRadioButtonCallback = function (pressedButton) {
    if (pressedButton === this.ActiveToolButton) {
      return false;
    }
    // GUI only change/
    this.HighlightRadioToolButton(pressedButton);

    // Turn off previous tool widgets. (deactivate)
    if (this.LayerPanel.EditingLayer) {
      var layer = this.LayerPanel.EditingLayer.Layer;
      layer.InactivateAll();
    }

    // Turn on the new one.
    // Note: This ensures a layer is highlighted.
    pressedButton.trigger('radio-on');

    // Show the open closed toggle and other options.
    this.UpdateToolVisibility();
  };

  MaskToolPanel.prototype.UpdateToolVisibility = function () {
    console.log('UpdateToolVisibility not needed here.  Does it have to be called?');
  };

  MaskToolPanel.prototype.CursorOn = function () {
    if (this.LayerPanel.EditingLayer && this.LayerPanel.EditingLayer.Layer) {
      this.LayerPanel.EditingLayer.Layer.SetSelected(false);
      this.LayerPanel.EditingLayer.Layer.EventuallyDraw();
    }
    this.Viewer.GetParentDiv().css({'cursor': ''});
    this.ActiveToolButton = this.CursorButton;
    // Is this thie correct behavior?
    this.LayerGui.SelectedWidgets = [];
  };

  MaskToolPanel.prototype.PaintButtonOn = function (annotObj) {
    // The layer has to be in editing mode.
    annotObj.EditOn();

    var widget;
    // Get a paint widget.
    // Look for a selected widget to reuse.
    var layer = annotObj.Layer;
    // ??????
    if (!widget) {
      widget = layer.GetASelectedWidget('paint');
    }
    if (!widget) {
      // A selected arrowWidget was not found. Make a new arrow widget.
      widget = new SAM.PaintWidget(layer);
      layer.AddWidget(widget);
      widget.SetCreationCamera(layer.GetCamera());
    }

    // Activate the widget to start drawing.
    widget.SetStateToDrawing(layer);

    // If the widget is deactivated with a key stroke, this will turn off the
    // widget button when the widget deactivates itself.
    var self = this;
    widget.SetStateChangeCallback(function () {
      if (!widget.GetActive()) {
        self.ToolRadioButtonCallback(self.CursorButton);
      }
    });

    this.LayerGui.SelectedWidgets = [widget];
  };

  MaskToolPanel.prototype.EraseButtonOn = function (annotObj) {
    // The layer has to be in editing mode.
    annotObj.EditOn();

    var widget;
    // Get an erase widget.
    // Look for a selected widget to reuse.
    var layer = annotObj.Layer;
    // ??????
    if (!widget) {
      widget = layer.GetASelectedWidget('erase');
    }
    if (!widget) {
      // A selected arrowWidget was not found. Make a new arrow widget.
      widget = new SAM.EraseWidget(layer);
      layer.AddWidget(widget);
      widget.SetCreationCamera(layer.GetCamera());
    }

    // Activate the widget to start drawing.
    widget.SetStateToDrawing(layer);

    // If the widget is deactivated with a key stroke, this will turn off the
    // widget button when the widget deactivates itself.
    var self = this;
    widget.SetStateChangeCallback(function () {
      if (!widget.GetActive()) {
        self.ToolRadioButtonCallback(self.CursorButton);
      }
    });

    this.LayerGui.SelectedWidgets = [widget];
  };

  MaskToolPanel.prototype.SetTime = function (time) {
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var annotObj = this.AnnotationObjects[i];
      var layer = annotObj.Layer;
      if (layer) {
        layer.ZTime = time;
      }
    }
  };

  SAM.MaskToolPanel = MaskToolPanel;
})();
