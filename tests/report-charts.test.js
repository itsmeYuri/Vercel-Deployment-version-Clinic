const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const charts = require('../public/assets/js/report-charts.js');
const series = [{key:'value', label:'Measurements'}];
assert.match(charts.timeline([], series), /No measurements/);
assert.match(charts.timeline([{label:'A', value:null}], series), /No measurements/);
const zero = charts.timeline([{label:'A', value:0}], series);
assert.match(zero, /<circle/);
assert.doesNotMatch(zero, /NaN|Infinity/);
const missing = charts.timeline([{label:'A',value:2}, {label:'B',value:null}, {label:'C',value:3}], series);
assert.equal((missing.match(/<polyline/g) || []).length, 2, 'Missing readings break the line');
assert.match(missing, /No measurement/);
assert.match(charts.timeline([{label:'<script>', value:2}], series, {forecast:true}), /&lt;script&gt;/);
assert.match(charts.timeline([{label:'A', value:2}], series, {forecast:true}), /stroke-dasharray/);
const bars = charts.bars([{label:'A', value:0}, {label:'B', value:3}], series, {title:'Volume'});
assert.match(bars, /report-bar-chart/);
assert.match(bars, /<rect/);
assert.match(bars, /aria-label="Volume"/);
assert.doesNotMatch(bars, /NaN|Infinity/);
assert.match(charts.distribution([{label:'A',n:0}], 'label', 'n'), /No validation flags/);
assert.match(charts.distribution([{label:'A',n:1},{label:'B',n:3}], 'label', 'n'), /75%/);
for (const root of ['', 'Main-Clinic-system/']) {
  if (!fs.existsSync(root + 'public/assets/js/main.js')) continue;
  const source = fs.readFileSync(root + 'public/assets/js/main.js', 'utf8');
  const block = source.slice(source.indexOf('  const reportViews ='), source.indexOf('  function renderAudit('));
  const calls = [];
  const context = vm.createContext({
    URLSearchParams, location: { search:'' },
    state:{ data: {reports:{},orders:[]} },
    pageMeta:{Admin:{reports:['Statistics']}},
    h:String, heading:()=>'', icon:()=>'', badge:()=>'', table:()=>'', dashboardStats:()=>'', donutCard:()=>'',
    trendAnalysisSection:()=>{calls.push('trends');return 'TREND_CONTENT';},
    utilizationAnalyticsSection:()=>{calls.push('utilization');return 'UTIL_CONTENT';},
    forecastingAnalysisSection:()=>{calls.push('forecast');return 'FORECAST_CONTENT';},
  });
  // The older copy defines trend helpers beside the renderer; use only navigation and renderer.
  const navigation = block.slice(0, block.indexOf('\n'));
  const renderer = block.slice(block.indexOf('  function renderReports('));
  vm.runInContext(navigation + '\n' + renderer, context);
  for (const view of ['trends','utilization','forecast','overview','unknown']) {
    calls.length=0;
    context.location.search='?report='+view;
    const html = context.renderReports();
    assert.equal((html.match(/data-report-view=/g)||[]).length,4);
    assert.deepEqual(calls, view==='overview'?[]:[view==='unknown'?'trends':view], 'Only the selected report is rendered');
    assert.match(html, /aria-current="page"/);
  }
}
console.log('Report charts and isolated report views passed.');
