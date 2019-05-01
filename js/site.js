function hxlProxyToJSON(input){
    var output = [];
    var keys = [];
    input.forEach(function(e,i){
        if(i==0){
            e.forEach(function(e2,i2){
                var parts = e2.split('+');
                var key = parts[0]
                if(parts.length>1){
                    var atts = parts.splice(1,parts.length);
                    atts.sort();                    
                    atts.forEach(function(att){
                        key +='+'+att
                    });
                }
                keys.push(key);
            });
        } else {
            var row = {};
            e.forEach(function(e2,i2){
                row[keys[i2]] = e2;
            });
            output.push(row);
        }
    });
    return output;
}

function parseDates(tags,data){
    var parseDateFormat = d3.time.format("%d-%m-%Y").parse;
    data.forEach(function(d){
        tags.forEach(function(t){
            d[t] = parseDateFormat(d[t]);
        });
    });
    return data;
}

function checkIntData(d){
    return (isNaN(parseInt(d)) || parseInt(d)<0) ? 0 : parseInt(d);
}

var date_sort = function (d1, d2) {
    if (d1['#date'] > d2['#date']) return 1;
    if (d1['#date'] < d2['#date']) return -1;
    return 0;
}

var target_date_sort = function (d1, d2) {
    if (d1['#date+start'] > d2['#date+start']) return 1;
    if (d1['#date+start'] < d2['#date+start']) return -1;
    return 0;
}

function monthDiff(d1, d2) {
    return d2.getMonth() - d1.getMonth() + 1;
}

function generateDescription(descriptionData){
    $('.description-text h1').text(descriptionData[0]['#description+title']);
    $('.description-text p').text(descriptionData[0]['#description'])
}

function getMonthName(monthID) {
    var monthArray = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthArray[monthID];
}

var formatComma = d3.format(',');
var targetcf, 
    progresscf,
    targetIndicatorDim,
    progressIndicatorDim,
    targetGroupByIndicator,
    progressGroupByIndicator;

