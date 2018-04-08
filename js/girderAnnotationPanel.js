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


(function () {
  'use strict';

  // PencilToggle.
  var OPEN = 0;
  var CLOSED = 1;

  // Parent is the viewer.Div
  function GirderAnnotationPanel (viewer, itemId) {
    this.Parent = viewer.GetDiv();
    // Any new layers created have to know the viewer.
    this.Viewer = viewer;
    viewer.ScaleOn();
    
    this.InitializeHelp(this.Parent.parent());
    
    // The pannel should probably not be managing this navigation widget.
    // I am putting it here as a temporary home.
    this.InitializeNavigation(viewer.GetDiv(), itemId);

    // To get event calls from the viewer.
    viewer.AddLayer(this);
    
    // -----------------------------------------------------
    this.ActiveColor = '#7CF';
    this.DefaultColor = '#DDD';
    this.ButtonSize = '16px';
    if (SAM.MOBILE_DEVICE === 'iPad') {
      this.ButtonSize = '24px';
    }
    
    // Create a parent div to hold all of the annotation labels
    this.Margin = 6;
    this.ToolDivHeight = 70;
    
    // Holds the annotation tools and the list of annotation buttons
    this.Div = $('<div>')
      // Have to use this parent, or events are blocked.
      .appendTo(this.Parent)
      .attr('id', 'saAnnotationPanel')
      .hover(function () { $(this).css({'opacity': '1'}); },
             function () { $(this).css({'opacity': '0.6'}); })
      .css({
        'position': 'absolute',
        'left': '3px',
        'top': (5 * this.Margin + this.ToolDivHeight) + 'px',
        'bottom': (2 * this.Margin) + 'px',
        'opacity': '0.6',
        'z-index': '2'});

    // If we have write access, this creates markup tools.
    this.ToolPanel = $('<div>')
      .appendTo(this.Parent.parent())
      .hover(function () { $(this).css({'opacity': '1'}); },
             function () { $(this).css({'opacity': '0.6'}); })
      .css({
        'position': 'absolute',
        'background-color':'#fff',
        'border': '1px solid #666666',        
        'left': '3px',
        'top': (5 * this.Margin) + 'px',
        //'height': this.ToolDivHeight.toString() + 'px',
        'opacity': '0.6',
        'z-index': '300'})
      .draggable();

    this.ToolDiv = $('<div>')
      .appendTo(this.ToolPanel);

    this.OptionsDiv = $('<div>')
      .appendTo(this.ToolPanel)
      .attr('id', 'saAnnotationTools');
    this.CheckItemIdAccessTools(itemId);

    // This makes a button for each annotation in the item.
    this.InitializeButtons(this.Div, itemId);

    this.Radius = 7;

    this.AnnotationObjects = [];
    this.Highlighted = undefined;

    this.ModifiedCount = 0;
  }

  GirderAnnotationPanel.prototype.InitializeNavigation = function (parent, itemId) {
    var nav = new SA.GirderNavigationWidget(parent, itemId);
    var self = this;
    nav.SetChangeItemCallback(function (itemId) { self.ChangeItem(itemId); });
  };

  // ===============================================================================
  // TODO: The information has to find a different home.
  GirderAnnotationPanel.prototype.InitializeHelp = function (parent) {
    var helpDiv = $('<div>')
        .appendTo(parent)
        .css({
          'position': 'absolute',
          'left': '3px',
          'top': '3px',
          'min-height': '300px',
          'min-width': '200px',
          'background-color':'#fff',
          'border': '1px solid #666666',
          'z-index': '400'})
        .hide()
        .on('mouseleave', 
            function (e) {
              helpDiv.hide();
            });
    var helpCloseButton = $('<div>')
        .appendTo(helpDiv)
        .prop('title', 'close')
        .addClass('sa-view-button')
        .css({
          'position': 'absolute',
          'right': '3px',
          'top': '3px',
          'height': '24px',
          'color': '#000',
          'z-index': '300'})
        .text('close')
        .on('click touchend',
            function (e) {
              helpDiv.hide();
            });

    var fullScreenOnDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width':'100%'});
    $('<img>')
      .appendTo(fullScreenOnDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'fullScreen32.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(fullScreenOnDiv)
      .css({'display':'inline-block'})
      .text('Expand the viewer to fullscreen.');
    
    var fullScreenOffDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width':'100%'});
    $('<img>')
      .appendTo(fullScreenOffDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'fullScreenOff32.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(fullScreenOffDiv)
      .css({'display':'inline-block'})
      .text('Turn off fullscreen');

    var textDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width':'100%'});
    $('<img>')
      .appendTo(textDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'Text.gif')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(textDiv)
      .css({'display':'inline-block'})
      .text('Text tool: Click on text to drag it.');

    var pencilDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width':'100%'});
    $('<img>')
      .appendTo(pencilDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'Pencil-icon.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(pencilDiv)
      .css({'display':'inline-block'})
      .text('Pencil tool: draw lines on the slide. Click on a line to select it.');

    var openDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width':'100%'});
    $('<img>')
      .appendTo(openDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'open_lasso.png')
      .css({'height': '24px',
            'margin-left':'24px'});
    $('<p>')
      .appendTo(openDiv)
      .css({'display':'inline-block'})
      .text('Open pencil mode: Simple open strokes.');

    var closedDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width':'100%'});
    $('<img>')
      .appendTo(closedDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'select_lasso.png')
      .css({'height': '24px',
            'margin-left':'24px'});
    $('<p>')
      .appendTo(closedDiv)
      .css({'display':'inline-block'})
      .text('Closed pencil mode: Draw closed loops that can be modified with subsequent strokes.');

    var deleteDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width':'100%'});
    $('<img>')
      .appendTo(deleteDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'blueDelete32.png')
      .css({'height': '24px',
            'margin-left':'24px'});
    $('<p>')
      .appendTo(deleteDiv)
      .css({'display':'inline-block'})
      .text('The delete button or the delete key will remove the selected markup.');

    var propertiesDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width':'100%'});
    $('<img>')
      .appendTo(propertiesDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'Menu.jpg')
      .css({'height': '24px',
            'margin-left':'24px'});
    $('<p>')
      .appendTo(propertiesDiv)
      .css({'display':'inline-block'})
      .text("Show the selected markup's property dialog.");

    // Annotation buttons
    $('<hr>')
      .appendTo(helpDiv);

    var annotationButtonDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width':'100%'});
    $('<img>')
      .appendTo(annotationButtonDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'AnnotationButton.jpg')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(annotationButtonDiv)
      .css({'display':'inline-block'})
      .text("Annotation buttons represent markup collections.");

    var visibilityDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width':'100%'});
    $('<img>')
      .appendTo(visibilityDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'eyeClosed32.png')
      .css({'height': '24px',
            'margin-left':'24px'});
    $('<img>')
      .appendTo(visibilityDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'eyeOpen32.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(visibilityDiv)
      .css({'display':'inline-block'})
      .text('The visibility toggle hides or shows all the markups in the annotation group.');

    var editDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width':'100%'});
    $('<img>')
      .appendTo(editDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'edit_up.png')
      .css({'height': '24px',
            'margin-left':'24px'});
    $('<img>')
      .appendTo(editDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'edit_down.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(editDiv)
      .css({'display':'inline-block'})
      .text('The edit toggle selects a single annotation group for editing.');

    // Toggle the help window on and off.
    var helpButton = $('<img>')
        .appendTo(parent)
        .prop('title', 'help')
        .addClass('sa-view-button')
        .attr('src', SA.ImagePathUrl + 'question32.png')
        .css({
          'position': 'absolute',
          'left': '40px',
          'top': '2px',
          'height': '24px',
          'z-index': '300'})
        .on('click touchend',
            function (e) {
              helpDiv.show();
            });
  };
  // ===============================================================================
  // Call back from navigation to update the annotation to match the viewer item.
  GirderAnnotationPanel.prototype.ChangeItem = function (itemId) {
    // Change the image in the viewer.
    var self = this;
    girder.rest.restRequest({
      path: 'item/' + itemId + '/tiles',
      method: 'GET'
    }).done(function (data) {
      self.LoadItemToViewer(itemId, data);
    });

    // Now for the annotation stuff.
    this.DeleteAnnotationButtons();
    this.InitializeButtons(this.Div, itemId);
  };

  GirderAnnotationPanel.prototype.LoadItemToViewer = function (itemId, data) {
    // TODO: if a viewer already exists, do we render again?
    // SlideAtlas bundles its own version of jQuery, which should attach itself to 'window.$' when it's sourced
    // The 'this.$el' still uses the Girder version of jQuery, which will not have 'saViewer' registered on it.
    var tileSource = {
      height: data.sizeY,
      width: data.sizeX,
      tileWidth: data.tileWidth,
      tileHeight: data.tileHeight,
      minLevel: 0,
      maxLevel: data.levels - 1,
      units: 'mm',
      spacing: [this.mm_x, this.mm_y],
      getTileUrl: function (level, x, y, z) {
        // Drop the 'z' argument
        var apiroot = 'api/v1';
        return apiroot + '/item/' + itemId + '/tiles/zxy/' + level + '/' + x + '/' + y;
      }
    };
    if (!this.mm_x) {
      // tileSource.units = 'pixels';
      tileSource.spacing = [1, 1];
    }

    var note = SA.TileSourceToNote(tileSource);
    this.Viewer.SetNote(note, 0, true);
    // Viewer.prototype.SetViewerRecord(viewerRecord, lockCamera);
  };

  // Now update the annotation GUI
  GirderAnnotationPanel.prototype.DeleteAnnotationButtons = function () {
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var annotObj = this.AnnotationObjects[i];
      this.EditOff(annotObj);
      this.VisibilityOff(annotObj);
      if (annotObj.Div) {
        annotObj.Div.remove();
      }
    }
    this.AnnotationObjects = [];
  };

  // Setup the tool buttons / GUI when this pannel is first constructed.
  // But first we have to go through a series of rest calls to determine we have write access.
  GirderAnnotationPanel.prototype.CheckItemIdAccessTools = function (itemId) {
    // First we have to see if we have write access to the folder containing this item.
    var self = this;
    girder.rest.restRequest({
      path: 'item/' + itemId,
      method: 'GET'
    }).done(function (data) {
      self.CheckItemDataAccessTools(data);
    });
  };
  GirderAnnotationPanel.prototype.CheckItemDataAccessTools = function (data) {
    // First we have to see if we have write access to the folder containing this item.
    var self = this;
    girder.rest.restRequest({
      path: 'folder/' + data.folderId,
      method: 'GET'
    }).done(function (data) {
      self.CheckFolderDataAccessTools(data);
    });
  };
  GirderAnnotationPanel.prototype.CheckFolderDataAccessTools = function (data) {
    if (data._accessLevel > 0) {
      // We have access.  Go ahead and create the tools.
      this.InitializeTools();
    }
  };
  GirderAnnotationPanel.prototype.InitializeTools = function () {
    var self = this;

    // Radio buttons for tools. (One active at a time).
    this.CursorButton = this.AddToolRadioButton('cursor_arrow.png', 'CursorOn');
    this.RectSelectButton = this.AddToolRadioButton('rect_select.png', 'RectSelectOn');
    this.TextButton = this.AddToolRadioButton('Text.gif', 'TextButtonOn');
    this.PencilButton = this.AddToolRadioButton('Pencil-icon.png', 'PencilButtonOn');
 
    // This is visibile, only when a annotation is being edited.
    this.RectSelectButton.hide();
      this.CursorButton.css({'border': '2px solid #333',
			     'background-color':'#bcf'});
    
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
        'height':'28px',
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

    // A delete button that pops up when a markup is selected.
    // Not part of the radio group.  This is a sub option for pencils.
    this.SelectedDeleteButton = $('<img>')
      .appendTo(this.OptionsDiv)
      .addClass('sa-view-annotation-button sa-flat-button-active')
      .addClass('sa-active')
      .css({
        'border': '1px solid #333',
        'width': '28px',
        'height':'28px',
        'background-color': '#fff'})
      .attr('type', 'image')
      .prop('title', 'delete selected')
      .attr('src', SA.ImagePathUrl + 'blueDelete32.png')
      .on('click touchstart',
          function () {
            self.DeleteSelectedWidget();
            return false;
          })
      .hide()
      .on('mousedown mousemove mouseup touchmove touchend',
          function () { return false; });

    // A menu button that pops up when a markup is selected.
    // Not part of the radio group.  This is a sub option for widgets.
    this.SelectedMenuButton = $('<img>')
      .appendTo(this.OptionsDiv)
      .addClass('sa-view-annotation-button sa-flat-button-active')
      .addClass('sa-active')
      .css({
        'border': '1px solid #333',
        'width': '28px',
        'height':'28px',
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

  GirderAnnotationPanel.prototype.AddToolRadioButton = function (imageFile, onCallbackName) {
    var self = this;
    var button = $('<img>')
        .appendTo(this.ToolDiv)
        .css({'border': '2px solid #ccc',
	      'margin': '1px',
              'background-color':'#fff',
              'width': '28px',
              'height':'28px',
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
		        self.WithHighlightedCall(function (annotObj) { (self[onCallbackName])(annotObj); });
          });
      }

      return button;
  };

  // Change the state of the Radio GUI, but do not trigger side effects (PencidOn ...)
  GirderAnnotationPanel.prototype.HighlightRadioToolButton = function (pressedButton) {
    if (pressedButton === this.ActiveToolButton) {
      return false;
    }
    // Turn off the old one. We have to do this by turning on the cursor.
    this.ActiveToolButton
      .css({'border': '2px solid #ccc',
			          'background-color':'#fff'});
    // Turn on the new one.
    pressedButton.css({'border': '2px solid #222',
		       'background-color':'#cdf'});
    this.ActiveToolButton = pressedButton;
  };

  // General for the radio
  // This assumes button is in the ToolRadioButtons list.
  GirderAnnotationPanel.prototype.ToolRadioButtonCallback = function (pressedButton) {
    if (pressedButton === this.ActiveToolButton) {
      return false;
    }
    // GUI only change/
    this.HighlightRadioToolButton(pressedButton);

    // Turn off previous tool widgets. (deactivate)
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      layer.InactivateAll();
    }

    // Turn on the new one.
    // Note: This ensures a layer is highlighted.
    pressedButton.trigger('radio-on');

    // Show the open closed toggle and other options.
    this.UpdateToolVisibility();    
  };

  // Called by the SelectedMenuButton click event.
  GirderAnnotationPanel.prototype.ShowSelectedWidgetMenu = function () {
    if (!this.Highlighted || !this.SelectedWidget) {
      return;
    }
    if (this.SelectedWidget.SetStateToDialog) {
      this.SelectedWidget.SetStateToDialog();
    } else {
      this.SelectedWidget.ShowPropertiesDialog();
    }
  };
  
  // When tools have nothing to modify, they disappear.
  // TODO: Help tool. to explain why a tool is not available.
  GirderAnnotationPanel.prototype.UpdateToolVisibility = function () {
    if (this.SelectedWidget) {
      this.SelectedDeleteButton.show();
      this.SelectedMenuButton.show();
    } else {
      this.SelectedDeleteButton.hide();
      this.SelectedMenuButton.hide();
    }

    // Pencil is always visible. If a layer is not being edit, one is created and set to editon.

    // RectangleSelect is only active when a layer is being edited and it has marks.
    //     An alternitive single select with mouseclick can always select and mark.
    // It does not make sense to create an annotation if one is not editing.
    // any created annotation will have no marks to select. Instead I will disable
    // the button until one is selected.
    // Just show and hid it for now.  I would really like to gray it out and put a hint
    // why it is grayed out.
    if (this.Highlighted && !this.Highlighted.Layer.IsEmpty()) {
      this.RectSelectButton.show();
    } else {
      this.RectSelectButton.hide();
    }

    // Open closed button is visible when any polylines are selected.
    // or the drawing pencil is active.
    var lineSelected = false;
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      for (var idx = 0; idx < layer.GetNumberOfWidgets(); ++idx) {
        var widget = layer.GetWidget(idx);
        if (widget.Type === 'pencil' && widget.IsSelected && widget.IsSelected()) {
          lineSelected = true;
          break;
        }
      }
    }
    // Some layer has to be being edited.
    if (this.Highlighted) {
      if (this.ActiveToolButton === this.PencilButton || lineSelected) {
        this.PencilOpenClosedToggle.show();
      } else {
        this.PencilOpenClosedToggle.hide();
      }
    }
  };

  GirderAnnotationPanel.prototype.LoadDefaults = function () {
    if (localStorage.SaAnnotationPanelDefaults) {
      var defaults = JSON.parse(localStorage.SaAnnotationPanelDefaults);
      if (defaults.PencilMode === 'closed') {
        this.SetPencilModeToClosed();
      }
    }
  };

  GirderAnnotationPanel.prototype.SaveDefaults = function () {
    var defaults = {'PencilMode': 'open'};
    if (this.PencilOpenClosedState === CLOSED) {
      defaults.PencilMode = 'closed';
    }
    localStorage.SaAnnotationPanelDefaults = JSON.stringify(defaults);
  };
  
  GirderAnnotationPanel.prototype.TogglePencilOpenClosed = function () {
    var widget;
    var i;
    if (this.PencilOpenClosedState === CLOSED) {
      this.SetPencilModeToOpen();
    } else {
      this.SetPencilModeToClosed();
    }
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      layer.EventuallyDraw();
    }
  };

  GirderAnnotationPanel.prototype.SetPencilModeToOpen = function () {
    if (this.PencilOpenClosedState === OPEN) {
      return;
    }
    this.PencilOpenClosedState = OPEN;
    this.PencilOpenClosedToggle
        .attr('src', SA.ImagePathUrl + 'open_lasso.png');

    if (this.SelectedWidget) {
      if (this.SelectedWidget.SetModeToOpen) {
        this.SelectedWidget.SetModeToOpen();
      }
      if (this.Highlighted) {
        this.Highlighted.Layer.EventuallyDraw();
      }
    }
    this.SaveDefaults();
  };

  GirderAnnotationPanel.prototype.SetPencilModeToClosed = function () {
    if (this.PencilOpenClosedState === CLOSED) {
      return;
    }
    console.log("Set mode to closed");
    this.PencilOpenClosedState = CLOSED;
    this.PencilOpenClosedToggle
        .attr('src', SA.ImagePathUrl + 'select_lasso.png');

    if (this.SelectedWidget) {
      if (this.SelectedWidget.SetModeToClosed) {
        this.SelectedWidget.SetModeToClosed();
      }
      if (this.Highlighted) {
        this.Highlighted.Layer.EventuallyDraw();
      }
    }
    this.SaveDefaults();
  };

  GirderAnnotationPanel.prototype.InitializeButtons = function (parent, itemId) {
    // The multiple nested annotation button divs are to get the scrollbar
    // on the left, but keep the text left justified.
    this.ScrollDiv = $('<div>')
      .appendTo(parent)
      .attr('id', 'saAnnotationButtons')
      .css({
        'direction': 'rtl',
        'overflow-y': 'auto'
        // 'position': 'absolute',
        // 'left': (3 * this.Margin) + 'px',
        // 'top': (10 * this.Margin) + 'px',
        // 'bottom': (5* this.Margin) + 'px',
        // 'width': '30%',
        // 'opacity': '0.4',
        // 'z-index': '2'
      });

    // A container for the list of buttons.
    this.ButtonDiv = $('<div>')
      .appendTo(this.ScrollDiv)
      .on('mousemove touchmove', function () { return true; })
      .css({'direction': 'ltr'});

    // Get a list of annotations and populate the button div.
    // But first, get info about the user (to manage sharing).
    var self = this;
    girder.rest.restRequest({
      path: 'user/me',
      method: 'GET'
    }).done(function (data) {
      if (!data) {
        self.UserData = {_id:'0000', login:'guest'};
      } else {
        self.UserData = data;
      }
      if (itemId) {
        self.ImageItemId = itemId;
        self.RequestGirderImageItem(itemId);
      }
    });
  };

  // Get a list of annotations and make the buttons.
  // Do not get or load the annotation data yet.
  GirderAnnotationPanel.prototype.RequestGirderImageItem = function (itemId) {
    // I think data is the wrong place to pass these parameters.
    var data = {
      'limit': 50,
      'offset': 0,
      'sort': 'lowerName',
      'sortdir': 0};

    var self = this;
    // This gives an array of {_id: '....',annotation:{name: '....'},itemId: '....'}
    girder.rest.restRequest({
      path: 'annotation?itemId=' + itemId,
      method: 'GET',
      data: JSON.stringify(data)
    }).done(function (data) {
      self.LoadGirderItemAnnotations(data);
    });
  };

  // Just the meta data for the items.  Make buttons from the meta data.
  GirderAnnotationPanel.prototype.LoadGirderItemAnnotations = function (data) {
    for (var i = 0; i < data.length; ++i) {
      this.AddAnnotationButton(data[i]);
    }
  };

  // data is the lightweight version
  // Add a new annotation to the list
  GirderAnnotationPanel.prototype.AddAnnotationButton = function (metadata) {
    // For now, users can only see their own annotations.
    //if (metadata.creatorId !== this.UserData._id) {
    //  return;
    //}
    var self = this;
    var div = $('<div>')
      .appendTo(this.ButtonDiv)
      .css({
        'display': 'table',
        'min-width': (2 * this.Radius) + 'px',
        'min-height': (2 * this.Radius) + 'px',
        'margin': '2px',
        'background-color': this.DefaultColor,
        'opacity': '0.7',
        'border': '1px solid #666666',
        'border-radius': '2px'
      });
    // Block the viewer from getting events
    // when the buttons and toggles are pressed.
    // This also blocks content editable for the button.
    // Try putting this one level doewn.
    // div.on('mousedown mousemove mouseup touchstart touchend',
    // function () { return false; });

    // Button is for the label and to make it current.
    var nameButton = $('<div>')
        .appendTo(div)
        .css({
          'display': 'inline',
          'position': 'static',
          'padding-left': '4px',
          'padding-right': '4px'})
        .text(metadata.annotation.name);

    // Check is for visibility
    var visToggle = $('<img>')
        .appendTo(div)
        .attr('type', 'image')
        .attr('src', SA.ImagePathUrl + 'eyeClosed32.png')
        .css({
          'display': 'inline',
          'width': this.ButtonSize,
          'height': this.ButtonSize,
          'cursor': 'pointer',
          'position': 'static',
          'margin': '1px',
          'background-color': this.DefaultColor,
          'border': '1px solid #555'});

    // Edit
    var editToggle = $('<img>')
        .appendTo(div)
        .addClass('saEditToggle')
        .attr('type', 'image')
        .attr('src', SA.ImagePathUrl + 'edit_up.png')
        .css({
          'display': 'inline',
          'width': this.ButtonSize,
          'height': this.ButtonSize,
          'cursor': 'pointer',
          'position': 'relative',
          'margin': '1px',
          'background-color': '#fff',
          'border': '1px solid #555'});

    // Delete
    var deleteButton = $('<img>')
        .appendTo(div)
        .attr('type', 'image')
        .attr('src', SA.ImagePathUrl + 'remove.png')
        .css({
          'display': 'inline',
          'width': this.ButtonSize,
          'height': this.ButtonSize,
          'cursor': 'pointer',
          'position': 'relative',
          'color': 'red',
          'margin': '1px',
          'background-color': '#DDD',
          'border': '1px solid #555'})
        .hide();

    // var slider = $('<div>')
    //  .appendTo(div)
    //  .css({'width': '10em',
    //        'margin': '5px'});

    var annotObj = {
      Id: metadata._id,
      CreatorId: metadata.creatorId,
      Data: undefined, //  load on demand
      Div: div,
      VisToggle: visToggle,
      Visible: false,
      EditToggle: editToggle,
      Editing: false,
      NameButton: nameButton,
      DeleteButton: deleteButton,
      Name: metadata.annotation.name,
      Modified: false
    };

    this.AnnotationObjects.push(annotObj);

    // Block the viewer from getting events
    // when the buttons and toggles are pressed.
    visToggle.on('mousedown mousemove mouseup touchmove touchend',
                 function () { return false; });
    editToggle.on('mousedown mousemove mouseup touchmove touchend',
                 function () { return false; });
    deleteButton.on('mousedown mousemove mouseup touchmove touchend',
                 function () { return false; });
    nameButton.on('mousedown mousemove mouseup touchmove touchend',
                 function () { return false; });

    // If this is active (which imples checked), unchecking
    // will also deactivate the annotation button.
    visToggle.hover(
      function () {
        $(this).css({'background-color': this.ActiveColor});
      },
      function () {
        $(this).css({'background-color': this.DefaultColor});
      });
    visToggle.on(
      'click touchstart',
      function () {
        if (annotObj.Visible) {
          self.VisibilityOff(annotObj);
        } else {
          self.AfterLoad(annotObj, function () { self.VisibilityOn(annotObj); });
        }
      });

    // When highlighted, I want the button to edit the title.
    // editToggle
    //  .hover(
    //    function () {
    //      $(this).css({'background-color': this.ActiveColor});
    //    },
    //    function () {
    //      $(this).css({'background-color': this.DefaultColor});
    //    });
    editToggle.on(
      'click touchstart',
      function () {
        if (annotObj.Editing) {
          self.EditOff(annotObj);
        } else {
          self.AfterLoad(annotObj, function () { self.EditOn(annotObj); });
        }
        return false;
      });

    // The user can only activate his own annotations
    if (metadata.creatorId === this.UserData._id) {
      this.SetNameButtonModeToOwner(annotObj);

      deleteButton.mouseenter(function () { div.focus(); })
        .hover(
          function () {
            $(this).css({'opacity': '1'});
          },
          function () {
            $(this).css({'opacity': '0.5'});
          });
      deleteButton.on(
        'click touchstart',
        function () {
          self.DeleteCallback(annotObj);
          return false;
        });
    }

    return annotObj;
  };

  // There are two modes for name editing.  This is the inner mode.
  // When the mouse if over the button, make the div content editable.
  GirderAnnotationPanel.prototype.EditNameOn = function (annotObj) {
    var self = this;
    this.Viewer.InteractionOff();
    // Get rid of the events blocking viewer interaction
    // but also blocking content editable.
    annotObj.NameButton.off();
    annotObj.NameButton.focus();
    annotObj.NameButton.attr('tabindex', '1');
    annotObj.NameButton.on('mouseleave', function () { self.EditNameOff(annotObj); });
  };
  GirderAnnotationPanel.prototype.EditNameOff = function (annotObj) {
    var self = this;
    // Did the name change?
    var name = annotObj.NameButton.text();
    if (name !== annotObj.Name) {
      // Yes,  schedule teh change to be saved on teh server.
      annotObj.Name = name;
      this.AnnotationModified(annotObj);
    }
    self.Viewer.InteractionOn();
    // Turn viewer event blocking on again.
    annotObj.NameButton.on('mousedown mousemove mouseup touchstart touchend',
                           function () { return false; });
    // Turn editing back on if the mouse enters the button again.
    annotObj.NameButton.on('mouseenter', function () { self.EditNameOn(annotObj); });
  };

  // There are two modes for name editing.  This is the outter mode.
  // The button is waiting for the mouse to hover.
  // The complexity is because ancenstor events interfere with contentEditing.
  GirderAnnotationPanel.prototype.SetNameButtonModeToEdit = function (annotObj) {
    var self = this;
    annotObj.NameButton
      .off('click touchstart')
      // .prop('title', 'edit name')
      .attr('contentEditable', true)
      .css({'cursor': 'text'})
      // Needed to expose contenteditable which is blocked by ancestor event handlers.
      .on('mouseenter', function () { self.EditNameOn(annotObj); });
  };

  GirderAnnotationPanel.prototype.SetNameButtonModeToOwner = function (annotObj) {
    var self = this;
    annotObj.NameButton
      .off('mouseenter')
      // .prop('title', 'edit')
      .attr('contentEditable', false)
      .css({'cursor': 'pointer'})
      .hover()
      .on('click touchstart', function () {
        annotObj.VisToggle.prop('checked', true);
        self.EditOn(annotObj);
        return false;
      });
  };

  // This call back pattern is all because we load on demand.
  // Call a method after an annotation is loaded.
  GirderAnnotationPanel.prototype.AfterLoad = function (annotObj, callback) {
    if (annotObj.Data) {
      (callback)();
    } else {
      // We need to load the annotation first.
      $('body').css({'cursor': 'wait'});
      girder.rest.restRequest({
        path: 'annotation/' + annotObj.Id,
        method: 'GET',
        contentType: 'application/json'
      }).done(function (data) {
        $('body').css({'cursor': ''});
        annotObj.Data = data;
        (callback)();
      });
    }
  };

  GirderAnnotationPanel.prototype.NewAnnotationLayer = function () {
    // Create an annotation layer by default.
    // viewer.GetDiv() is Same as this.Parent
    var annotationLayer = new SAM.AnnotationLayer(this.Viewer.GetDiv());
    // Only for the text widget (dialog).
    // It needs this reference to turn off events to make the text input work.
    annotationLayer.SetViewer(this.Viewer);
    // Lets just shallow copy the viewers camera to synchronize all layer views..
    annotationLayer.SetCamera(this.Viewer.GetCamera());

    // TODO: Get rid of this.  master view is passed to draw.
    // Hack so the scale widget can get the spacing.
    annotationLayer.ScaleWidget.View = this.MainView;
    // Hack only used for girder testing.
    annotationLayer.SetViewer(this.Viewer);
    annotationLayer.UpdateSize();

    return annotationLayer;
  };
  
  // TODO: Load annotations into a 'group'.  Manage separate groups.
  // Move the annotation info to the layer widgets and draw.
  GirderAnnotationPanel.prototype.DisplayAnnotation = function (annotObj) {
    // If there is no layer, we have to create one
    if (!annotObj.Layer) {
      annotObj.Layer = this.NewAnnotationLayer();
      var self = this;
      // I am not sure that this is still used.
      annotObj.Layer.SetActivatedCallback(function () { self.EditOn(annotObj); });
      annotObj.Layer.SetModifiedCallback(function () { self.AnnotationModified(annotObj); });
      //annotObj.Layer.SetSelectionChangeCallback(function () { self.SelectionChanged(annotObj); });
      annotObj.Layer.Reset();

      // Put all the rectangles into one set.
      var setObj = {};
      setObj.type = 'rect_set';
      setObj.centers = [];
      setObj.widths = [];
      setObj.heights = [];
      setObj.confidences = [];
      setObj.labels = [];

      if (!annotObj.Data) {
        return;
      }

      var annot = annotObj.Data.annotation;
      for (var i = 0; i < annot.elements.length; ++i) {
        var element = annot.elements[i];
        var obj = {};

        if (element.type === 'view') {
          // Set the camera / view.
          var cam = annotObj.Layer.GetCamera();
          cam.SetWorldFocalPoint(element.center);
          cam.SetHeight(element.height);
          if (element.rotation) {
            cam.SetWorldRoll(element.rotation);
          } else {
            cam.SetWorldRoll(0);
          }
          // Ignore width for now because it is determined by the
          // viewport.
          cam.ComputeMatrix();
          // How to handle forcing viewer to render?
          // I could have a callback.
          // I could also make a $('.sa-viewer').EventuallyRender();
          // or $('.sa-viewer').saViewer('EventuallyRender');
          if (annotObj.Layer.Viewer) {
            annotObj.Layer.Viewer.EventuallyRender();
          }
        }
        if (element.type === 'circle') {
          obj.type = element.type;
          obj.outlinecolor = SAM.ConvertColor(element.lineColor);
          obj.linewidth = element.lineWidth;
          obj.origin = element.center;
          obj.radius = element.radius;
          var w = annotObj.Layer.LoadWidget(obj);
          w = this.Viewer;
        }
        if (element.type === 'arrow') {
          obj.type = 'text';
          obj.string = element.label.value;
          obj.color = SAM.ConvertColor(element.fillColor);
          obj.size = element.label.fontSize;
          obj.position = element.points[0].slice(0);
          obj.offset = element.points[1].slice(0);
          obj.offset[0] -= obj.position[0];
          obj.offset[1] -= obj.position[1];
          obj.visibility = element.points[0][2];
          var w = annotObj.Layer.LoadWidget(obj);
          w = this.Viewer;
        }
        if (element.type === 'rectanglegrid') {
          obj.type = 'grid';
          obj.outlinecolor = SAM.ConvertColor(element.lineColor);
          obj.linewidth = element.lineWidth;
          obj.origin = element.center;
          obj.bin_width = element.width / element.widthSubdivisions;
          obj.bin_height = element.height / element.heightSubdivisions;
          obj.orientation = element.rotation;
          obj.dimensions = [element.widthSubdivisions, element.heightSubdivisions];
          var w = annotObj.Layer.LoadWidget(obj);
          w = this.Viewer;
        }
        if (element.type === 'rectangle') {
          // Switch to rect set versus individual rects. if false
          if (element.type === 'rectangle') { // switch behavior to ....
            setObj.widths.push(element.width);
            setObj.heights.push(element.height);
            setObj.centers.push(element.center[0]);
            setObj.centers.push(element.center[1]);
            if (element.scalar === undefined) {
              element.scalar = 1.0;
            }
            setObj.confidences.push(element.scalar);
            if (element.label) {
              setObj.labels.push(element.label.value);
            } else {
              setObj.labels.push('');
            }
          } else {
            obj.type = 'rect';
            obj.outlinecolor = SAM.ConvertColor(element.lineColor);
            obj.linewidth = element.lineWidth;
            obj.origin = element.center;
            obj.width = element.width;
            obj.length = element.height;
            obj.orientation = element.rotation;
            var w = annotObj.Layer.LoadWidget(obj);
            w = this.Viewer;
          }
        }
        if (element.type === 'polyline') {
          // obj.type = element.type;
          // obj.closedloop = element.closed;
          // obj.outlinecolor = SAM.ConvertColor(element.lineColor);
          // obj.linewidth = element.lineWidth;
          // obj.points = element.points;
          // annotObj.Layer.LoadWidget(obj);
          // Make a pencil instead.
          obj.type = 'pencil';
          obj.outlinecolor = SAM.ConvertColor(element.lineColor);
          obj.linewidth = element.lineWidth;
          obj.shapes = [element.points];
          obj.closedFlags = [element.closed];
          var w = annotObj.Layer.LoadWidget(obj);
          w = this.Viewer;
        }
      }

      if (setObj.widths.length > 0) {
        var w = annotObj.Layer.LoadWidget(setObj);
        w = this.Viewer;
      }
    }

    annotObj.Layer.SetVisibility(true);
    annotObj.Layer.EventuallyDraw();
  };

  // ============================================================================
  // new (used) stuff.

  // Only one editable/highliged at a time (or none)
  GirderAnnotationPanel.prototype.EditOn = function (annotObj) {
    if (!annotObj || annotObj.Editing) {
      this.UpdateToolVisibility();
      return;
    }
    annotObj.Editing = true;

    // Turn the previous one off. (Only one can be highlighted at a time)
    if (this.Highlighted) {
      this.EditOff(this.Highlighted);
    }

    // Make the name editable.
    this.SetNameButtonModeToEdit(annotObj);

    annotObj.EditToggle
      .attr('src', SA.ImagePathUrl + 'edit_down.png');
    // Change the color of the edit button, to indicate edit off.
    // annotObj.EditToggle
    //  .css({'background-color': this.DefaultColor});
    // Make the delete button visible.
    annotObj.DeleteButton.show();

    // Turn the new on on.
    this.Highlighted = annotObj;
    // Change the color of the GUI.
    annotObj.Div.css({'background-color': this.ActiveColor});
    // Make the markup visible
    this.VisibilityOn(annotObj);
    this.UpdateToolVisibility();
  };

  GirderAnnotationPanel.prototype.EditOff = function (annotObj) {
    if (!annotObj || !annotObj.Editing) {
      return;
    }
    annotObj.Editing = false;

    annotObj.EditToggle
      .attr('src', SA.ImagePathUrl + 'edit_up.png');

    // Deactivate any widgets in the layer.
    var layer = annotObj.Layer;
    layer.SetSelected(false);
    layer.Deactivate();
    layer.EventuallyDraw();

    // Disable editing of the name.
    this.SetNameButtonModeToOwner(annotObj);

    // Save the annotation if anything changed.
    if (annotObj.Modified) {
      this.RecordAndSave(annotObj);
    }
    // annotObj.EditToggle
    //  .css({'background-color': this.ActiveColor});
    // Hide the delete button
    annotObj.DeleteButton.hide();
    // Turn the background to the default.
    if (this.Highlighted === annotObj) {
      this.Highlighted.Div.css({'background-color': this.DefaultColor});
      this.Highlighted = undefined;
    }

    this.UpdateToolVisibility();
  };

  GirderAnnotationPanel.prototype.VisibilityOn = function (annotObj) {
    if (!annotObj || annotObj.Visible) {
      return;
    }
    annotObj.Visible = true;
    annotObj.VisToggle
      .attr('src', SA.ImagePathUrl + 'eyeOpen32.png');
    this.DisplayAnnotation(annotObj);
  };
  GirderAnnotationPanel.prototype.VisibilityOff = function (annotObj) {
    if (!annotObj || !annotObj.Visible) {
      return;
    }
    annotObj.Visible = false;
    annotObj.VisToggle
      .attr('src', SA.ImagePathUrl + 'eyeClosed32.png');
    annotObj.Layer.SetVisibility(false);

    // Editing annots must be visible.
    this.EditOff(annotObj);
  };

  // This call back pattern is all because we load on demand.
  // Gets the active annotation. If one is not highlighted, look for one
  // with the default name (users last name).  If none are found Creates one.
  GirderAnnotationPanel.prototype.WithHighlightedCall = function (callback) {
    if (this.Highlighted) {
      (callback)(this.Highlighted);
      return;
    }
    var self = this;
    var annotObj;
    for (var idx = 0; idx < this.AnnotationObjects.length; ++idx) {
      annotObj = this.AnnotationObjects[idx];
      if (annotObj.CreatorId === this.UserData._id &&
          annotObj.Name === this.UserData.login) {
        // Use this one. Make sure it is loaded before executing the callback.
        this.AfterLoad(annotObj, function () {
          self.DisplayAnnotation(annotObj);
          self.EditOn(annotObj);
          (callback)(annotObj);
        });
        return;
      }
    }

    // Make a new one.
    // Do not make it real until saved.
    var annotation = {elements: []};
    var data = {
      annotation: {name: this.UserData.login},
      creatorId: this.UserData._id,
      _id: undefined,
      data: annotation};
    // TODO: try to merge this with the other code that makes a layer.
    annotObj = this.AddAnnotationButton(data);
    annotObj.VisToggle.prop('checked', true);
    annotObj.Layer = this.NewAnnotationLayer();
    // I am not sure that this is still used.
    annotObj.Layer.SetActivatedCallback(function () { self.EditOn(annotObj); });
    //annotObj.Layer.SetSelectionChangeCallback(function () { self.SelectionChanged(annotObj); });
    annotObj.Layer.SetModifiedCallback(function () { self.AnnotationModified(annotObj); });

    this.EditOn(annotObj);
    (callback)(this.Highlighted);
  };

  // This is primarily for the pencil widget. The layer can select it without our knowlege.
  // This callback informs us the selection has changed.
  // GirderAnnotationPanel.prototype.SelectionChanged = function (annotObj) {
  //  if (annotObj.Layer.HasSelections()) {
  //    this.EditOn(annotObj);
  //  }
  //  this.UpdateToolVisibility();
  // };

  // Call back from deleteButton.
  GirderAnnotationPanel.prototype.DeleteCallback = function (annotObj) {
    if (!confirm('Are you sure you want to delete anntoation ' + annotObj.Name)) {
      return;
    }

    if (annotObj.SaveTimerId) {
      clearTimeout(annotObj.SaveTimerId);
      annotObj.SaveTimerId = undefined;
    }
    // Visibility and editing off.
    this.VisibilityOff(annotObj);

    if (!annotObj.Id) {
      this.DeleteAnnotationGUI(annotObj);
      return;
    }

    // Delete it from the database before deleting the GUI.
    var self = this;
    girder.rest.restRequest({
      path: 'annotation/' + annotObj.Id,
      method: 'DELETE',
      contentType: 'application/json'
    }).done(function (ret) {
      self.DeleteAnnotationGUI(annotObj);
    });
  };

  GirderAnnotationPanel.prototype.DeleteAnnotationGUI = function (annotObj) {
    // Visibility and editing off.
    this.VisibilityOff(annotObj);
    // Remove the buttons
    annotObj.Div.remove();
    // Take it out of our list.
    var idx = this.AnnotationObjects.indexOf(annotObj);
    this.AnnotationObjects.splice(idx, 1);
  };

  // Called when the user draws something.
  GirderAnnotationPanel.prototype.AnnotationModified = function (annotObj) {
    if (!annotObj.Modified) {
      this.ModifiedCount += 1;
    }
    var self = this;
    annotObj.Modified = true;
    // Change the background color of the edit toggle to show that is is modified.
    if (this.UserData.login !== "guest") {
      annotObj.EditToggle.css({'background-color': '#F55'});
    }
    // Save after 30 second pause in annotation.
    // start a timer to actually save.
    //if (annotObj.SaveTimerId) {
    //  clearTimeout(annotObj.SaveTimerId);
    //  annotObj.SaveTimerId = undefined;
    //}
    // Every minute
    //console.log('Save in 30 seconds');
    //annotObj.SaveTimerId = setTimeout(function () { self.RecordAndSave(annotObj); }, 30000);

    // Save after 30 seconds regardless of additional markup.
    if (!annotObj.SaveTimerId) {
      console.log('Save in 30 seconds');
      annotObj.SaveTimerId = setTimeout(function () { self.RecordAndSave(annotObj); }, 30000);
    }
    
    window.onbeforeunload = function (event) {
      console.log('Leaving page ' + self.ModifiedCount);
      return true;
    }
  };

  // Called when the annotation is saved successfully..
  GirderAnnotationPanel.prototype.AnnotationSaved = function (annotObj) {
    if (annotObj.Modified) {
      this.ModifiedCount -= 1;
    }
    annotObj.Modified = false;
    annotObj.Div.css({'border': '1px solid #666'});
    annotObj.EditToggle.css({'background-color': '#FFF'});
    if (this.ModifiedCount === 0) {
      window.onbeforeunload = undefined;
    }
  };

  // Records and saves an annotation. Will create a new one if annotObj has no id.
  GirderAnnotationPanel.prototype.RecordAndSave = function (annotObj) {
    if (this.UserData.login === "guest") {
      return;
    }
    var self = this;
    if (annotObj.SaveTimerId) {
      clearTimeout(annotObj.SaveTimerId);
      annotObj.SaveTimerId = undefined;
    }

    console.log('Save annotation');
    if (!annotObj.Data) {
      annotObj.Data = {annotation: {elements: []}};
    }
    // Read markup and put into data object.
    annotObj.Data.annotation.elements = this.RecordAnnotation(annotObj);
    annotObj.Data.annotation.name = annotObj.Name;

    // Change the color of the edit toggle to yellow, to show we are saving.
    annotObj.EditToggle.css({'background-color': '#FF5'});

    if (!annotObj.Id) {
      if (annotObj.Layer.IsEmpty()) {
        // Do not save a new annotation if it is empty.
        this.AnnotationSaved(annotObj);
        return;
      }
      // A new annotation
      girder.rest.restRequest({
        path: 'annotation?itemId=' + this.ImageItemId,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(annotObj.Data.annotation)
      }).done(function (retAnnot) {
        // Saving has finished.
        // This has the girder id.
        annotObj.Id = annotObj.Data._id = retAnnot._id;
        self.AnnotationSaved(annotObj);
      });

      /*
      // Set up access to this annotation so that only I can see it.
      // But what if I wnt others to be able to read but not write?
      var access = {
        'groups': [],
        'users': [
          {
            'flags': [],
            'id': this.UserData._id,
            'level': 2,
            'login': this.UserData.login,
            'name': this.UserData.firstName + ' ' + this.UserData.lastname
          }
        ]
      };
      /*
      girder.rest.restRequest({
        path: 'annotation/' + this.ImageItemId + '/access',
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(access)
      }).done(function (retData) {
        console.log('PUT access seemed to work');
      });
      */
    } else {
      // Save a modified annotation.
      girder.rest.restRequest({
        path: 'annotation/' + annotObj.Data._id,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(annotObj.Data.annotation)
      }).done(function (retAnnot) {
        // This has the girder id.
        self.AnnotationSaved(annotObj);
      });
    }
  };

  // Converts annotation layer widgets into girder annotation elements.
  // returns an elements array.
  GirderAnnotationPanel.prototype.RecordAnnotation = function (annotObj) {
    var returnElements = [];
    var i;
    var j;
    var k;
    var points;

    // record the view.
    /*
    var cam = this.AnnotationLayer.GetCamera();
    var element = {
      'type': 'view',
      'center': cam.GetWorldFocalPoint(),
      'height': cam.GetHeight(),
      'width': cam.GetWidth(),
      'rotation': cam.Roll};
    element.center[2] = 0;
    returnElements.push(element);
    element = undefined;
    */
    var element;
    for (i = 0; i < annotObj.Layer.GetNumberOfWidgets(); ++i) {
      if ( ! annotObj.Layer.GetWidget(i).Serialize) {
        continue;
      }
      var widget = annotObj.Layer.GetWidget(i).Serialize();
      if (widget.type === 'circle') {
        widget.origin[2] = 0; // z coordinate
        element = {
          'type': 'circle',
          'center': widget.origin,
          'radius': widget.radius};
      }
      if (widget.type === 'text') {
        // Will not keep scale feature..
        points = [widget.position, widget.offset];
        points[1][0] += widget.position[0];
        points[1][1] += widget.position[1];
        // Have to add a z coordinate for the scheme
        // Hacky way to save visibility state.
        points[0][2] = points[1][2] = widget.visibility;
        element = {
          'type': 'arrow',
          'lineWidth': 10,
          'fillColor': SAM.ConvertColorToHex(widget.color),
          'points': points};
        element.label = {
          'value': widget.string,
          'fontSize': widget.size,
          'color': SAM.ConvertColorToHex(widget.color)};
      }
      if (widget.type === 'grid') {
        element = {
          'type': 'rectanglegrid',
          'center': widget.origin,
          'width': widget.bin_width * widget.dimensions[0],
          'height': widget.bin_height * widget.dimensions[1],
          'rotation': widget.orientation,
          'normal': [0, 0, 1.0],
          'widthSubdivisions': widget.dimensions[0],
          'heightSubdivisions': widget.dimensions[1]};
      }
      if (widget.type === 'rect') {
        element = {
          'type': 'rectangle',
          'label': {'value': 'test'},
          'center': widget.origin,
          'height': widget.height,
          'width': widget.width,
          'rotation': widget.orientation};
      }
      if (widget.type === 'rect_set') {
        var num = widget.widths.length;
        for (j = 0; j < num; ++j) {
          element = {
            'type': 'rectangle',
            'label': {'value': widget.labels[j]},
            'center': [widget.centers[2 * j], widget.centers[2 * j + 1], 0],
            'height': widget.heights[j],
            'width': widget.widths[j],
            'rotation': 0,
            'scalar': widget.confidences[j]};
          returnElements.push(element);
        }
        element = undefined;
      }
      if (widget.type === 'polyline') {
        // add the z coordinate
        for (j = 0; j < widget.points.length; ++j) {
          widget.points[j][2] = 0;
        }
        element = {
          'type': 'polyline',
          'closed': widget.closedloop,
          'points': widget.points};
      }
      if (widget.type === 'lasso') {
                // add the z coordinate
        for (j = 0; j < widget.points.length; ++j) {
          widget.points[j][2] = 0;
        }
        element = {
          'type': 'polyline',
          'closed': true,
          'points': widget.points};
      }
      // Pencil scheme not exact match.  Need to split up polylines.
      if (widget.type === 'pencil') {
        for (k = 0; k < widget.shapes.length; ++k) {
          points = widget.shapes[k];
          // Add the z coordinate.
          for (j = 0; j < points.length; ++j) {
            points[j][2] = 0;
          }
          element = {
            'type': 'polyline',
            'closed': widget.closedFlags[k],
            'points': points};
          // Hackish way to deal with multiple lines.
          if (widget.outlinecolor !== undefined) {
            element.lineColor = SAM.ConvertColorToHex(widget.outlinecolor);
          }
          if (widget.linewidth !== undefined) {
            element.lineWidth = Math.round(widget.linewidth);
          }
          returnElements.push(element);
          element = undefined;
        }
      } else if (element) {
        if (widget.outlinecolor !== undefined) {
          element.lineColor = SAM.ConvertColorToHex(widget.outlinecolor);
        }
        if (widget.linewidth !== undefined) {
          element.lineWidth = Math.round(widget.linewidth);
        }
        returnElements.push(element);
        element = undefined;
      }
    }
    return returnElements;
  };

  GirderAnnotationPanel.prototype.CursorOn = function () {
    if (this.Highlighted && this.Highlighted.Layer) {
      this.Highlighted.Layer.SetSelected(false);
      this.Highlighted.Layer.EventuallyDraw();
    }
    this.Viewer.GetParentDiv().css({'cursor': ''});
    this.ActiveToolButton = this.CursorButton;
    this.SelectedWidget = undefined;
  };

  // An annotation has to be selected for editing before this is called.
  // It starts a rectSelectWidget for the user.
  GirderAnnotationPanel.prototype.RectSelectOn = function () {
    var self = this;
    var annotObj = this.Highlighted;
    // Anything being edited has to be loaded too.
    var layer = annotObj.Layer;
    layer.SetSelected(false);
    var selectWidget = new SAM.RectSelectWidget(layer);
    selectWidget.SetFinishCallback(function (w) { self.RectSelectOff(); });
    layer.AddWidget(selectWidget);
    // Start receiving events.
    // Normally this happens as a call back when state changes to drawing.
    layer.ActivateWidget(selectWidget);
    selectWidget.SetStateToDrawing(layer);
    this.SelectedWidget = selectWidget;
  };
  GirderAnnotationPanel.prototype.RectSelectOff = function () {
    var annotObj = this.Highlighted;
    var selectWidget = this.SelectedWidget;
    var selectCount = 0;
    var layer = annotObj.Layer;
    for (var idx = 0; idx < layer.GetNumberOfWidgets(); ++idx) {
      var w = layer.GetWidget(idx);
      if (w.Select) {
        selectCount += w.Select(selectWidget);
      }
    }
    layer.RemoveWidget(selectWidget);
    layer.EventuallyDraw();

    // Se if we can move this to CursorOn
    this.SelectedWidget = undefined;
    this.HighlightRadioToolButton(this.CursorButton);

    this.UpdateToolVisibility();
  };

  // TextButton is really a toggle (part of a radio group).
  // Text buttonOn <=> dialog showing.
  // Selecting a text automatically turns text button on and shows dialog.
  // I do not know if any call actually passes a wiodget.
  // Widget is an optional arguement. May not ever be called with a widget.
  GirderAnnotationPanel.prototype.TextButtonOn = function (annotObj) {
    // The layer has to be in editing mode.
    this.EditOn(annotObj);

    var widget;
    // Get a text widget.
    // Look for a selected widget to reuse.
    var layer = annotObj.Layer;
    if (!widget) {
      widget = layer.GetASelectedWidget('text');
    }
    if (!widget) {
      // A selected textWidget was not found. Make a new text widget.
      widget = new SAM.TextWidget(layer);
      // Dialog needs tu turn off and on bindings.
      // TODO: REmove dialogs from widget and manage them here.
      // Widgets can share a dialog.
      layer.AddWidget(widget);
      widget.SetCreationCamera(layer.GetCamera());
      widget.SetStateToDialog();
    }
    //this.TextWidget = widget; scheduled for delete.  Not used anywhere.

    // Activate the widget to start drawing.
    widget.SetStateToDrawing(layer);

    // If the text is deactivated by closing the dialog, this will turn off the
    // text button.
    var self = this;
    widget.SetStateChangeCallback(function () {
      if (!widget.Layer) {
        // string was empty.  TODO: find a better way to handle widget initiated delete.
        self.SelectedWidget = undefined;
        self.ToolRadioButtonCallback(self.CursorButton);
        self.UpdateToolVisibility();            
      } else if (!widget.GetActive()) {
        self.ToolRadioButtonCallback(self.CursorButton);
      }
    });

    this.SelectedWidget = widget;
  };

  // Widget is an optional arguement.
  GirderAnnotationPanel.prototype.PencilButtonOn = function (annotObj) {
    // The layer has to be in editing mode.
    this.EditOn(annotObj);

    var widget;
    // Get a pencil widget.
    // Look for a selected widget to reuse.
    var layer = annotObj.Layer;
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

    this.SelectedWidget = widget;
  };


  // ===========================================================================
  // Forward events to layers.
  
  // onresize callback.  Canvas width and height and the camera need
  // to be synchronized with the canvas div.
  GirderAnnotationPanel.prototype.UpdateSize = function () {
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var annotObj = this.AnnotationObjects[i];
      var layer = annotObj.layer;
      if (layer && layer.UpdateSize) {
        layer.UpdateSize();
      }
    }
  };

  GirderAnnotationPanel.prototype.Draw = function () {
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var annotObj = this.AnnotationObjects[i];
      var layer = annotObj.Layer;
      if (layer && layer.Draw) {
        layer.Draw();
      }
    }
  };

  GirderAnnotationPanel.prototype.Reset = function () {
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var annotObj = this.AnnotationObjects[i];
      var layer = annotObj.layer;
      if (layer && layer.Reset) {
        layer.Reset();
      }
    }
  };

  GirderAnnotationPanel.prototype.HandleTouchStart = function (event) {
    if (this.CheckForIPadPencil(event)) {
      var self = this;
      // User is drawing with a pencil.  Make sure a layer is editable.
		  this.WithHighlightedCall(function (annotObj) {
        // A small hack.
        self.SelectedWidget = annotObj.Layer.GetIPadPencilWidget();
        annotObj.Layer.HandleTouchStart(event);
      });
      return false;
    }
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      if (layer && layer.HandleTouchStart) {
        return layer.HandleTouchStart(event);
      }
    }
    return true;
  };

  GirderAnnotationPanel.prototype.HandleTouchMove = function (event) {
    this.CheckForIPadPencil(event);
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      if (layer && layer.HandleTouchMove) {
        return layer.HandleTouchMove(event);
      }
    }
    return true;
  };

  GirderAnnotationPanel.prototype.HandleTouchEnd = function (event) {
    console.log("panel touch end " + event.touches.length);
    // No touches for end events so we cannot check for ipad pencil.
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      if (layer && layer.HandleTouchEnd) {
        // To cache pencil editing.
        this.UpdateToolVisibility();
        return layer.HandleTouchEnd(event);
      }
    }
    return true;
  };

  GirderAnnotationPanel.prototype.HandleMouseDown = function (event) {
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      if (layer && layer.HandleMouseDown) {
        return layer.HandleMouseDown(event);
      }
    }
    return true;
  };

  GirderAnnotationPanel.prototype.HandleMouseUp = function (event) {
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      if (layer && layer.HandleMouseUp) {
        return layer.HandleMouseUp(event);
      }
    }
    return true;
  };

  GirderAnnotationPanel.prototype.HandleMouseMove = function (event) {
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      if (layer && layer.HandleMouseMove) {
        return layer.HandleMouseMove(event);
      }
    }
    return true;
  };

  GirderAnnotationPanel.prototype.HandleMouseWheel = function (event) {
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      if (layer && layer.HandleMouseWheel) {
        return layer.HandleMouseWheel(event);
      }
    }
    return true;
  };

  GirderAnnotationPanel.prototype.HandleKeyDown = function (event) {
    // Handle the delete key special
    // Multiple widgets ( in the layer being edit) can be deleted.
    var widget;
    if (this.Highlighted && event.keyCode === 46) { // delete key
      // TODO: Consider calling delete selected (the button callback).
      if (this.Highlighted.Layer.DeleteSelected()) {
        this.ToolRadioButtonCallback(this.CursorButton);
        this.Highlighted.Layer.EventuallyDraw();
      }
      event.preventDefault();
      return false;
    }

    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      if (layer && layer.HandleKeyDown) {
        return layer.HandleKeyDown(event);
      }
    }
    return true;
  };

  // Called by the SelectedDeleteButton click event.
  GirderAnnotationPanel.prototype.DeleteSelectedWidget = function () {
    if (!this.Highlighted) {
      return;
    }
    if (this.Highlighted.Layer.DeleteSelected()) {
      this.SelectedWidget = undefined;
      this.ToolRadioButtonCallback(this.CursorButton);
      this.UpdateToolVisibility();
      this.Highlighted.Layer.EventuallyDraw();
    }
  };
  
  GirderAnnotationPanel.prototype.HandleKeyUp = function (event) {
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      if (layer && layer.HandleKeyUp) {
        return layer.HandleKeyUp(event);
      }
    }
    return true;
  };


 /*
  GirderAnnotationPanel.prototype.HandleTouchPan = function () {
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var annotObj = this.AnnotationObjects[i];
      var layer = annotObj.layer;
      if (layer.HandleTouchPan && !layer.HandleTouchPan(event)) {
        return false;
      }
    }
  };

  GirderAnnotationPanel.prototype.HandleTouchRotate = function () {
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var annotObj = this.AnnotationObjects[i];
      var layer = annotObj.layer;
      if (layer.HandleTouchRotate && !layer.HandleTouchRotate(event)) {
        return false;
      }
    }
  };
 */
