


(function () {
    // Depends on the CIRCLE widget
  'use strict';

  function GirderRocWidget (parent, positives, negatives, apiRoot) {
    this.ChipSize = 128;
    this.MaxChips = 200;
    this.Positives = positives;
    this.Negatives = negatives;
    this.NumPositives = positives.length;
    this.NumNegatives = negatives.length;
    // Combine the two lists, but label them first.
    for (var i = 0; i < positives.length; ++i) {
      positives[i].positive = true;
    }
    for (var i = 0; i < negatives.length; ++i) {
      negatives[i].positive = false;
    }
    this.Detections = positives.concat(negatives);
    this.Detections.sort(
      function (a,b) {
        return b.element.scalar - a.element.scalar;
      });

    this.Container = $('<div>')
      .appendTo(parent)
      .css({'width':'100%',
            'margin-right':'30px'});

    this.RocDiv = $('<div>')
      .appendTo(this.Container)
      .css({'width':'100%',
            'position': 'relative'});
    this.LightBoxDiv = $('<div>')
      .appendTo(this.Container)
      .css({'width':'100%',
            'min-height':'500px',
            'position': 'relative'});

    this.FalsePositiveDiv = $('<div>')
      .appendTo(this.LightBoxDiv)
      .css({'border': '1px solid #AAA',
           'position': 'absolute',
           'left': '0px',
           'width': '50%',
           'top': '0px'});
    this.FalseNegativeDiv = $('<div>')
      .appendTo(this.LightBoxDiv)
      .css({'width': '49%',
           'position': 'absolute',
           'left': '50%',
           'width': '50%',
           'top': '0px'});

    var self = this;
    this.SliderDiv = $('<div>')
      .appendTo(this.RocDiv)
      .css({
        'position': 'absolute',
        'left': '0px',
        'bottom': '0px',
        'width': '100%',
        'z-index': '10'})
       //.on('keyup', function (e) { self.HandleKeyUp(e); })
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
        start: function (e, ui) {},
        slide: function (e, ui) {
          var thresh = 1.0 - ui.value / 100.0;
          self.UpdateThreshold(thresh);
        },
        stop: function (e, ui) {}
      });

    this.DrawGraph();

    // Make the thumbnails / chips.
    this.InitializeChips();
    this.UpdateThreshold(1.0);
  }

  GirderRocWidget.prototype.UpdateThreshold = function (thresh) {
    // Find the point for this threshold.
    // TODO: Search from last point.
    var i = 0;
    var x = 0, y = 0;
    for (var i = 0; i < this.Points.length; ++i) {
      if (this.Points[i][2] < thresh) {
        x = this.Points[i][0];
        y = this.Points[i][1];
        break;
      }
    }
    console.log(thresh);
    var x = this.XScale(x);
    var y = this.YScale(y);
    this.Dot
      .attr('cx', x)
      .attr('cy', y);

    this.ThreshLabel
      .attr('x', x)
      .attr('y', y)
      .text(thresh.toFixed(2));

    // Update chip visibility.
    // TODO: Incremental update
    for (var i = 0; i < this.Detections.length; ++i) {
      var d = this.Detections[i];
      if (d.imgDiv) {
        if (d.positive) {
          if (d.element.scalar <= thresh) {
            d.imgDiv.show();
          } else {
            d.imgDiv.hide();
          }
        } else {
          if (d.element.scalar >= thresh) {
            d.imgDiv.show();
          } else {
            d.imgDiv.hide();
          }
        }
      }
    }
  };

  GirderRocWidget.prototype.GetImageUrl = function (imageId, left, top, width, height, targetHeight) {
    var magnification = 40.0 * targetHeight / height;
    if (magnification > 40) {
      magnification = 40;
    }
    return 'api/v1/item/'+imageId+'/tiles/region?magnification='+magnification+
           '&left='+left+'&top='+top+'&regionWidth='+width+'&regionHeight='+height+
           '&units=base_pixels&exact=false&encoding=JPEG&jpegQuality=95&jpegSubsampling=0';
  };

  GirderRocWidget.prototype.InitializeChips = function() {
    this.Positives.sort(
      function (a,b) {
        return a.element.scalar - b.element.scalar;
      });
    this.Negatives.sort(
      function (a,b) {
        return b.element.scalar - a.element.scalar;
      });
    this.Positives = this.Positives.slice(0,this.MaxChips);
    this.Negatives = this.Negatives.slice(0,this.MaxChips);

    for (var i = 0; i < this.Positives.length; ++i) {
      this.CreateChip(this.Positives[i], this.FalseNegativeDiv);
    }
    for (var i = 0; i < this.Negatives.length; ++i) {
      this.CreateChip(this.Negatives[i], this.FalsePositiveDiv);
    }
  };

  GirderRocWidget.prototype.CreateChip = function(chip, parent) {
    var imageId = chip.imageId;
    var e = chip.element;
    if (e.type === "rectangle"){
      var left = Math.round(e.center[0]-e.width / 2);
      var top  = Math.round(e.center[1]-e.height / 2);
      // Use closure to keep track of images state?
      var imgDiv = $('<div>')
        .appendTo(parent)
        .addClass("img-div")
        .css({'height':(this.ChipSize + 8).toString() + 'px',
              'width':(this.ChipSize + 8).toString() + 'px',
              'margin': '1px',
              'display': 'inline-block',
              'position': 'relative',
              'cursor': 'crosshair',
              'border': '4px solid #EEE'})
        // needed to receive key events
        .attr('tabindex', '0');
      var img = $('<img>')
        .appendTo(imgDiv)
        .addClass("img-chip")
        .css({'height':this.ChipSize.toString()+'px',
              'width':this.ChipSize.toString()+'px',
              'cursor': 'crosshair'})
        .attr('tabindex', '0')
        .prop('src', this.GetImageUrl(imageId, left, top, 920, 920, this.ChipSize));
      chip.imgDiv = imgDiv;
      chip.img = img;
    }
  };

  // Initialize and draw the graph.
  GirderRocWidget.prototype.DrawGraph = function() {
    this.Points = [];
    var negCount = 0;
    var posCount = 0;

    var stride = Math.round(this.Detections.length / 100);

    for (var i = 0; i < this.Detections.length; ++i) {
      var d = this.Detections[i];
      if (stride == 0 || i % stride == 0) {
        this.Points.push([negCount, posCount, d.element.scalar]);
      }
      if (d.positive) {
        ++posCount;
      } else {
        ++negCount;
      }
    }
    // Add the last point.
    this.Points.push([negCount, posCount]);

    // Draw the d3 graph
    var margin = {top: 20, right: 20, bottom: 50, left: 70};
    var width = 600 - margin.left - margin.right
    var height = 400 - margin.top - margin.bottom;

    var xScale = d3.scale.linear()
      .domain([0, this.NumNegatives])
      .range([0, width]);
    var yScale = d3.scale.linear()
      .domain([0, this.NumPositives])
      .range([height, 0]);

    var xAxis = d3.svg.axis()
      .scale(xScale)
      .orient("bottom")
      .ticks(5);
      //.style({"stroke-width": "1.5px"});
    var yAxis = d3.svg.axis()
      .scale(yScale)
      .orient("left")
      .ticks(5);
      //.style({"stroke-width": "1.5px"});

    // append the svg obgect to the body of the page
    // appends a 'group' element to 'svg'
    // moves the 'group' element to the top left margin

    var svg = d3.select(this.RocDiv[0]).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform",
              "translate(" + margin.left + "," + margin.top + ")");

    var valueline = d3.svg.line()
      .x(function (d) { return xScale(d[0]); })
      .y(function (d) { return yScale(d[1]); });

    svg.append("path")
      .attr("class", "line")
      .attr('fill', 'none')
      .attr('stroke', 'blue')
      .attr("d", valueline(this.Points));

    svg.append("g")
        .attr("class", "x axis")
        .attr('stroke-width', '1')
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
      .append("text")
        .style("text-anchor", "end")
        .attr("transform", "translate(" + width + ", 0)")
        .attr("dy", "-.55em")
        .text("False Positives");

    svg.append("g")
        .attr("class", "y axis")
        .attr('stroke-width', '1')
        .call(yAxis)
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("True Positives");

    this.XScale = xScale;
    this.YScale = yScale;
    this.Dot = svg.append('circle')
      .attr('cx', '0')
      .attr('cy', height.toString())
      .attr('r','30')
      .attr('stroke', 'black')
      .attr('stroke-width', '1')
      .attr('fill', 'yellow')
      .attr('r', '10');
    this.ThreshLabel = svg.append('text')
      .attr('x', '0')
      .attr('y', '0')
      .attr('dy', '-20')
      .style("text-anchor", "middle")
      .text("0.0");
  };

  SAM.GirderRocWidget = GirderRocWidget;
})();

// export { GirderRocWidget }
