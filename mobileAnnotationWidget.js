// Testing annotation widget with touch events.


//------------------------------------------------------------------------------
// I intend to have only one object
function MobileAnnotationWidget() {

  var size = '80px';
  //var left = '620px';
  var right = '0px';
  var bottom = '170px';
  if (MOBILE_DEVICE == "iPhone") {
    size = '100px';
    bottom = '80px';
    left = '80px';
  }
  
  var self = this;
  this.Div =
    $('<div>').appendTo('body')
              .addClass("sa-view-annotation-div ui-responsive")

  // I cannot get touch events that start in the image to continue in
  // the document / viewer.  Press to place, then interact to position.
  this.CircleButton =
    $('<img>').appendTo(this.Div)
              .addClass("sa-view-annotation-button")
              .attr('src',"webgl-viewer/static/Circle128.jpg")
              .click(function(){self.CircleCallback();});
  this.CircleTip = new ToolTip(this.CircleButton, "Circle Annotation");

  this.TextButton =
    $('<img>').appendTo(this.Div)
              .addClass("sa-view-annotation-button")
              .attr('src',"webgl-viewer/static/Text128.jpg")
              .click(function(){self.TextCallback();});
  this.TextTip = new ToolTip(this.TextButton, "Text Annotation");

  this.Visibility = false;

  var self = this;
  EVENT_MANAGER.OnStartInteraction( function () { self.SetVisibility(false);} );
}


MobileAnnotationWidget.prototype.CircleCallback = function() {
  console.log("New circle");

  // Hard code only a single view for now.
  this.Viewer = VIEWER1;

  if ( this.Viewer.ActiveWidget != undefined && widget ) {
    this.Viewer.ActiveWidget.Deactivate();
  }
  var widget = new CircleWidget(this.Viewer, false);
  var cam = this.Viewer.GetCamera();
  var x = cam.FocalPoint[0];
  var y = cam.FocalPoint[1];

  widget.Shape.Origin = [x, y];
  widget.Shape.Radius = cam.Height / 4.0;
  widget.Shape.UpdateBuffers();
  eventuallyRender();

  //this.Viewer.ActiveWidget = widget;
  this.Viewer.SetAnnotationVisibility(ANNOTATION_ON);
}

MobileAnnotationWidget.prototype.TextCallback = function() {
  this.Viewer = VIEWER1;
  var widget = this.Viewer.ActiveWidget;
  if ( widget ) {
    widget.Deactivate();
  }

  this.Viewer.SetAnnotationVisibility(ANNOTATION_ON);
  var widget = new TextWidget(this.Viewer, "");
  var cam = this.Viewer.GetCamera();
  var x = cam.FocalPoint[0];
  var y = cam.FocalPoint[1];
  widget.Text.Anchor[0] = x;
  widget.Text.Anchor[1] = y;
  eventuallyRender();

  this.Viewer.ActiveWidget = widget;

  // The dialog is used to set the initial text.
  widget.ShowPropertiesDialog();
}

MobileAnnotationWidget.prototype.SetVisibility = function(v) {
  this.Visibility = v;
  if (v) {
    this.Div.show();
  } else {
    this.Div.hide();
  }
}

MobileAnnotationWidget.prototype.ToggleVisibility = function() {
    this.SetVisibility( ! this.Visibility);
    if (FAVORITES_WIDGET) { 
        FAVORITES_WIDGET.FavoritesBar.ShowHideFavorites();
    }
}