/*
  GirderAnnotationPanel.prototype.HandleDoubleClick = function () {
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var annotObj = this.AnnotationObjects[i];
      var layer = annotObj.layer;
      if (layer.HandleDoubleClick && !layer.HandleDoubleClick(event)) {
        return false;
      }
    }
  };
*/

  // I am going to use click / tap to select markup.
  // How can we enforce only one selected at a time (for click)?
  // First one to consume the click stops propagation.
  // The problem is:  What should we do if one is already selected?
  // Event propagation will turn anyones off in the early layers.
  // After event propagation is stoped,  Loop through the rest
  // un selecting them.
  GirderAnnotationPanel.prototype.HandleSingleSelect = function (event) {
    // Turn off previous tool widgets. (deactivate)
    if (this.Highlighted) {
      var layer = this.Highlighted.Layer;
      layer.InactivateAll();
    }

    // First one to consume the click wins the selection.
    // TODO: Change this to voting if annotations start to overlap.
    var selectedWidget;
    var selectedAnnotObj;

    // TODO: Get rid of the multiple strokes in a single pencil widget.
    // It was a bad idea. It is "hard" because lasso interaction editing of loops
    // depends on the two strokes to be in the same widget.  I do not want to
    // Break everything by rewritting this widget again.  I need to detect
    // If the same stroke was selected again (to show the popup).
    // This is the best way to trigger the popup. Ha,  it is not. I am getting
    // rid of the popup anyway.  I will just put a popup button in the option
    // panel.
    
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var annotObj = this.AnnotationObjects[i];
      var layer = annotObj.Layer;
      if (!layer) {
        continue;
      }
      if (selectedWidget) {
        // Just unselect remaining layers.
        layer.SetSelected(false);
      } else {
        // We even give inactive layers a chance to claim the selection.
        // It is a way to find which group a mark belongs to.
        if (layer.SingleSelect) {
          var selectedWidget = layer.SingleSelect(event);
          if (selectedWidget) {
            selectedAnnotObj = annotObj;
          }
        }
      }
    }

    // TODO: This ivar is only really needed for the properties dialog.
    // We could just find the first selected widget ....
    this.SelectedWidget = undefined;

    // Change the panel to reflect a selection change.
    if (!selectedWidget) {
      // Nothing was selected with that click.
      // Change the state back to cursor
      this.HighlightRadioToolButton(this.CursorButton);
      // See if we can move this to CursorOn
      this.Viewer.EventuallyRender();
      this.UpdateToolVisibility();
      return true;
    }

    // Make the layer editable.
    if (selectedAnnotObj) {
      this.EditOn(selectedAnnotObj)
    }
    
    // Change the tool radio to reflect the widget choosen.
    if (selectedWidget.Type == 'pencil') {
      // Make the open-closed toggle button match the state of the selected widget.
      // I could not (easily) put this in UpdateToolVisibility because the widget
      // was changed to match the button before this code executed.
      if (selectedWidget.IsModeClosed()) {
        this.SetPencilModeToClosed();
      } else {
        this.SetPencilModeToOpen();
      }
      // Turn on the pencil tool
      // I am trying to avoid triggering the button. It has caused headaches in the past.
      // This might miss setting up a callback on the widget.
      this.HighlightRadioToolButton(this.PencilButton);
      selectedWidget.SetStateToDrawing(selectedAnnotObj.Layer);
    }
    if (selectedWidget.Type == 'text') {
      this.HighlightRadioToolButton(this.TextButton);
      selectedWidget.SetStateToDrawing(selectedAnnotObj.Layer);
    }
    
    // TODO: This ivar is only really needed for the properties dialog.
    // We could just find the first selected widget ....
    this.SelectedWidget = selectedWidget;
    this.UpdateToolVisibility();
    
    return false;
  };

  // This adds a pencil ivar (= true) for events generated by the iPad pencil.
  GirderAnnotationPanel.prototype.CheckForIPadPencil = function (event, debug) {
    if (SAM.MOBILE_DEVICE === 'iPad' && event.touches && event.touches.length === 1) {
      var touch = event.touches[0];
      // iPad pencil generates a force.
      if (touch.force && !isNaN(touch.force) && touch.force !== 0) {
        if (debug) {
          print('event force = ' + touch.force);
        }
        event.pencil = true;
        // Hack
        // TODO: Trigger this on selected stroke.
        this.PencilOpenClosedToggle.show();
        return true;
      } else {
        if (debug) {
          if (toucn.force === undefined) {
            print('No force in event');
          } else {
            print('non qualified event force = ' + touch.force);
          }
        }
      }
    }
    return false;
  };

  SAM.GirderAnnotationPanel = GirderAnnotationPanel;
})();
