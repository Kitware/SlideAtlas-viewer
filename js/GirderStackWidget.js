// GUI to navigate a stack and manager views.
// I will try to keep loading to "on demand" as much as possible.
// Put a section transform in the camera.
// Connect section bounds to camera section transform.
// Restrict viewer to bounds of section.
// Startup in the middle of the first bounds.

// TODO: If we can, delay creating the saSection until the cache root is loaded.

// TODO: Make sure that the annotation (stored in slide coordiantes) get
// transformed to section coordinates before they are rendered.

// NOTE: Three different sections.

//   metaSection: loaded from the girder item metadata.
//   stackSection: object internal to this class.
//   saSection: Object slide atlas uses to manage sections.
// TODO: Merge these in the future if possible.

// Loading is a bit confusing (due to load on demand requirements):
// Initialize (block / serialized)
// 1: LoadFolder (called externally): Just gets the number of items in the folder.
// 2: LoadFolderImageIds (chunked recursively):
//      Gets the itemIds and meta data.  Creates the instance stack array.
//      Section objects have bounds an transform, imageId.
//      calls LoadStackMetaData to asynchronously load other item info.
// Initialize (non blocking/ asynchonous, throttled)
// 1: LoadStackMetaData:
//      Choose a (high priority) section that needs metadata loaded.
//      Call CreateSaSection to load the metadata
//      (with a recursive callback to LoadStackMetaData)
// 2: CreateSaSection: Loads the image tile meta data if necesary.
//      No: Just call CreateSaSectionFromCache
//      Yes: GirderRequest->LoadItem
// 3: LoadItem: .....