function generateCharts(targetData, progressData, keyfigureTargetData, keyfigureProgressData){
    targetcf = crossfilter(targetData);
    progresscf = crossfilter(progressData);
    keyfigureTargetcf = crossfilter(keyfigureTargetData);
    keyfigureProgresscf = crossfilter(keyfigureProgressData);

    targetData.forEach(function(d){
        d['#targeted'] = checkIntData(d['#targeted']);
    });
    progressData.forEach(function(d){
        d['#value'] = checkIntData(d['#value']);
    });
    keyfigureTargetData.forEach(function(d){
        d['#targeted'] = checkIntData(d['#targeted']);
    });
    keyfigureProgressData.forEach(function(d){
        d['#value'] = checkIntData(d['#value']);
    });

    //get target and progress dimensions by indicator
    targetIndicatorDim = targetcf.dimension(function(d) { return d['#sector']+'|'+d['#indicator']; });
    progressIndicatorDim = progresscf.dimension(function(d) { return d['#indicator']; });

    targetGroupByIndicator = targetIndicatorDim.group().reduceSum(function(d){return d['#targeted']; }).all();
    progressGroupByIndicator = progressIndicatorDim.group().reduceSum(function(d){return d['#value']; }).all();
    
    //get target and progress data values for key stats
    keyfigureTargetIndicatorDim = keyfigureTargetcf.dimension(function(d) { return d['#sector']+'|'+d['#indicator']; });
    keyfigureProgressIndicatorDim = keyfigureProgresscf.dimension(function(d) { return d['#indicator']; });

    keyfigureTargetGroupByIndicator = keyfigureTargetIndicatorDim.group().reduceSum(function(d){return d['#targeted']; }).all();
    keyfigureProgressGroupByIndicator = keyfigureProgressIndicatorDim.group().reduceSum(function(d){return d['#value']; }).all();

    for (var i=0; i<targetGroupByIndicator.length; i++) {
        if (targetGroupByIndicator[i].key.length>1) {
            //create data structure for target line
            var currentSector = targetGroupByIndicator[i].key.split('|')[0];
            var currentIndicator = targetGroupByIndicator[i].key.split('|')[1];
            var targetArr = targetIndicatorDim.filter(targetGroupByIndicator[i].key).top(Infinity).sort(target_date_sort);
            var startDate = new Date(targetArr[0]['#date+start']);
            var endDate = new Date(targetArr[0]['#date+end']);
            var mthDiff = monthDiff(startDate, endDate);
            var spanType = targetArr[0]['#meta+cumulative'];
            var dateRange = '';
            switch(spanType.toLowerCase()) {
                case 'per month':
                    dateRange = (targetArr[0]['#date+end']!=null) ? ' as of ' + getMonthName(endDate.getMonth()) : '';
                    break;
                case 'monthly':
                    dateRange = ' as of ' + getMonthName(endDate.getMonth());
                    break;
                default:
                    dateRange = ' ' + getMonthName(startDate.getMonth()) + ' to ' + getMonthName(endDate.getMonth());
            }

            var keyfigureTarg = '';
            keyfigureTargetGroupByIndicator.forEach(function(obj, index) { 
                if (obj.key == targetGroupByIndicator[i].key) {
                    keyfigureTarg = obj.value;
                }
            });
            var keyfigureProg = '';
            keyfigureProgressGroupByIndicator.forEach(function(obj, index) { 
                if (obj.key == currentIndicator) {
                    keyfigureProg = obj.value;
                }
            });

            //get target values
            var valueTargetArray = ['Target'];
            var targetVal = 0;
            if (spanType.toLowerCase()=='per month') {
                var lastDate = new Date();
                var total = 0;
                var first = true;
                targetArr.forEach(function(value, index) {
                    if (first) {
                        lastDate = value['#date+start'];
                        first = false;
                    }
                    if (value['#date+start'].getTime() != lastDate.getTime()) {
                        lastDate = value['#date+start'];
                        valueTargetArray.push(total);
                        targetVal += Number(total);
                        total = 0;
                    }
                    total += value['#targeted'];
                });
                //add last total to array
                valueTargetArray.push(total);
            }
            else {
                for (var j=0; j<mthDiff; j++) {
                    valueTargetArray.push(targetGroupByIndicator[i].value);
                }
            }

            //get progress values
            var indicatorArr = progressIndicatorDim.filter(currentIndicator).top(Infinity).sort(date_sort);
            var dateArray = ['x'];
            var valueReachedArray = ['Reached'];
            var lastDate = new Date();
            var total = 0;
            var first = true;
            indicatorArr.forEach(function(value, index) {
                if (first) {
                    lastDate = value['#date'];
                    dateArray.push(lastDate);
                    first = false;
                }
                if (value['#date'].getTime() != lastDate.getTime()) {
                    lastDate = value['#date'];
                    valueReachedArray.push(total);
                    dateArray.push(lastDate);
                    total = 0;
                }
                total += value['#value'];
            });
            //add last total to array
            valueReachedArray.push(total);

            var sectorIcon = currentSector.toLowerCase().replace(/ /g, '').split('(')[0];
            var targClass = (keyfigureTarg <= 0) ? 'hidden' : '';
            var reachClass = (keyfigureProg <= 0) ? 'hidden' : '';

            //create key stats
            $('.graphs').append('<div class="col-sm-6 col-md-4" id="indicator' + i + '"><div class="header"><i class="icon-ocha icon-'+sectorIcon+'"></i><h4>' + currentSector + '</h4><h3>'+  currentIndicator +'</h3></div><div class="chart-container"><div class="keystat-container"><div class="keystat ' + targClass + '"><div class="num targetNum">' + formatComma(keyfigureTarg) + '</div> targeted</div><div class="keystat ' + reachClass + '"><div class="num reachedNum">' + formatComma(keyfigureProg) + '</div> reached</div></div><div class="timespan text-center small">(' + spanType + dateRange + ')</div><div id="chart' + i + '" class="chart"></div></div></div>');

            //create bar charts
            var chartType = 'line';
            var chart = c3.generate({
                bindto: '#chart'+i,
                size: { height: 200 },
                data: {
                    x: 'x',
                    type: chartType,
                    columns: [ dateArray, valueReachedArray, valueTargetArray ],
                    colors: {
                        Target: '#659ad2',
                        Reached: '#f47933'
                    }
                },
                axis: {
                    x: {
                        type: 'timeseries',
                        localtime: false,
                        tick: {
                            centered: true,
                            format: '%b %Y',
                            outer: false
                        }
                    },
                    y: {
                        tick: {
                            count: 5,
                            format: d3.format('.2s')
                        },
                        min: 0,
                        padding: { bottom : 0 }
                    }
                },
                tooltip: {
                    format: {
                        value: d3.format(',') 
                    }
                },
                padding: { right: 35 }
            });

            //store reference to chart
            $('#chart'+i).data('chartObj', chart);
        }
    }
}

