// GUI to navigate a stack and manager views.
// I will try to keep loading to "on demand" as much as possible.
// Put a section transform in the camera.
// Connect section bounds to camera section transform.
// Restrict viewer to bounds of section.
// Startup in the middle of the first bounds.

// NOTE: Three different sections. 
//   metaSection: loaded from the girder item metadata.
//   stackSection: object internal to this class.
//   saSection: Object slide atlas uses to manage sections.
// TODO: Merge these in the future if possible.

(function () {
  'use strict';

  function GirderStackWidget (parent, display, apiRoot) {
    this.SectionIndex = -1;
    // Stuff needs to be initialized on the first render.
    this.First = true;
    this.ApiRoot = apiRoot;
    // List of stackSections
    this.Stack = [];
    // dictionary to share caches when multiple sections on one slide
    this.Caches = {};
    this.Display = display;

    var self = this;
    this.SliderDiv = $('<div>')
      .appendTo(parent)
      .css({
        // 'background-color': '#fff',
        // 'opacity': '0.2',
        'position': 'absolute',
        'left': '0px',
        'bottom': '0px',
        'width': '100%',
        'z-index': '10'})
      .on('keyup', function (e) { self.HandleKeyUp(e); })
      .hover(
        function () {
          self.SliderDiv.focus();
          // self.SliderDiv.css({'opacity': '1'});
        },
        function () {
          self.SliderDiv.blur();
          // self.SliderDiv.css({'opacity': '0.2'});
        })
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
    if (e.keyCode === 33) {
      // page up
      this.Previous();
      return false;
    } else if (e.keyCode === 34) {
      // page down
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
    this.SectionMap = {};
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
              stackSection = {imageId: item._id, loaded: false};
              if (metaSection.bounds) {
                stackSection.bounds = metaSection.bounds;
              }
              if (metaSection.center) {
                stackSection.center = metaSection.center;
              }
              self.Stack.push(stackSection);
            }
          } else {
            // Just add a single section (the whole slide)
            stackSection = {imageId: resp[j]._id, loaded: false};
            self.Stack.push(stackSection);
          }
        }
      }
      // Serialize the bites.
      self.LoadFolderImageIds(folderId, offset + limit, limit, length);
    });
  };

  // Method to help share caches.
  // TODO: Merge this with the method in cache.js to do the same.
  GirderStackWidget.prototype.GetCache = function (imageId) {
    var cache = this.Caches[imageId];
    if (!cache) {
      cache = new SA.Cache();
      this.Caches[imageId] = cache;
    }
    return cache;
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
    this.SectionIndex = index;
    this.RenderSection(this.Stack[index]);
  };

  // The section images must be loaded before this call.
  GirderStackWidget.prototype.RenderSection = function (stackSection) {
    if (stackSection.SaSection === undefined) {
      // The load call back will render if the section is current.
      return;
    }
    // Here display is just a viewer.
    // We can only initialize the slide when all the image ids are loaded
    // and we know the length of the stack.  This will change with multiple
    // sections per image.
    if (this.First) {
      delete this.First;
      this.SliderDiv.slider('option', 'max', this.Stack.length - 1);
      // Only reset the camere on the first render.
      this.Display.SetCamera(
        [(stackSection.bounds[0] + stackSection.bounds[2]) / 2,
          (stackSection.bounds[1] + stackSection.bounds[3]) / 2],
        0, (stackSection.bounds[3] - stackSection.bounds[1]));
    }
    // Let the SlideAtlas sections deal with the transformations
    this.Display.SetSection(stackSection.SaSection);
    this.Display.EventuallyRender();
  };

  GirderStackWidget.prototype.SectionLoaded = function (section) {
    var cache = this.GetCache(section.imageId);
    // The cache has an image iVar after it has been loaded.
    return cache.Image;
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
    // Multi0le section can have the same image id.
    var foundSection = this.Stack[startIdx];
    if (this.SectionLoaded(foundSection)) {
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
        if (this.SectionLoaded(foundSection)) {
          // already loaded
          foundSection = undefined;
        }
      }
      // Look backward
      idx = startIdx - radius;
      if (!foundSection && idx >= 0 && idx < this.Stack.length) {
        foundSection = this.Stack[idx];
        if (this.SectionLoaded(foundSection)) {
          // already loaded
          foundSection = undefined;
        }
      }
      ++radius;
    }

    if (foundSection) {
      // Recursively call this method to throttle requests.
      this.LoadSectionMetaData(foundSection,
                               function () { self.LoadStackMetaData(); });
    }
  };

  GirderStackWidget.prototype.LoadSectionMetaData = function (stackSection, callback) {
    var self = this;

    girder.rest.restRequest({
      path: 'item/' + stackSection.imageId + '/tiles',
      method: 'GET',
      contentType: 'application/json',
      error: function (error, status) {
        console.error(error.status + ' ' + error.statusText, error.responseText);
        this.ErrorCount += 1;
        if (callback) {
          (callback())();
        }
      }
    }).done(function (resp) {
      var w = resp.sizeX;
      var h = resp.sizeY;
      var tileSize = resp.tileWidth;
      var levels = resp.levels;
      // There can be multiple sections on a single slide.
      // Each needs its own region.
      // Set a default bounds to the whole slide.
      if (stackSection.bounds === undefined) {
        stackSection.bounds = [0, w - 1, 0, h - 1];
      }
      // Set a default center to the middle of the bounds.
      if (stackSection.center === undefined) {
        var bds = stackSection.bounds;
        stackSection.center = [(bds[0] + bds[2]) * 0.5,
                          (bds[1] + bds[3]) * 0.5];
      }
      // Get / setup the cache.
      var cache = self.GetCache(stackSection.imageId);
      if (cache.Image === undefined) {
        var tileSource = {
          height: h,
          width: w,
          tileSize: tileSize,
          minLevel: 0,
          maxLevel: levels - 1,
          getTileUrl: function (level, x, y, z) {
            return self.ApiRoot + '/item/' + stackSection.imageId +
              '/tiles/zxy/' + level + '/' + x + '/' + y;
          }
        };
        cache.SetTileSource(tileSource);
        // Request the lowest resolution tile from girder.
        cache.LoadRoots();
      }
      // Setup the slideAtlas section
      var saSection = new SA.Section();
      saSection.AddCache(cache);
      stackSection.SaSection = saSection;

      // If this is the current stackSection, render it.
      if (self.SectionIndex !== -1) {
        var currentSection = self.Stack[self.SectionIndex];
        if (stackSection.imageId === currentSection.imageId) {
          self.RenderSection(currentSection);
        }
      }

      // This serializes the requests. Starts loading the next after the
      // current is finished.
      if (callback) {
        (callback)();
      }
    });
  };

  SAM.GirderStackWidget = GirderStackWidget;
})();
