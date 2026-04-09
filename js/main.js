(function(){

    var attrArray = ["gold", "silver", "bronze", "total", "athletes",
                     "gold_pct", "total_per_athlete", "pop_millions", "medals_per_million"];
    var expressed = attrArray[0];

    window.onload = setMap();

    function setMap() {

        var width = window.innerWidth * 0.45,
            height = 460;

        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        var projection = d3.geoEqualEarth()
            .scale(160)
            .translate([width / 2, height / 2]);

        var path = d3.geoPath()
            .projection(projection);

        var promises = [
            d3.csv("data/MedalData.csv"),
            d3.json("data/WorldCountries.topojson")
        ];
        Promise.all(promises).then(callback);

        function callback(data) {
            var csvData = data[0];
            var countries = data[1];

            var worldCountries = topojson.feature(countries, countries.objects.ne_110m_admin_0_countries);

            worldCountries = joinData(worldCountries, csvData);

            var colorScale = makeColorScale(csvData);

            setEnumerationUnits(worldCountries, map, path, colorScale);

            setChart(csvData, colorScale);
        }
    }

    function joinData(worldCountries, csvData) {

        var nameMap = {
            "Great Britain": "United Kingdom"
        };

        for (var i = 0; i < csvData.length; i++) {
            var csvCountry = csvData[i];
            var csvKey = nameMap[csvCountry.country] || csvCountry.country;

            for (var a = 0; a < worldCountries.features.length; a++) {
                var geojsonProps = worldCountries.features[a].properties;
                var geojsonKey = geojsonProps.NAME;

                if (geojsonKey == csvKey) {
                    attrArray.forEach(function(attr) {
                        geojsonProps[attr] = parseFloat(csvCountry[attr]);
                    });
                }
            }
        }

        return worldCountries;
    }

    function makeColorScale(data) {
        var colorClasses = [
            "#feedde",
            "#fdbe85",
            "#fd8d3c",
            "#e6550d",
            "#a63603"
        ];

        var colorScale = d3.scaleQuantile()
            .range(colorClasses);

        var domainArray = [];
        for (var i = 0; i < data.length; i++) {
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        }

        colorScale.domain(domainArray);

        console.log("Class breaks:", colorScale.quantiles());

        return colorScale;
    }

    function setEnumerationUnits(worldCountries, map, path, colorScale) {

        var countryPaths = map.selectAll(".countries")
            .data(worldCountries.features)
            .enter()
            .append("path")
            .attr("class", function(d) {
                return "countries " + d.properties.NAME;
            })
            .attr("d", path)
            .style("fill", function(d) {
                var value = d.properties[expressed];
                if (value !== undefined && value !== null && !isNaN(value)) {
                    return colorScale(value);
                } else {
                    return "#ccc";
                }
            });
    }

    function setChart(csvData, colorScale) {

        var chartWidth = window.innerWidth * 0.4,
            chartHeight = 473,
            leftPadding = 25,
            rightPadding = 2,
            topBottomPadding = 35,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topBottomPadding * 2,
            translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        var yScale = d3.scaleLinear()
            .range([chartInnerHeight, 0])
            .domain([0, d3.max(csvData, function(d) {
                return parseFloat(d[expressed]);
            })]);

        var bars = chart.selectAll(".bars")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b) {
                return b[expressed] - a[expressed];
            })
            .attr("class", function(d) {
                return "bars " + d.country;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .attr("x", function(d, i) {
                return i * (chartInnerWidth / csvData.length) + leftPadding;
            })
            .attr("height", function(d) {
                return chartInnerHeight - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d) {
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            .style("fill", function(d) {
                return colorScale(d[expressed]);
            });

        var numbers = chart.selectAll(".numbers")
            .data(csvData)
            .enter()
            .append("text")
            .sort(function(a, b) {
                return b[expressed] - a[expressed];
            })
            .attr("class", "numbers")
            .attr("text-anchor", "middle")
            .attr("x", function(d, i) {
                var fraction = chartInnerWidth / csvData.length;
                return i * fraction + leftPadding + (fraction - 1) / 2;
            })
            .attr("y", function(d) {
                return yScale(parseFloat(d[expressed])) + topBottomPadding + 15;
            })
            .text(function(d) {
                return d[expressed];
            });

        var chartTitle = chart.append("text")
            .attr("x", leftPadding + 10)
            .attr("y", 25)
            .attr("class", "chartTitle")
            .text(expressed.replace(/_/g, " ") + " by Country");

        var yAxis = d3.axisLeft()
            .scale(yScale);

        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
    }

})();