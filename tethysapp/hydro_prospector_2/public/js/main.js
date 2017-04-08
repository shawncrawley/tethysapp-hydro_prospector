//loads modal on page load
MONTHLY_STATS = {
    'Jan': {'daylight': 0.46, 'temperature': 52.0},
    'Feb': {'daylight': 0.48, 'temperature': 52.7},
    'Mar': {'daylight': 0.50, 'temperature': 53.7},
    'Apr': {'daylight': 0.52, 'temperature': 54.7},
    'May': {'daylight': 0.54, 'temperature': 55.5},
    'Jun': {'daylight': 0.55, 'temperature': 55.9},
    'Jul': {'daylight': 0.55, 'temperature': 55.7},
    'Aug': {'daylight': 0.53, 'temperature': 54.9},
    'Sep': {'daylight': 0.51, 'temperature': 54.0},
    'Oct': {'daylight': 0.49, 'temperature': 53.0},
    'Nov': {'daylight': 0.47, 'temperature': 52.2},
    'Dec': {'daylight': 0.46, 'temperature': 51.7}
};

var averagePrecip, watershedArea;

$(document).ready(function () {
    $("#welcome-popup").modal("show");
    $('#btnShowWaterUseStatsModal').on('click', function () {
        $('#modalWaterUseStats').modal('show');
    });
    $('#btnCalcWaterUseStats').on('click', function () {
        var totalVol = Number($('.volBlue').first().text()).toFixed(2);
        var k, t, p, crop;
        var uTotal = 0;

        $('.result-option').add('#results-waterUse')
            .addClass('hidden');

        // AGRICULTURAL CALCULATIONS
        if ($('#kValue1').val() == 999) {
            k = $('#kValue2').val();
            crop = $('#cropName').val();
        } else {
            k = $('#kValue1').val();
            crop = $('#kValue1').find(':selected').text().split(' ')[1].slice(1, -1);
        }

        $('.month').each(function (i, obj) {
            var $this = $(obj);
            if ($this.is(':checked')) {
                t = MONTHLY_STATS[$this.val()]['temperature'];
                p = MONTHLY_STATS[$this.val()]['daylight'];
                uTotal += (k * t * p / 100);
            }
        });

        // watershedArea is in square kilometers
        // uTotal is in inches
        // totalVol is in cubic meters
        // 0.00972855818531 ac-in in 1 m^3 (http://www.convertunits.com/from/cubic+foot/to/acre+inch)

        var totalVolAcreInch = totalVol * 0.00972855818531;
        var totalCropAcres = totalVolAcreInch / uTotal;

        $('#result-acres').text(Number(totalCropAcres).toFixed(2));
        $('#result-crop').text(crop);

        // DOMESTIC CALCULATIONS

        var householdWater = $('#householdWater').val();

        if ($('#domesticOption1').is(':checked')) {
            // householdWater is in liters
            // totalVol is in cubic meters
            // 1 m^3 is 1000 liters

            var householdsServed = parseInt(totalVol * 1000 / householdWater);
            $('.result-households').text(householdsServed);

            $('#result-option1').removeClass('hidden');
        } else {
            var numHouseholds = Number($('#householdCount').val());
            var daysServed = totalVol * 1000 / (householdWater * numHouseholds);

            $('.result-households').text(numHouseholds);
            $('#result-days').text(daysServed);

            $('#result-option2').removeClass('hidden');
        }

        $('#results-waterUse').removeClass('hidden');
        var body = $('#modalWaterUseStats').find('.modal-body')
        body.scrollTop(body[0].scrollHeight);
    });
});

//----------------------------------------------------------------------------------------------------------------------

//creates variable for public functions
var app;