(function () {
    // Depends on the CIRCLE widget
  'use strict';

  function GirderStackWidget (parent, display, overlay, apiRoot) {
    // We need a common center to treat as the center for the stack.
    // This is used to compute the transforms from the section centers.
    this.VolumeCenter = undefined;

    this.SectionIndex = -1;
    // Stuff needs to be initialized on the first render.
    this.First = true;
    this.ApiRoot = apiRoot;
    // List of stackSections
    this.Stack = [];
    // dictionary to share caches when multiple sections on one slide
    this.Caches = {};
    this.Display = display;
    // Have the viewer call this objects event methods.
    display.AddLayer(this);
    // For debugging (place two section on top of each other to judge alignment.
    // this.Overlay = overlay;

    var self = this;
    // THese event bindings do not work.
    this.SliderDiv = $('<div>')
      .appendTo(parent)
      .css({
        // 'background-color': '#fff',
        // 'opacity': '0.2',
        'position': 'absolute',
        'left': '0px',
        'bottom': '5px',
        'width': '100%',
        'z-index': '1000'})
      .on('keyup', function (e) { self.HandleKeyUp(e); })
      .hover(
        function () {
          self.SliderDiv.focus();
          // self.SliderDiv.css({'opacity': '1'});
        },
        function () {
          self.SliderDiv.blur();
          // self.SliderDiv.css({'opacity': '0.2'});
        });
    this.SliderDiv
      .slider({
        start: function (e, ui) { self.StartCallback(ui.value); },
        slide: function (e, ui) { self.SlideCallback(ui.value); },
        stop: function (e, ui) { self.StopCallback(ui.value); }
      });

    this.SlideLabel = $('<div>')
      .appendTo(this.SliderDiv)
      .css({
        'position': 'absolute',
        'top': '-25px',
        'text-align': 'center',
        'color': '#ddf',
        'text-shadow': '2px 2px #000'})
      .hide();
  }

  GirderStackWidget.prototype.SetAnnotationName = function (name) {
    this.AnnotationName = name;
  };

  GirderStackWidget.prototype.StartCallback = function (value) {
    this.SlideLabel.text(this.SectionIndex.toString());
    var x = 100 * value / (this.Stack.length - 1);
    this.SlideLabel.css({'left': x + '%'});
    this.SlideLabel.show();
  };

  GirderStackWidget.prototype.SlideCallback = function (value) {
    // TODO: Display the thumbnail (instead of the whold slide).
    // Does rending the whole image while sliding  cause too many tiles
    // requests?
    this.SetSectionIndex(value);
    var x = 100 * value / (this.Stack.length - 1);
    this.SlideLabel.text(value.toString());
    this.SlideLabel.css({'left': x + '%'});
  };

  GirderStackWidget.prototype.StopCallback = function (value) {
    this.SetSectionIndex(value);
    this.SlideLabel.text(value.toString());
    this.SlideLabel.hide();
  };

  GirderStackWidget.prototype.HandleKeyUp = function (e) {
    if (e.keyCode === 33 || e.keyCode === 80) {
      // page up or p
      this.Previous();
      return false;
    } else if (e.keyCode === 34 || e.keyCode === 32 || e.keyCode === 78) {
      // page down, space or n
      this.Next();
      return false;
    }
    return true;
  };

  GirderStackWidget.prototype.Next = function () {
    this.SetSectionIndex(this.SectionIndex + 1);
  };

  GirderStackWidget.prototype.Previous = function () {
    this.SetSectionIndex(this.SectionIndex - 1);
  };

  // Load all the images in a folder as a stack.
  GirderStackWidget.prototype.LoadFolder = function (folderId) {
    var self = this;
    this.Stack = [];
    // This just gets the number of items.
    // All we need to start is the number of images in the folder.
    // However, the folder may contain non image items (like this stack).
    this.ErrorCount = 0;
    if (window.girder) {
      girder.rest.restRequest({
        path: ('folder/' + folderId + '/details'),
        method: 'GET',
        contentType: 'application/json'
      }).done(function (resp) {
        // Just serialize loading the item info
        var length = resp.nItems;
        var limit = 100;
        self.LoadFolderImageIds(folderId, 0, limit, length);
      });
    }
  };

  // ============================================================================
  // Load all the images in a folder as a stack.
  // All this does is get the ids of the images in the folder.
  // Image data is loaded on demand
  GirderStackWidget.prototype.LoadFolderImageIds = function (folderId,
                                                             offset, limit, length) {
    var self = this;
    if (offset >= length) {
      // We have received all the ImageIds in the stack
      if (this.Stack.length > 0) {
        this.SetSectionIndex(0);
        // Get meta data for all images in the stack.
        this.ErrorCount = 0;
        this.LoadStackMetaData();
      }
      return;
    }

    // Get the next bite.
    girder.rest.restRequest({
      path: 'item?folderId=' + folderId + '&limit=' + limit +
        '&offset=' + offset + '&sort=lowerName&sortdir=1',
      method: 'GET',
      contentType: 'application/json',
      error: function (error, status) {
        self.ErrorCount += 1;
        if (self.ErrorCount < 100) {
          console.error(error.status + ' ' + error.statusText, error.responseText);
          // try again:
          self.LoadFolderImageIds(folderId, offset, limit, length);
        } else {
          console.log('Too many errors loading folder');
        }
      }
    }).done(function (resp) {
      for (var j = 0; j < resp.length; ++j) {
        var item = resp[j];
        var stackSection;
        // TODO: Handle small images too.
        if (item.largeImage) {
          if (item.meta && item.meta.sections) {
            // Add all the sections listed in the meta data.
            var metaSections = item.meta.sections;
            for (var sIdx = 0; sIdx < metaSections.length; ++sIdx) {
              var metaSection = metaSections[sIdx];
              stackSection = {imageId: item._id};
              if (metaSection.trans) {
                stackSection.transform = metaSection.trans;
              }
              if (metaSection.bounds) {
                // These bounds are in image coordinate ssytem.
                stackSection.bounds = [
                  metaSection.bounds[0],
                  metaSection.bounds[2],
                  metaSection.bounds[1],
                  metaSection.bounds[3]];
              }
              self.Stack.push(stackSection);
            }
          } else {
            // Just add a single section (the whole slide)
            stackSection = {imageId: resp[j]._id};
            self.Stack.push(stackSection);
          }
        }
      }
      // Serialize the bites.
      self.LoadFolderImageIds(folderId, offset + limit, limit, length);
    });
  };

  // Load section meta-data from the stack item.
  // This is a second path that allows editing of the sequence.
  GirderStackWidget.prototype.LoadSections = function (sectionData) {
    var self = this;
    this.Stack = [];

    if (sectionData.length > 0) {
      this.SetSectionIndex(0);
    }

    for (var idx = 0; idx < sectionData.length; ++idx) {
      var metaSection = sectionData[idx];
      var stackSection = {imageId: metaSection.itemId};
      if (metaSection.trans) {
        stackSection.transform = metaSection.trans;
      }
      if (metaSection.bounds) {
        // These bounds are in image coordinate ssytem.
        stackSection.bounds = [
          metaSection.bounds[0],
          metaSection.bounds[2],
          metaSection.bounds[1],
          metaSection.bounds[3]];
      }
      self.Stack.push(stackSection);
    }
    this.LoadStackMetaData();
  };

  // Does everything necessary to load the section into the viewer.
  // Does nothing if the section is not loaded from the datbase yet.
  GirderStackWidget.prototype.SetSectionIndex = function (index) {
    if (index >= this.Stack.length) {
      index = this.Stack.length - 1;
    }
    if (index < 0) {
      return;
    }
    if (this.SectionIndex === index) {
      return;
    }
    console.log('stack index ' + index.toString());
    this.SectionIndex = index;
    // Tell annotation what time to display.
    var num = this.Display.GetNumberOfLayers();
    for (var i = 0; i < num; ++i) {
      var layer = this.Display.GetLayer(i);
      if (layer && layer.SetTime) {
        layer.SetTime(index);
      }
    }

    this.RenderSection(this.Stack[index]);
  };

  // The section images must be loaded before this call.
  GirderStackWidget.prototype.RenderSection = function (stackSection) {
    if (stackSection.SaSection === undefined) {
      return;
    }

    var cache = this.Caches[stackSection.imageId];
    if (cache === undefined || !cache.RootsLoaded) {
      // The load callback will render if the section is current.
      return;
    }
    // Here display is just a viewer.
    // We can only initialize the slide when all the image ids are loaded
    // and we know the length of the stack.  This will change with multiple
    // sections per image.
    if (this.First) {
      delete this.First;
      this.SliderDiv.slider('option', 'max', this.Stack.length - 1);
      // Only reset the camera on the first render.
      this.Display.SetCamera([
        (stackSection.bounds[0] + stackSection.bounds[1]) / 2,
        (stackSection.bounds[2] + stackSection.bounds[3]) / 2],
                             0, (stackSection.bounds[3] - stackSection.bounds[2]));
    }
    // Let the SlideAtlas sections deal with the transformations
    this.Display.SetSection(stackSection.SaSection);
    if (cache.Annotation) {
      var annotLayer = this.Display.GetAnnotationLayer();
      DisplayAnnotation(annotLayer, cache.Annotation);
    }
    this.Display.EventuallyRender();

    // get the next section for the overlay
    if (this.Overlay) {
      var idx = this.Stack.indexOf(stackSection);
      if (idx !== -1 && idx < this.Stack.length - 1) {
        var nextSection = this.Stack[idx + 1];
        cache = this.Caches[nextSection.imageId];
        if (cache === undefined || !cache.RootsLoaded) {
          return;
        }
        this.Overlay.SetSection(nextSection.SaSection);
      }
      this.Overlay.DrawTiles();
    }
  };

  // ============================================================================
  // Load minimal meta data for every section.  Throttle and Prioritize.
  // It would be silly to make a general purpose queue when we know all the
  // images that have to be loaded.  Just load them serially but compute a
  // priority based on the current image index.
  // Assume the stack is static.
  GirderStackWidget.prototype.LoadStackMetaData = function () {
    if (this.ErrorCount > 100) {
      console.error('Too many errors loading item tile info.');
      return;
    }
    if (this.Stack.length === 0) {
      return;
    }
    // Find the next highest priority image info to load.
    var self = this;
    // Find the highest priority section whose image has not been loaded.
    var startIdx = Math.max(this.SectionIndex, 0);
    // Multiple section can have the same image id.
    var foundSection = this.Stack[startIdx];
    if (foundSection.SaSection) {
      // already loaded
      foundSection = undefined;
    }

    var radius = 1;
    // Tolerate overshoot with startIdx+radius
    while (!foundSection && radius < this.Stack.length) {
      // Look forward.
      var idx = startIdx + radius;
      if (idx >= 0 && idx < this.Stack.length) {
        foundSection = this.Stack[idx];
        if (foundSection.SaSection) {
          // already loaded
          foundSection = undefined;
        }
      }
      // Look backward
      idx = startIdx - radius;
      if (!foundSection && idx >= 0 && idx < this.Stack.length) {
        foundSection = this.Stack[idx];
        if (foundSection.SaSection) {
          // already loaded
          foundSection = undefined;
        }
      }
      ++radius;
    }

    if (foundSection) {
      // Recursively call this method to throttle requests.
      this.CreateSaSection(foundSection,
                           function () { self.LoadStackMetaData(); });
    }
  };

  // This gets called to create the saSection.  It may need to make a cache
  // and get the image data from the server to do it.
  GirderStackWidget.prototype.CreateSaSection = function (stackSection, callback) {
    var cache = this.Caches[stackSection.imageId];
    if (cache) {
      // we have the cache already
      this.CreateSaSectionFromCache(stackSection, cache);
      if (callback) {
        (callback)();
      }
      return;
    }

    // We need to request image data from the server to setup the cache.
    var self = this;
    girder.rest.restRequest({
      path: 'item/' + stackSection.imageId + '/tiles',
      method: 'GET',
      contentType: 'application/json',
      error: function (error, status) {
        console.error(error.status + ' ' + error.statusText, error.responseText);
        this.ErrorCount += 1;
        if (callback) {
          (callback)();
        }
      }
    }).done(function (resp) {
      self.LoadItem(resp, stackSection, callback);
    });
  };

  // This is only called once per item.
  GirderStackWidget.prototype.LoadItem = function (resp, stackSection, callback) {
    var w = resp.sizeX;
    var h = resp.sizeY;

    // If the item did not have bounds meta data, set bounds to be the
    // whole slide.
    if (stackSection.bounds === undefined) {
      stackSection.bounds = [0, w - 1, 0, h - 1];
    }
    // Get / setup the cache.
    var cache = new SA.Cache();
    this.Caches[stackSection.imageId] = cache;
    var tileSource = new GirderTileSource(w, h, resp.tileWidth, resp.tileHeight,
                                          0, resp.levels - 1,
                                          this.ApiRoot,
                                          stackSection.imageId,
                                          [0, w - 1, 0, h - 1]);
    cache.SetTileSource(tileSource);
    // Setup the slideAtlas section
    var saSection = new SA.Section();
    saSection.AddCache(cache);
    stackSection.SaSection = saSection;

    cache.SetTileSource(tileSource);
    // Request the lowest resolution tile from girder.
    var self = this;
    cache.LoadRoots(
      function () {
        cache.RootsLoaded = true;
        // If the current section uses this cache. render it.
        if (self.SectionIndex !== -1) {
          var currentSection = self.Stack[self.SectionIndex];
          if (stackSection.imageId === currentSection.imageId) {
            self.RenderSection(currentSection);
          }
        }
      });
    this.CreateSaSectionFromCache(stackSection, cache);

    // Load annotation if necessary.
    // Associated it with the cache.
    // TODO: REnder when load if section is current.
    if (this.AnnotationName) {
      girder.rest.restRequest({
        path: 'annotation?itemId=' + stackSection.imageId + '&name=' + this.AnnotationName,
        method: 'GET',
        contentType: 'application/json',
        error: function (error, status) {
          console.error(error.status + ' ' + error.statusText, error.responseText);
        }
      }).done(function (resp) {
        if (resp.length > 0) {
          var annotId = resp[0]['_id'];
          girder.rest.restRequest({
            path: 'annotation/' + annotId,
            method: 'GET',
            contentType: 'application/json',
            error: function (error, status) {
              console.error(error.status + ' ' + error.statusText, error.responseText);
            }
          }).done(function (resp) {
            cache.Annotation = resp.annotation;
          });
        }
      });
    }

    // This serializes the requests. Starts loading the next after the
    // current is finished.
    if (callback) {
      (callback)();
    }
  };

  GirderStackWidget.prototype.CreateSaSectionFromCache = function (stackSection, cache) {
    // If the girder meta data did not set up the section defaults, do it
    // here. The center is the first pass at the transformation.
    var image = cache.GetImageData();
    if (stackSection.bounds === undefined) {
      stackSection.bounds = [0, image.dimensions[0] - 1, 0, image.dimensions[1] - 1];
    }
    var bds = stackSection.bounds;
    var center = [
      (bds[0] + bds[1]) * 0.5,
      (bds[2] + bds[3]) * 0.5];
    if (!this.VolumeCenter) {
      this.VolumeCenter = center;
    }
    // Set a default center to the middle of the bounds.
    if (stackSection.transform === undefined) {
      stackSection.transform = [
        1, 0, 0, 1,
        center[0] - this.VolumeCenter[0],
        center[1] - this.VolumeCenter[1]];
    }

    // Setup the slideAtlas section
    var saSection = new SA.Section();
    saSection.AddCache(cache);
    // First set the world to image transformation.
    saSection.SetTransform(stackSection.transform);

    // Now set the slide atla section bounds. They are best kept in world
    // coordinate system because they are used for interaction.
    // The stackSection bounds are in image coodindate system (for now).
    // TODO: fix this:  Since we only have translation, hack in the
    // conversion to world coordinate system.
    var tmp = SAM.InvertTransform(stackSection.transform);
    saSection.Bounds = SAM.TransformBounds(tmp, bds);

    stackSection.SaSection = saSection;
  };

  var GirderTileSource = function (width, height,
                                   tileWidth, tileHeight,
                                   minLevel, maxLevel,
                                   apiRoot, imageId,
                                   bounds) {
    this.height = height;
    this.width = width;
    this.TileWidth = tileWidth;
    this.TileHeight = tileHeight;
    this.apiRoot = apiRoot;
    this.imageId = imageId;
    this.bounds = bounds;
    this.maxLevel = maxLevel;
  };

  GirderTileSource.prototype.getTileUrl = function (level, x, y, z) {
    return this.apiRoot + '/item/' + this.imageId +
      '/tiles/zxy/' + level + '/' + x + '/' + y;
  };

  // TODO: Copied from girderWidget.  Share code!!!!!!!!!!!!!!!!
  // Move the annotation info to the layer widgets and draw.
  // Converts annotObj from girder to slideAtlas
  var DisplayAnnotation = function (annotLayer, girderAnnot) {
    annotLayer.SetVisibility(true);
    annotLayer.Reset();

    // Put all the rectangles into one set.
    var setObj = {};
    setObj.type = 'rect_set';
    setObj.centers = [];
    setObj.widths = [];
    setObj.heights = [];
    setObj.confidences = [];
    setObj.labels = [];

    var annot = girderAnnot;
    for (var i = 0; i < annot.elements.length; ++i) {
      var element = annot.elements[i];
      var obj = {};

      if (element.type === 'view') {
                // Set the camera / view.
        var cam = annotLayer.GetCamera();
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
        if (annotLayer.Viewer) {
          annotLayer.Viewer.EventuallyRender();
        }
      }
      if (element.type === 'circle') {
        obj.type = element.type;
        obj.lineColor = SAM.ConvertColor(element.lineColor);
        obj.lineWidth = element.lineWidth;
        obj.origin = element.center;
        obj.radius = element.radius;
        annotLayer.LoadWidget(obj);
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
        annotLayer.LoadWidget(obj);
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
        annotLayer.LoadWidget(obj);
      }
      if (element.type === 'rectangle') {
        if (element.type === 'rectangle') { // switch behavior to ....
          setObj.widths.push(element.width);
          setObj.heights.push(element.height);
          setObj.centers.push(element.center[0]);
          setObj.centers.push(element.center[1]);
          if (element.scalar === undefined) {
            element.scalar = 1.0;
          }
          setObj.confidences.push(element.scalar);
          if (element.vector === undefined) {
            element.vector = [0, 0, 0];
          }
          if (setObj.vectors === undefined) {
            setObj.vectors = [];
          }
          setObj.vectors.push(element.vector[0]);
          setObj.vectors.push(element.vector[1]);
          if (element.label) {
            setObj.labels.push(element.label.value);
          } else {
            setObj.labels.push('');
          }
        } else {
          obj.type = 'rect';
          obj.lineColor = SAM.ConvertColor(element.lineColor);
          obj.lineWidth = element.lineWidth;
          obj.origin = element.center;
          obj.width = element.width;
          obj.length = element.height;
          obj.orientation = element.rotation;
          annotLayer.LoadWidget(obj);
        }
      }
      if (element.type === 'polyline') {
        obj.type = element.type;
        obj.closedloop = element.closed;
        obj.lineColor = SAM.ConvertColor(element.lineColor);
        obj.lineWidth = element.lineWidth;
        obj.points = element.points;
        annotLayer.LoadWidget(obj);
      }
    }

    if (setObj.widths.length > 0) {
      annotLayer.LoadWidget(setObj);
    }

    annotLayer.EventuallyDraw();
  };

  SAM.GirderStackWidget = GirderStackWidget;
})();

// export { GirderStackWidget }
