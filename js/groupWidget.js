// ==============================================================================
// Experment to manage multiple girder annotations in a single layer.

(function () {
  'use strict';

  function GroupWidget (viewer, newFlag) {
    if (viewer === null) {
      return;
    }
    this.Viewer = viewer;
    this.Viewer.AddWidget(this);
    this.Widgets = [];
    this.Active = false;
  }

  GroupWidget.prototype.Draw = function (view) {
    for (var i = 0; i < this.Widgets.length; ++i) {
      this.Widgets[i].Draw(view);
    }
  };

  GroupWidget.prototype.RemoveFromViewer = function () {
    if (this.Viewer) {
      this.Viewer.RemoveWidget(this);
    }
  };

  GroupWidget.prototype.HandleKeyPress = function (keyCode, shift) {
    for (var i = 0; i < this.Widgets.length; ++i) {
      var child = this.Widgets[i];
      if (child.HandleKeyPress) {
        if (!child.HandleKeyPress(keyCode, shift)) {
          return false;
        }
      }
    }
    return true;
  };

  GroupWidget.prototype.HandleMouseDown = function (event) {
    if (event.which !== 1) {
      return;
    }
    for (var i = 0; i < this.Widgets.length; ++i) {
      var child = this.Widgets[i];
      if (child.HandleMouseDown) {
        if (!child.HandleMouseDown(event)) {
          return false;
        }
      }
    }
    return true;
  };

  // returns false when it is finished doing its work.
  GroupWidget.prototype.HandleMouseUp = function (event) {
    for (var i = 0; i < this.Widgets.length; ++i) {
      var child = this.Widgets[i];
      if (child.HandleMouseDown) {
        child.HandleMouseUp(event);
      }
      return true;
    }
  };

  GroupWidget.prototype.HandleMouseMove = function (event) {
    for (var i = 0; i < this.Widgets.length; ++i) {
      var child = this.Widgets[i];
      if (child.HandleMouseMove) {
        if (!child.HandleMouseMove(event)) {
          return false;
        }
      }
    }
    return true;
  };

  GroupWidget.prototype.CheckActive = function (event) {
    for (var i = 0; i < this.Widgets.length; ++i) {
      var child = this.Widgets[i];
      if (child.CHeckActive) {
        if (child.CheckActive(event)) {
          this.Active = true;
          return true;
        }
      }
      this.Active = false;
      return false;
    }
  };

  // Multiple active states.  Active state is a bit confusing.
  GroupWidget.prototype.GetActive = function () {
    return this.Active;
  };

  // Setting to active always puts state into "active".
  // It can move to other states and stay active.
  GroupWidget.prototype.SetActive = function (flag) {
    alert('GroupWidget.SetActive not handled.');
  };

  SAM.GroupWidget = GroupWidget;
})();
