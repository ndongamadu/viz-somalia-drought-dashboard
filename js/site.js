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

function getMonthName(monthID) {
  var monthArray = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return monthArray[monthID];
}

var formatComma = d3.format(',');
var formatNum = d3.format('.2s');

function generateDescription(descriptionData){
  $('.title span').text('as of ' + descriptionData[0]['#date+reported']);
  $('.description-text p').text(descriptionData[0]['#description'])
}

function updateCharts(region) {
  idpLineChart.load({
    columns: getDisplacedData(region)
  });
  idpLineChart.hide('Displaced');
}

var mapsvg,
    centered;
var fillColor = '#dddddd';
var hoverColor = '#3b88c0';
var inactiveFillColor = '#f2efe9';
function generateMap(adm1, countrieslabel, idpData){
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

  cf = crossfilter(idpData);
  idpsDimension = cf.dimension(function(d){
    return [d['#adm1+dest+name'], d['#meta+category'], d['#date+reported']];
  });

  idpsGroup = idpsDimension.group().reduceSum(function(d){ return d['#affected']; }).top(Infinity).sort(date_sort);

  var dim = cf.dimension(function(d){ return [d['#meta+category'],d['#date+reported']];});
  var grp = dim.group().reduceSum(function(d){ return d['#affected'];}).top(Infinity).sort(date_sort);

  var maxDate = new Date(d3.max(idpData,function(d){return d['#date+reported'];})).getMonth();
  var minDate = new Date(d3.min(idpData,function(d){return d['#date+reported'];})).getMonth();
  selectFrom = document.getElementById('dateFrom');
  selectEnd = document.getElementById('dateEnd');
  for (var i = minDate; i <= maxDate; i++) {
    option = document.createElement( 'option' );
    option.value = option.text = monthNames[i];
    selectFrom.add( option );
  }
  for (var i = minDate; i <= maxDate; i++) {
    option = document.createElement( 'option' );
    option.value = option.text = monthNames[i];
    i === maxDate ? option.selected = true : '';
    selectEnd.add( option );
  }

  xUnfiltered.push('Date');
  yUnfiltered.push('Displaced');
  totalDrought = 0;
  totalConflict = 0;
  totalOther = 0;
  total = 0;

  for (var i = 0; i < grp.length; i++) {
    //Drought related
    total += grp[i].value
    if (grp[i].key[0]==='Drought related') {
      xUnfiltered.push(grp[i].key[1]);
      yUnfiltered.push(grp[i].value);
      totalDrought += grp[i].value;
    //Conflict/Insecurity
    } else if(grp[i].key[0]==='Conflict/Insecurity') {
      totalConflict +=grp[i].value;
    //Other
    } else if(grp[i].key[0]==='Other'){
      totalOther += grp[i].value;
    }

  }
  generateIdpStats(total,totalDrought,totalConflict,totalOther);

  idpLineChart = c3.generate({
    bindto: '#idpChart',
    size: {
      height: 320
    },
    data: {
      x: 'Date',
      columns:[xUnfiltered, yUnfiltered],
    },
    axis: {
      x: {
        type: 'timeseries',
        tick: {
          format: '%Y-%m-%d',
          count:52,
          outer: false
        }
      }
    }
  });
}// generateMap

var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

var date_sort = function (d1, d2) {
    if (d1.key > d2.key) return 1;
    if (d1.key < d2.key) return -1;
    return 0;
};


function getDisplacedData (adm1) {
  var fromDate = $('#dateFrom option:selected').text();
  var endDate = $('#dateEnd option:selected').text();

  var dateArray = [],
      affectedArray = [];
  var totalDrought = 0;
  var totalConflict = 0;
  var totalOther = 0;
  var total = 0;
  dateArray.push('Date');
  affectedArray.push(adm1);

  for (var i = 0; i < idpsGroup.length; i++) {
    if (idpsGroup[i].key[0]===adm1) {
      total += idpsGroup[i].value;
      if (idpsGroup[i].key[1]==='Drought related') {
        dateArray.push(idpsGroup[i].key[2]);
        affectedArray.push(idpsGroup[i].value);
        totalDrought += idpsGroup[i].value;
      } else if (idpsGroup[i].key[1]==='Conflict/Insecurity') {
        totalConflict += idpsGroup[i].value;

      } else if (idpsGroup[i].key[1]==='Other') {
        totalOther += idpsGroup[i].value;
      }
    }
  }
  generateIdpStats(total,totalDrought,totalConflict,totalOther);

  return [dateArray, affectedArray]
}//generateDisplacedData

