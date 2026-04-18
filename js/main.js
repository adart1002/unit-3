(function(){

    // global variables
    var attrArray = ["gold", "silver", "bronze", "total", "athletes",
                     "gold_pct", "total_per_athlete", "pop_millions", "medals_per_million"];
    var expressed = attrArray[0]; // Default attribute

    // explainers for each attribute in explainer box
    var metadata = {
        "gold": "Total gold medals won. Represents the number of events where the country achieved first place. Norway was the overall winner of the 2026 Winter Olympics with 18 gold medals.",
        "silver": "Total silver medals won. Represents the number of events where the country achieved second place. The United States and Norway both tied with 12 silver medals, falling short of adding more to their gold medal totals.",
        "bronze": "Total bronze medals won. Represents the number of events where the country achieved third place. Italy had the most bronze medals with 14, displaying a strong performance across many events as the host nation.",
        "total": "The cumulative count of all gold, silver, and bronze medals won by the nation. Norway led the medal table with a total of 41 medals, continuing their dominance in winter sports.",
        "athletes": "The total number of athletes sent to the games. Larger values often correlate with higher medal counts. The United States sent the largest amount of athletes in Winter Olympic history, with 232 competitors across all sports.",
        "gold_pct": "The percentage of a country's total medals that are Gold. This highlights the 'quality' of a country's podium finishes. Brazil and Kazakhstan, for example, had 100% gold medal rates due to winning only one medal each, while Norway's gold percentage was around 44% due to their large total medal count.",
        "total_per_athlete": "Calculates the ratio of total medals to the number of athletes. This 'Efficiency' metric shows which teams performed best relative to their size. The Netherlands and Norway were by far the most efficient teams, with around 0.5 medals per athlete, while larger teams like the United States had a much lower ratio of around 0.14 medals per athlete.",
        "pop_millions": "The country's total population in millions. Used as a baseline for normalization.",
        "medals_per_million": "Total medals divided by population. This highlights small nations that punch far above their weight in winter sports. Norway, with a population of just 5.4 million, had an astonishing 7.6 medals per million people, while larger nations like the United States had only around 0.7 medals per million."
    };

    // Chart frame dimensions
    var chartWidth = window.innerWidth * 0.35,
        chartHeight = 460,
        leftPadding = 45,
        rightPadding = 15,
        topBottomPadding = 35,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    // x and y scale
    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0]);

    var xScale = d3.scaleBand()
        .range([0, chartInnerWidth])
        .padding(0.05);

    // initialize map
        window.onload = setMap;

    // core functions
    function setMap() {
        var width = window.innerWidth * 0.55,
            height = 460;

        // container for map and UI elements
        var mapContainer = d3.select("#viz-wrapper")
            .append("div")
            .attr("class", "mapContainer");

        var map = mapContainer
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        // prevents map overflow when zooming
        map.append("defs")
            .append("clipPath")
            .attr("id", "map-clip")
            .append("rect")
            .attr("width", width)
            .attr("height", height);

        // apply zoom transforms
        var mapGroup = map.append("g")
            .attr("class", "mapGroup")
            .attr("clip-path", "url(#map-clip)");

        // Equal Earth projection
        var projection = d3.geoEqualEarth()
            .scale(width / 6.5)
            .translate([width / 2, height / 2]);

        var path = d3.geoPath().projection(projection);

        // zoom behavior
        var zoom = d3.zoom()
            .scaleExtent([1, 8])
            .translateExtent([[0, 0], [width, height]])
            .on("zoom", function(event) {
                mapGroup.attr("transform", event.transform);
                mapGroup.selectAll(".countries")
                    .style("stroke-width", 0.5 / event.transform.k + "px");
            });

        map.call(zoom);

        // map controls
        var controls = mapContainer.append("div").attr("class", "map-controls");
        
        controls.append("button").attr("class", "zoom-btn").text("+")
            .on("click", () => map.transition().duration(300).call(zoom.scaleBy, 1.5));
        
        controls.append("button").attr("class", "zoom-btn").text("−")
            .on("click", () => map.transition().duration(300).call(zoom.scaleBy, 0.67));
        
        controls.append("button").attr("class", "zoom-btn zoom-reset").text("⟳ Reset")
            .on("click", () => map.transition().duration(500).call(zoom.transform, d3.zoomIdentity));

        var legendContainer = mapContainer.append("div").attr("class", "legend-container");

        // load data
        Promise.all([
            d3.csv("data/MedalData.csv"),
            d3.json("data/WorldCountries.topojson")
        ]).then(function(data){
            var csvData = data[0];
            var countries = data[1];

            // convert topojson to geojson and join with csv data
            var worldCountries = topojson.feature(countries, countries.objects.ne_110m_admin_0_countries);
            worldCountries = joinData(worldCountries, csvData);

            var colorScale = makeColorScale(csvData);

            // initialize, map, chart, dropdown, and legend
            setEnumerationUnits(worldCountries, mapGroup, path, colorScale);
            setChart(csvData, colorScale);
            createDropdown(csvData, mapContainer);
            setLegend(colorScale, legendContainer);

            // set initial explainer text
            updateExplainer();
        });
    }

    // handle discrepencies between country names in csv and topojson
    function joinData(worldCountries, csvData) {
        var nameMap = { "Great Britain": "United Kingdom", "United States": "United States of America" };

        // loop through csv to assign data to geojson properties
        csvData.forEach(function(csvCountry) {
            var csvKey = nameMap[csvCountry.country] || csvCountry.country;
            worldCountries.features.forEach(function(feature) {
                if (feature.properties.NAME == csvKey) {
                    attrArray.forEach(attr => feature.properties[attr] = parseFloat(csvCountry[attr]));
                    feature.properties.country = csvCountry.country;
                }
            });
        });
        return worldCountries;
    }

    // quantile scale across 5 classes
    function makeColorScale(data) {
        var colorClasses = ["#daf3fb", "#93d4ef", "#4badd6", "#1a7db5", "#084a87"];
        var colorScale = d3.scaleQuantile().range(colorClasses);
        colorScale.domain(data.map(d => parseFloat(d[expressed])));
        return colorScale;
    }

    // draw country polygons and color based on data
    function setEnumerationUnits(worldCountries, mapGroup, path, colorScale) {
        mapGroup.selectAll(".countries")
            .data(worldCountries.features)
            .enter()
            .append("path")
            .attr("class", d => "countries " + (d.properties.country ? d.properties.country.replace(/\s+/g, "_") : "unknown"))
            .attr("d", path)
            .style("fill", d => {
                var val = d.properties[expressed];
                return (val !== undefined && !isNaN(val)) ? colorScale(val) : "#ccc";
            })
            .on("mouseover", (event, d) => { if(d.properties.country) highlight(d.properties); })
            .on("mouseout", (event, d) => { if(d.properties.country) dehighlight(d.properties); })
            .on("mousemove", moveLabel)
            .append("desc").text('{"stroke": "#aaa", "stroke-width": "0.5px"}');
    }

    // create the bar chart
    function setChart(csvData, colorScale) {
        var chart = d3.select("#viz-wrapper").append("svg")
            .attr("width", chartWidth).attr("height", chartHeight).attr("class", "chart");

        chart.append("rect").attr("class", "chartBackground")
            .attr("width", chartInnerWidth).attr("height", chartInnerHeight).attr("transform", translate);

        // initial sort
        var sortedData = csvData.slice().sort((a, b) => b[expressed] - a[expressed]);
        xScale.domain(sortedData.map(d => d.country));
        yScale.domain([0, d3.max(sortedData, d => parseFloat(d[expressed]))]);

        var bars = chart.selectAll(".bars").data(sortedData).enter().append("rect")
            .attr("class", d => "bars " + d.country.replace(/\s+/g, "_"))
            .attr("width", xScale.bandwidth())
            .on("mouseover", (event, d) => highlight(d))
            .on("mouseout", (event, d) => dehighlight(d))
            .on("mousemove", moveLabel);

        // chart elements
        bars.append("desc").text('{"stroke": "none", "stroke-width": "0px"}');
        chart.selectAll(".numbers").data(sortedData).enter().append("text").attr("class", "numbers");
        chart.append("text").attr("x", leftPadding + 5).attr("y", 22).attr("class", "chartTitle");
        chart.append("g").attr("class", "axis").attr("transform", translate).call(d3.axisLeft().scale(yScale));
        chart.append("rect").attr("class", "chartFrame").attr("width", chartInnerWidth).attr("height", chartInnerHeight).attr("transform", translate);

        updateChart(bars, sortedData, colorScale);
    }

    // re-sort data based on new attribute
    function updateChart(bars, csvData, colorScale) {
        var sortedData = csvData.slice().sort((a, b) => b[expressed] - a[expressed]);
        xScale.domain(sortedData.map(d => d.country));
        yScale.domain([0, d3.max(sortedData, d => parseFloat(d[expressed]))]);
        
        // transition bars to new positions and heights
        bars.transition().duration(500).delay((d, i) => i * 15)
            .attr("x", d => xScale(d.country) + leftPadding)
            .attr("y", d => yScale(parseFloat(d[expressed])) + topBottomPadding)
            .attr("height", d => chartInnerHeight - yScale(parseFloat(d[expressed])))
            .style("fill", d => colorScale(parseFloat(d[expressed])));

        d3.selectAll(".numbers").transition().duration(500)
            .attr("x", d => xScale(d.country) + leftPadding + xScale.bandwidth() / 2)
            .attr("y", d => yScale(parseFloat(d[expressed])) + topBottomPadding + 13)
            .text(d => d[expressed]);

        d3.select(".chartTitle").text(toTitleCase(expressed) + " by Country");
        d3.select(".axis").transition().duration(500).call(d3.axisLeft().scale(yScale));
        updateLegend(colorScale);
    }

    // create dropdown menu for attribute selection
    function createDropdown(csvData, mapContainer) {
        var dropdown = mapContainer.append("select").attr("class", "dropdown")
            .on("change", function() { changeAttribute(this.value, csvData); });

        dropdown.selectAll(".attrOption").data(attrArray).enter().append("option")
            .attr("class", "attrOption").attr("value", d => d)
            .text(d => toTitleCase(d));
    }

    // update map and chart based on new attribute
    function changeAttribute(attribute, csvData) {
        expressed = attribute;
        var colorScale = makeColorScale(csvData);

        d3.selectAll(".countries").transition().duration(1000)
            .style("fill", d => {
                var val = d.properties[expressed];
                return (val !== undefined && !isNaN(val)) ? colorScale(val) : "#ccc";
            });

        // re-sort bars and update chart
        var sortedData = csvData.slice().sort((a, b) => b[expressed] - a[expressed]);
        var bars = d3.selectAll(".bars").data(sortedData, d => d.country);
        updateChart(bars, sortedData, colorScale);
        updateExplainer();
    }

    // update explainer text based on selected attribute
    function updateExplainer() {
        d3.select("#explainer-title").text(toTitleCase(expressed));
        d3.select("#explainer-body").text(metadata[expressed]);
    }

    // create retrive element on hover
    function highlight(props) {
        var name = props.country.replace(/\s+/g, "_");
        d3.selectAll("." + name).style("stroke", "#FFD700").style("stroke-width", "2px");
        setLabel(props);
    }

    // disable highlight
    function dehighlight(props) {
        var name = props.country.replace(/\s+/g, "_");
        d3.selectAll("." + name)
            .style("stroke", function() { return JSON.parse(d3.select(this).select("desc").text()).stroke; })
            .style("stroke-width", function() { return JSON.parse(d3.select(this).select("desc").text())["stroke-width"]; });
        d3.select(".infolabel").remove();
    }

    // create dynamic label
    function setLabel(props) {
        var labelHtml = `<div class='labelname'>${props.country}</div>
            <div class='label-main'><span class='label-val'>${props[expressed]}</span> 
            <span class='label-attr'>${toTitleCase(expressed)}</span></div>
            <div class='label-stats'>
                <span>🥇 ${props.gold || 0}</span><span>🥈 ${props.silver || 0}</span>
                <span>🥉 ${props.bronze || 0}</span><span>Total: ${props.total || 0}</span>
            </div>`;

        d3.select("body").append("div").attr("class", "infolabel").html(labelHtml);
    }

    // move label with mouse
    function moveLabel(event) {
        var labelNode = d3.select(".infolabel").node();
        if (!labelNode) return;
        var labelWidth = labelNode.getBoundingClientRect().width;
        var x = event.clientX > window.innerWidth - labelWidth - 20 ? event.clientX - labelWidth - 10 : event.clientX + 10;
        var y = event.clientY < 75 ? event.clientY + 25 : event.clientY - 75;
        d3.select(".infolabel").style("left", x + "px").style("top", y + "px");
    }

    // create legend based on color scale
    function setLegend(colorScale, legendContainer) {
        var legendWidth = 140, legendHeight = 125;
        var legend = d3.select(legendContainer.node()).append("svg").attr("class", "legend")
            .attr("width", legendWidth).attr("height", legendHeight);

        legend.append("text").attr("class", "legendTitle").attr("x", 0).attr("y", 12).text(toTitleCase(expressed));

        colorScale.range().forEach(function(color, i) {
            var rowY = 20 + i * 20;
            legend.append("rect").attr("class", "legendRect legend_" + i).attr("x", 0).attr("y", rowY).attr("width", 16).attr("height", 16).style("fill", color).style("stroke", "#aaa").style("stroke-width", "0.5px");
            legend.append("text").attr("class", "legendText legend_" + i).attr("x", 22).attr("y", rowY + 13);
        });
        updateLegend(colorScale);
    }

    // update legend text based on new color scale
    function updateLegend(colorScale) {
        var quantiles = colorScale.quantiles();
        d3.select(".legendTitle").text(toTitleCase(expressed));
        colorScale.range().forEach(function(color, i) {
            var low = i === 0 ? colorScale.domain()[0].toFixed(2) : quantiles[i - 1].toFixed(2);
            var high = i < quantiles.length ? quantiles[i].toFixed(2) : colorScale.domain()[colorScale.domain().length - 1].toFixed(2);
            d3.select(".legendRect.legend_" + i).style("fill", color);
            d3.select(".legendText.legend_" + i).text(low + " – " + high);
        });
    }

    // helper function to convert attribute names to upper-case
    function toTitleCase(str) {
        return str.replace(/_/g, " ").split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

})();