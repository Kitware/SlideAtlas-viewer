// GUI to navigate a stack and manager views.
// I will try to keep loading to "on demand" as much as possible.
// Add bounds to the stack section
// Add a transform to each section.
// Load stack from json file.

(function () {
  'use strict';

  function GirderStackWidget (parent, display, apiRoot) {
    this.SectionIndex = -1;
    // Stuff needs to be initialized on the first render.
    this.First = true;
    this.ApiRoot = apiRoot;
    this.Stack = [];
    // Share caches.  Multiple section can be on a single slide.
    this.Caches = {};
    this.Display = display;

    var self = this;
    this.SliderDiv = $('<div>')
      .appendTo(parent)
      .css({//'background-color': '#fff',
            //'opacity': '0.2',
            'position': 'absolute',
            'left': '0px',
            'bottom': '0px',
            'width': '100%',
            'z-index': '10'})
      .on('keyup', function(e) { self.HandleKeyUp(e);})
      .hover(
        function () {
          self.SliderDiv.focus();
          //self.SliderDiv.css({'opacity': '1'});
        },
        function () {
          self.SliderDiv.blur();
          //self.SliderDiv.css({'opacity': '0.2'});
        })
      .slider({
        start: function (e, ui) { self.StartCallback(ui.value); },
        slide: function (e, ui) { self.SlideCallback(ui.value); },
        stop: function (e, ui) { self.StopCallback(ui.value); }
      });

    this.SlideLabel = $('<div>')
      .appendTo(this.SliderDiv)
      .css({'position': 'absolute',
            'top': '-25px',
            'text-align': 'center',
            'color': '#ddf',
            'text-shadow': '2px 2px #000'})
      .hide();
  };

  GirderStackWidget.prototype.StartCallback = function (value) {
    this.SlideLabel.text(this.SectionIndex.toString());
    var x = 100 * value/ (this.Stack.length-1);
    this.SlideLabel.css({'left': x+'%'});
    this.SlideLabel.show();
  };

  GirderStackWidget.prototype.SlideCallback = function (value) {
    // TODO: Display the thumbnail (instead of the whold slide).
    // Does rending the whole image while sliding  cause too many tiles
    // requests?
    this.SetSectionIndex(value);
    var x = 100 * value/ (this.Stack.length-1); 
    this.SlideLabel.text(value.toString());
    this.SlideLabel.css({'left': x+'%'});
  };

  GirderStackWidget.prototype.StopCallback = function (value) {
    this.SetSectionIndex(value);
    this.SlideLabel.text(value.toString());
    this.SlideLabel.hide();
  };

  GirderStackWidget.prototype.HandleKeyUp = function (e) {
    if( e.keyCode == 33) {
      // page up
      this.Previous();
      return false;
    } else if (e.keyCode == 34) {
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
    this.Caches = {};
    // This just gets the number of items.
    // All we need to start is the number of images in the folder.
    // However, the folder may contain non image items (like this stack).
    this.ErrorCount = 0;
    if (window.girder) { 
      girder.rest.restRequest({
        path: ('folder/'+folderId+'/details'),
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

  //============================================================================
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
      path: 'item?folderId='+folderId+'&limit='+limit
        +'&offset='+offset+'&sort=lowerName&sortdir=1',
      method: 'GET',
      contentType: 'application/json',
      error: function (error, status) {
        self.ErrorCount += 1;
        if (self.ErrorCount < 100) {
          console.error(error.status + ' ' + error.statusText, error.responseText);
          // try again:
          self.LoadFolderImageIds(folderId,offset,limit,length);
        } else {
          console.log("Too many errors loading folder");
        }
      }
    }).done(function (resp) {
      for (var j = 0; j < resp.length; ++j) {
        if (resp[j].largeImage) {
          var section = {imageId: resp[j]._id};
          self.Stack.push(section);
        }
      }
      // Serialize the bites.
      self.LoadFolderImageIds(folderId,offset+limit,limit,length);
    });
  };


  GirderStackWidget.prototype.GetCache = function (imageId) {
    var cache = this.Caches[imageId];
    if (! cache) {
      var cache = new SA.Cache();
      this.Caches[imageId] = cache;
    }
    return cache;
  };

  // Does everything necessary to load the section into the viewer.
  GirderStackWidget.prototype.SetSectionIndex = function (index) {
    var self = this;
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
    var section = this.Stack[index];
    var cache = this.GetCache(section.imageId);
    // The image loader will render if it belongs to the current.
    if ( cache.Image) {
      this.RenderSection(section);
    }
  };

  // The section images must be loaded before this call.
  GirderStackWidget.prototype.RenderSection = function(section) {
    // Here display is just a viewer.
    // We can only initialize the slide when all the image ids are loaded
    // and we now the length of the stack.  This will change with multiple
    // sections per image.
    if (this.First) {
      delete this.First;
      this.SliderDiv.slider( "option", "max", this.Stack.length-1 );
      // Only reset the camer on the first render.
      this.Display.SetCamera([(section.bounds[0]+section.bounds[1])/2,
                              (section.bounds[2]+section.bounds[3])/2],
                             0, (section.bounds[3]-section.bounds[2]));
    }
    this.Display.SetCache(this.GetCache(section.imageId));
    this.Display.EventuallyRender();
  };


  GirderStackWidget.prototype.SectionLoaded = function (section) {
    var cache = this.GetCache(section.imageId);
    // The cache has an image iVar after it has been loaded.
    return cache.Image;
  }

  //============================================================================
  // Load minimal meta data for every section.  Throttle and Prioritize.
  // It would be silly to make a general purpose queue when we know all the
  // images that have to be loaded.  Just load them serially but compute a
  // priority based on the current image index.
  // Assume the stack is static.
  GirderStackWidget.prototype.LoadStackMetaData = function () {
    if (this.Errorcount > 100) {
      console.error("Too many errors loading item tile info.");
      return;
    }
    if (this.Stack.length == 0) {
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
      var idx = startIdx+radius;
      if (idx >= 0 && idx < this.Stack.length) {
        var foundSection = this.Stack[idx];
        if (this.SectionLoaded(foundSection)) {
          // already loaded
          foundSection = undefined;
        }
      }
      // Look backward
      var idx = startIdx-radius;
      if (! foundSection && idx >= 0 && idx < this.Stack.length) {
        var foundSection = this.Stack[idx];
        if (this.SectionLoaded(foundSection)) {
          // already loaded
          foundSection = undefined;
        }
      }
      ++radius;
    }

    if (foundSection) {
      // Recursively call this method to throttle requests.
      this.LoadSectionMetaData(foundSection, function() {self.LoadStackMetaData();});
    }
  };

  GirderStackWidget.prototype.LoadSectionMetaData = function (section, callback) {
    var self = this;

    girder.rest.restRequest({
      path: 'item/'+section.imageId+'/tiles',
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
      var cache = self.GetCache(section.imageId);
      if (!cache.Image) {
        var w = resp.sizeX;
        var h = resp.sizeY;
        var tileSize = resp.tileWidth;
        var levels = resp.levels;
        var tileSource = {
          height: h,
          width: w,
          tileSize: tileSize,
          minLevel: 0,
          maxLevel: levels - 1,
          getTileUrl: function (level, x, y, z) {
            return self.ApiRoot + '/item/' + section.imageId
              + '/tiles/zxy/' + level + '/' + x + '/' + y;
          }
        };
        // For now each section is its own image.  In the future multiple
        // sections can be in a single image and we will need to set the
        // bounds to be a region.
        section.bounds = [0,w-1,0,h-1];
        cache.SetTileSource(tileSource);
        // Get the lowest resolution tile.
        cache.LoadRoots();
        // If this is the current section, render it.
        if (self.SectionIndex != -1) {
          var currentSection = self.Stack[self.SectionIndex];
          if (section.imageId === currentSection.imageId) {
            self.RenderSection(currentSection);
          }
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