function generateIdpStats (tot, drght,cfts,others) {
  $('#idpStats').html('');
  $('#idpStats').append('TOTAL IDPs: <span class="num">'+formatNum(tot)+'</span> Drought: <span class="num">'+formatNum(drght)+'</span> Conflicts: <span class="num">'+formatNum(cfts)+'</span> Other: <span class="num">'+formatNum(others)+'</span>');
} //generateIdpStats

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
  var chartObjects = idpLineChart.data.names();
  //remove Displaced in chartObjects

  generateIdpStats(total,totalDrought,totalConflict,totalOther);
  idpLineChart.hide();
  idpLineChart.toggle('Displaced').focus('Displaced');
  updateCharts('');
  return false;

}

/** River Level Charts **/
function generateRiverLevels(riverLevel1Data, riverLevel2Data) {
  var riverDataArray = [riverLevel1Data, riverLevel2Data];
  for (var i=0; i<riverDataArray.length; i++){
    var riverData = riverDataArray[i];
    var riverChart = '#riverLevel'+ (i+1) +'Chart';
    var riverName = (i==0) ? 'Shabelle River' : 'Juba River';
    var date = ['x'];
    var severity = ['Current Level'];
    var severityMean = ['Long Term Average'];
    for (var j=0; j<riverData.length; j++){
      var d = new Date(riverData[j]['#date+reported']+'-'+riverData[j]['#indicator+num']);
      if (d.getDay()==1){ //only show monday data to represent the week
        date.push(riverData[j]['#date+reported']+'-'+riverData[j]['#indicator+num']);
        severity.push(riverData[j]['#severity']);
        severityMean.push(riverData[j]['#severity+mean']);
      }
    }

    var chart = c3.generate({
      bindto: riverChart,
      title: { text: riverName },
      padding: { top: 20 },
      size: {
        height: 200
      },
      data: {
        x: 'x',
        xFormat: '%b-%d',
        columns: [date, severity, severityMean],       
        colors: {
          'Current Level': '#E56A54',
          'Long Term Average': '#418FDE'
        }
      },
      axis: {
        x: {
          type: 'timeseries',
          tick: {
            //count: 52,
            format: '%m-%d'
          }
        },
        y: {
          padding: {top: 0, bottom: 0},
          min: 0,
          tick: {
            count: 6,
            format: d3.format('.1f')
          }
        }
      }
    });
  }
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

var descriptionCall = $.ajax({ 
  type: 'GET', 
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F1LVJwQKBkX11ZTCy6UwPYlskJ1M1UhjRLkIJh4n6sUBE%2Fedit%23gid%3D0',
  dataType: 'json',
});

var riverLevel1Call = $.ajax({ 
  type: 'GET', 
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F16QXGa8aGIka_a0lhYx2O0rSVSy5KkUhmiNtOqGH0dVo%2Fedit%23gid%3D1461276083',
  dataType: 'json',
});

var riverLevel2Call = $.ajax({ 
  type: 'GET', 
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F16QXGa8aGIka_a0lhYx2O0rSVSy5KkUhmiNtOqGH0dVo%2Fedit%23gid%3D299718476',
  dataType: 'json',
});

var idpCall = $.ajax({ 
  type: 'GET', 
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F12o4Si6pqbLsjkxuWpZjtC8sIvSFpD7_DtkrMUAbt32I%2Fedit%23gid%3D1239684438',
  dataType: 'json',
});

var cf,
    idpsDimension,
    idpsGroup,
    idpLineChart,
    xUnfiltered = [],
    yUnfiltered =[],
    totalDrought,
    totalConflict,
    totalOther,
    total;
    
//description data
$.when(descriptionCall).then(function(descriptionArgs){
  var descriptionData = hxlProxyToJSON(descriptionArgs);
  generateDescription(descriptionData);
});

//map data
$.when(adm1Call, somCall, countrieslabelCall, idpCall).then(function(adm1Args, somArgs, countrieslabelArgs, idpArgs){
  var countrieslabel = countrieslabelArgs[0].countries;
  var idps = hxlProxyToJSON(idpArgs[0]);
  //generateDisplacedData(idps);
  generateMap(somArgs[0], countrieslabel, idps);

});

//river levels data
$.when(riverLevel1Call, riverLevel2Call).then(function(riverLevel1Args, riverLevel2Args){
  var riverLevel1Data = hxlProxyToJSON(riverLevel1Args[0]);
  var riverLevel2Data = hxlProxyToJSON(riverLevel2Args[0]);
  generateRiverLevels(riverLevel1Data, riverLevel2Data);
});

