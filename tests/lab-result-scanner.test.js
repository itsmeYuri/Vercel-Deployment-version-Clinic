const assert = require('node:assert/strict');
const scanner = require('../public/assets/js/lab-result-scanner.js');

const clear = new Uint8ClampedArray(800 * 800 * 4);
for (let y = 0; y < 800; y += 1) {
  for (let x = 0; x < 800; x += 1) {
    const offset = (y * 800 + x) * 4;
    clear[offset] = clear[offset + 1] = clear[offset + 2] = x % 16 < 8 ? 20 : 235;
    clear[offset + 3] = 255;
  }
}
assert.equal(scanner.imageQuality({ width: 800, height: 800, data: clear }).lowResolution, false);
const uniform = new Uint8ClampedArray(400 * 400 * 4).fill(128);
const poor = scanner.imageQuality({ width: 400, height: 400, data: uniform });
assert.equal(poor.lowResolution, true);
assert.equal(poor.blurry, true);
assert.equal(poor.lowContrast, true);
assert.ok(scanner.recognitionScore({ values: [{ parameter: 'WBC', value: '5', unit: 'x10^9/L', referenceRange: '4-11' }] }, 85)
  > scanner.recognitionScore({ values: [{ parameter: 'WBC', value: '5', unit: '', referenceRange: '' }] }, 95));
assert.equal(scanner.parse('WBC 5.2 x10^9/L 4.0-11.0').values[0].value, '5.2');
const wrongReport = scanner.parse('PATIENT NAME : Demo Alexander Cajura\nRESULT VALUES\nHemoglobin A1c 5.4 % 4.0 - 5.6 Normal\nUrine pH 6.0 pH 4.5 - 8.0 Normal\nCRP 2.6 mg/L <10.0 Normal');
const wrongScan = scanner.scanMismatch(wrongReport, { patientName: 'Integration Patient', tests: 'C-Reactive Protein' });
assert.equal(wrongScan.patientMismatch, true);
assert.deepEqual(wrongScan.unexpected, ['HbA1c', 'Urine pH']);
assert.deepEqual(scanner.scanMismatch(scanner.parse('PATIENT NAME: Integration Patient\nCRP 2.6 mg/L <10.0 Normal'), { patientName: 'Integration Patient', tests: 'C-Reactive Protein' }).reasons, []);
console.log('Scanner quality and recognition scoring passed.');
