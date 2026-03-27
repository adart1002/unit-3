// begin script when window loads
window.onload = setMap();

function setMap() {

    // map frame dimensions
    var width = 960,
        height = 460;

    // create new svg container for map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    // create Equal Earth projection centered on the world
    var projection = d3.geoEqualEarth()
        .scale(160)
        .translate([width / 2, height / 2]);

    // create path generator
    var path = d3.geoPath()
        .projection(projection);

// set up choropleth map
    var promises = [
        d3.csv("data/MedalData.csv"),
        d3.json("data/WorldCountries.topojson")
    ];
    Promise.all(promises).then(callback);

    function callback(data) {
        csvData = data[0];
        countries = data[1];

        // translate countries topojson to geojson
        var worldCountries = topojson.feature(countries, countries.objects.ne_110m_admin_0_countries);

        // add countries to map
        var countryPaths = map.selectAll(".countries")
            .data(worldCountries.features)
            .enter()
            .append("path")
            .attr("class", function(d) {
                return "countries " + d.properties.NAME;
            })
            .attr("d", path);

        console.log(csvData);
        console.log(countries);
    };
};