function updateCharts(region) {
    for (var i=0; i<targetGroupByIndicator.length; i++) {
        //create data structure for target line
        var currentIndicator = targetGroupByIndicator[i].key.split('|')[1];
        var targetArr = targetIndicatorDim.filter(targetGroupByIndicator[i].key).top(Infinity);
        var targetedVal = 0, 
            startDate,
            endDate,
            mthDiff,
            keyfigureTarg = 0,
            keyfigureProg = 0;
        targetArr.forEach(function(value, index) {
            if (value['#adm1+name'] == region || region == '') {
                targetedVal += Number(value['#targeted']);
                startDate = new Date(value['#date+start']);
                endDate = new Date(value['#date+end']);
                mthDiff = monthDiff(startDate, endDate);
            }
        });

        //get key figure target number
        var keyfigureTargetArr = keyfigureTargetIndicatorDim.filter(targetGroupByIndicator[i].key).top(Infinity);
        keyfigureTargetArr.forEach(function(value, index) {
            if (value['#adm1+name'] == region || region == '') {
                keyfigureTarg += Number(value['#targeted']);
            }
        });
        //get key figure progress number
        var keyfigureProgressArr = keyfigureProgressIndicatorDim.filter(currentIndicator).top(Infinity);
        keyfigureProgressArr.forEach(function(value, index) {
            if (value['#adm1+name'] == region || region == '') {
                keyfigureProg += Number(value['#value']);
            }
        });

        //get target values
        var valueTargetArray = ['Target'];
        var targetVal = 0;
        if (targetArr[0]['#meta+cumulative'].toLowerCase()=='per month') {
            var lastDate = new Date();
            var total = 0;
            var first = true;
            targetArr.forEach(function(value, index) {
                if (targetArr[index]['#adm1+name'] == region || region == '') {
                    if (first) {
                        lastDate = value['#date+start'];
                        first = false;
                    }
                    if (value['#date+start'].getTime() != lastDate.getTime()) {
                        lastDate = value['#date+start'];
                        valueTargetArray.push(total);
                        targetVal += Number(total);
                        total = 0;
                    }
                    total += value['#targeted'];
                }
            });
            //add last total to array
            valueTargetArray.push(total);
            targetVal += Number(total);
        }
        else {
            for (var j=0; j<mthDiff; j++) {
                valueTargetArray.push(targetedVal);
            }
        }

        //get progress data
        var indicatorArr = progressIndicatorDim.filter(currentIndicator).top(Infinity).sort(date_sort);
        var dateArray = ['x'];
        var valueReachedArray = ['Reached'];
        var lastDate = new Date();
        var total = 0;
        var first = true;
        var reachedVal = 0;
        indicatorArr.forEach(function(value, index) {
            if (indicatorArr[index]['#adm1+name'] == region || region == '') {
                if (first) {
                    lastDate = value['#date'];
                    dateArray.push(lastDate);
                    first = false;
                }
                if (value['#date'].getTime() != lastDate.getTime()) {
                    lastDate = value['#date'];
                    valueReachedArray.push(total);
                    dateArray.push(lastDate);
                    total = 0;
                }
                total += value['#value'];
            }
        });
        //add last total to array
        valueReachedArray.push(total);

        //update key figures
        var targClass = (keyfigureTarg <= 0) ? 'hidden' : '';
        var reachClass = (keyfigureProg <= 0) ? 'hidden' : '';
        $('#indicator'+i).find('.targetNum').parent().removeClass('hidden').addClass(targClass);
        $('#indicator'+i).find('.reachedNum').parent().removeClass('hidden').addClass(reachClass);

        $('#indicator'+i).find('.targetNum').html(formatComma(keyfigureTarg));
        $('#indicator'+i).find('.reachedNum').html(formatComma(keyfigureProg));

        //update bar charts
        var currentChart = $('#chart'+i).data('chartObj');
        currentChart.load({
            columns: [ dateArray, valueReachedArray, valueTargetArray ]
        });
    }
}


