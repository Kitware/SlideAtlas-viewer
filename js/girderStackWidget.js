// GUI to navigate a stack and manager views.
// First just get the stack as a girder folder.
// I will try to keep loading to "on demand" as much as possible.
// Navigate with keys to start.

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
    // All we need to start is the number of images in the folder.
    // However, the folder may contain non image items (like this stack).
    if (window.girder) { // Conditional is for testing in slide atlas.
      girder.rest.restRequest({
        path: ('folder/'+folderId+'/details'),
        method: 'GET',
        contentType: 'application/json'
      }).done(function (resp) {
        var length = resp.nItems;
        self.LoadFolderImages(folderId,length);
      });
    }
  };

  // Load all the images in a folder as a stack.
  // All this does is get the ids of the images in the folder.
  // Image data is loaded on demand
  GirderStackWidget.prototype.LoadFolderImages = function (folderId, length) {
    var self = this;
    this.Stack = [];
    this.Caches = {};
    var count = 0;
    for (var i = 0; i < length; i += 50) {
      girder.rest.restRequest({
        path: 'item?folderId='+folderId+'&limit=50&offset='+i+'&sort=lowerName&sortdir=1',
        method: 'GET',
        contentType: 'application/json',
      }).done(function (resp) {
        for (var j = 0; j < resp.length; ++j) {
          if (resp[j].largeImage) {
            var section = {_id: resp[j]._id};
            self.Stack.push(section);
          }
          ++count;
          if (count == length) {
            self.SetSectionIndex(0);
          }
        }
      });
    }
  };

  GirderStackWidget.prototype.GetCache = function (imageId) {
    var cache = this.Caches[imageId];
    if (! cache) {
      var cache = new SA.Cache();
      this.Caches[imageId] = cache;
    }
    return cache;
  };

  GirderStackWidget.prototype.RequestSectionData = function (section, callback) {
    var self = this;
    var cache = self.GetCache(section._id);
    // Already loaded?
    if (cache.Image) {
      if (callback) { (callback)(); }
      return;
    }
    // Already requested?
    // TODO: Is it a problem to request more than once.
    // If we return wen requested already, we have to make sure it we clear
    // the stated if the request never returns (or reutrns with error).
    girder.rest.restRequest({
      path: 'item/'+section._id+'/tiles',
      method: 'GET',
      contentType: 'application/json',
    }).done(function (resp) {
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
          return self.ApiRoot + '/item/' + section._id + '/tiles/zxy/' + level + '/' + x + '/' + y;
        }
      };
      // For now each section is its own image.  In the future multiple
      // sections can be in a single image.
      section.bounds = [0,w-1,0,h-1];
      cache.SetTileSource(tileSource);
      cache.LoadRoots();
      // If this is the current section, render it.
      if (self.Stack[self.SectionIndex] === section) {
        self.RenderSection(section);
      }
      if (callback) {
        (callback)();
      }
    });
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
    var cache = this.GetCache(section._id);
    if ( ! cache.Image) { // or not cache.TileSource
      // Image information has not been loaded yet.
      // If this is still the current section when it loads, 
      // the section will render.
      this.RequestSectionData(section);
    } else {
      this.RenderSection(section);
    }
  };

  GirderStackWidget.prototype.PreloadSectionIndex = function (index) {
    if (index < 0 || index >= this.Stack.length) { return; }
    var self = this;
    this.RequestSectionData(
      this.Stack[index],
      function () {
        self.PreloadSectionIndex(index + 1);
      }
    );
  };
      
  // The section images must be loaded before this call.
  GirderStackWidget.prototype.RenderSection = function(section) {
    // Here display is just a viewer.
    if (this.First) {
      delete this.First;
      this.SliderDiv.slider( "option", "max", this.Stack.length-1 );
      this.Display.SetCamera([(section.bounds[0]+section.bounds[1])/2,
                              (section.bounds[2]+section.bounds[3])/2],
                             0, (section.bounds[3]-section.bounds[2]));
      // Start loading all the thumbnails, one at a time.
      this.PreloadSectionIndex(0);

    }
    this.Display.SetCache(this.GetCache(section._id));
    this.Display.EventuallyRender();
  };

  SAM.GirderStackWidget = GirderStackWidget;
})();
