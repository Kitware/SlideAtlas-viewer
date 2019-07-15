// This is created by the girder plugin to create anntotation layers.
// This manages a list of annotation layers as divs on the left side of the viewer window.

// Added: currently visible annotations names to the "localStorage" so they remain open when stepping
// through images with the navigator.

// Each layer is a group of vector annotations that can be turned on and off together.
// Layers first started off as markup,  but I am extending this to include a raster mask layer.


// Notes:
// LayerGuis, are annotationLayerGui objects that manaage an annotation layer and GUI


// TODO:
// I want layerGui to own the tools, but the tools have to be available before the first layer is created.
// Make a default layerGui that is not visible until it has its first annotation


// TODO:
// Click Select circle not working
// Cannot navigate viewer with touch.




(function () {
  'use strict';

  
  function LayerPanel (viewer, itemId) {
    this.Viewer = viewer;
    this.Parent = viewer.GetDiv();
    this.ItemId = itemId;
    this.LayerGuis = [];
    this.ModifiedCount = 0;
    this.EditingLayer = undefined;
    this.SelectedWidgets = [];
    
    // Because of loading on demand, the easiest way to restore
    // visibile annotations from local storage is to load a list
    // here.
    this.RestoreVisibilityFromLocalStorage();

    // Create a parent div to hold all of the annotation labels
    // Warning: These are duplicated in layerPanel
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
    
    if (itemId) {
      this.CheckItemIdAccessTools(itemId);
      // This makes a button for each annotation in the item.
      this.InitializeButtons(this.Div, itemId);
    }

    // The pannel should probably not be managing this navigation widget.
    // I am putting it here as a temporary home.
    if (itemId) {
      this.InitializeNavigation(viewer.GetDiv(), itemId);
    }

    this.Parent = viewer.GetDiv();
    this.InitializeHelp(this.Parent.parent());

    // To get event calls from the viewer.
    this.Viewer.AddLayer(this);
  }


  LayerPanel.prototype.UpdateToolVisibility = function () {
    if (this.AnnotationToolPanel) {
      this.AnnotationToolPanel.UpdateToolVisibility();
    }
  };


  // onresize callback.  Canvas width and height and the camera need
  // to be synchronized with the canvas div.
  LayerPanel.prototype.UpdateSize = function () {
    for (var i = 0; i < this.LayerGuis.length; ++i) {
      var layerGui = this.LayerGuis[i];
      var layer = layerGui.layer;
      if (layer && layer.UpdateSize) {
        layer.UpdateSize();
      }
    }
  };


  LayerPanel.prototype.Draw = function () {
    for (var i = 0; i < this.LayerGuis.length; ++i) {
      var layerGui = this.LayerGuis[i];
      var layer = layerGui.Layer;
      if (layer && layer.Draw) {
        layer.Draw();
      }
    }
  };

  
  LayerPanel.prototype.Reset = function () {
    for (var i = 0; i < this.LayerGuis.length; ++i) {
      var layerGui = this.LayerGuis[i];
      var layer = layerGui.layer;
      if (layer && layer.Reset) {
        layer.Reset();
      }
    }
  };
  

  LayerPanel.prototype.InitializeNavigation = function (parent, itemId) {
    var nav = new SA.GirderNavigationWidget(parent, itemId);
    var self = this;
    nav.SetChangeItemCallback(function (itemId) { self.ChangeItem(itemId); });
  };


  // This call back pattern is all because we load on demand.
  // Gets the annotation being edited. If one is not editing, look for one
  // with the default name (users last name).  If none are found, one is created.
  // The tools use this method.
  LayerPanel.prototype.WithEditingLayerCall = function (callback) {
    if (this.EditingLayer) {
      (callback)(this.EditingLayer);
      return;
    }
    var self = this;
    var layerGui;
    for (var idx = 0; idx < this.LayerGuis.length; ++idx) {
      layerGui = this.LayerGuis[idx];
      if (layerGui.CreatorId === this.UserData._id &&
          layerGui.Name === this.UserData.login) {
        // Use this one. Make sure it is loaded before executing the callback.
        layerGui.AfterLoad(function () {
          layerGui.DisplayAnnotation();
          layerGui.EditOn();
          (callback)(layerGui);
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
    layerGui = new SAM.AnnotationLayerGui(data, this);
    this.LayerGuis.push(layerGui);
    layerGui.VisToggle.prop('checked', true);
    layerGui.MakeAnnotationLayer(this.Viewer);

    layerGui.EditOn();
    (callback)(this.EditingLayer);
  };


  
  // ===============================================================================
  // TODO: The information has to find a different home.
  LayerPanel.prototype.InitializeHelp = function (parent) {
    var helpDiv = $('<div>')
        .appendTo(parent)
        .css({
          'position': 'absolute',
          'left': '3px',
          'top': '3px',
          'min-height': '300px',
          'min-width': '200px',
          'background-color': '#fff',
          'border': '1px solid #666666',
          'z-index': '400'})
        .hide()
        .on('mouseleave',
            function (e) {
              helpDiv.hide();
            });
    // var helpCloseButton =
    $('<div>')
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
        .css({'width': '100%'});
    $('<img>')
      .appendTo(fullScreenOnDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'fullScreen32.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(fullScreenOnDiv)
      .css({'display': 'inline-block'})
      .text('Expand the viewer to fullscreen.');

    var fullScreenOffDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(fullScreenOffDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'fullScreenOff32.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(fullScreenOffDiv)
      .css({'display': 'inline-block'})
      .text('Exit fullscreen');

    var textDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(textDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'Text.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(textDiv)
      .css({'display': 'inline-block'})
      .text('Text tool: Select text to drag it.');

    var arrowDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(arrowDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'Arrow.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(arrowDiv)
      .css({'display': 'inline-block'})
      .text('Arrow tool: draw an arrow. Mouse press places the tip. Mouse drag places the end.');

    var pencilDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(pencilDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'Pencil-icon.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(pencilDiv)
      .css({'display': 'inline-block'})
      .text('Pencil tool: draw lines on the slide. Click on a line to select it.');

    var openDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(openDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'open_lasso.png')
      .css({
        'height': '24px',
        'margin-left': '24px'});
    $('<p>')
      .appendTo(openDiv)
      .css({'display': 'inline-block'})
      .text('Open pencil mode: Simple open strokes.');

    var closedDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(closedDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'select_lasso.png')
      .css({
        'height': '24px',
        'margin-left': '24px'});
    $('<p>')
      .appendTo(closedDiv)
      .css({'display': 'inline-block'})
      .text('Closed pencil mode: Draw closed loops that can be modified with subsequent strokes. Editing strokes must cross the loop twice.');

    // Selection -------------------------------------------------------------------
    $('<hr>')
      .appendTo(helpDiv);
    $('<p>')
      .appendTo(helpDiv)
      .css({'display': 'inline-block'})
      .text('Click on any annotation to select it. The delete key deletes selected annotations. When one annotation is selected it can be edited.');

    var rectSelectDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(rectSelectDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'rect_select.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(rectSelectDiv)
      .css({'display': 'inline-block'})
      .text('The rectancle selection tool allows multiple annotations to be selected at once.');

    var propertiesDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(propertiesDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'Menu.jpg')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(propertiesDiv)
      .css({'display': 'inline-block'})
      .text('Show the selected annotation\'s property dialog.');

    // Annotation buttons ---------------------------------------------------------
    $('<hr>')
      .appendTo(helpDiv);

    var annotationButtonDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(annotationButtonDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'AnnotationButton.jpg')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(annotationButtonDiv)
      .css({'display': 'inline-block'})
      .text('Annotation buttons represent markup collections. YOu can click the name to change it.');

    var visibilityDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(visibilityDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'eyeClosed32.png')
      .css({
        'height': '24px',
        'margin-left': '24px'});
    $('<img>')
      .appendTo(visibilityDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'eyeOpen32.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(visibilityDiv)
      .css({'display': 'inline-block'})
      .text('The visibility toggle hides or shows all the markups in the annotation group.');

    var editDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(editDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'edit_up.png')
      .css({
        'height': '24px',
        'margin-left': '24px'});
    $('<img>')
      .appendTo(editDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'edit_down.png')
      .css({'height': '24px'});
    $('<p>')
      .appendTo(editDiv)
      .css({'display': 'inline-block'})
      .text('The edit toggle selects a single annotation group for editing.');

    var deleteDiv = $('<div>')
        .appendTo(helpDiv)
        .css({'width': '100%'});
    $('<img>')
      .appendTo(deleteDiv)
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'remove.png')
      .css({
        'height': '24px',
        'margin-left': '24px'});
    $('<p>')
      .appendTo(deleteDiv)
      .css({'display': 'inline-block'})
      .text('Delete a selected annotation. If no annotation is selected, the whole annotation group will be deleted.');

    // Toggle the help window on and off.
    // var helpButton =
    $('<img>')
      .appendTo(parent)
      .prop('title', 'help')
      .addClass('sa-view-button')
      .attr('src', SA.ImagePathUrl + 'question32.png')
      .css({
        'position': 'absolute',
        'left': '35px',
        'top': '2px',
        'height': '24px',
        'z-index': '300'})
      .on('click touchend',
          function (e) {
            helpDiv.show();
          });
  };

  
  // Setup the tool buttons / GUI when this pannel is first constructed.
  // But first we have to go through a series of rest calls to determine we have write access.
  LayerPanel.prototype.CheckItemIdAccessTools = function (itemId) {
    // First we have to see if we have write access to the folder containing this item.
    var self = this;
    girder.rest.restRequest({
      path: 'item/' + itemId,
      method: 'GET'
    }).done(function (data) {
      self.CheckItemDataAccessTools(data);
    });
  };
  LayerPanel.prototype.CheckItemDataAccessTools = function (data) {
    // First we have to see if we have write access to the folder containing this item.
    var self = this;
    girder.rest.restRequest({
      path: 'folder/' + data.folderId,
      method: 'GET'
    }).done(function (data) {
      self.CheckFolderDataAccessTools(data);
    });
  };
  LayerPanel.prototype.CheckFolderDataAccessTools = function (data) {
    // if (data._accessLevel > 0) {
    // We have access.  Go ahead and create the tools.
    this.AnnotationToolPanel = new SAM.AnnotationToolPanel(this);
  };

  
  // ===============================================================================
  // Call back from navigation to update the annotation to match the viewer item.
  LayerPanel.prototype.ChangeItem = function (itemId) {
    // Change the image in the viewer.
    var self = this;
    girder.rest.restRequest({
      path: 'item/' + itemId + '/tiles',
      method: 'GET'
    }).done(function (data) {
      self.LoadItemToViewer(itemId, data);
    });

    // There is contention trying to restore annotation visibility in the next item.
    // Deleting Annotation Buttons erases local storage of the visible names.
    // Probably a better solution than this is to have two set visibility methods.
    // Only the one used by the gui changes local storage values.
    // For now, save and restore the cached names.
    var savedNames = this.LocalStorageVisibleAnnotationNames;

    // Now for the annotation stuff.
    this.DeleteAnnotationButtons();
    this.LocalStorageVisibleAnnotationNames = savedNames;
    this.InitializeButtons(this.Div, itemId);
  };


  // Now update the annotation GUI
  LayerPanel.prototype.DeleteAnnotationButtons = function () {
    for (var i = 0; i < this.LayerGuis.length; ++i) {
      var layerGui = this.LayerGuis[i];
      layerGui.EditOff();
      layerGui.VisibilityOff();
      if (layerGui.Div) {
        layerGui.Div.remove();
      }
    }
    this.LayerGuis = [];
  };

  
  
  LayerPanel.prototype.RestoreVisibilityFromLocalStorage = function () {
    this.LocalStorageVisibleAnnotationNames = [];
    var str = localStorage.getItem('SAAnnotationVisibility');
    if (str) {
      this.LocalStorageVisibleAnnotationNames = JSON.parse(str);
    }
  };

  LayerPanel.prototype.SaveVisibilityInLocalStorage = function () {
    // Assemble a list of visible names.
    var names = [];
    for (var idx = 0; idx < this.LayerGuis.length; ++idx) {
      var layerGui = this.LayerGuis[idx];
      if (layerGui.Visible) {
        names.push(layerGui.Name);
      }
    }

    localStorage.setItem('SAAnnotationVisibility', JSON.stringify(names));
    this.LocalStorageVisibleAnnotationNames = names;
  };


  LayerPanel.prototype.LoadItemToViewer = function (itemId, data) {
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
      spacing: [data.mm_x, data.mm_y],
      getTileUrl: function (level, x, y, z) {
        // Drop the 'z' argument
        var apiroot = 'api/v1';
        return apiroot + '/item/' + itemId + '/tiles/zxy/' + level + '/' + x + '/' + y;
      }
    };
    if (!data.mm_x) {
      // tileSource.units = 'pixels';
      tileSource.spacing = [1, 1];
    }

    var note = SA.TileSourceToNote(tileSource);
    this.Viewer.SetNote(note, 0, true);
    // Viewer.prototype.SetViewerRecord(viewerRecord, lockCamera);
  };


  LayerPanel.prototype.InitializeButtons = function (parent, itemId) {
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
        self.UserData = {_id: '0000', login: 'guest'};
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
  LayerPanel.prototype.RequestGirderImageItem = function (itemId) {
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
  LayerPanel.prototype.LoadGirderItemAnnotations = function (data) {
    for (var i = 0; i < data.length; ++i) {
      var layerGui = new SAM.AnnotationLayerGui(data[i], this);
      this.LayerGuis.push(layerGui);
    }
  };



  // ===========================================================================
  // Forward events to layers.

  // onresize callback.  Canvas width and height and the camera need
  // to be synchronized with the canvas div.
  LayerPanel.prototype.UpdateSize = function () {
    for (var i = 0; i < this.LayerGuis.length; ++i) {
      var layerGui = this.LayerGuis[i];
      var layer = layerGui.layer;
      if (layer && layer.UpdateSize) {
        layer.UpdateSize();
      }
    }
  };

  LayerPanel.prototype.Draw = function () {
    for (var i = 0; i < this.LayerGuis.length; ++i) {
      var layerGui = this.LayerGuis[i];
      var layer = layerGui.Layer;
      if (layer && layer.Draw) {
        layer.Draw();
      }
    }
  };

  LayerPanel.prototype.Reset = function () {
    for (var i = 0; i < this.LayerGuis.length; ++i) {
      var layerGui = this.LayerGuis[i];
      var layer = layerGui.layer;
      if (layer && layer.Reset) {
        layer.Reset();
      }
    }
  };

  LayerPanel.prototype.HandleTouchStart = function (event) {
    if (this.CheckForIPadPencil(event)) {
      var self = this;
      // User is drawing with a pencil.  Make sure a layer is editable.
      this.WithEditingLayerCall(
        function (layerGui) {
          // A small hack.
          self.SelectedWidgets = [layerGui.Layer.GetIPadPencilWidget()];
          layerGui.Layer.HandleTouchStart(event);
        });
      return false;
    }
    if (this.EditingLayer) {
      var layer = this.EditingLayer.Layer;
      if (layer && layer.HandleTouchStart) {
        return layer.HandleTouchStart(event);
      }
    }
    return true;
  };

  LayerPanel.prototype.HandleTouchMove = function (event) {
    this.CheckForIPadPencil(event);
    if (this.EditingLayer) {
      var layer = this.EditingLayer.Layer;
      if (layer && layer.HandleTouchMove) {
        return layer.HandleTouchMove(event);
      }
    }
    return true;
  };

  LayerPanel.prototype.HandleTouchEnd = function (event) {
    console.log('panel touch end ' + event.touches.length);
    // No touches for end events so we cannot check for ipad pencil.
    if (this.EditingLayer) {
      var layer = this.EditingLayer.Layer;
      if (layer && layer.HandleTouchEnd) {
        // To cache pencil editing.
        this.UpdateToolVisibility();
        return layer.HandleTouchEnd(event);
      }
    }
    return true;
  };

  LayerPanel.prototype.HandleMouseDown = function (event) {
    if (this.EditingLayer) {
      var layer = this.EditingLayer.Layer;
      if (layer && layer.HandleMouseDown) {
        return layer.HandleMouseDown(event);
      }
    }
    return true;
  };

  LayerPanel.prototype.HandleMouseUp = function (event) {
    if (this.EditingLayer) {
      var layer = this.EditingLayer.Layer;
      if (layer && layer.HandleMouseUp) {
        return layer.HandleMouseUp(event);
      }
    }
    return true;
  };

  LayerPanel.prototype.HandleMouseMove = function (event) {
    if (this.EditingLayer) {
      var layer = this.EditingLayer.Layer;
      if (layer && layer.HandleMouseMove) {
        return layer.HandleMouseMove(event);
      }
    }
    return true;
  };

  LayerPanel.prototype.HandleMouseWheel = function (event) {
    if (this.EditingLayer) {
      var layer = this.EditingLayer.Layer;
      if (layer && layer.HandleMouseWheel) {
        return layer.HandleMouseWheel(event);
      }
    }
    return true;
  };

  LayerPanel.prototype.HandleKeyDown = function (event) {
    if ( ! this.EditingLayer) {
      return true;
    }
    var layer = this.EditingLayer.Layer;
    // Handle the delete key special
    // Multiple widgets ( in the layer being edit) can be deleted.
    if (event.keyCode === 46 || event.keyCode === 8) { // delete key
      this.DeleteSelected();
      layer.EventuallyDraw();
      event.preventDefault();
      return false;
    }

    if (layer && layer.HandleKeyDown) {
      return layer.HandleKeyDown(event);
    }

    return true;
  };

  // I am going to use click / tap to select markup.
  // How can we enforce only one selected at a time (for click)?
  // First one to consume the click stops propagation.
  // The problem is:  What should we do if one is already selected?
  // Event propagation will turn anyones off in the early layers.
  // After event propagation is stoped,  Loop through the rest
  // un selecting them.
  // NOTE: Select opperates on all layers.  It will choose a new "EditingLayer".
  LayerPanel.prototype.HandleMouseClick = function (event, shift) {
    // Turn off previous tool widgets. (deactivate)
    if (this.EditingLayer && !shift && !SAM.ControlKey) {
      var layer = this.EditingLayer.Layer;
      layer.UnselectAll();
    }

    // First one to consume the click wins the selection.
    // TODO: Change this to voting if annotations start to overlap.
    var selectedWidget;

    // TODO: Get rid of the multiple strokes in a single pencil widget.
    // It was a bad idea. It is 'hard' because lasso interaction editing of loops
    // depends on the two strokes to be in the same widget.  I do not want to
    // Break everything by rewritting this widget again.  I need to detect
    // If the same stroke was selected again (to show the popup).
    // This is the best way to trigger the popup. Ha,  it is not. I am getting
    // rid of the popup anyway.  I will just put a popup button in the option
    // panel.

    for (var i = 0; i < this.LayerGuis.length; ++i) {
      var layerGui = this.LayerGuis[i];
      layer = layerGui.Layer;
      if (!layer) {
        continue;
      }
      if (selectedWidget) {
        if (!shift && !SAM.ControlKey) {
          // Just unselect remaining layers.
          layer.SetSelected(false);
        }
      } else {
        // We even give inactive layers a chance to claim the selection.
        // It is a way to find which group a mark belongs to.
        if (layer.SingleSelect) {
          selectedWidget = layer.SingleSelect(event, shift);
          // if (selectedWidget) {
          //  selectedAnnotObj = layerGui;
          // }
        }
      }
    }

    // I should really pass in the layerGui that contains the widget.
    // However, this method finds it anyway.
    this.SetSelectedWidget(selectedWidget);
    return false;
  };

  
  // If only one widget is selected, we make it active (and show the properties button.
  // You can call this with selectedWidget = undefined to unset it.
  // "selectedLayerGui" is the one that contains the widget.
  LayerPanel.prototype.SetSelectedWidget = function (selectedWidget,
                                                     selectedLayerGui) {
    var tools = this.AnnotationToolPanel;
    
    // Unselect previous selected widgets.
    for (var i = 0; i < this.SelectedWidgets.length; ++i) {
      var widget = this.SelectedWidgets[i];
      widget.SetActive(false);
    }
    this.SelectedWidgets = [];

    // No widget: Go back to the cursor mode.
    if (!selectedWidget) {
      // Nothing was selected.
      // Change the state back to cursor
      tools.HighlightRadioToolButton(tools.CursorButton);
      // See if we can move this to CursorOn
      this.Viewer.EventuallyRender();
      tools.UpdateToolVisibility();
      return true;
    }

    // Trying to unify single select and region select (when only one is selected)
    // This is ugly.  Caller should supply the layer gui.
    if (selectedLayerGui === undefined) {
      // Find the layerGui for this widget.
      for (i = 0; i < this.LayerGuis.length && !selectedLayerGui; ++i) {
        var layerGui = this.LayerGuis[i];
        if (layerGui.Layer !== undefined) {
          var layer = layerGui.Layer;
          for (var j = 0; j < layer.GetNumberOfWidgets(); ++j) {
            if (selectedWidget === layer.GetWidget(j)) {
              selectedLayerGui = layerGui;
              break;
            }
          }
        }
      }
    }
    if (selectedLayerGui === undefined) {
      return;
    }

    // TODO: This ivar is only really needed for the properties dialog.
    // We could just find the first selected widget ....
    this.SelectedWidgets = [];

    // Make the layer editable.
    if (selectedLayerGui) {
      selectedLayerGui.EditOn();
    }

    // TODO: Try to get rid of this case statement.
    // Change the tool radio to reflect the widget choosen.
    if (selectedWidget.Type === 'pencil') {
      // Make the open-closed toggle button match the state of the selected widget.
      // I could not (easily) put this in UpdateToolVisibility because the widget
      // was changed to match the button before this code executed.
      if (selectedWidget.IsModeClosed()) {
        tools.SetPencilModeToClosed();
      } else {
        tools.SetPencilModeToOpen();
      }
      // Turn on the pencil tool
      // I am trying to avoid triggering the button. It has caused headaches in the past.
      // This might miss setting up a callback on the widget.
      tools.HighlightRadioToolButton(tools.PencilButton);
      // Should we change this to SetActive(true)?
      selectedWidget.SetStateToDrawing(selectedLayerGui.Layer);
    }
    if (selectedWidget.Type === 'text') {
      selectedWidget.SetActive(true);
      tools.HighlightRadioToolButton(tools.TextButton);
    }
    if (selectedWidget.Type === 'arrow') {
      tools.HighlightRadioToolButton(tools.ArrowButton);
      selectedWidget.SetActive(true);
    }
    if (selectedWidget.Type === 'circle') {
      tools.HighlightRadioToolButton(tools.CircleButton);
      selectedWidget.SetActive(true);
    }
    if (selectedWidget.Type === 'rect') {
      tools.HighlightRadioToolButton(tools.RectangleButton);
      selectedWidget.SetActive(true);
    }

    // TODO: This ivar is only really needed for the properties dialog.
    // We could just find the first selected widget ....
    this.SelectedWidgets = [selectedWidget];
    tools.UpdateToolVisibility();
  };


  // This should probably go into annotationLayerGui, but
  // I cannot decide who should be responsible for updating the tools.
  // Wait until we figure out how the layerGui can own the tools.
  // Rectangle select is only active on the editing layer.
  // Only widgets from one layer can be selected.
  // Called by the SelectedDeleteButton click event (or delete key).
  // Returns true if a widget was deleted.
  LayerPanel.prototype.DeleteSelected = function () {
    var layerGui = this.EditingLayer;
    if (!layerGui) {
      return false;
    }
    if (!layerGui.Layer.IsSelected()) {
      layerGui.Delete();
      return;
    }
    if (layerGui.Layer.DeleteSelected()) {
      layerGui.AnnotationModified();
      if (layerGui.Layer.IsEmpty()) {
        layerGui.Delete();
      }
    }
    this.SelectedWidgets = [];
    this.ToolRadioButtonCallback(this.CursorButton);
    this.UpdateToolVisibility();
    layerGUi.Layer.EventuallyDraw();
  };


  SAM.LayerPanel = LayerPanel;
})();