var mapsvg,
    centered;
var fillColor = '#dddddd';//rgba(199,214,235,0.5)';//'#c7d6ee';
var hoverColor = '#3b88c0';//'#f47933';
var inactiveFillColor = '#f2efe9';
function generateMap(adm1, countrieslabel){
    //remove loader and show map
    $('.sp-circle').remove();
    $('.map-container').fadeIn();

    var width = $('#map').width();
    var height = 400;

    mapsvg = d3.select('#map').append('svg')
        .attr('width', width)
        .attr('height', height);

    var mapscale = ($('body').width()<768) ? width*4.7 : width*2.7;
    var mapprojection = d3.geo.mercator()
        .center([47, 5])
        .scale(mapscale)
        .translate([width / 2, height / 2]);    

    var g = mapsvg.append('g').attr('id','adm1layer');
    var path = g.selectAll('path')
        .data(adm1.features).enter()
        .append('path')
        .attr('d', d3.geo.path().projection(mapprojection))
        .attr('id',function(d){
            return d.properties.admin1Name;
        })
        .attr('class',function(d){
            var classname = (d.properties.admin1Name != '0') ? 'adm1' : 'inactive';
            return classname;
        })
        .attr('fill', function(d) {
            var clr = (d.properties.admin1Name != '0') ? fillColor: inactiveFillColor;
            return clr;
        })
        .attr('stroke-width', 1)
        .attr('stroke','#7d868d');

    //map tooltips
    var maptip = d3.select('#map').append('div').attr('class', 'd3-tip map-tip hidden');
    path.filter('.adm1')
        .on('mousemove', function(d,i) {
            $(this).attr('fill', hoverColor);
            var mouse = d3.mouse(mapsvg.node()).map( function(d) { return parseInt(d); } );
            maptip
                .classed('hidden', false)
                .attr('style', 'left:'+(mouse[0]+20)+'px; top:'+(mouse[1]+20)+'px')
                .html(d.properties.admin1Name)
        })
        .on('mouseout',  function(d,i) {
            if (!$(this).data('selected'))
                $(this).attr('fill', fillColor);
            maptip.classed('hidden', true);
        })
        .on('click', function(d,i){
            selectRegion($(this), d.properties.admin1Name);
        }); 

    //create country labels
    var country = g.selectAll('text')
        .data(countrieslabel).enter()
        .append('text')
        .attr('class', 'countryLabel')
        .attr("transform", function(d) {
          return "translate(" + mapprojection([d.coordinates[0], d.coordinates[1]]) + ")";
        })
        .text(function(d){ return d.country; });

    $('.reset-btn').on('click', reset);
}

function selectRegion(region, name) {
    region.siblings().data('selected', false);
    region.siblings('.adm1').attr('fill', fillColor);
    region.attr('fill', hoverColor);
    region.data('selected', true);
    $('.regionLabel > div > strong').html(name);
    updateCharts(name);
}

function reset() {
    $('#adm1layer').children('.adm1').attr('fill', fillColor);
    $('.regionLabel > div > strong').html('All Regions');
    updateCharts('');
    return false;
}

var somCall = $.ajax({ 
    type: 'GET', 
    url: 'data/som-merged-topo.json',
    dataType: 'json',
});

var adm1Call = $.ajax({ 
    type: 'GET', 
    url: 'data/som_adm1.json',
    dataType: 'json',
});

var countrieslabelCall = $.ajax({ 
    type: 'GET', 
    url: 'data/countries.json',
    dataType: 'json',
});


$.when(adm1Call, somCall, countrieslabelCall).then(function(adm1Args, somArgs, countrieslabelArgs){
    var countrieslabel = countrieslabelArgs[0].countries;
    generateMap(somArgs[0], countrieslabel);
});