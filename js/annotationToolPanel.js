// Split off from girderAnnotationPannel.js
// NOTE: These two classes have not been untangled completely.
// Try to get rid of "LayerPanel" ivar wherever it is used.

// This creates and manages the set of radio buttons for annotating.
// I tis a bit complex with the states.

// Get iPad pencil automatically triggering pecil tool (transiently)

// Get an eraser pencil option working.

// Text widget does not change background rect size when new lines are added.
// Fix potential infinte loop in pencil widget combine strokes.

// Delete stroke should select the last stroke in the widget. If the widget
// is empty, the widget should be removed and the tool state should go to cursor.

// Pencil should work on the overview.
// Copy?
// Higher opacity on ipad.
// ? button for instructions
// Eraser button.
// Double click a stroke brings up delete.
// Separate out the pencil dialog from the pencil widget.  make it apply to individual strokes.
// pop up dialog on doulbe click.

// Text background flag does not toggle.

// 1: fix delay before pencil starts drawing (gap in line).
//  9: Make the panel collapse to a single button.
// 11: make sure it works on an ipad / surface.

// 3: undo.


// Notes:  It was tricky getting two modes of activating tools:  1 radio button, 2 click to select widget.
// Here is what happens for the two paths:
// Click Tool button
//   0: Update the radio GUI.
//   2: Inactivate previous widget.
//   1: Layer editon (good)
//   3: Activate a new widget active
// Click widget (single select)
//   0: Inactivate Previous widget.
//   1: Widget state to Editing (Widget handles this)
//   2: Layer editon (good)
//   3: Changes tool button GUI.


// TODO: Clean up the access to "AnnotationLayerGui::SelectedWidgets"


