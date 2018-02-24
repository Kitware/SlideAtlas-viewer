// Text arrow state not being saved.

// Text dialog not on top when full screen

// Text background flag does not toggle.

// Test iPad

// Clicking an a pencil which activate the encil button

// 1: fix delay before pencil starts drawing (gap in line).
//  9: Make the panel collapse to a single button.
// 11: make sure it works on an ipad / surface.

// 3: undo.

(function () {
  'use strict';

  // PencilToggle.
  var OPEN = 0;
  var CLOSED = 1;

  // Parent is the viewer.Div
  function GirderAnnotationPanel (viewer, itemId) {
    // The pannel should probably not be managing this navigation widget.
    // I am putting it here as a temporary home.
    this.InitializeNavigation(viewer.GetDiv(), itemId);

    // -----------------------------------------------------

    this.ActiveColor = '#7CF';
    this.DefaultColor = '#DDD';
    this.ButtonSize = '16px';

    this.Parent = viewer.Div;
    // Any new layers created have to know the viewer.
    this.Viewer = viewer;

    // Create a parent div to hold all of the annotation labels
    this.Margin = 6;

    // Holds the annotation tools and the list of annotation buttons
    this.Div = $('<div>')
      // Have to use this parent, or events are blocked.
      .appendTo(this.Parent)
      .attr('id', 'saAnnotationPanel')
      .hover(function () { $(this).css({'opacity': '1'}); },
             function () { $(this).css({'opacity': '0.4'}); })
      .css({
        'position': 'absolute',
        'left': '3px',
        'top': (5 * this.Margin) + 'px',
        'bottom': (2 * this.Margin) + 'px',
        'opacity': '0.4',
        'z-index': '2'});

    // If we have write access, this creates markup tools.
    this.ToolDiv = $('<div>')
      .appendTo(this.Div)
      .attr('id', 'saAnnotationTools');
    this.OptionsDiv = $('<div>')
      .appendTo(this.Div)
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

  GirderAnnotationPanel.prototype.ChangeItem = function (itemId) {
    console.log('change item ' + itemId);
    // Change the image in the viewer.
    var self = this;
    girder.rest.restRequest({
      path: 'item/' + itemId + '/tiles',
      method: 'GET'
    }).done(function (data) {
      self.LoadItemToViewer(itemId, data);
    });

    // Now for the annotation stuff.
    this.DeleteButtons();
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
  GirderAnnotationPanel.prototype.DeleteButtons = function () {
    for (var i = 0; i < this.AnnotationObjects.length; ++i) {
      var annotObj = this.AnnotationObjects[i];
      this.EditOff(annotObj);
      this.VisibilityOff(annotObj);
      if (annotObj.Layer) {
        this.Viewer.RemoveLayer(annotObj.Layer);
      }
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
    // This turns on, only when a annotation is being edited.
    this.RectSelectButton = $('<img>')
      .appendTo(this.ToolDiv)
      .addClass('sa-view-annotation-button sa-flat-button-active')
      .addClass('sa-active')
      .css({'border': '1px solid #aaa'})
      .attr('type', 'image')
      .attr('src', SA.ImagePathUrl + 'rect_select.png')
      .on('click touchstart',
          function () {
            self.SelectStrokes();
            return false;
          })
      .hide();
    this.RectSelectButton.on('mousedown mousemove mouseup touchmove touchend',
                             function () { return false; });

    this.TextButton = $('<img>')
      .appendTo(this.ToolDiv)
      .addClass('sa-view-annotation-button sa-flat-button-active')
      .addClass('sa-active')
      .attr('type', 'image')
      .attr('src', SA.ImagePathUrl + 'Text.gif')
      .on('click touchstart',
          function () {
            self.TextButtonCallback();
            return false;
          });
    this.TextButton.on('mousedown mousemove mouseup touchmove touchend',
                       function () { return false; });

    this.PencilButton = $('<img>')
      .appendTo(this.ToolDiv)
      .addClass('sa-view-annotation-button sa-flat-button-active')
      .addClass('sa-active')
      .css({'border': '1px solid #aaa'})
      .attr('type', 'image')
      .attr('src', SA.ImagePathUrl + 'Pencil-icon.jpg')
      .on('click touchstart',
          function () {
            self.PencilButtonCallback();
            return false;
          });
    this.PencilButton.on('mousedown mousemove mouseup touchmove touchend',
                         function () { return false; });

    this.PencilOpenClosedState = OPEN;
    this.PencilOpenClosedToggle = $('<img>')
      .appendTo(this.OptionsDiv)
      .addClass('sa-view-annotation-button sa-flat-button-active')
      .addClass('sa-active')
      .css({
        'border': '1px solid #aaa',
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
  };

  // When tools have nothing to modify, they disappear.
  // TODO: Help tool. to explain why a tool is not available.
  GirderAnnotationPanel.prototype.UpdateToolVisibility = function () {
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
        if (widget.IsSelected()) {
          lineSelected = true;
          break;
        }
      }
    }
    // Some layer has to be being edited.
    if (this.Highlighted) {
      if (this.PencilWidget || lineSelected) {
        this.PencilOpenClosedToggle.show();
      } else {
        this.PencilOpenClosedToggle.hide();
      }
    }
  };

  GirderAnnotationPanel.prototype.TogglePencilOpenClosed = function () {
    var layer = this.Highlighted.Layer;
    var widget;
    var i;
    if (this.PencilOpenClosedState === CLOSED) {
      this.PencilOpenClosedState = OPEN;
      this.PencilOpenClosedToggle
        .attr('src', SA.ImagePathUrl + 'open_lasso.png');
      for (i = 0; i < layer.GetNumberOfWidgets(); ++i) {
        widget = layer.GetWidget(i);
        if (widget.SetModeToOpen) {
          widget.SetModeToOpen(layer);
        }
      }
    } else {
      this.PencilOpenClosedState = CLOSED;
      this.PencilOpenClosedToggle
        .attr('src', SA.ImagePathUrl + 'select_lasso.png');
      // Hack reference to the widget.
      for (i = 0; i < layer.GetNumberOfWidgets(); ++i) {
        widget = layer.GetWidget(i);
        if (widget.SetModeToOpen) {
          widget.SetModeToClosed(layer);
        }
      }
    }
    layer.EventuallyDraw();
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
      self.UserData = data;
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
    if (metadata.creatorId !== this.UserData._id) {
      return;
    }
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
        .attr('src', SA.ImagePathUrl + 'plus.png')
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
      .attr('contentEditing', true)
      .css({'cursor': 'text'})
      // Needed to expose contenteditable which is blocked by ancestor event handlers.
      .on('mouseenter', function () { self.EditNameOn(annotObj); });
  };

  GirderAnnotationPanel.prototype.SetNameButtonModeToOwner = function (annotObj) {
    var self = this;
    annotObj.NameButton
      .off('mouseenter')
      // .prop('title', 'edit')
      .attr('contentEditing', false)
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

  // TODO: Load annotations into a 'group'.  Manage separate groups.
  // Move the annotation info to the layer widgets and draw.
  GirderAnnotationPanel.prototype.DisplayAnnotation = function (annotObj) {
    // If there is no layer, we have to create one
    if (!annotObj.Layer) {
      annotObj.Layer = this.Viewer.NewAnnotationLayer();
      var self = this;
    // I am not sure that this is still used.
      annotObj.Layer.SetActivatedCallback(function () { self.EditOn(annotObj); });
      annotObj.Layer.SetModifiedCallback(function () { self.AnnotationModified(annotObj); });
      annotObj.Layer.SetSelectChangeCallback(function () { self.SelectChanged(annotObj); });
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
          annotObj.Layer.LoadWidget(obj);
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
          obj.visibility = elements.points[0][2];
          annotObj.Layer.LoadWidget(obj);
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
          annotObj.Layer.LoadWidget(obj);
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
            annotObj.Layer.LoadWidget(obj);
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
          var widget = annotObj.Layer.LoadWidget(obj);
          // Allows drawing to transfer to a new widget.
          widget.SetSelectedCallback(function (w) { self.WidgetSelected(annotObj, w); });
        }
      }

      if (setObj.widths.length > 0) {
        annotObj.Layer.LoadWidget(setObj);
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
      .attr('src', SA.ImagePathUrl + 'minus.png');
    this.DisplayAnnotation(annotObj);
  };
  GirderAnnotationPanel.prototype.VisibilityOff = function (annotObj) {
    if (!annotObj || !annotObj.Visible) {
      return;
    }
    annotObj.Visible = false;
    annotObj.VisToggle
      .attr('src', SA.ImagePathUrl + 'plus.png');
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
          annotObj.Name === this.UserData.lastName) {
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
      annotation: {name: this.UserData.lastName},
      creatorId: this.UserData._id,
      _id: undefined,
      data: annotation};
    annotObj = this.AddAnnotationButton(data);
    annotObj.VisToggle.prop('checked', true);
    annotObj.Layer = this.Viewer.NewAnnotationLayer();
    // I am not sure that this is still used.
    annotObj.Layer.SetActivatedCallback(function () { self.EditOn(annotObj); });
    annotObj.Layer.SetSelectChangeCallback(function () { self.SelectChanged(annotObj); });
    annotObj.Layer.SetModifiedCallback(function () { self.AnnotationModified(annotObj); });

    this.EditOn(annotObj);
    (callback)(this.Highlighted);
  };

  GirderAnnotationPanel.prototype.SelectChanged = function (annotObj) {
    if (annotObj.Layer.HasSelections()) {
      this.EditOn(annotObj);
    }
    this.UpdateToolVisibility();
  };

  // TextButton is really a toggle.
  // Text buttonOn <=> dialog showing.
  // Selecting a text automatically turns text button on and shows dialog.
  GirderAnnotationPanel.prototype.TextButtonCallback = function () {
    if (this.TextWidget) {
      // The user pressed the button again (while it was active).
      this.TextButtonOff();
    } else {
      var self = this;
      // This makes sure an annotation layer is selected and editing
      // before calling 'PencilButtonOn'.
      this.WithHighlightedCall(function (annotObj) { self.TextButtonOn(annotObj); });
    }
  };

  // Widget is an optional arguement.
  GirderAnnotationPanel.prototype.TextButtonOn = function (annotObj, widget) {
    // TODO: Try to generalize all this stuff and put in 'NewTool'
    // If the text is already active,  just return.
    if (widget && widget === this.TextWidget) {
      return;
    }

    // The text button is already editing another widget. Turn it off.
    if (this.TextWidget) {
      this.TextButtonOff();
    }

    // Make the pencil button reflect its toggled on/off state.
    var button = this.TextButton;
    button.addClass('sa-active');

    // The layer has to be in editing mode.
    this.EditOn(annotObj);

    // Get a text widget.
    // Look for a selected widget to reuse.
    var layer = annotObj.Layer;
    if (!widget) {
      widget = layer.GetASelectedWidget('text');
    }
    if (!widget) {
      // A selected textWidget was not found. Make a new text widget.
      widget = new SAM.TextWidget(layer);
      layer.AddWidget(widget);
      widget.SetCreationCamera(layer.GetCamera());
      widget.SetStateToDialog(layer);
    }
    this.TextWidget = widget;

    // Activate the widget to start drawing.
    widget.SetStateToDrawing(layer);

    // This will turn off the pencil button when the widget deactivates itself.
    var self = this;
    widget.SetStateChangeCallback(function () {
      if (!widget.GetActive()) {
        self.TextButtonOff();
      }
    });

    // Show the open closed toggle.
    this.UpdateToolVisibility();
  };

  GirderAnnotationPanel.prototype.TextButtonOff = function () {
    if (!this.TextWidget) {
      return;
    }
    var widget = this.TextWidget;
    this.TextWidget = undefined;
    var layer = this.Highlighted.Layer;
    widget.SetStateToInactive(layer);
    this.UpdateToolVisibility();
  };

  // PencilButton is really a toggle.
  GirderAnnotationPanel.prototype.PencilButtonCallback = function () {
    if (this.PencilWidget) {
      // The user pressed the button again (while it was active).
      this.PencilButtonOff();
    } else {
      var self = this;
      // This makes sure an annotation layer is selected and editing
      // before calling 'PencilButtonOn'.
      this.WithHighlightedCall(function (annotObj) { self.PencilButtonOn(annotObj); });
    }
  };

  // Widget is an optional arguement.
  GirderAnnotationPanel.prototype.PencilButtonOn = function (annotObj, widget) {
    // Pencil specific stuff.
    // TODO: Try to generalize all this stuff and put in 'NewTool'
    // If the pencil is already drawing in the selected widget.
    if (widget && widget === this.PencilWidget) {
      return;
    }

    // The pencil is already editing another layer. Turn it off.
    if (this.PencilWidget) {
      this.PencilButtonOff();
    }

    // Make the pencil button reflect its toggled on/off state.
    var button = this.PencilButton;
    button.addClass('sa-active');

    // The layer has to be in editing mode.
    this.EditOn(annotObj);

    // Get a pencil widget.
    // Look for a selected widget to reuse.
    var layer = annotObj.Layer;
    if (!widget) {
      widget = layer.GetASelectedWidget('pencil');
    }
    if (!widget) {
      // A selected pencilWidget was not found. Make a new pencil widget.
      widget = new SAM.PencilWidget(layer);
      // Allows drawing to transfer to a new widget.
      widget.SetSelectedCallback(function (w) { self.WidgetSelected(annotObj, w); });
      layer.AddWidget(widget);
      widget.SetCreationCamera(layer.GetCamera());
    }
    this.PencilWidget = widget;

    // Activate the widget to start drawing.
    widget.SetStateToDrawing(layer);

    // This will turn off the pencil button when the widget deactivates itself.
    var self = this;
    widget.SetStateChangeCallback(function () {
      if (!widget.GetActive()) {
        self.PencilButtonOff();
      }
    });

    // Will it use open or closed strokes?
    if (this.PencilOpenClosedState === OPEN) {
      widget.SetModeToOpen(layer);
    } else {
      widget.SetModeToClosed(layer);
    }

    // Show the open closed toggle.
    this.UpdateToolVisibility();
  };

  GirderAnnotationPanel.prototype.PencilButtonOff = function () {
    if (!this.PencilWidget) {
      return;
    }
    var widget = this.PencilWidget;
    this.PencilWidget = undefined;
    var layer = this.Highlighted.Layer;
    widget.SetStateToInactive(layer);
    this.UpdateToolVisibility();
  };

  // This gives the user the ability to shwitch drawing to a differernt widget.
  GirderAnnotationPanel.prototype.WidgetSelected = function (annotObj, widget) {
    if (widget === this.PencilWidget) {
      return;
    }
    if (this.PencilWidget && widget.Type === 'pencil') {
      // Activates the pencil with the new selected widget.
      this.PencilButtonOn(annotObj, widget);
    }
  };

  GirderAnnotationPanel.prototype.NewText = function () {
    // var button = this.TextButton;
    // var widget = this.NewTool(button, SAM.TextWidget);
    // The dialog is used to set the initial text.
    // widget.ShowPropertiesDialog();
  };

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
    // Remove the annotation layer from the viewer.
    this.Viewer.RemoveLayer(annotObj.Layer);
  };

  // Called when the user draws something.
  GirderAnnotationPanel.prototype.AnnotationModified = function (annotObj) {
    if (!annotObj.Modified) {
      this.ModifiedCount += 1;
    }
    var self = this;
    annotObj.Modified = true;
    // Change the background color of the edit toggle to show that is is modified.
    annotObj.EditToggle.css({'background-color': '#F55'});
    // start a timer to actually save.
    if (annotObj.SaveTimerId) {
      clearTimeout(annotObj.SaveTimerId);
      annotObj.SaveTimerId = undefined;
    }
    // Every minute
    console.log('Save in 30 seconds');
    annotObj.SaveTimerId = setTimeout(function () { self.RecordAndSave(annotObj); }, 30000);

    window.onbeforeunload = function (event) {
      console.log('Leaving page ' + self.ModifiedCount);
      return true;
    };
    // if (this.ModifiedCount === 0) {
    //    return false;
    //  }
    //  for (var i = 0; i < self.AnnotationObjects.length; ++i) {
    //    var annotObj = self.AnnotationObjects[i];
    //    if (annotObj.Modified) {
    //      self.RecordAndSave(annotObj);
    //    }
    //  }
    //  event.returnValue = 'Saving work';
    //  //return 'Changes are being saved. Are you sure you want to leave?';
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
        this.AnnotationSaved();
        return;
      }
      // Indicate we are saving somehow.
      annotObj.Div.css({'border': '3px solid #000'});
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
      // Indicate we are saving somehow.
      annotObj.Div.css({'border': '3px solid #000'});
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
        points[0][2] = this.Widget.visibility;
        points[1][2] = this.Widget.visibility;
          
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

  // An annotation has to be selected for editing before this is called.
  // It starts a rectSelectWidget for the user.
  GirderAnnotationPanel.prototype.SelectStrokes = function () {
    var self = this;
    var annotObj = this.Highlighted;
    // Anything being edited has to be loaded too.
    var layer = annotObj.Layer;
    var selectWidget = new SAM.RectSelectWidget();
    selectWidget.SetFinishCallback(function (w) { self.FinishSelectStrokes(annotObj, w); });
    layer.AddWidget(selectWidget);
    // Start receiving events.
    // Normally this happens as a call back when state changes to drawing.
    layer.ActivateWidget(selectWidget);
    selectWidget.SetStateToDrawing(layer);
  };
  GirderAnnotationPanel.prototype.FinishSelectStrokes = function (annotObj, selectWidget) {
    var selectCount = 0;
    var layer = annotObj.Layer;
    for (var idx = 0; idx < layer.GetNumberOfWidgets(); ++idx) {
      var w = layer.GetWidget(idx);
      if (w.Select) {
        selectCount += w.Select(selectWidget);
      }
    }
    if (selectCount > 0) {
      console.log('Selected ' + selectCount + ' shapes');
    }
    layer.RemoveWidget(selectWidget);
    layer.EventuallyDraw();

    this.UpdateToolVisibility();
  };

  SAM.GirderAnnotationPanel = GirderAnnotationPanel;
})();
