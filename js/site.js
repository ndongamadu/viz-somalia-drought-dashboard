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

var date_sort = function (d1, d2) {
  if (d1.key[2] > d2.key[2]) return 1;
  if (d1.key[2] < d2.key[2]) return -1;
  return 0;
};

var formatNum = d3.format('.2s');

function generateDescription(descriptionData){
  $('.title span').text('as of ' + descriptionData[0]['#date+reported']);
  $('.description-text p').text(descriptionData[0]['#description'])
}

function updateCharts(displacedData) {
  var charts = idpLineChart.data.shown();
  var loadedCharts = [];
  for ( k in charts){
    loadedCharts.push(charts[k].id)
  }
  idpLineChart.load({
    unload: loadedCharts, //refresh chart
    columns: displacedData
    // xs: {
    //   'Drought related': 'Drought',
    //   'Conflict/Insecurity': 'Conflict',
    //   'Other': 'Autre'
    //   }
  });
  // idpLineChart.hide({id:loadedCharts});
}

var mapsvg,
    centered;
var fillColor = '#dddddd';
var hoverColor = primaryColor;
var inactiveFillColor = '#F8F4EC';
function generateMap(adm2, countrieslabel, idpData){
  //remove loader and show map
  $('.sp-circle').remove();
  $('.row').css('opacity', 1);

  var width = $('#map').width();
  var height = 400;

  mapsvg = d3.select('#map').append('svg')
    .attr('width', width)
    .attr('height', height);

  var mapscale = ($('body').width()<768) ? width*4 : width*2.9;
  var mapprojection = d3.geo.mercator()
    .center([47, 5])
    .scale(mapscale)
    .translate([width / 2, height / 2]);    

  var g = mapsvg.append('g').attr('id','adm2layer');
  var path = g.selectAll('path')
    .data(adm2.features).enter()
    .append('path')
    .attr('d', d3.geo.path().projection(mapprojection))
    .attr('id',function(d){
      return d.properties.admin2Name;
    })
    .attr('class',function(d){
      var classname = (d.properties.admin2Name != '0') ? 'adm2' : 'inactive';
      return classname;
    })
    .attr('fill', function(d) {
      var clr = (d.properties.admin2Name != '0') ? fillColor: inactiveFillColor;
      return clr;
    })
    .attr('stroke-width', 1)
    .attr('stroke','#7d868d');

  //map tooltips
  var maptip = d3.select('#map').append('div').attr('class', 'd3-tip map-tip hidden');
  path.filter('.adm2')
    .on('mousemove', function(d,i) {
      $(this).attr('fill', hoverColor);
      var mouse = d3.mouse(mapsvg.node()).map( function(d) { return parseInt(d); } );
      maptip
        .classed('hidden', false)
        .attr('style', 'left:'+(mouse[0]+20)+'px; top:'+(mouse[1]+20)+'px')
        .html(d.properties.admin2Name)
    })
    .on('mouseout',  function(d,i) {
      if (!$(this).data('selected'))
        $(this).attr('fill', fillColor);
      maptip.classed('hidden', true);
    })
    .on('click', function(d,i){
      selectRegion($(this), d.properties.admin2Name);
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

  //IDP Chart
  cf = crossfilter(idpData);
  idpsDimension = cf.dimension(function(d){
    return [d['#adm2+dest+name'],d['#meta+category'],d['#date+reported']];
  });

  idpsGroup = idpsDimension.group().reduceSum(function(d){ return d['#affected']; }).top(Infinity).sort(date_sort);


  var kfDim = cf.dimension(function(d){ return [d['#adm2+dest+name'], d['#meta+category']]; });
  keyFiguresGroup = kfDim.group().reduceSum(function(d){ return d['#affected']; }).top(Infinity);

  var dim = cf.dimension(function(d){ return [d['#meta+category'],d['#date+reported']];});
  var grp = dim.group().reduceSum(function(d){ return d['#affected'];}).top(Infinity).sort(function(a,b){ return a.key[1]<b.key[1] ? -1 : a.key[1]>b.key[1] ? 1 : 0;});

  // for (var i = 0; i < idpsGroup.length; i++) {
  //   console.log(idpsGroup[i]);
  // }

  var maxDate = new Date(d3.max(idpData,function(d){return d['#meta+date']+'-01';}));//.getMonth();
  var minDate = new Date(d3.min(idpData,function(d){return d['#meta+date']+'-01';}));//.getMonth();
  $('#idpDates').text('('+monthNames[minDate.getMonth()].substring(0,3)+' – '+monthNames[maxDate.getMonth()].substring(0,3)+' '+maxDate.getFullYear()+')');

  xDroughtUnfiltered.push('Drought');
  xConflictsUnfiltered.push('Conflict');
  xOtherUnfiltered.push('Autre');
  droughtUnfiltered.push('Drought related');
  conflictsUnfiltered.push('Conflict/Insecurity');
  otherUnfiltered.push('Other');

  for (var i = 0; i < grp.length; i++) {
    var mm = 'W'+Number(grp[i].key[1].split("-")[1]);
    if (grp[i].key[0]==='Drought related') {
      droughtUnfiltered.push(grp[i].value);
      xDroughtUnfiltered.push(mm);
    } else if (grp[i].key[0]==='Conflict/Insecurity') {
      conflictsUnfiltered.push(grp[i].value);
      xConflictsUnfiltered.push(mm);
    } else if (grp[i].key[0]==='Other'){
      otherUnfiltered.push(grp[i].value);
      xOtherUnfiltered.push(mm);
    }
  }
  generateIdpStats();

  idpLineChart = c3.generate({
    bindto: '#idpChart',
    padding: { left: 30 },
    size: {
      height: 350
    },
    data: {
      xs: {
        'Drought related': 'Drought',
        'Conflict/Insecurity': 'Conflict',
        'Other': 'Autre'
      },
      columns: [xDroughtUnfiltered,xConflictsUnfiltered,xOtherUnfiltered,droughtUnfiltered,conflictsUnfiltered,otherUnfiltered],
      colors: {
        'Drought related': primaryColor,
        'Conflict/Insecurity': secondaryColor,
        'Other': tertiaryColor
      },
      type: 'line',
    },
    // color: {
    //   pattern: [primaryColor]
    // },
    axis: {
      y: {
        padding: {top: 0, bottom: 0},
        min: 0
      },
      x: {
        type: 'category',
        tick: {
          centered: true,
          outer: false
        }
      }
    },    
    tooltip: {
      format: {
        value: d3.format(',')
      }
    },
  });

}// generateMap

var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getDisplacedData(adm2) {
  var droughtAffected = [],
      xDrought = [],
      conflictsAffected = [],
      xConflict = [],
      otherAffected = [],
      xOther = [];
  xDrought.push('Drought');
  xConflict.push('Conflict');
  xOther.push('Autre');
  droughtAffected.push('Drought related');
  conflictsAffected.push('Conflict/Insecurity');
  otherAffected.push('Other')

  for (var i = 0; i < idpsGroup.length; i++) {
    if (idpsGroup[i].key[0]===adm2) {
      var dd = 'W'+Number(idpsGroup[i].key[2].split('-')[1]);
      if (idpsGroup[i].key[1]==='Drought related') {
        droughtAffected.push(idpsGroup[i].value);
        conflictsAffected.push(0);
        otherAffected.push(0);
        xDrought.includes(dd) ? '' : xDrought.push(dd);
        xConflict.includes(dd) ? '' : xConflict.push(dd);
        xOther.includes(dd) ? '' : xOther.push(dd);
      } else if (idpsGroup[i].key[1]==='Conflict/Insecurity') {
        conflictsAffected.push(idpsGroup[i].value);
        otherAffected.push(0);
        droughtAffected.push(0);
        xDrought.includes(dd) ? '' : xDrought.push(dd);
        xConflict.includes(dd) ? '' : xConflict.push(dd);
        xOther.includes(dd) ? '' : xOther.push(dd);
      } else if (idpsGroup[i].key[1]==='Other'){
        otherAffected.push(idpsGroup[i].value);
        droughtAffected.push(0);
        conflictsAffected.push(0);
        xDrought.includes(dd) ? '' : xDrought.push(dd);
        xConflict.includes(dd) ? '' : xConflict.push(dd);
        xOther.includes(dd) ? '' : xOther.push(dd);
      }
    }
  }
  var datas = [];
  xDrought.length >1 ? datas.push(xDrought) : '';
  xConflict.length >1 ? datas.push(xConflict) : '';
  xOther.length >1 ? datas.push(xOther) : '';
  droughtAffected.length >1 ? datas.push(droughtAffected) : '';
  conflictsAffected.length >1 ? datas.push(conflictsAffected) : '';
  otherAffected.length >1 ? datas.push(otherAffected) : '';
  //only update chart if there is data this region
  if (datas.length===0) {
    return null;
  }
  else {
    generateIdpStats(adm2);
    return datas;
  }
}//generateDisplacedData

function generateIdpStats (adm2) {
  var tot = 0,
      drght = 0,
      cfts = 0,
      others = 0;
  if (adm2===undefined) {
    for (var i = 0; i < keyFiguresGroup.length; i++) {
      tot += keyFiguresGroup[i].value;
      keyFiguresGroup[i].key[1]==='Conflict/Insecurity' ? cfts += keyFiguresGroup[i].value :
      keyFiguresGroup[i].key[1]==='Drought related' ? drght += keyFiguresGroup[i].value :
      keyFiguresGroup[i].key[1]==='Other' ? others += keyFiguresGroup[i].value : '';
    }
  } else {
    for (var i = 0; i < keyFiguresGroup.length; i++) {
      if (keyFiguresGroup[i].key[0]===adm2) {
        tot += keyFiguresGroup[i].value;
        keyFiguresGroup[i].key[1]==='Conflict/Insecurity' ? cfts += keyFiguresGroup[i].value :
        keyFiguresGroup[i].key[1]==='Drought related' ? drght += keyFiguresGroup[i].value :
        keyFiguresGroup[i].key[1]==='Other' ? others += keyFiguresGroup[i].value : '';
      }
    }
  }

  $('#idpStats').html('');
  $('#idpStats').append('<label>Total IDPs:</label> <span class="num">'+formatNum(tot)+'</span> <label>Drought:</label> <span class="num">'+formatNum(drght)+'</span> <label>Conflicts:</label> <span class="num">'+formatNum(cfts)+'</span> <label>Other:</label> <span class="num">'+formatNum(others)+'</span>');
} //generateIdpStats

function selectRegion(region, name) {
  var displacedData = getDisplacedData(name);
  if (displacedData!=null) {  
    region.siblings().data('selected', false);
    region.siblings('.adm2').attr('fill', fillColor);
    region.attr('fill', primaryColor);
    region.data('selected', true);
    $('.regionLabel > .errorLabel').hide();
    $('.regionLabel > .filterLabel > strong').html(name);
    updateCharts(displacedData);
  }
  else {
    $('.regionLabel > .errorLabel').show();
    $('.regionLabel > .errorLabel span').html(name);
  }
}

function reset() {
  $('#adm2layer').children('.adm2').attr('fill', fillColor);
  $('.regionLabel > .filterLabel > strong').html('All Regions');
  $('.regionLabel > .errorLabel').hide();

  //update IDP stats
  generateIdpStats();
  updateCharts([xDroughtUnfiltered,xConflictsUnfiltered,xOtherUnfiltered,droughtUnfiltered,conflictsUnfiltered,otherUnfiltered]);
  idpLineChart.show();
  idpLineChart.flush();

  return false;
}

/** River Level Charts **/
function generateRiverLevels(riverLevel1Data, riverLevel2Data) {
  var riverDataArray = [riverLevel1Data, riverLevel2Data];
  for (var i=0; i<riverDataArray.length; i++){
    var weekNum = 0;
    var riverData = riverDataArray[i];
    var riverChart = '#riverLevel'+ (i+1) +'Chart';
    var riverName = (i==0) ? 'Shabelle River' : 'Juba River';
    var date = ['x'];
    var severity = ['Current Level'];
    var severityMean = ['Long Term Average'];
    for (var j=0; j<riverData.length; j++){
      var now = new Date();
      var d = new Date(now.getFullYear()+'-'+riverData[j]['#date+reported']+'-'+riverData[j]['#indicator+num']);
      if (d.getDay()==1){ //only show monday data to represent the week
        weekNum++;
        date.push('W'+weekNum);
        severity.push(riverData[j]['#severity']);
        severityMean.push(riverData[j]['#severity+mean']);
      }
    }

    var chart = c3.generate({
      bindto: riverChart,
      title: { text: riverName },
      padding: { top: 20, left: 24 },
      size: {
        height: 200
      },
      data: {
        x: 'x',
        columns: [date, severity, severityMean],       
        colors: {
          'Current Level': secondaryColor,
          'Long Term Average': primaryColor
        }
      },
      axis: {     
        x: {
          type: 'category',
          tick: {
            centered: true
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

/** Key Figures **/
function generateKeyFigures(keyFigureData) {
  for (var i=0; i<keyFigureData.length; i++) {
    $('#keyFigures').append('<div class="col-md-3"><h3>'+keyFigureData[i]['#indicator']+'</h3><div class="key-figure"><span class="num">'+keyFigureData[i]['#affected+num']+'</span></div></div>');
  }
}
var parseDate = function(d){
  dd = new Date(d);
  return dd.getDate()  +  + (dd.getMonth()+1) + "-" + dd.getFullYear();
};

function generateSectorData (data) {

  var sectors = [];
  var dates = [];
  dates.push('x');
  for(k in data){
    sectors.includes(data[k]['#sector'])? '': sectors.push(data[k]['#sector']);
    var d = parseDate(data[k]['#date']);
    dates.includes(data[k]['#date']) ? '': dates.push(data[k]['#date']);
  }
  for (var i = 0; i < sectors.length; i++) {
    var reachedArr = [];
    var indicatorName = [];
    var targetArr = [];
    reachedArr.push('Reached');
    targetArr.push('Target');
    for (k in data){
      if (data[k]['#sector']===sectors[i]) {
        reachedArr.push(data[k]['#reached']);
        targetArr.push(data[k]['#targeted']);
        indicatorName.includes(data[k]['#indicator'])? '': indicatorName.push(data[k]['#indicator']);
      }

    }
    var sectorName= (sectors[i] ==='FOOD SECURITY') ? indicatorName[0] = 'foodsecuritycluster' : sectors[i].toLowerCase();
    $('.sectorChart').append('<div class="col-sm-6 col-md-4" id="indicator'+i+'"><div class="chart-header"><h3><span>'+sectors[i]+':</span> '+indicatorName[0]+'</h3></div><div class="chart-container"><div id="chart'+i+'""></div></div>');
    var chartType = 'line';
    var chart = c3.generate({
      bindto: '#chart'+i,
      size:  { height: 180 },
      padding: { top: 10, right: 35 },
      data: {
        x: 'x',
        type: chartType,
        columns: [dates, reachedArr, targetArr],
        colors: {
          Target: primaryColor,
          Reached: secondaryColor
        }
      },
      axis: {
        x: {
          type: 'timeseries',
          localtime: false,
          tick: {
            centered: false,
            format: '%b %Y',
            outer: false
          }
        },
        y:{
          tick: {
            count: 5,
            format: d3.format('.2s')
          },
          min: 0,
          padding: { bottom: 0 }
        }
      },
      tooltip: {
        format: {
          value: d3.format(',')
        }
      },
    });
    $('#chart'+i).data('chartObj', chart);
  }
}//generateSectorData

var somCall = $.ajax({ 
  type: 'GET', 
    url: 'data/som-adm2-neighbour-topo.json',
  dataType: 'json',
});

// var adm1Call = $.ajax({ 
//   type: 'GET', 
//   url: 'data/som_adm1.json',
//   dataType: 'json',
// });

var countrieslabelCall = $.ajax({ 
  type: 'GET', 
  url: 'data/countries.json',
  dataType: 'json',
});

var descriptionCall = $.ajax({ 
  type: 'GET', 
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F1LVJwQKBkX11ZTCy6UwPYlskJ1M1UhjRLkIJh4n6sUBE%2Fedit%23gid%3D0&force=on',
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
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F12o4Si6pqbLsjkxuWpZjtC8sIvSFpD7_DtkrMUAbt32I%2Fedit%23gid%3D974093512',
  dataType: 'json',
});

var keyFiguresCall = $.ajax({
  type: 'GET',
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&force=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F19U-C50J8OvvuvtAgJQ09eWJ3BAxxAfZlU5qH4SvAdwg%2Fedit%23gid%3D0',
  dataType: 'json',
});

var sectorDataCall = $.ajax({
  type: 'GET',
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F1UVyiOhuUqiIKrZfwl9al9GBUyH43ioYr-F8TE03rySU%2Fedit%23gid%3D0',
  dataType: 'json',
});

var cf,
    idpsDimension,
    idpsGroup,
    keyFiguresGroup,
    idpLineChart,
    droughtUnfiltered = [],
    xDroughtUnfiltered = [],
    conflictsUnfiltered = [],
    xConflictsUnfiltered = [],
    otherUnfiltered = [],
    xOtherUnfiltered = [];

//colors
var primaryColor = '#418FDE',
    secondaryColor = '#E56A54'
    tertiaryColor = '#A4D65E';

//description data
$.when(descriptionCall).then(function(descriptionArgs){
  var descriptionData = hxlProxyToJSON(descriptionArgs);
  generateDescription(descriptionData);
});

//map data
$.when(somCall, countrieslabelCall, idpCall).then(function(somArgs, countrieslabelArgs, idpArgs){
  var countrieslabel = countrieslabelArgs[0].countries;
  var idps = hxlProxyToJSON(idpArgs[0]);
  var som = topojson.feature(somArgs[0],somArgs[0].objects.som_adm2_neighbour);
  generateMap(som, countrieslabel, idps);

});

//river levels data
$.when(riverLevel1Call, riverLevel2Call).then(function(riverLevel1Args, riverLevel2Args){
  var riverLevel1Data = hxlProxyToJSON(riverLevel1Args[0]);
  var riverLevel2Data = hxlProxyToJSON(riverLevel2Args[0]);
  generateRiverLevels(riverLevel1Data, riverLevel2Data);
});

//indicator data
$.when(keyFiguresCall).then(function(keyFiguresArgs){
  var keyFigures = hxlProxyToJSON(keyFiguresArgs);
  generateKeyFigures(keyFigures);
});

//sector data 
$.when(sectorDataCall).then(function(sectorDataArgs){
  var sectorData = crossfilter(hxlProxyToJSON(sectorDataArgs));
  var dim = sectorData.dimension(function(d){ return d['#sector']; });
  var arr = dim.top(Infinity);
  generateSectorData(arr);

});
