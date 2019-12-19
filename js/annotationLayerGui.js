// AnnotationLayer holds the view and annotations in a girder annotation object.
// This class (AnnotationLayerGui) holds the GUI button that controls the name,
// visibiltiy button, and edit/save button.  Each annotation layer has one of these objects.

(function () {
  'use strict';

  // This is a helper object that manages one annoation layer.
  function AnnotationLayerGui (metadata, layerPanel) {
    // This is needed because EditOn, has to turn off any other layers editing.
    this.LayerPanel = layerPanel;
    this.Viewer = this.LayerPanel.Viewer;
    // Only widgets in a single layer can be selected at the same time.
    this.SelectedWidgets = [];

    this.ActiveColor = '#7CF';
    this.DefaultColor = '#DDD';
    this.ButtonSize = '16px';
    if (SAM.MOBILE_DEVICE === 'iPad') {
      this.ButtonSize = '24px';
    }

    // For now, users can only see their own annotations.
    // if (metadata.creatorId !== this.LayerPanel.UserData._id) {
    //  return;
    // }
    var self = this;
    var div = $('<div>')
      .appendTo(layerPanel.ButtonDiv)
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

    nameButton.hover(
      function () {
        $(this).css({'background-color': this.ActiveColor,
          'cursor': 'text'});
      },
      function () {
        $(this).css({'background-color': this.DefaultColor,
          'cursor': 'pointer'});
      });

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

    this.GirderAnnotId = metadata._id;
    this.CreatorId = metadata.creatorId;
    this.Data = undefined; //  load on demand
    this.Div = div;
    this.VisToggle = visToggle;
    this.Visible = false;
    this.EditToggle = editToggle;
    this.Editing = false;
    this.NameButton = nameButton;
    this.DeleteButton = deleteButton;
    this.Name = metadata.annotation.name;
    this.Modified = false;

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
        if (self.Visible) {
          self.VisibilityOff();
        } else {
          self.AfterLoad(function () { self.VisibilityOn(); });
        }
      });

    editToggle.on(
      'click touchstart',
      function () {
        if (self.Editing) {
          self.EditOff();
        } else {
          self.AfterLoad(function () { self.EditOn(); });
        }
        return false;
      });

    // The user can only activate his own annotations
    if (metadata.creatorId === this.LayerPanel.UserData._id) {
      this.EditNameOff();
      deleteButton.on(
        'click touchstart',
        function () {
          self.DeleteCallback();
          return false;
        });
    }

    // Restore any visible annotations from a previous session.
    if (this.LayerPanel.LocalStorageVisibleAnnotationNames.indexOf(this.Name) > -1) {
      this.AfterLoad(function () {
        self.VisibilityOn();
      });
    }
  }

  AnnotationLayerGui.prototype.MakeAnnotationLayer = function (viewer) {
    // Create an annotation layer by default.
    // viewer.GetDiv() is Same as this.Parent
    var annotationLayer = new SAM.AnnotationLayer(viewer.GetDiv());
    // Only for the text widget (dialog).
    // It needs this reference to turn off events to make the text input work.
    annotationLayer.SetViewer(viewer);
    // Lets just shallow copy the viewers camera to synchronize all layer views..
    annotationLayer.SetCamera(viewer.GetCamera());

    // TODO: Get rid of this.  master view is passed to draw.
    // Hack so the scale widget can get the spacing.
    annotationLayer.ScaleWidget.View = this.MainView;
    // Hack only used for girder testing.
    annotationLayer.SetViewer(viewer);
    annotationLayer.UpdateSize();
    this.Layer = annotationLayer;

    // I am not sure that this is still used.
    var self = this;
    annotationLayer.SetActivatedCallback(function () { self.EditOn(); });
    annotationLayer.SetModifiedCallback(function () { self.AnnotationModified(); });

    return annotationLayer;
  };

  AnnotationLayerGui.prototype.GetToolPanel = function () {
    if (!this.ToolPanel) {
      if (this.Name === this.LayerPanel.GetDefaultLayerName()) {
        this.ToolPanel = this.LayerPanel.DefaultToolPanel;
      } else if (this.Data.annotation.elements.length > 0 &&
          this.Data.annotation.elements[0].user &&
          this.Data.annotation.elements[0].user.imageUrl) {
        this.ToolPanel = new SAM.MaskToolPanel(this.LayerPanel);
      } else {
        this.ToolPanel = new SAM.AnnotationToolPanel(this.LayerPanel);
      }
      this.ToolPanel.SetLayerGui(this);
    }
    return this.ToolPanel;
  };

  // Only one editable at a time (or none)
  AnnotationLayerGui.prototype.EditOn = function () {
    if (this.Editing) {
      this.UpdateToolVisibility();
      return;
    }
    this.Editing = true;

    // Wait as long as possible before creating and setting the tool panel.
    // create it now.  SetEditinglayerGui needs to tool panel.
    this.GetToolPanel();

    // Make the name editable.
    var self = this;
    this.NameButton
      .on('click touchstart', function () {
        self.AfterLoad(function () { self.EditNameOn(); });
        return false;
      });

    this.EditToggle
      .attr('src', SA.ImagePathUrl + 'edit_down.png');
    // Make the delete button visible.
    this.DeleteButton.show();

    // Turn the new on on.
    this.LayerPanel.SetEditingLayerGui(this);
    // Change the color of the GUI.
    this.Div.css({'background-color': this.ActiveColor});
    // Make the markup visible
    this.VisibilityOn();

    this.UpdateToolVisibility();
  };

  AnnotationLayerGui.prototype.EditOff = function () {
    if (!this.Editing) {
      return;
    }
    this.Editing = false;

    this.EditToggle
      .attr('src', SA.ImagePathUrl + 'edit_up.png');

    // Deactivate any widgets in the layer.
    if (this.Layer) {
      this.Layer.SetSelected(false);
      this.Layer.Deactivate();
      this.Layer.EventuallyDraw();
    }
    // Disable editing of the name.
    this.EditNameOff();
    this.NameButton.off('click touchstart');

    // Save the annotation if anything changed.
    if (this.Modified) {
      this.RecordAndSave();
    }
    // Hide the delete button
    this.DeleteButton.hide();
    // Turn the background to the default.
    if (this.LayerPanel.EditingLayerGui === this) {
      this.Div.css({'background-color': this.DefaultColor});
      this.LayerPanel.SetEditingLayerGui(undefined);
    }

    this.UpdateToolVisibility();
  };

  // Called when the user draws something.
  AnnotationLayerGui.prototype.AnnotationModified = function () {
    if (!this.Modified) {
      // For wanr when leaing page with modified annotations.
      // I do not think the count is necessary.
      this.LayerPanel.ModifiedCount += 1; // ????
    }
    this.Modified = true;
    // Change the background color of the edit toggle to show that is is modified.
    if (this.LayerPanel.UserData.login !== 'guest') {
      this.EditToggle.css({'background-color': '#F55'});
    }

    // Save after 30 seconds regardless of additional markup.
    var self = this;
    if (!this.SaveTimerId) {
      console.log('Save in 30 seconds');
      this.SaveTimerId = setTimeout(function () { self.RecordAndSave(); }, 30000);
    }

    window.onbeforeunload = function (event) {
      console.log('Leaving page ' + self.LayerPanel.ModifiedCount);
      return true;
    };
  };

  AnnotationLayerGui.prototype.VisibilityOn = function () {
    if (this.Visible) {
      return;
    }
    this.Visible = true;
    this.VisToggle
      .attr('src', SA.ImagePathUrl + 'eyeOpen32.png');
    this.DisplayAnnotation();

    // Record the visibility of this annotation in local storage.
    this.LayerPanel.SaveVisibilityInLocalStorage();
  };

  AnnotationLayerGui.prototype.VisibilityOff = function () {
    if (!this.Visible) {
      return;
    }
    this.Visible = false;
    this.VisToggle
      .attr('src', SA.ImagePathUrl + 'eyeClosed32.png');
    this.Layer.SetVisibility(false);

    // Editing annots must be visible.
    this.EditOff();
    // Record the visibility of this annotation in local storage.
    this.LayerPanel.SaveVisibilityInLocalStorage();
  };

  // There are two modes for name editing.  This is the inner mode.
  // When the mouse if over the button, make the div content editable.
  AnnotationLayerGui.prototype.EditNameOn = function () {
    var self = this;
    this.EditOn();

    // Get rid of the events blocking viewer interaction
    // but also blocking content editable.
    this.Viewer.InteractionOff();
    this.NameButton.off();
    this.NameButton.attr('tabindex', '1');
    // Sometimes the leave even does not fire, and the viewer appears non functional
    this.LayerPanel.Div.on('mousedown.namebutton', function () { self.EditNameOff(); });
    this.LayerPanel.Div.on('mouseleave.namebutton', function () { self.EditNameOff(); });
    this.Viewer.GetDiv().on('mousedown.namebutton', function () { self.EditNameOff(); });

    this.NameButton
      .attr('contentEditable', true);
    this.NameButton.focus();
  };

  AnnotationLayerGui.prototype.EditNameOff = function () {
    // console.log('edit name off');

    var self = this;
    // Did the name change?
    var name = this.NameButton.text();
    if (name !== this.Name) {
      // Yes,  schedule the change to be saved on the server.
      this.Name = name;
      this.AnnotationModified();
    }

    this.Viewer.InteractionOn();

    this.LayerPanel.Div.off('mousedown.namebutton');
    this.LayerPanel.Div.off('mouseleave.namebutton');
    this.Viewer.GetDiv().off('mousedown.namebutton');

    this.NameButton
      .attr('contentEditable', false)
      .css({'cursor': 'pointer'})
      .on('click touchstart', function () {
        self.AfterLoad(function () { self.EditNameOn(); });
        return false;
      });

    // Turn viewer event blocking on again.
    this.NameButton.on('mousedown mousemove mouseup touchstart touchend',
                       function () { return false; });

    if (this.Name !== this.LayerPanel.GetDefaultLayerName()) {
      this.LayerPanel.InitializeDefaultToolPanel();
    }
  };

  // This call back pattern is all because we load on demand.
  // Call a method after an annotation is loaded.
  AnnotationLayerGui.prototype.AfterLoad = function (callback) {
    // guest annotation
    if (this.GirderAnnotId === undefined) {
      (callback)();
      return;
    }
    if (this.Data) {
      (callback)();
    } else {
      // We need to load the annotation first.
      var self = this;
      $('body').css({'cursor': 'wait'});
      girder.rest.restRequest({
        url: 'annotation/' + this.GirderAnnotId,
        method: 'GET',
        contentType: 'application/json'
      }).done(function (data) {
        $('body').css({'cursor': ''});
        self.Data = data;
        (callback)();
      });
    }
  };

  // Call back from deleteButton.
  AnnotationLayerGui.prototype.DeleteCallback = function () {
    if (!this.LayerPanel.EditingLayerGui) {
      return;
    }
    this.Delete();
  };

  AnnotationLayerGui.prototype.Delete = function () {
    if (!this.LayerPanel.EditingLayerGui.Layer.IsSelected()) {
      if (!confirm('Do you want to delete the entire annotation group?' + this.Name)) {
        return;
      }
      if (this.SaveTimerId) {
        clearTimeout(this.SaveTimerId);
        this.SaveTimerId = undefined;
      }
      // Visibility and editing off.
      this.VisibilityOff();

      if (!this.GirderAnnotId) {
        // Not Saved yet.
        this.DeleteAnnotationGui();
        return;
      }

      // Delete it from the database before deleting the GUI.
      var self = this;
      girder.rest.restRequest({
        url: 'annotation/' + this.GirderAnnotId,
        method: 'DELETE',
        contentType: 'application/json'
      }).done(function (ret) {
        self.DeleteAnnotationGui();
      });
    }
  };

  AnnotationLayerGui.prototype.DeleteAnnotationGui = function () {
    // Break these links which will allow the default tool panel to
    // create another layerGUi if it is used.
    if (this.ToolPanel) {
      this.ToolPanel.SetLayerGui(undefined);
      this.ToolPanel = undefined;
    }
    // Visibility and editing off.
    this.VisibilityOff();
    // Remove the buttons
    this.Div.remove();
    // Take it out of the annotation panel.
    var idx = this.LayerPanel.LayerGuis.indexOf(this);
    this.LayerPanel.LayerGuis.splice(idx, 1);
  };

  // TODO: Load annotations into a 'group'.  Manage separate groups.
  // Move the annotation info to the layer widgets and draw.
  AnnotationLayerGui.prototype.DisplayAnnotation = function () {
    // If there is no layer, we have to create one
    if (!this.Layer) {
      var layer = this.MakeAnnotationLayer(this.Viewer);
      layer.Reset();

      // Put all the rectangles into one set.
      var setObj = {};
      setObj.type = 'rect_set';
      setObj.centers = [];
      setObj.widths = [];
      setObj.heights = [];
      setObj.confidences = [];
      setObj.labels = [];

      if (!this.Data) {
        return;
      }

      var annot = this.Data.annotation;
      for (var i = 0; i < annot.elements.length; ++i) {
        var element = annot.elements[i];
        var obj = {};

        if (element.type === 'view') {
          // Set the camera / view.
          var cam = this.Layer.GetCamera();
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
          if (this.Layer.Viewer) {
            this.Layer.Viewer.EventuallyRender();
          }
        }
        if (element.type === 'circle') {
          this.Layer.LoadWidget(element);
        }
        if (element.type === 'rect') {
          this.Layer.LoadWidget(element);
        }
        if (element.type === 'arrow') {
          if (element.label) {
            obj.type = 'text';
            obj.string = element.label.value;
            obj.color = SAM.ConvertColor(element.fillColor);
            obj.size = element.label.fontSize;
            obj.position = element.points[0].slice(0);
            obj.offset = element.points[1].slice(0);
            obj.offset[0] -= obj.position[0];
            obj.offset[1] -= obj.position[1];
            obj.visibility = element.points[0][2];
            this.Layer.LoadWidget(obj);
          } else {
            obj.type = 'arrow';
            obj.origin = element.points[0].slice(0);
            obj.fillColor = element.fillColor;
            obj.lineColor = element.lineColor;
            var dx = element.points[1][0] - element.points[0][0];
            var dy = element.points[1][1] - element.points[0][1];
            var length = Math.sqrt((dx * dx) + (dy * dy));
            obj.length = length;
            // The upper left origin causes orientation to be negative.
            obj.orientation = -Math.atan2(dy / length, dx / length) * 180 / Math.PI;
            if (element.lineWidth !== undefined) {
              obj.width = element.lineWidth;
            } else {
              obj.width = 10;
            }
            obj.fixedsize = 'false';
            obj.fixedorientation = 'false';
            this.Layer.LoadWidget(obj);
          }
        }
        if (element.type === 'rectanglegrid') {
          obj.type = 'grid';
          obj.lineColor = SAM.ConvertColor(element.lineColor);
          obj.lineWidth = element.lineWidth;
          obj.origin = element.center;
          obj.bin_width = element.width / element.widthSubdivisions;
          obj.bin_height = element.height / element.heightSubdivisions;
          obj.orientation = element.rotation;
          obj.dimensions = [element.widthSubdivisions, element.heightSubdivisions];
          this.Layer.LoadWidget(obj);
        }
        if (element.type === 'rectangle') {
          // Switch to rect set versus individual rects. if false
          var keepRectSets = false;
          if (keepRectSets && element.type === 'rectangle') { // switch behavior to ....
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
            this.Layer.LoadWidget(element);
          }
        }
        if (element.type === 'polyline') {
          // Make a pencil instead.
          obj.type = 'pencil';
          obj.lineColor = SAM.ConvertColor(element.lineColor);
          obj.lineWidth = element.lineWidth;
          obj.shapes = [element.points];
          obj.closedFlags = [element.closed];
          this.Layer.LoadWidget(obj);
        }
      }

      if (setObj.widths.length > 0) {
        this.Layer.LoadWidget(setObj);
      }
    }

    this.Layer.SetVisibility(true);
    this.Layer.EventuallyDraw();
  };

  // Records and saves an annotation. Will create a new one if this obj has no id.
  AnnotationLayerGui.prototype.RecordAndSave = function () {
    var self = this;
    if (this.SaveTimerId) {
      clearTimeout(self.SaveTimerId);
      self.SaveTimerId = undefined;
    }

    // console.log('Save annotation');
    if (!this.Data) {
      this.Data = {annotation: {elements: []}};
    }
    // Read markup and put into data object.
    this.Data.annotation.elements = this.RecordAnnotation();
    this.Data.annotation.name = this.Name;

    // Change the color of the edit toggle to yellow, to show we are saving.
    this.EditToggle.css({'background-color': '#FF5'});

    if (!this.GirderAnnotId) {
      if (this.Layer.IsEmpty()) {
        // Do not save a new annotation if it is empty.
        this.AnnotationSaved();
        return;
      }
      // A new annotation
      girder.rest.restRequest({
        url: 'annotation?itemId=' + this.LayerPanel.ItemId,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(this.Data.annotation)
      }).done(function (retAnnot) {
        // Saving has finished.
        // This has the girder id.
        self.GirderAnnotId = self.Data._id = retAnnot._id;
        self.AnnotationSaved();
      });
    } else {
      // Save a modified annotation.
      girder.rest.restRequest({
        url: 'annotation/' + this.GirderAnnotId,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(this.Data.annotation)
      }).done(function (retAnnot) {
        // This has the girder id.
        self.AnnotationSaved();
      });
    }
  };

  // Called when the annotation is saved successfully..
  AnnotationLayerGui.prototype.AnnotationSaved = function () {
    if (this.Modified) {
      this.LayerPanel.ModifiedCount -= 1; // ???
    }
    this.Modified = false;
    this.Div.css({'border': '1px solid #666'});
    this.EditToggle.css({'background-color': '#FFF'});
    if (this.LayerPanel.ModifiedCount === 0) {
      window.onbeforeunload = undefined;
    }
  };

  // Converts annotation layer widgets into girder annotation elements.
  // returns an elements array.
  AnnotationLayerGui.prototype.RecordAnnotation = function () {
    var returnElements = [];
    var i;
    var j;
    var k;
    var points;

    // record the view.
    var element;
    for (i = 0; i < this.Layer.GetNumberOfWidgets(); ++i) {
      if (!this.Layer.GetWidget(i).Serialize) {
        continue;
      }
      var widget = this.Layer.GetWidget(i).Serialize();
      if (widget.type === 'circle') {
        element = widget;
      }
      if (widget.type === 'rectangle') {
        element = widget;
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
      if (widget.type === 'arrow') {
        // Will not keep scale feature..
        var pt1 = [widget.origin[0], widget.origin[1], 0];
        var pt2 = [widget.origin[0], widget.origin[1], 0];
        var theta = -widget.orientation * Math.PI / 180.0;
        pt2[0] += widget.length * Math.cos(theta);
        pt2[1] += widget.length * Math.sin(theta);
        points = [pt1, pt2];
        element = {
          'type': 'arrow',
          // 'lineWidth': widget.lineWidth,
          'lineColor': widget.lineColor,
          'fillColor': widget.fillColor,
          'points': points};
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
          'heightSubdivisions': widget.dimensions[1],
          'lineWidth': widget.lineWidth,
          'lineColor': widget.lineColor};
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
        element = {
          'type': 'polyline',
          'closed': widget.closedloop,
          'lineWidth': widget.lineWidth,
          'lineColor': widget.lineColor,
          'points': widget.points};
      }
      if (widget.type === 'lasso') {
        element = {
          'type': 'polyline',
          'closed': true,
          'lineWidth': widget.lineWidth,
          'lineColor': widget.lineColor,
          'points': widget.points};
      }
      // Pencil scheme not exact match.  Need to split up polylines.
      if (widget.type === 'pencil') {
        for (k = 0; k < widget.shapes.length; ++k) {
          points = widget.shapes[k];
          element = {
            'type': 'polyline',
            'closed': widget.closedFlags[k],
            'points': points};
          // Hackish way to deal with multiple lines.
          if (widget.lineColor !== undefined) {
            element.lineColor = widget.lineColor;
          }
          if (widget.lineWidth !== undefined) {
            element.lineWidth = Math.round(widget.lineWidth);
          }
          returnElements.push(element);
          element = undefined;
        }
      } else if (element) {
        returnElements.push(element);
        element = undefined;
      }
    }
    return returnElements;
  };

  AnnotationLayerGui.prototype.UpdateToolVisibility = function () {
    if (this.ToolPanel) {
      this.ToolPanel.UpdateToolVisibility();
    }
  };

  // Rectangle select is only active on the editing layer.
  // Only widgets from one layer can be selected.
  // Called by the SelectedDeleteButton click event (or delete key).
  // Returns true if a widget was deleted.
  AnnotationLayerGui.prototype.DeleteSelected = function () {
    if (this.Layer.IsEmpty()) {
      this.Delete();
      return;
    }
    if (this.Layer.DeleteSelected()) {
      this.AnnotationModified();
      if (this.Layer.IsEmpty()) {
        this.Delete();
        return;
      }
    }
    this.SelectedWidgets = [];
    // TODO: Clean this up.
    var toolPanel = this.GetToolPanel();
    toolPanel.ToolRadioButtonCallback(toolPanel.CursorButton);
    this.UpdateToolVisibility();
    this.Layer.EventuallyDraw();
  };

  // If only one widget is selected, we make it active (and show the properties button.
  // You can call this with selectedWidget = undefined to unset it.
  // "selectedLayerGui" is the one that contains the widget.
  AnnotationLayerGui.prototype.SetSelectedWidgets = function (selectedWidgets) {
    // Unselect previous selected widgets.
    // I do not think this is necessary.  The picking process should do this.
    // for (var i = 0; i < this.SelectedWidgets.length; ++i) {
    //   var widget = this.SelectedWidgets[i];
    //   widget.SetActive(false);
    // }
    this.SelectedWidgets = [];

    var tools;
    // No widget: Go back to the cursor mode.
    if (!selectedWidgets || selectedWidgets.length === 0) {
      // Nothing was selected.
      // Change the state back to cursor.
      // TODO: Clean this API up.
      tools = this.GetToolPanel();
      tools.HighlightRadioToolButton(tools.CursorButton);
      // See if we can move this to CursorOn
      this.Viewer.EventuallyRender();
      tools.UpdateToolVisibility();
      return true;
    }

    this.EditOn();
    // Hack so I do not need to deal with multiple selection right now.
    var selectedWidget = selectedWidgets[0];

    // TODO: Try to get rid of this case statement.
    // TODO: Move this into ToolPanel
    // Change the tool radio to reflect the widget choosen.
    tools = this.GetToolPanel();
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
      selectedWidget.SetStateToDrawing(this.Layer);
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
    this.SelectedWidgets = selectedWidgets;
    tools.UpdateToolVisibility();
  };

  SAM.AnnotationLayerGui = AnnotationLayerGui;
})();