(function () {
  'use strict';

  // PencilToggle.
  var OPEN = 0;
  var CLOSED = 1;

  // Parent is the viewer.Div
  // TODO: Simplify the args.
  function AnnotationToolPanel (layerPanel) {
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
        // 'height': this.ToolDivHeight.toString() + 'px',
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

  AnnotationToolPanel.prototype.SetLayerGui = function (layerGui) {
    this.LayerGui = layerGui;
  };

  AnnotationToolPanel.prototype.GetLayerGui = function () {
    if (! this.LayerGui) {
      this.LayerGui = this.LayerPanel.GetDefaultLayerGui()
      // The layer panel aleady sets this,
      // but it cannot hurt to do this for saftey.
      // It is a hack.  No API.
      // this.LayerGui.ToolPanel = this;
    }
    return this.LayerGui;
  };
  
  AnnotationToolPanel.prototype.Hide = function () {
    this.ToolPanel.hide();
  };

  AnnotationToolPanel.prototype.Show = function () {
    this.ToolPanel.show();
  };
  
  AnnotationToolPanel.prototype.InitializeTools = function () {
    var self = this;

    // Radio buttons for tools. (One active at a time).
    this.CursorButton = this.AddToolRadioButton('cursor_arrow.png', 'CursorOn');
    this.TextButton = this.AddToolRadioButton('Text.png', 'TextButtonOn');
    this.ArrowButton = this.AddToolRadioButton('Arrow.png', 'ArrowButtonOn');
    this.CircleButton = this.AddToolRadioButton('Circle.png', 'CircleButtonOn');
    this.RectangleButton = this.AddToolRadioButton('rectangle.gif', 'RectangleButtonOn');
    this.PencilButton = this.AddToolRadioButton('Pencil-icon.png', 'PencilButtonOn');
    this.RectSelectButton = this.AddToolRadioButton('rect_select.png', 'RectSelectOn');

    // This is visibile, only when a annotation is being edited.
    this.RectSelectButton.hide();
    this.CursorButton.css({
      'border': '2px solid #333',
      'background-color': '#bcf'});

    // Default just lets the viewer handle the events.
    this.ActiveToolButton = this.CursorButton;

    // Not part of the radio group.  This is a sub option for pencils.
    this.PencilOpenClosedState = OPEN;
    this.PencilOpenClosedToggle = $('<img>')
      .appendTo(this.OptionsDiv)
      .addClass('sa-view-annotation-button sa-flat-button-active')
      .addClass('sa-active')
      .css({
        'border': '1px solid #333',
        'width': '28px',
        'height': '28px',
        'background-color': '#fff'})
      .attr('type', 'image')
      .prop('title', 'open/closed')
      .attr('src', SA.ImagePathUrl + 'open_lasso.png')
      .on('click touchstart',
          function () {
            self.TogglePencilOpenClosed();
            return false;
          })
      .hide();
    this.PencilOpenClosedToggle.on('mousedown mousemove mouseup touchmove touchend',
                                   function () { return false; });

    // Not part of the radio group.  This is a sub option for pencils.
    this.PencilOpenClosedState = OPEN;
    this.PencilOpenClosedToggle = $('<img>')
      .appendTo(this.OptionsDiv)
      .addClass('sa-view-annotation-button sa-flat-button-active')
      .addClass('sa-active')
      .css({
        'border': '1px solid #333',
        'background-color': '#fff'})
      .attr('type', 'image')
      .prop('title', 'open/closed')
      .attr('src', SA.ImagePathUrl + 'open_lasso.png')
      .on('click touchstart',
          function () {
            self.TogglePencilOpenClosed();
            return false;
          })
      .hide();
    this.PencilOpenClosedToggle.on('mousedown mousemove mouseup touchmove touchend',
                                   function () { return false; });

    // A menu button that pops up when a markup is selected.
    // Not part of the radio group.  This is a sub option for widgets.
    this.PropertiesDialogButton = $('<img>')
      .appendTo(this.OptionsDiv)
      .addClass('sa-view-annotation-button sa-flat-button-active')
      .addClass('sa-active')
      .css({
        'border': '1px solid #333',
        'width': '28px',
        'height': '28px',
        'background-color': '#fff'})
      .attr('type', 'image')
      .prop('title', 'properties')
      .attr('src', SA.ImagePathUrl + 'Menu.jpg')
      .on('click touchstart',
          function () {
            self.ShowSelectedWidgetMenu();
            return false;
          })
      .hide()
      .on('mousedown mousemove mouseup touchmove touchend',
          function () { return false; });

    this.LoadDefaults();
  };

  AnnotationToolPanel.prototype.AddToolRadioButton = function (imageFile, onCallbackName) {
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
            function (layerGui) {
              (self[onCallbackName])(layerGui);
            });
        });
    }
    return button;
  };

  // Change the state of the Radio GUI, but do not trigger side effects (PencidOn ...)
  AnnotationToolPanel.prototype.HighlightRadioToolButton = function (pressedButton) {
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
  AnnotationToolPanel.prototype.ToolRadioButtonCallback = function (pressedButton) {
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

  // Called by the PropertiesDialogButton click event.
  AnnotationToolPanel.prototype.ShowSelectedWidgetMenu = function () {
    var layerGui = this.GetLayerGui();
    if (!layerGui.SelectedWidgets.length === 1) {
      return;
    }

    var widget = layerGui.SelectedWidgets[0];
    if (widget.SetStateToDialog) {
      widget.SetStateToDialog();
    } else {
      widget.ShowPropertiesDialog();
    }
  };

  // When tools have nothing to modify, they disappear.
  // TODO: Help tool. to explain why a tool is not available.
  AnnotationToolPanel.prototype.UpdateToolVisibility = function () {
    if (this.GetLayerGui().SelectedWidgets.length === 1) {
      this.PropertiesDialogButton.show();
    } else {
      this.PropertiesDialogButton.hide();
    }

    // Pencil is always visible. If a layer is not being edited, one is created and set to editon.

    // RectangleSelect is only active when a layer is being edited and it has marks.
    //     An alternitive single select with mouseclick can always select and mark.
    // It does not make sense to create an annotation if one is not editing.
    // any created annotation will have no marks to select. Instead I will disable
    // the button until one is selected.
    // Just show and hid it for now.  I would really like to gray it out and put a hint
    // why it is grayed out.
    if (this.LayerPanel.EditingLayer && !this.LayerPanel.EditingLayer.Layer.IsEmpty()) {
      this.RectSelectButton.show();
    } else {
      this.RectSelectButton.hide();
    }

    // Open closed button is visible when any polylines are selected.
    // or the drawing pencil is active.
    var lineSelected = false;
    if (this.LayerPanel.EditingLayer) {
      var layer = this.LayerPanel.EditingLayer.Layer;
      for (var idx = 0; idx < layer.GetNumberOfWidgets(); ++idx) {
        var widget = layer.GetWidget(idx);
        if (widget.Type === 'pencil' && widget.IsSelected && widget.IsSelected()) {
          lineSelected = true;
          break;
        }
      }
    }
    // Some layer has to be being edited.
    if (this.LayerPanel.EditingLayer) {
      if (this.ActiveToolButton === this.PencilButton || lineSelected) {
        this.PencilOpenClosedToggle.show();
      } else {
        this.PencilOpenClosedToggle.hide();
      }
    }
  };

  AnnotationToolPanel.prototype.LoadDefaults = function () {
    if (localStorage.SaAnnotationPanelDefaults) {
      var defaults = JSON.parse(localStorage.SaAnnotationPanelDefaults);
      if (defaults.PencilMode === 'closed') {
        this.SetPencilModeToClosed();
      }
    }
  };

  AnnotationToolPanel.prototype.SaveDefaults = function () {
    var defaults = {'PencilMode': 'open'};
    if (this.PencilOpenClosedState === CLOSED) {
      defaults.PencilMode = 'closed';
    }
    localStorage.SaAnnotationPanelDefaults = JSON.stringify(defaults);
  };

  AnnotationToolPanel.prototype.TogglePencilOpenClosed = function () {
    if (this.PencilOpenClosedState === CLOSED) {
      this.SetPencilModeToOpen();
    } else {
      this.SetPencilModeToClosed();
    }
    if (this.LayerPanel.EditingLayer) {
      var layer = this.LayerPanel.EditingLayer.Layer;
      layer.EventuallyDraw();
    }
  };

  AnnotationToolPanel.prototype.SetPencilModeToOpen = function () {
    if (this.PencilOpenClosedState === OPEN) {
      return;
    }
    this.PencilOpenClosedState = OPEN;
    this.PencilOpenClosedToggle
        .attr('src', SA.ImagePathUrl + 'open_lasso.png');

    if (this.LayerGui) {
      var layerGui = this.LayerGui;
      for (var i = 0; i < layerGui.SelectedWidgets.length; ++i) {
        var widget = layerGui.SelectedWidgets[i];
        if (widget.SetModeToOpen) {
          widget.SetModeToOpen();
        }
        if (this.LayerPanel.EditingLayer) {
          this.LayerPanel.EditingLayer.Layer.EventuallyDraw();
        }
      }
    }
    this.SaveDefaults();
  };

  AnnotationToolPanel.prototype.SetPencilModeToClosed = function () {
    if (this.PencilOpenClosedState === CLOSED) {
      return;
    }
    console.log('Set mode to closed');
    this.PencilOpenClosedState = CLOSED;
    this.PencilOpenClosedToggle
        .attr('src', SA.ImagePathUrl + 'select_lasso.png');

    if (this.LayerGui) {
      var layerGui = this.LayerGui;
      for (var i = 0; i < layerGui.SelectedWidgets.length; ++i) {
        var widget = layerGui.SelectedWidgets[i];
        if (widget.SetModeToClosed) {
          widget.SetModeToClosed();
        }
        if (this.LayerPanel.EditingLayer) {
          this.LayerPanel.EditingLayer.Layer.EventuallyDraw();
        }
      }
    }
    this.SaveDefaults();
  };


  // ============================================================================
  // new (used) stuff.


  AnnotationToolPanel.prototype.CursorOn = function () {
    if (this.LayerPanel.EditingLayer && this.LayerPanel.EditingLayer.Layer) {
      this.LayerPanel.EditingLayer.Layer.SetSelected(false);
      this.LayerPanel.EditingLayer.Layer.EventuallyDraw();
    }
    this.Viewer.GetParentDiv().css({'cursor': ''});
    this.ActiveToolButton = this.CursorButton;
    // Is this thie correct behavior?
    if (this.LayerGui) {
      this.LayerGui.SelectedWidgets = [];
    }
  };

  // An annotation has to be selected for editing before this is called.
  // It starts a rectSelectWidget for the user.
  AnnotationToolPanel.prototype.RectSelectOn = function () {
    var self = this;
    var layerGui = this.LayerPanel.EditingLayer;
    // Anything being edited has to be loaded too.
    var layer = layerGui.Layer;
    layer.SetSelected(false);
    var rectSelectWidget = new SAM.RectSelectWidget(layer);
    rectSelectWidget.SetFinishCallback(function (w) { self.RectSelectOff(rectSelectWidget); });
    layer.AddWidget(rectSelectWidget);
    // Start receiving events.
    // Normally this happens as a call back when state changes to drawing.
    layer.ActivateWidget(rectSelectWidget);
    rectSelectWidget.SetStateToDrawing(layer);
  };
  // This is called when the selection has been made by the user.
  AnnotationToolPanel.prototype.RectSelectOff = function (selector) {
    var layerGui = this.LayerPanel.EditingLayer;
    var selectedWidgets = [];
    var layer = layerGui.Layer;
    for (var idx = 0; idx < layer.GetNumberOfWidgets(); ++idx) {
      var w = layer.GetWidget(idx);
      if (w.ApplySelect && w.ApplySelect(selector)) {
        selectedWidgets.push(w);
      }
    }
    layer.RemoveWidget(selector);
    layer.EventuallyDraw();

    var layerGui = this.GetLayerGui();
    if (selectedWidgets.length === 1) {
      layerGui.SetSelectedWidget(selectedWidgets[0]);
    } else {
      // See if we can move this to CursorOn
      layerGui.SelectedWidgets = selectedWidgets;
      this.HighlightRadioToolButton(this.CursorButton);
    }
    this.UpdateToolVisibility();
  };

  // TextButton is really a toggle (part of a radio group).
  // Text buttonOn <=> dialog showing.
  // Selecting a text automatically turns text button on and shows dialog.
  // I do not know if any call actually passes a wiodget.
  // Widget is an optional arguement. May not ever be called with a widget.
  AnnotationToolPanel.prototype.TextButtonOn = function (layerGui) {
    // The layer has to be in editing mode.
    layerGui.EditOn();

    var widget;
    // Get a text widget.
    // Look for a selected widget to reuse.
    var layer = layerGui.Layer;
    if (!widget) {
      widget = layer.GetASelectedWidget('text');
    }
    if (!widget) {
      // A selected textWidget was not found. Make a new text widget.
      widget = new SAM.TextWidget(layer);
      // widget.State = 3; // hack hack TODO: fix (text chowing up before dialog closes.
      // Dialog needs tu turn off and on bindings.
      // TODO: REmove dialogs from widget and manage them here.
      // Widgets can share a dialog.
      layer.AddWidget(widget);
      widget.SetCreationCamera(layer.GetCamera());
      widget.SetStateToDialog();
    }

    // Activate the widget to start drawing.
    // TODO: Fix the Text dialog creation process.  THis is not right but necvessary it seems.
    // widget.SetActive(true);

    // If the text is deactivated by closing the dialog, this will turn off the
    // text button.
    var self = this;
    widget.SetStateChangeCallback(function () {
      if (!widget.Layer) {
        // string was empty.  TODO: find a better way to handle widget initiated delete.
        self.GetLayerGui().SelectedWidgets = [];
        self.ToolRadioButtonCallback(self.CursorButton);
        self.UpdateToolVisibility();
      } else if (!widget.GetActive()) {
        self.ToolRadioButtonCallback(self.CursorButton);
      }
    });

    this.GetLayerGui().SelectedWidgets = [widget];
  };

  // Widget is an optional arguement.
  AnnotationToolPanel.prototype.ArrowButtonOn = function (layerGui) {
    // The layer has to be in editing mode.
    layerGui.EditOn();

    var widget;
    // Get an arrow widget.
    // Look for a selected widget to reuse.
    var layer = layerGui.Layer;
    if (!widget) {
      widget = layer.GetASelectedWidget('arrow');
    }
    if (!widget) {
      // A selected arrowWidget was not found. Make a new arrow widget.
      widget = new SAM.ArrowWidget(layer);
      // Dialog needs tu turn off and on bindings.
      // TODO: REmove dialogs from widget and manage them here.
      // Widgets can share a dialog.
      layer.AddWidget(widget);
      widget.SetC
      reationCamera(layer.GetCamera());
    }

    // Activate the widget to start drawing.
    widget.SetStateToDrawing(layer);

    // If the arrow is deactivated with a key stroke, this will turn off the
    // arrow button when the widget deactivates itself.
    var self = this;
    widget.SetStateChangeCallback(function () {
      if (!widget.GetActive()) {
        self.ToolRadioButtonCallback(self.CursorButton);
      }
    });

    this.GetLayerGui().SelectedWidgets = [widget];
  };

  AnnotationToolPanel.prototype.CircleButtonOn = function (layerGui) {
    // The layer has to be in editing mode.
    layerGui.EditOn();

    var widget;
    // Get an arrow widget.
    // Look for a selected widget to reuse.
    var layer = layerGui.Layer;
    if (!widget) {
      widget = layer.GetASelectedWidget('circle');
    }
    if (!widget) {
      // A selected arrowWidget was not found. Make a new arrow widget.
      widget = new SAM.CircleWidget(layer);
      // Dialog needs tu turn off and on bindings.
      // TODO: REmove dialogs from widget and manage them here.
      // Widgets can share a dialog.
      layer.AddWidget(widget);
      widget.SetCreationCamera(layer.GetCamera());
    }

    // Activate the widget to start drawing.
    widget.SetStateToDrawing(layer);

    // If the arrow is deactivated with a key stroke, this will turn off the
    // arrow button when the widget deactivates itself.
    var self = this;
    widget.SetStateChangeCallback(function () {
      if (!widget.GetActive()) {
        self.ToolRadioButtonCallback(self.CursorButton);
      }
    });

    this.GetLayerGui().SelectedWidgets = [widget];
  };

  AnnotationToolPanel.prototype.RectangleButtonOn = function (layerGui) {
    // The layer has to be in editing mode.
    layerGui.EditOn();

    var widget;
    // Get an arrow widget.
    // Look for a selected widget to reuse.
    var layer = layerGui.Layer;
    if (!widget) {
      widget = layer.GetASelectedWidget('rect');
    }
    if (!widget) {
      // A selected arrowWidget was not found. Make a new arrow widget.
      widget = new SAM.RectWidget(layer);
      // Dialog needs to turn off and on bindings.
      // TODO: REmove dialogs from widget and manage them here.
      // Widgets can share a dialog.
      layer.AddWidget(widget);
      widget.SetCreationCamera(layer.GetCamera());
    }

    // Activate the widget to start drawing.
    widget.SetStateToDrawing(layer);

    // If the rectangle is deactivated with a key stroke, this will turn off the
    // rectangle button when the widget deactivates itself.
    var self = this;
    widget.SetStateChangeCallback(function () {
      if (!widget.GetActive()) {
        self.ToolRadioButtonCallback(self.CursorButton);
      }
    });

    this.GetLayerGui().SelectedWidgets = [widget];
  };

  // Widget is an optional arguement.
  AnnotationToolPanel.prototype.PencilButtonOn = function (layerGui) {
    // The layer has to be in editing mode.
    layerGui.EditOn();

    var widget;
    // Get a pencil widget.
    // Look for a selected widget to reuse.
    var layer = layerGui.Layer;
    if (!widget) {
      widget = layer.GetASelectedWidget('pencil');
    }
    if (!widget) {
      // A selected pencilWidget was not found. Make a new pencil widget.
      widget = new SAM.PencilWidget(layer);
      // Dialog needs tu turn off and on bindings.
      // TODO: REmove dialogs from widget and manage them here.
      // Widgets can share a dialog.
      layer.AddWidget(widget);
      widget.SetCreationCamera(layer.GetCamera());
    }

    // Activate the widget to start drawing.
    widget.SetStateToDrawing(layer);

    // If the pencil is deactivated with a key stroke, this will turn off the
    // pencil button when the widget deactivates itself.
    var self = this;
    widget.SetStateChangeCallback(function () {
      if (!widget.GetActive()) {
        self.ToolRadioButtonCallback(self.CursorButton);
      }
    });

    // Will it use open or closed strokes?
    if (this.PencilOpenClosedState === OPEN) {
      widget.SetModeToOpen(layer);
    } else {
      widget.SetModeToClosed(layer);
    }

    this.GetLayerGui().SelectedWidgets = [widget];
  };

    
  AnnotationToolPanel.prototype.SetTime = function (time) {
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var layerGui = this.AnnotationObjects[i];
      var layer = layerGui.Layer;
      if (layer) {
        layer.ZTime = time;
      }
    }
  };

  
  SAM.AnnotationToolPanel = AnnotationToolPanel;
})();
