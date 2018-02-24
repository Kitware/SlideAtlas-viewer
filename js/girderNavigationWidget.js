// To be put in the girder annotation panel.
// Fast forward skips ahead/back 1/10 of folder.
// However, I want to use callbacks to make this more general.

(function () {
  'use strict';

  function GirderNavigationWidget (parent, itemId) {
    this.InitializeItemId(itemId);
    this.ChangeItemCallback = undefined;
    this.ItemIndex = -1;
    this.FolderItemIds = undefined;

    var self = this;
    var size = '40px';
    if (SAM.detectMobile()) {
      // fake a tab
      this.Tab = {};
      this.Tab.Panel = $('<div>')
            .appendTo(parent)
            .hide()
            // .addClass("sa-view-navigation-div ui-responsive");
            .addClass('ui-responsive')
            .css({'position': 'absolute',
              'right': '150px',
              'bottom': '20px',
              'z-index': '5'});
      var panel = this.Tab.Panel;
      this.Tab.show = function () { panel.show(); };
      this.Tab.hide = function () {
        panel.hide();
      };
      // SA.OnStartInteraction( function () { panel.hide();} );
    } else {
      this.Tab = new SA.Tab(parent, SA.ImagePathUrl + 'nav.png', 'navigationTab');
      // this.Tab.Div.prop('title', 'Navigation');
      this.Tab.Div
        // .addClass('sa-view-navigation-div')
        .css({
          'box-sizing': 'border-box',
          '`position': 'absolute',
          'bottom': '0px',
          'right': '150px',
          'z-index': '200'});
      this.Tab.Panel
        .addClass('sa-view-navigation-panel')
        .css({'overflow':'hidden'});

      // Put the stack display in the navigation button
      this.NoteDisplay = $('<div>')
            .appendTo(this.Tab.Div)
            .addClass('sa-view-note')
            .html('');
    }

    this.PreviousSlideButton =
        $('<img>').appendTo(this.Tab.Panel)
        .addClass('sa-view-navigation-button')
        .attr('src', SA.ImagePathUrl + 'previousSlide.png')
        // .prop('title', 'Previous Slide. (page-up)')
        .click(function () { self.PreviousSlide(); });

    this.PreviousNoteButton =
        $('<img>').appendTo(this.Tab.Panel)
        .addClass('sa-view-navigation-button')
        .attr('src', SA.ImagePathUrl + 'previousNote.png')
        // .prop('title', 'Previous Note. (p)')
        .click(function () { self.PreviousNote(); });

    this.NextNoteButton =
        $('<img>').appendTo(this.Tab.Panel)
        .addClass('sa-view-navigation-button')
        .attr('src', SA.ImagePathUrl + 'nextNote.png')
        // .prop('title', 'Next Note, (n, space)')
        .click(function () { self.NextNote(); });

    this.NextSlideButton =
        $('<img>').appendTo(this.Tab.Panel)
        .addClass('sa-view-navigation-button')
        .attr('src', SA.ImagePathUrl + 'nextSlide.png')
        // .prop('title', 'Next Slide. (page-down)')
        .css({'z-index': '100'})
        .click(function () { self.NextSlide(); });
    this.NextSlideButton
        .on('touchend', function (event) {
          self.NextSlide();
          return false;
        });

    this.NameLabel = $('<div>')
      .appendTo(this.Tab.Panel)
      .css({
        'font-size': '10px',
        'position': 'relative',
        'top': '-3px'});

    // TODO: Fix the main css file for mobile.  Hack this until fixed.
    if (SAM.MOBILE_DEVICE) {
      size = '80px';
      if (SAM.MOBILE_DEVICE === 'iPhone') {
        size = '100px';
      }
      this.PreviousSlideButton
            .css({'height': size,
              'width': size,
              'opacity': '0.8'})
            .on('touchend', function () { self.PreviousSlide(); });
      this.PreviousNoteButton
            .css({'height': size,
              'width': size,
              'opacity': '0.8'})
            .on('touchend', function () { self.PreviousNote(); });
      this.NextNoteButton
            .css({'height': size,
              'width': size,
              'opacity': '0.8'})
            .on('touchend', function () { self.NextNote(); });
      this.NextSlideButton
            .css({'height': size,
              'width': size,
              'opacity': '0.8'});
    }

    // this.CopyrightWrapper =
    //    $('<div>').appendTo(parent)
    //    .css({
    //      'width': '100%',
    //      'text-align': 'center'
    //    }).html();
  }

  GirderNavigationWidget.prototype.SetChangeItemCallback = function (callback) {
    this.ChangeItemCallback = callback;
  };

  GirderNavigationWidget.prototype.ChangeItem = function () {
    window.history.pushState(this.ItemId, "SlideAtlas viewer " + this.ItemId,
                             "/#item/" + this.ItemId);

    if (this.ChangeItemCallback) {
      (this.ChangeItemCallback)(this.ItemId);
    }
  };

  GirderNavigationWidget.prototype.InitializeItemId = function (itemId) {
    // Get the item object so we can find the folder id.
    this.ItemId = itemId;
    var self = this;
    girder.rest.restRequest({
      path: 'item/' + itemId,
      method: 'GET'
    }).done(function (data) {
      if (data && data.folderId) {
        self.InitializeFolderId(data.folderId);
      } else {
        console.log('Could not find item ' + itemId);
      }
    });
  };

  GirderNavigationWidget.prototype.InitializeFolderId = function (folderId) {
    // Load the folder so we can create a list to iterate over.
    var self = this;
    girder.rest.restRequest({
      path: 'item?folderId=' + folderId + '&limit=5000&sort=lowerName&sortdir=1',
      method: 'GET'
    }).done(function (data) {
      self.LoadFolderItems(data);
    });
  };

  GirderNavigationWidget.prototype.LoadFolderItems = function (data) {
    this.ItemIndex = -1;
    this.FolderItemIds = [];
    this.FolderItemNames = [];
    for (var i = 0; i < data.length; ++i) {
      var itemId = data[i]._id;
      if (itemId === this.ItemId) {
        this.ItemIndex = i;
      }
      this.FolderItemIds.push(itemId);
      this.FolderItemNames.push(data[i].name);
    }
    this.Update();
  };

  GirderNavigationWidget.prototype.SetInteractionEnabled = function (flag) {
    var self = this;
    if (flag) {
      this.Display.Parent.on(
            'keydown.navigation',
            function (event) {
              return self.HandleKeyDown(event);
            });
    } else {
      this.Display.Parent.off('keydown.navigation');
    }
  };

  GirderNavigationWidget.prototype.HandleKeyDown = function (event) {
    var keyCode = event.keyCode;
    // 34=page down, 78=n, 32=space
    if (keyCode === 34) {
      this.NextSlide();
      return false;
    }
    if (keyCode === 78 || keyCode === 32) {
      this.NextNote();
      return false;
    }
    // 33=page up, 80=p
    if (keyCode === 33) {
      this.PreviousSlide();
      return false;
    }
    if (keyCode === 80) {
      this.PreviousNote();
      return false;
    }

    return true;
  };

  GirderNavigationWidget.prototype.ToggleVisibility = function () {
    this.SetVisibility(!this.Visibility);
  };

  // Used on mobile.
  GirderNavigationWidget.prototype.SetVisibility = function (v) {
    this.Visibility = v;
    if (v) {
      this.Tab.show();
    } else {
      this.Tab.hide();
    }
  };

  // Change which buttons are active based on the current index.
  GirderNavigationWidget.prototype.Update = function () {
    this.ItemName = this.FolderItemNames[this.ItemIndex];
    this.NameLabel.text(this.ItemIndex.toString() + ':' + this.ItemName);

    // Disable and enable prev/next slide buttons so we cannot go past the end.
    if (!this.FolderItemIds || this.ItemIndex <= 0) {
      this.PreviousNoteButton.removeClass('sa-active');
      this.PreviousSlideButton.removeClass('sa-active');
    } else {
      this.PreviousNoteButton.addClass('sa-active');
      this.PreviousSlideButton.addClass('sa-active');
    }
    if (!this.FolderItemIds || this.ItemIndex >= this.FolderItemIds.length - 1) {
      this.NextNoteButton.removeClass('sa-active');
      this.NextSlideButton.removeClass('sa-active');
    } else {
      this.NextNoteButton.addClass('sa-active');
      this.NextSlideButton.addClass('sa-active');
    }
  };

  GirderNavigationWidget.prototype.PreviousNote = function () {
    if (!this.FolderItemIds) { return; }
    // Make sure user notw changes are not pending to be saved.
    // if (SA.notesWidget) { SA.notesWidget.Flush(); }
    if (this.ItemIndex <= 0) {
      return;
    }
    this.ItemIndex -= 1;
    this.ItemId = this.FolderItemIds[this.ItemIndex];
    this.ChangeItem();
    this.Update();
  };

  GirderNavigationWidget.prototype.NextNote = function () {
    if (!this.FolderItemIds) { return; }
    // Make sure user not changes are not pending to be saved.
    // if (SA.notesWidget) { SA.notesWidget.Flush(); }
    if (this.ItemIndex >= this.FolderItemIds.length) {
      return;
    }

    this.ItemIndex += 1;
    this.ItemId = this.FolderItemIds[this.ItemIndex];
    this.ChangeItem();
    this.Update();
  };

  GirderNavigationWidget.prototype.GetFastIncrement = function () {
    var inc = this.FolderItemIds.length / 20;
    if (inc < 5) {
      return 5;
    }
    var tmp;
    for (tmp = 10; tmp <= 50; tmp += 10) {
      if (inc < tmp) {
        return tmp;
      }
    }
    for (tmp = 100; tmp <= 500; tmp += 100) {
      if (inc < tmp) {
        return tmp;
      }
    }
    return 1000;
  };

  GirderNavigationWidget.prototype.PreviousSlide = function () {
    if (!this.FolderItemIds) { return; }
    // Make sure user notw changes are not pending to be saved.
    // if (SA.notesWidget) { SA.notesWidget.Flush(); }

    if (this.ItemIndex <= 0) {
      return;
    }
    var inc = this.GetFastIncrement();

    this.ItemIndex -= inc;
    if (this.ItemIndex < 0) {
      this.ItemIndex = 0;
    }
    this.ItemId = this.FolderItemIds[this.ItemIndex];
    this.ChangeItem();
    this.Update();
  };

  GirderNavigationWidget.prototype.NextSlide = function () {
    if (!this.FolderItemIds) { return; }
    // Make sure user notw changes are not pending to be saved.
    // if (SA.notesWidget) { SA.notesWidget.Flush(); }

    if (this.ItemIndex >= this.FolderItemIds.length) {
      return;
    }
    var inc = this.GetFastIncrement();

    this.ItemIndex += inc;
    if (this.ItemIndex >= this.FolderItemIds.length) {
      this.ItemIndex = this.FolderItemIds.length - 1;
    }
    this.ItemId = this.FolderItemIds[this.ItemIndex];
    this.ChangeItem();
    this.Update();
  };

  SA.GirderNavigationWidget = GirderNavigationWidget;
})();
