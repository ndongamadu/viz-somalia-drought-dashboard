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
  if (d1.key[1] > d2.key[1]) return 1;
  if (d1.key[1] < d2.key[1]) return -1;
  return 0;
};

var formatNum = d3.format('.2s');
var formatCommaNum = d3.format(',');

function generateDescription(descriptionData){
  $('.title span').text('as of ' + descriptionData[0]['#date+reported']);
  $('.description-text p').text(descriptionData[0]['#description'])
}

/*
Remove existing line chart et draw new ones
*/
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
    xAxis.includes(mm) ? '' : xAxis.push(mm);
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

/*
Return for given district couple weeks/#of people affected by drought - conflicts and others
*/
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
  otherAffected.push('Other');

  var dataArray = idpsDimension.group().reduceSum(function(d){ return d['#affected']; }).top(Infinity).filter(function(d){ return d.key[0]===adm2});
  var droughtArr = dataArray.filter(function(d){ return d.key[1]==='Drought related';}).sort(function(a,b){
    return a.key[2]<b.key[2] ? -1 : a.key[2]>b.key[2] ? 1 : 0;
  });
  var conflictArr = dataArray.filter(function(d){ return d.key[1]==='Conflict/Insecurity';}).sort(function(a,b){
    return a.key[2]<b.key[2] ? -1 : a.key[2]>b.key[2] ? 1 : 0;
  });
  var otherArr = dataArray.filter(function(d){ return d.key[1]==='Other';}).sort(function(a,b){
    return a.key[2]<b.key[2] ? -1 : a.key[2]>b.key[2] ? 1 : 0;
  });

  for (var i = 0; i < xAxis.length; i++) {
    var droughtVal = 0,
        conflictVal = 0,
        otherVal = 0;
    for (var k = 0; k < droughtArr.length; k++) {
      var dd = 'W'+Number(droughtArr[k].key[2].split('-')[1]);
      xAxis[i]===dd ? droughtVal = droughtArr[k].value : '';
    }
    for (var k = 0; k < conflictArr.length; k++) {
      var dd = 'W'+Number(conflictArr[k].key[2].split('-')[1]);
      xAxis[i]===dd ? conflictVal = conflictArr[k].value : '';
    }
    for (var k = 0; k < otherArr.length; k++) {
      var dd = 'W'+Number(otherArr[k].key[2].split('-')[1]);
      xAxis[i]===dd ? otherVal = otherArr[k].value : '';
    }
    droughtAffected.push(droughtVal);
    xDrought.push(xAxis[i]);
    conflictsAffected.push(conflictVal);
    xConflict.push(xAxis[i]);
    otherAffected.push(otherVal);
    xOther.push(xAxis[i]);
  }

  var datas = [];
  datas.push(xDrought);
  datas.push(xConflict);
  datas.push(xOther);
  datas.push(droughtAffected);
  datas.push(conflictsAffected);
  datas.push(otherAffected);

  //only update chart if there is data this region
  if (datas.length===0) {
    return null;
  }
  else {
    generateIdpStats(adm2);
    return datas;
  }
}//generateDisplacedData

