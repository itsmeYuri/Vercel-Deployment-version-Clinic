const test = require('node:test');
const assert = require('node:assert/strict');
const { build, diagnostic, diagnosticTopics } = require('../public/assets/js/lab-trend-analysis.js');

test('diagnostic describes filtered activity and avoids claiming a cause', () => {
  const analysis = build(
    [{ createdAt: '2026-10-01', tests: 'CBC, TSH', facilityName: 'Clinic A' }],
    [{ createdAt: '2026-10-02', releasedAt: '2026-10-02 02:00:00', values: [{ parameter: 'WBC', value: '12', flag: 'High' }], facilityName: 'Clinic A', status: 'Released' }],
    { from: '2026-10-01', to: '2026-10-03', group: 'day' }
  );
  const narrative = diagnostic(analysis);
  assert.match(narrative.observed, /2 requested tests and 1 encoded result/);
  assert.match(narrative.observed, /Above Reference Range \(1\)/);
  assert.match(narrative.explanation, /cannot establish a root cause/);
  assert.match(narrative.nextSteps, /review flagged values/i);
});

test('diagnostic handles an empty filtered period without invented findings', () => {
  const narrative = diagnostic(build([], [], { from: '2026-10-01', to: '2026-10-03', group: 'day' }));
  assert.match(narrative.observed, /No laboratory requests or encoded results/);
  assert.match(narrative.nextSteps, /Check the date and facility filters/);
});

test('separate diagnostic report covers all four operational areas', () => {
  const analysis = build(
    [{ createdAt: '2026-10-01', tests: 'CBC, TSH', facilityName: 'Clinic A' }],
    [{ createdAt: '2026-10-02', releasedAt: '2026-10-02 02:00:00', values: [{ parameter: 'WBC', value: '12', flag: 'High' }], facilityName: 'Clinic A', status: 'Released' }],
    { from: '2026-10-01', to: '2026-10-03', group: 'day' }
  );
  const topics = diagnosticTopics(analysis);
  assert.deepEqual(topics.map(({ title }) => title), ['Test volume', 'Result turnaround', 'Validation flags', 'Facility workload']);
  assert.match(topics[0].observed, /2 tests were requested/);
  assert.match(topics[1].observed, /120 minutes/);
  assert.match(topics[2].observed, /Above Reference Range/);
  assert.match(topics[3].observed, /Clinic A/);
  assert.match(topics[0].explanation, /1 recorded request contained 2.0 tests each/);
  assert.match(topics[1].nextSteps, /1 measured result in Oct 2/);
  assert.match(topics[2].nextSteps, /1 above reference range value/);
  assert.match(topics[3].explanation, /100% of requested tests/);
  topics.forEach((topic) => {
    assert.ok(topic.explanation.length > 40);
    assert.ok(topic.nextSteps.length > 40);
  });
});
