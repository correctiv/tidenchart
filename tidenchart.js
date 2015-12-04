/* gloabls: d3 */

/*
  Based on
  http://bl.ocks.org/mbostock/8033015
*/

window.TidenChart = (function(){
'use static';

var margin = {top: 20, right: 40, bottom: 30, left: 40};

function TidenChart(container, config) {
  this.container = container;
  this.config = config;

  var x = this.x = d3.time.scale();
  var y = this.y = d3.scale.linear();
  this.voronoi = d3.geom.voronoi()
      .x(function(d) { return x(d.date); })
      .y(function(d) { return y(d.value); });
  this.line = d3.svg.line()
      .interpolate("monotone")
      .x(function(d) { return x(d.date); })
      .y(function(d) { return y(d.value); });

  var svgEl = this.svgEl = d3.select(container).append("svg");
  var svg = this.svg = svgEl.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svg.append("g")
    .attr("class", "axis axis--x");

  svg.append("g")
      .attr("class", "axis axis--y")
      .append("text")
        .attr('class', 'axis-label')
        .attr("x", 4)
        .attr("dy", ".32em")
        .text(this.config.labels.yAxis);

  this.tidenGroup = svg.append("g")
      .attr("class", "tiden");

  this.guideline = svg.append("line")
    .style('display', 'none')
    .attr("class", "guideline")
    .attr("x1", 0);

  this.focus = svg.append("g")
    .attr("transform", "translate(-100,-100)")
    .attr("class", "focus");

  this.focus.append("circle")
      .attr("r", 3.5);

  this.focus.append("text")
    .attr('class', 'shadow')
    .attr("y", -30);

  this.focus.append("text")
      .attr("y", -30);

  this.voronoiGroup = svg.append("g")
      .attr("class", "voronoi");
}

TidenChart.prototype.init = function() {
  var self = this;
  this.resize();

  var timeFormat = d3.time.format("%Y-%m-%d");

  d3.csv(this.config.baseurl + this.config.data, function(error, tiden) {
    self.years = undefined;
    self.tiden = tiden.map(function(d){
      if (self.years === undefined) {
        self.years = Object.keys(d).map(timeFormat.parse).filter(Number);
      }
      return {
        name: d.name,
        values: self.years.map(function(m) {
          return {
            name: d.name,
            date: m,
            value: +d[timeFormat(m)] || undefined,

          };
        }).filter(function(m){
          return m.value !== undefined;
        })
      };
    });
    self.tidenMap = {};
    self.tiden.forEach(function(d){ self.tidenMap[d.name] = d; });
    self.redata(self.years, self.tiden);
    self.redraw();
  });

  window.addEventListener('resize', function(){
    self.resize();
    self.redraw();
  });
};

TidenChart.prototype.resize = function() {
  var w = this.container.offsetWidth;
  var h = Math.min(w * (this.config.sizeRatio || 1.66), window.innerHeight);
  var width = this.width = w - margin.left - margin.right;
  var height = this.height = h - margin.top - margin.bottom;
  this.svgEl
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  this.svg.select('.axis.axis--x')
    .attr("transform", "translate(0," + this.height + ")");

  this.x.range([0, this.width]);
  this.y.range([this.height, 0]);
  this.voronoi.clipExtent([[-margin.left, -margin.top], [this.width + margin.right, this.height + margin.bottom]]);
};

TidenChart.prototype.redata = function(years, tiden) {
  this.x.domain(d3.extent(years));
  this.y.domain([
    d3.min(tiden, function(c) {
      return d3.min(c.values, function(d) { return d.value; });
    }),
    d3.max(tiden, function(c) { return d3.max(c.values, function(d) { return d.value; }); })
  ]).nice();
};

TidenChart.prototype.redraw = function() {
  var self = this;

  this.svg.select('.axis.axis--x')
    .call(d3.svg.axis()
      .scale(this.x)
      .orient("bottom"));

  this.svg.select('.axis.axis--y')
      .call(d3.svg.axis()
        .scale(this.y)
        .orient("left"));

  this.tidenGroup.selectAll("path")
      .data(this.tiden).enter()
        .append("path");

  this.tidenGroup.selectAll("path")
      .data(this.tiden)
        .attr("d", function(d) {
          d.line = this; return self.line(d.values);
        });
  if (this.config.animateLine) {
    this.tidenGroup.selectAll('path')
      .call(this.animateLine.bind(this));
  }

  var voronoi = this.voronoiGroup.selectAll("path")
      .data(this.voronoi(d3.nest()
          .key(function(d) { return self.x(d.date) + "," + self.y(d.value); })
          .rollup(function(v) { return v[0]; })
          .entries(d3.merge(self.tiden.map(function(d) { return d.values; })))
          .map(function(d) { return d.values; })));
  voronoi
    .enter().append("path");
  voronoi
      .attr("d", function(d) { return "M" + d.join("L") + "Z"; })
      .datum(function(d) { return d.point; })
      .on("mouseover", this.highlightTide.bind(this))
      .on("touchstart", this.highlightTide.bind(this))
      .on("mouseout", this.unhighlightTide.bind(this))
      .on("touchend", this.unhighlightTide.bind(this));
};

TidenChart.prototype.animateLine = function(paths) {
  paths[0].forEach(function(d) {
    var l = d3.select(d);
    var totalLength = l.node().getTotalLength();
    l
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
        .duration(1000)
        .ease("linear")
        .attr("stroke-dashoffset", 0);
  });
};

TidenChart.prototype.highlightTide = function(d) {
    var tide = this.tidenMap[d.name];
    d3.select(tide.line).classed("tide--hover", true);
    tide.line.parentNode.appendChild(tide.line);
    this.focus.attr("transform", "translate(" + this.x(d.date) + "," + this.y(d.value) + ")");
    this.focus.selectAll("text")
      .text(tide.name + ' (' + d.date.getFullYear() + ', ' + Math.round(d.value) + ' cm)');
    var textWidth = this.focus.select("text").node().getBBox().width;
    var textOffset = this.x(d.date) - Math.max(Math.min(this.x(d.date), this.width - textWidth), 0);
    this.focus.selectAll("text")
      .attr('x', -textOffset);
    this.guideline
      .attr("y1", this.y(d.value))
      .attr("x2", this.width)
      .attr("y2", this.y(d.value))
      .style('display', 'block');
};

TidenChart.prototype.unhighlightTide = function(d) {
    var tide = this.tidenMap[d.name];
    d3.select(tide.line).classed("tide--hover", false);
    this.focus.attr("transform", "translate(-100,-100)");
    this.guideline
      .style('display', 'none');
};

return TidenChart;

}());