/*
Generate numbers at the top of the IDP chart
*/
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
  $('#idpStats').append('<label>Total:</label> <span class="num">'+formatCommaNum(tot)+'</span> <label>Drought related:</label> <span class="num">'+formatCommaNum(drght)+'</span> <label>Conflict/Insecurity:</label> <span class="num">'+formatCommaNum(cfts)+'</span> <label>Other:</label> <span class="num">'+formatCommaNum(others)+'</span>');
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
  updateCharts([xDroughtUnfiltered,xConflictsUnfiltered,xOtherUnfiltered,droughtUnfiltered,conflictsUnfiltered,otherUnfiltered])
  //reset IDP chart
  // if (idpLineChart.data.shown()[0]!==undefined) {
  //   var currentLine = idpLineChart.data.shown()[0].id;
  //   currentLine = (currentLine!=='Displaced') ? currentLine : null;
  //   if (currentLine!=null) idpLineChart.unload(currentLine);
  // }
  // idpLineChart.show();
  // idpLineChart.flush();

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
      var d = new Date(riverData[j]['#date+reported']+' '+riverData[j]['#indicator+num']+', '+now.getFullYear());
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
      padding: {left: 15, right: 15},
      size: {
        height: 210
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
            fit: true,
            centered: true,
            multiline: false,
            rotate: 25
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
    chart.flush();
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

/** Overall monthly response charts**/
function generateOverallSector () {
  var sectors = [];
  var monthsRange = [];
  monthsRange.push('x');
  var cf = crossfilter(sectorsData);
  var dim = cf.dimension(function(d){ return [d['#sector'], d['#date']]; });
  dim.filterAll();
  var allDataArr = cf.dimension(function(d){ return [d['#meta+target+type'],d['#sector'], d['#date']]; }).top(Infinity).sort(function(a,b){
    return a['#date']<b['#date'] ? -1 : a['#date']>b['#date'] ? 1 : 0;
  });
  for (var i = 0; i < allDataArr.length; i++) {
    sectors.includes(allDataArr[i]['#sector']) ? '': sectors.push(allDataArr[i]['#sector']);
    monthsRange.includes(allDataArr[i]['#date']) ? '': monthsRange.push(allDataArr[i]['#date']);
  }

  sectors.sort(function(a,b){
    return a<b ? -1 : a>b ? 1 : 0;
  });
  $('.sectorChart').html('');
  for (var i = 0; i < sectors.length; i++) {
    var reached = [];
    var targeted = [];

    reached.push('Reached');
    targeted.push('Monthly target');
    var sData = allDataArr.filter(function(d){ return d['#sector']===sectors[i]; });
    var targetType = [],
        indcatorName = [];
    for (var t = 0; t < sData.length; t++) {
      targetType.includes(sData[t]['#meta+target+type']) ? '' : targetType.push(sData[t]['#meta+target+type']);
      indcatorName.includes(sData[t]['#indicator']) ? '' : indcatorName.push(sData[t]['#indicator']);
    }
    var totYTarget = 0;
    if (targetType[0]==='End/year target') {
      for (var k = 0; k < sData.length; k++) {
        sData[k]['#date']==='2019-01-01' ? totYTarget +=parseInt(sData[k]['#targeted+year']) : '';
      }
      targeted[0]='End/year target';
      for (var r = 0; r < monthsRange.length; r++) {
        totYTarget !=NaN ? targeted.push(totYTarget) : '';
      }
    }

    for (var j = 1; j < monthsRange.length; j++) {
      var totReached = 0,
          totMTarget = 0;
      if (targetType[0]==='Monthly') {
        for (var h = 0; h < sData.length; h++) {
          monthsRange[j] ===sData[h]['#date'] ? totMTarget +=parseInt(sData[h]['#targeted+month']) : '';
        }
        targeted.push(totMTarget);
      }
      for (var m = 0; m < sData.length; m++) {
        monthsRange[j]===sData[m]['#date'] ? totReached += parseInt(sData[m]['#reached']) : '';
      }
      reached.push(totReached);
    }//j

    $('.sectorChart').append('<div class="col-sm-6 col-md-4" id="indicator'+i+'"><div class="chart-header"><h3><span>'+sectors[i]+':</span> '+indcatorName[0]+'</h3></div><div class="chart-container"><div id="chart'+i+'""></div></div>');
    var chartType = 'line';
    var chart = c3.generate({
      bindto: '#chart'+i,
      size:  { height: 180 },
      padding: { top: 10, right: 35 },
      data: {
        x: 'x',
        type: chartType,
        columns: [monthsRange, reached, targeted],
        // colors: {
        //   Target: primaryColor,
        //   Reached: secondaryColor
        // }
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

  }//i sectors

}//generateOverallSector

/** Monthly response charts for a given region**/
function generateSectorData (region) {
  var data = sectorDataDimension.filter(function(d){ return d===region ;}).top(Infinity);
  data.sort(function(a,b){
    a = new Date(a['#date']);
    b = new Date(b['#date']);
    return a<b ? -1 : a>b ? 1 : 0;
  });
  data.sort(function(a,b){
    return a['#sector']<b['#sector'] ? -1 : a['#sector']>b['#sector'] ? 1 : 0;
  });
  var sectors = [];
  var dates = [];
  dates.push('x');
  for(k in data){
    sectors.includes(data[k]['#sector'])? '': sectors.push(data[k]['#sector']);
    dates.includes(data[k]['#date']) ? '': dates.push(data[k]['#date']);
  }
  $('.sectorChart').html(''); 
  for (var i = 0; i < sectors.length; i++) {
    var reachedArr = [];
    var indicatorName = [];
    var targetArr = [];
    var targetMonth = [];
    reachedArr.push('Reached');
    targetArr.push('End/year Target');
    targetMonth.push('Monthly Target');
    for (k in data){
      if (data[k]['#sector']===sectors[i]) {
        reachedArr.push(data[k]['#reached']);
        data[k]['#targeted+year'] !='NA' ? targetArr.push(data[k]['#targeted+year']) : '';
        data[k]['#targeted+month'] !='NA' ? targetMonth.push(data[k]['#targeted+month']) : '';
        indicatorName.includes(data[k]['#indicator'])? '': indicatorName.push(data[k]['#indicator']);
      }

    }
    var targeted = (targetMonth.length<=1 ? targetArr : targetMonth );
    $('.sectorChart').append('<div class="col-sm-6 col-md-4" id="indicator'+i+'"><div class="chart-header"><h3><span>'+sectors[i]+':</span> '+indicatorName[0]+'</h3></div><div class="chart-container"><div id="chart'+i+'""></div></div>');
    var chartType = 'line';
    var chart = c3.generate({
      bindto: '#chart'+i,
      size:  { height: 180 },
      padding: { top: 10, right: 35 },
      data: {
        x: 'x',
        type: chartType,
        columns: [dates, reachedArr, targeted],
        // colors: {
        //   Target: primaryColor,
        //   Reached: secondaryColor
        // }
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

/** Generate the dropdown menu below Monthly chart **/
function generateDropdown (argument) {
  sectorDataCf = crossfilter(argument);
  sectorDataDimension = sectorDataCf.dimension(function(d){ return d['#adm1+name']; });

  var admin1 = [];
  for (var i = 0; i < argument.length; i++) {
    admin1.includes(argument[i]['#adm1+name']) ? '' : admin1.push(argument[i]['#adm1+name']);
  }
  var options = '<label>Selected Region</label><select id="regionDrowdown"><option value="all" selected>All regions</option>';
  for (var i = 0; i < admin1.length; i++) {
    options +='<option value="'+admin1[i]+'">'+admin1[i]+'</option>';
  }
  options +='</select>';
  $('#dropdown').html(options);
  selectedRegion = admin1[0];

  $('#regionDrowdown').on('change', function(d){
    updateSectorCharts();
  });
}//generateDropdown

function updateSectorCharts () {
  var region = $('#regionDrowdown option:selected').text();
  console.log(region)
  region ==='All regions' ? generateOverallSector() : generateSectorData(region);
}//updateSectorCharts

function generateRegionWaterPrice (data) {
  var pricesArr = [];
  var waterPriceRegionArr = [];
  waterPriceRegionArr.push('Region');
  pricesArr.push('Water Price/200  liters (USD)');
  for (var i = 0; i < data.length; i++) {
    waterPriceRegionArr.push(data[i]['#adm1+name']);
    pricesArr.push(data[i]['#indicator+price']);
  }
  var chart = c3.generate({
    bindto: '#waterPricesRegion',
    title: {text: 'Water prices by region'},
    padding: { top: 20, left: 24, right: 24 },
    size: {
        height: 229
    },
    data: {
      x: 'Region',
      columns: [waterPriceRegionArr, pricesArr],
      type: 'bar',
      colors: {
        'Water Price/200  liters (USD)': primaryColor,
      },
    },
    axis: {
      x: {
        type: 'category',
        tick: {
          centered: true,
          fit: true,
          multiline: false,
          rotate: 25
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
}//generateRegionWaterPrice

function generateDiseases (data) {
  var xArr = [],
      awdArr = [],
      choleraArr = [],
      measlesArr = [];
  xArr.push('Week');
  awdArr.push('AWD');
  choleraArr.push('Bloody Diarrhea');
  measlesArr.push('Measles');
  data.sort(function(a,b){
    a['#date+week']<b['#date+week'] ? -1 : a['#date+week']>b['#date+week'] ? 1 : 0;
  });
  for (var i = 0; i < data.length; i++) {
    xArr.push(data[i]['#date+week']);
    awdArr.push(data[i]['#indicator+awd']);
    choleraArr.push(data[i]['#indicator+bd']);
    measlesArr.push(data[i]['#indicator+meas']);
  }

  var awdCholeraChart = c3.generate({
    bindto: '#awdCholera',
    title: {text: 'AWD/Cholera and Bloody Diarrhea'},
    padding: { top: 20, left: 24 },
    size: {
        height: 200
    },
    data: {
      x: 'Week',
      columns: [xArr, awdArr, choleraArr],
      groups: [awdArr, choleraArr],
      type: 'line',
      colors: {
          'AWD': secondaryColor,
          'Bloody Diarrhea': primaryColor
        }
      },
      axis: {
        x: {
          type: 'category',
          tick: {
            centered: true,
            fit: true,
            multiline: false,
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

  var measlesChart = c3.generate({
    bindto: '#measles',
    title: {text: 'Measles'},
    padding: { top: 20, left: 24 },
    size: {
        height: 200
    },
    data: {
      x: 'Week',
      columns: [xArr, measlesArr],
      type: 'line',
      },
      axis: {
        x: {
          type: 'category',
          tick: {
            centered: true,
            fit: true,
            multiline: false,
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
}//generateDiseases


var somCall = $.ajax({ 
  type: 'GET', 
    url: 'data/som-adm2-neighbour-topo.json',
  dataType: 'json',
});

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
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F16QXGa8aGIka_a0lhYx2O0rSVSy5KkUhmiNtOqGH0dVo%2Fedit%23gid%3D1461276083&force=on',
  dataType: 'json',
});

var riverLevel2Call = $.ajax({ 
  type: 'GET', 
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F16QXGa8aGIka_a0lhYx2O0rSVSy5KkUhmiNtOqGH0dVo%2Fedit%23gid%3D299718476&force=on',
  dataType: 'json',
});

var idpCall = $.ajax({ 
  type: 'GET', 
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F12o4Si6pqbLsjkxuWpZjtC8sIvSFpD7_DtkrMUAbt32I%2Fedit%23gid%3D974093512&force=on',
  dataType: 'json',
});

var keyFiguresCall = $.ajax({
  type: 'GET',
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&force=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F19U-C50J8OvvuvtAgJQ09eWJ3BAxxAfZlU5qH4SvAdwg%2Fedit%23gid%3D0',
  dataType: 'json',
});

var sectorDataCall = $.ajax({
  type: 'GET',
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F1UVyiOhuUqiIKrZfwl9al9GBUyH43ioYr-F8TE03rySU%2Fedit%23gid%3D973763003&force=on',
  dataType: 'json',
});

var waterPriceRegionCall = $.ajax({
  type: 'GET',
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F16QXGa8aGIka_a0lhYx2O0rSVSy5KkUhmiNtOqGH0dVo%2Fedit%23gid%3D549566422&force=on',
  dataType: 'json',
});

var diseaseDataCall = $.ajax({
  type: 'GET',
  url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F1acP0oXgGHi9kG735xiloZfj83_NkxR4HyzeYwUJlp4c%2Fedit%23gid%3D0&force=on',
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
    xOtherUnfiltered = [],
    xAxis = [];

//colors
var primaryColor = '#418FDE',
    secondaryColor = '#E56A54'
    tertiaryColor = '#A4D65E';

var sectorDataCf,
    sectorDataDimension,
    sectorsData;

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
  // generateKeyFigures(keyFigures);
});

//sector data 
$.when(sectorDataCall).then(function(sectorDataArgs){
  sectorsData = hxlProxyToJSON(sectorDataArgs);
  generateDropdown(sectorsData);
  generateOverallSector();

});

$.when(waterPriceRegionCall).then(function(waterPriceRegionArgs){
  var waterRegion = hxlProxyToJSON(waterPriceRegionArgs);
  generateRegionWaterPrice(waterRegion);
});

$.when(diseaseDataCall).then(function(diseaseDataArgs){
  var diseaseData = hxlProxyToJSON(diseaseDataArgs);
  generateDiseases(diseaseData);
});
