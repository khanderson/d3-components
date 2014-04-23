var d3c = {
  Group: function(components) {
    var components = components === undefined ? [] : components;
    
    return {
      add_component: function(component) {
        components.push(component);
      },
      update_all: function(all_data) {
        components.forEach(function(component) { 
          component.update_all(all_data);
        });
      },
      update_positions: function(all_data) {
        components.forEach(function(component) { 
          component.update_positions(all_data);
        });
      }
    };
  },
  StackedHorizontalBarChart: function(svg, options) {
    var defaults = {
          x_offset: 0,
          y_offset: 0,
          height: 120,
          width: 200,
          class_name: 'stacked-horizontal-bar',
          data_extractor: function(all_data) { return all_data; },
          field_extractor: function(datum) { return datum; },
          bar_scale_factor: 1.0,
          category_axis_options: { show: true, orient: 'left', labels: 'inside' },
          value_axis_options: { show: true, orient: 'bottom' },
          listeners: {}
        };
    
    options = $.extend(true, {}, defaults, options);
    
    var clip_path_id = options.class_name + '-clip',
        chart_g = svg
        .append("g")
        .attr("class", options.class_name + '-g')
        .attr("transform", "translate(" + options.x_offset + "," + options.y_offset + ")"),
        chart_body_g = chart_g
        .append("g")
        .attr("clip-path", "url(#" + clip_path_id + ")"),
        y_scale = options.y_scale,
        x_scale = options.x_scale || d3.scale.linear().rangeRound([0, width]),
        y_axis_g = chart_g.append("g")
        .attr("class", "y-generic-time axis"),
        x_axis_g = svg.append("g")
        .attr("class", "x-generic-time axis")
        .attr("transform", "translate(" + options.x_offset + "," + (options.y_offset + options.height) + ")"),
        y_axis = d3.svg.axis()
        .scale(y_scale)
        .orient(options.category_axis_options.orient),
        x_axis = d3.svg.axis()
        .scale(x_scale)
        .ticks(5)
        .orient(options.value_axis_options.orient)
        .tickFormat(d3.format(".2s")),
        utils = options.utils;
      
    if (options.category_axis_options.labels == 'none' || options.category_axis_options.labels == 'inside') {
      y_axis.tickFormat(function(d, i) { return ""; });
    }
    
    // A clip path covering the main chart without the axes
    // (ie. the blank white bit we want to draw bars on).
    svg.append("clipPath")
       .attr("id", clip_path_id)
     .append("rect")
       .attr("width", options.width)
       .attr("height", options.height);
    
    var update_positions = function() {
      if (options.value_axis_options.show) x_axis_g.transition().call(x_axis);
      if (options.category_axis_options.show) y_axis_g.call(y_axis);
    };
  
    var update_all = function(all_data) {
      var data = options.data_extractor(all_data),
          unscaled_bar_width = y_scale.rangeBand(),
          scaled_bar_width = unscaled_bar_width * options.bar_scale_factor;

      x_scale.domain([0, d3.max(data, function(d) { return d3.sum(options.category_scale.domain(), function(category) { return d.values[category] ? options.field_extractor(d.values[category]) : 0; }); }) ]);

      // STACKS
      var stacks = chart_body_g.selectAll(".stacks")
          .data(data, options.get_identifier);
        
      var stacks_entry_g = stacks.enter()
          .append("g")
          .attr("class", "stacks")
          .attr("transform", function(d) { return "translate(0," + (y_scale(options.get_identifier(d)) + (unscaled_bar_width - scaled_bar_width)/2) + ")"; });

      stacks.exit()
          .remove();

      // Event bindings for rectangles forming the stacks.
      var bind_events = function(target_selection) {
        $.each(options.listeners, function(event_name, handler) {
          target_selection.on(event_name, function(d, i) {
            var context = {
              segment_data: $.extend({ category: d.category, y: d.y }, d.data),
              position: {
                x0: x_scale(d.x0),
                y0: y_scale(d.y),
                width: x_scale(d.x1) - x_scale(d.x0),
                height: scaled_bar_width
              }
            };
          
            handler(context);
          });
        });
      };

      // RECTANGLES FORMING THE STACKS
      var bars = stacks.selectAll("rect")
          .data(function(d) {
            var x0 = 0;
            return options.category_scale.domain().map(function(category) {
              var category_data = d.values[category];

              return {
                category: category,
                data: category_data,
                y: options.get_identifier(d),
                x0: x0,
                x1: x0 += (category_data ? options.field_extractor(category_data) : 0)
              };
            });
          }, function(dd) { return dd.category });

      bars.transition()
          .attr("x", function(d) { return x_scale(d.x0); })
          .attr("width", function(d) { return utils.assertNonNegative(x_scale(d.x1) - x_scale(d.x0)); });

      bars.enter()
          .append("rect")
          .attr("class", "bar")
          .attr("height", scaled_bar_width)
          .attr("x", function(d) { return x_scale(d.x0); })
          .attr("width", 0)
          .style("fill", function(d) { return options.category_scale(d.category); })
          .call(bind_events)
         .transition()
          .attr("width", function(d) { return utils.assertNonNegative(x_scale(d.x1) - x_scale(d.x0)); });

          /*
          .call(utils.bindTooltip, chart_g, function(d, i) {
            var place_on_left = x_scale(x_scale(d.x1)) > width / 3;
            return { x: x_scale(place_on_left ? d.x0 : d.x1),
                     y: y_scale(d.y) + bar_height/2,
                     placement: place_on_left ? 'left' : 'right',
                     title: options.tooltip_title(d, all_data),
                     content: options.tooltip_content(d, all_data)
            };
          })
          */

      bars.exit().remove();
      
      if (options.category_axis_options.labels == 'inside') {
        var label_y_factor = 0.5, label_x_offset = 6;
      
        stacks_entry_g.append('text')
        .attr("x", x_scale(0) + label_x_offset)
        .attr("y", function(d) { return scaled_bar_width * label_y_factor; })
        .attr("dy", ".35em")
        .style('text-anchor', 'beginning')
        .attr('fill', 'white')
        .style("font-size", "0.6em")
        .text(function(d) { return d.y });
      }
    
      update_positions();
    };
  
    return {
      update_positions: update_positions,
      update_all: update_all
    };
  }
};