//imports necessary packages and calls app main function
require(["dojo/dom",
        "dojo/_base/array",
        "esri/Color",

        "esri/map",
        "esri/toolbars/draw",
        "esri/layers/FeatureLayer",
        "esri/SnappingManager",
        "esri/graphic",
        "esri/graphicsUtils",
        "esri/tasks/Geoprocessor",
        "esri/tasks/FeatureSet",
        "esri/tasks/LinearUnit",
        "esri/symbols/SimpleMarkerSymbol",
        "esri/symbols/SimpleLineSymbol",
        "esri/symbols/SimpleFillSymbol","esri/request"],
    function(dom, array, Color, Map, Draw, FeatureLayer, SnappingManager,
             Graphic, GraphicsUtils, GeoProcessor, FeatureSet, LinearUnit,
             SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, esriRequest) {

        //creates map
        var map = new Map("mapDiv", {
            center: [-69.5, 18.6],
            zoom: 8,
            basemap: "hybrid"
        });

        var toolbar;

        //creates streamlines featuer layer and adds it to the map
        var featureLayer = new FeatureLayer("http://geoserver.byu.edu/arcgis/rest/services/hydropower_mskl/backgroundData/MapServer/1");
        map.addLayer(featureLayer);

        var layerInfos = [{
            layer: featureLayer
        }];

        //add snapping functionality to the map
        map.enableSnapping({alwaysSnap: true}).setLayerInfos(layerInfos);

        //creates geoprocessing task by calling geoprocessing service for server
        gp = new GeoProcessor("http://geoserver.byu.edu/arcgis/rest/services/FDC_Jackson/FDCCalc3/GPServer/FDC%20Calculator");
        gp.setOutputSpatialReference({wkid: 102100});

        //creates drawing tool
        function createToolbar(map) {
            toolbar = new Draw(map);
            toolbar.on("draw-complete", addPointToMap);
        }

        //function to enable draw point tool on map
        var pointTest;
        function drawPoint() {
            map.graphics.clear();
            if (pointTest === false) {
                toolbar.deactivate();
            }
            pointTest = true;
            map.graphics.clear();
            map.setMapCursor("crosshair");
            $("#initDraw").bind("click", createToolbar(map));
            toolbar.activate(Draw.POINT);
            map.hideZoomSlider();
        }

        //variable to save point drawn on map for later use when running geoprocessing task
        var featureSet = new FeatureSet();

        //gets parameters and sends request to server to run geoprocessing service
        function submitResRequest() {
            // USE FOR TESTING RESULTS MODAL
            // resultsRequestSucceeded('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]');
            // return;
            var params = {
                "pour_point": featureSet,
                "height": $("#damHeight").val(),
                "curve_number": $('#curveNumber').val()
            };
            map.setMapCursor("progress");
            gp.submitJob(params, completeCallback, statusCallback);
        }

        //creates symbology for point, draws point, adds it to map, and adds it to feature set variable
        function addPointToMap(evt) {
            var pointSymbol = new SimpleMarkerSymbol();
            pointSymbol.setSize(14);
            pointSymbol.setOutline(new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 1));
            pointSymbol.setColor(new Color([0, 0, 255, 0.25]));

            map.setMapCursor("auto");
            map.showZoomSlider();
            if (pointTest === true) {
                var graphic = new Graphic(evt.geometry, pointSymbol);
                map.graphics.add(graphic);

                var features = [];
                features.push(graphic);
                featureSet.features = features;
                pointTest = false;
            }
            $('#btnSubmitProperties').prop('disabled', false);
            $('#modalPropertiesForm').modal('show');
        }

        //displays request status
        function statusCallback(jobInfo) {
            if (jobInfo.jobStatus === "esriJobSubmitted") {
                $("#status").html("<h6>Request submitted...</h6>");
            } else if (jobInfo.jobStatus === "esriJobExecuting") {
                $("#status").html("<h6>Executing...</h6>");
            } else if (jobInfo.jobStatus === "esriJobSucceeded") {
                $("#status").html("<h6>Retrieving results...</h6>");
            }
        }

        //calls draw reservoir and get volume on success, or failedcallback on failed request
        function completeCallback(jobInfo) {
            $('#status').addClass('hidden');
            map.graphics.clear();
            gp.getResultData(jobInfo.jobId, "watershed", drawWatershed, failedCallback);
            gp.getResultData(jobInfo.jobId, "reservoir", drawReservoir);
            gp.getResultData(jobInfo.jobId, "volume", getVolume);
            /* The next line shows the workaround that I found. So in the python geoprocessing script you created, there
             are various arcpy.AddMessage() calls. Well, it turns out that the web service geoprocessing task writes
             those messages to the "messages" property of the jobInfo callback variable. I saw that on line 172 of your
             script (https://github.com/elisenavidad/FDC-Storage/blob/master/tethysapp/storage_capacity/public/arcgis/FDC_Storage2.py#L172)
             you called arcpy.AddMessage(results). Thus, the results were actually stored inside the jobInfo.messages
             array. By inspection, I found that it was stored in the 18th index (19th item) in the array. The actual
             text of the message is stored in the "description" property of the message.
             If you were wanting to convert the string to an actual list, you would use the eval() function I showed you.
             Like so:
             var results_list = eval(jobInfo.messages[18].description)
             */
            resultsRequestSucceeded(jobInfo);
            // gp.getResultData(jobInfo.jobId, "results", getResults);
        }

        //prints alert for wrong input point on failed request
        function failedCallback() {
            map.setMapCursor("auto");
            $("#status").html("<p class='bg-danger'><span class='volError'>No nearby stream found</span></p>");
            alert("No major stream found nearby. Please click at least within 100 meters of a major stream.")
        }

        //creates reservoir polygon on successful request and adds it to the map
        function drawReservoir(reservoir) {
            var polySymbol = new SimpleFillSymbol();
            polySymbol.setOutline(new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 0, 255, 0.5]), 1));
            polySymbol.setColor(new Color([0, 127, 255, 0.7]));
            var features = reservoir.value.features;
            for (var f = 0, fl = features.length; f < fl; f++) {
                var featureRe = features[f];
                featureRe.setSymbol(polySymbol);
                map.graphics.add(featureRe);
            }
        }

        //creates watershed polygon on successful request and adds it to the map
        function drawWatershed(watershed) {
            var polySymbol = new SimpleFillSymbol();
            polySymbol.setOutline(new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 0, 255, 0.5]), 2));
            polySymbol.setColor(new Color([0, 127, 255, 0]));
            var features = watershed.value.features;
            for (var f = 0, fl = features.length; f < fl; f++) {
                var featureWa = features[f];
                featureWa.setSymbol(polySymbol);
                map.graphics.add(featureWa);
            }
            map.setMapCursor("auto");
            map.setExtent(GraphicsUtils.graphicsExtent(map.graphics.graphics), true);
        }

        //sends request to get volume text file from server
        function getVolume(volume) {
            var req = esriRequest({
                "url": volume.value.url,
                "handleAs": "text"
            });
            req.then(volRequestSucceeded, volRequestFailed);
        }

        //manipulates text dile and adds total volume to app on successful text file request
        function volRequestSucceeded(response){
            var elem = response.split(",");
            var volNumber = Number(elem[elem.length - 1]).toFixed(2);
            $(".vol").html(
                "<h5>Total Volume:</h5>" +
                "<p class='bg-primary'><span class='volBlue'>" + volNumber + "</span> Cubic Meters</p>"
            );
            $('.result-water').text(volNumber);
        }

        //returns error on failed text file request
        function volRequestFailed(error){
            $("#status").html("<p class='bg-danger'>Error: " + error + " happened while retrieving the volume</p>");
        }

        function resultsRequestSucceeded(results){
            var flowList = results.messages[18].description;
            console.log(flowList);
            var percentList = JSON.stringify([99,95,90,85,80,75,70,60,50,40,30,20]);
            averagePrecip = Number(results.messages[15].description.split('=')[1]);
            watershedArea = Number(results.messages[14].description.split('=')[1]);
            $.ajax({
                url: '/apps/hydro-prospector-2/calculate-capacity/',
                type: 'POST',
                data: $('#parameters-form').serialize() + '&percentList=' + percentList + '&flowList=' + flowList,
                success: function (responseHtml) {
                    $('#results').html(responseHtml);
                    $('#btnShowModalResults').removeClass('hidden');
                    $('#modalResults').one('shown.bs.modal', function () {
                        initHighChartsPlot($('.highcharts-plot'), 'spline');
                    });
                    $('#modalResults').modal('show');
                }
            })
        }

        function initHighChartsPlot($element, plot_type) {
            if ($element.attr('data-json')) {
                var json_string, json;

                // Get string from data-json attribute of element
                json_string = $element.attr('data-json');

                // Parse the json_string with special reviver
                json = JSON.parse(json_string, functionReviver);
                $element.highcharts(json);
            }
            else if (plot_type === 'line' || plot_type === 'spline') {
                initLinePlot($element[0], plot_type);
            }
        }

        function initLinePlot(element, plot_type) {
            var title = $(element).attr('data-title');
            var subtitle = $(element).attr('data-subtitle');
            var series = $.parseJSON($(element).attr('data-series'));
            var xAxis = $.parseJSON($(element).attr('data-xAxis'));
            var yAxis = $.parseJSON($(element).attr('data-yAxis'));

            $(element).highcharts({
                chart: {
                    type: plot_type
                },
                title: {
                    text: title,
                    x: -20 //center
                },
                subtitle: {
                    text: subtitle,
                    x: -20
                },
                xAxis: {
                    title: {
                        text: xAxis['title']
                    },
                    labels: {
                        formatter: function() {
                            return this.value + xAxis['label'];
                        }
                    }
                },
                yAxis: {
                    title: {
                        text: yAxis['title']
                    },
                    labels: {
                        formatter: function() {
                            return this.value + yAxis['label'];
                        }
                    }
                },
                tooltip: {
                    valueSuffix: '°C'
                },
                legend: {
                    layout: 'vertical',
                    align: 'right',
                    verticalAlign: 'middle',
                    borderWidth: 0
                },
                series: series
            });
        }

        function functionReviver(k, v) {
            if (typeof v === 'string' && v.indexOf('function') !== -1) {
                var fn;
                // Pull out the 'function()' portion of the string
                v = v.replace('function ()', '');
                v = v.replace('function()', '');

                // Create a function from the string passed in
                fn = Function(v);

                // Return the handle to the function that was created
                return fn;
            } else {
                return v;
            }
        }

        $('[name=domesticOption').on('change', function () {
           $('#householdCountDiv').toggleClass('hidden', !$('#domesticOption2').is(':checked'));
        });

        $('#btnSubmitProperties').on('click', function () {
            $('#status').removeClass('hidden');
        });

        //adds public functions to variable app
        app = {map: map, drawPoint: drawPoint, submitResRequest: submitResRequest};
    });