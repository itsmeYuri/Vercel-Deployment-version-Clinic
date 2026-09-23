(function (root) {
  "use strict";
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const colors = ["#087f78", "#386fa4", "#95633b", "#a84755"];
  const number = (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  function timeline(rows, series, options = {}) {
    if (!rows.length || !rows.some(row => series.some(s => row[s.key] != null))) return '<div class="empty-state">No measurements in this period.</div>';
    const width = 800, left = 54, right = 780, top = 24, bottom = 230;
    const maxValue = Math.max(1, ...rows.flatMap(row => series.map(s => Number(row[s.key]) || 0)));
    const step = Math.pow(10, Math.floor(Math.log10(maxValue))) / 2;
    const max = Math.ceil(maxValue / step) * step;
    const x = i => rows.length === 1 ? (left + right) / 2 : left + i * (right - left) / (rows.length - 1);
    const y = n => bottom - Number(n) / max * (bottom - top);
    const grid = Array.from({length: 5}, (_, i) => {
      const value = max * i / 4;
      return `<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" class="report-grid"/><text x="44" y="${y(value) + 4}" text-anchor="end">${number(value)}</text>`;
    }).join("");
    const paths = series.map((s, index) => {
      const color = colors[index % colors.length];
      const segments = []; let segment = [];
      rows.forEach((row, i) => { if (row[s.key] == null) { if (segment.length) segments.push(segment); segment = []; } else segment.push([x(i), y(row[s.key])]); });
      if (segment.length) segments.push(segment);
      return segments.map(points => `${options.area && index === 0 ? `<polygon points="${points[0][0]},${bottom} ${points.map(p => p.join(',')).join(' ')} ${points.at(-1)[0]},${bottom}" fill="${color}" opacity=".1"/>` : ""}<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" ${options.forecast ? 'stroke-dasharray="7 5"' : ''}/>`).join("") + rows.map((row, i) => row[s.key] == null ? "" : `<circle cx="${x(i)}" cy="${y(row[s.key])}" r="3" fill="white" stroke="${color}" stroke-width="2"><title>${escape(row.label)} · ${escape(s.label)}: ${number(row[s.key])}</title></circle>`).join("");
    }).join("");
    const labelEvery = Math.max(1, Math.ceil(rows.length / 6));
    const labels = rows.map((row, i) => i % labelEvery === 0 || i === rows.length - 1 ? `<text x="${x(i)}" y="257" text-anchor="${i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}">${escape(row.label)}</text>` : "").join("");
    return `<div class="report-chart"><div class="report-chart-key"><span>${escape(options.unit || "Count")}</span>${series.map((s, i) => `<span><i style="--series-color:${colors[i % colors.length]}"></i>${escape(s.label)}</span>`).join('')}</div><svg viewBox="0 0 ${width} 274" role="img" aria-label="${escape(options.title || 'Activity over time')}">${grid}${paths}${labels}</svg><details class="report-data"><summary>View chart data</summary><div><table><thead><tr><th>Period</th>${series.map(s => `<th>${escape(s.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr><th>${escape(row.label)}</th>${series.map(s => `<td>${row[s.key] == null ? 'No measurement' : number(row[s.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details></div>`;
  }
  function bars(rows, series, options = {}) {
    if (!rows.length || !rows.some(row => series.some(s => row[s.key] != null))) return '<div class="empty-state">No measurements in this period.</div>';
    const width = 800, left = 54, right = 780, top = 24, bottom = 218;
    const maxValue = Math.max(1, ...rows.flatMap(row => series.map(s => Number(row[s.key]) || 0)));
    const step = Math.pow(10, Math.floor(Math.log10(maxValue))) / 2;
    const max = Math.ceil(maxValue / step) * step;
    const y = value => bottom - Number(value) / max * (bottom - top);
    const grid = Array.from({length: 5}, (_, i) => {
      const value = max * i / 4;
      return `<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" class="report-grid"/><text x="44" y="${y(value) + 4}" text-anchor="end">${number(value)}</text>`;
    }).join("");
    const groupWidth = (right - left) / rows.length;
    const availableWidth = Math.min(groupWidth * .72, 30);
    const barWidth = Math.max(2, availableWidth / series.length);
    const columns = rows.map((row, rowIndex) => series.map((item, seriesIndex) => {
      if (row[item.key] == null) return "";
      const value = Number(row[item.key]) || 0;
      const height = Math.max(0, bottom - y(value));
      const x = left + rowIndex * groupWidth + (groupWidth - availableWidth) / 2 + seriesIndex * barWidth;
      return `<rect x="${x}" y="${y(value)}" width="${Math.max(1, barWidth - 1)}" height="${height}" rx="2" fill="${colors[seriesIndex % colors.length]}" class="report-bar"><title>${escape(row.label)} Â· ${escape(item.label)}: ${number(value)}</title></rect>`;
    }).join("")).join("");
    const labelEvery = Math.max(1, Math.ceil(rows.length / 6));
    const labels = rows.map((row, index) => index % labelEvery === 0 || index === rows.length - 1 ? `<text x="${left + (index + .5) * groupWidth}" y="247" text-anchor="middle">${escape(row.label)}</text>` : "").join("");
    return `<div class="report-chart report-bar-chart"><div class="report-chart-key"><span>${escape(options.unit || "Count")}</span>${series.map((item, index) => `<span><i style="--series-color:${colors[index % colors.length]}"></i>${escape(item.label)}</span>`).join("")}</div><svg viewBox="0 0 ${width} 264" role="img" aria-label="${escape(options.title || "Activity by period")}">${grid}${columns}${labels}</svg><details class="report-data"><summary>View chart data</summary><div><table><thead><tr><th>Period</th>${series.map(item => `<th>${escape(item.label)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr><th>${escape(row.label)}</th>${series.map(item => `<td>${row[item.key] == null ? "No measurement" : number(row[item.key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details></div>`;
  }
  function distribution(rows, labelKey, valueKey) {
    const total = rows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
    if (!total) return '<div class="empty-state">No validation flags in this period.</div>';
    let offset = 0;
    const circles = rows.map((row, i) => { const share = Number(row[valueKey] || 0) / total * 100; const item = `<circle cx="70" cy="70" r="52" pathLength="100" fill="none" stroke="${colors[i % colors.length]}" stroke-width="15" stroke-dasharray="${share} ${100 - share}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`; offset += share; return item; }).join('');
    return `<div class="report-distribution"><svg viewBox="0 0 140 140" role="img" aria-label="Validation flags by category">${circles}<text x="70" y="69" text-anchor="middle" class="report-ring-total">${total}</text><text x="70" y="87" text-anchor="middle">flags</text></svg><ul>${rows.map((row, i) => `<li><i style="--series-color:${colors[i % colors.length]}"></i><span>${escape(row[labelKey])}</span><strong>${number(row[valueKey])}</strong><span>${Math.round(row[valueKey] / total * 100)}%</span></li>`).join('')}</ul></div>`;
  }
  function pie(rows, labelKey, valueKey) {
    const entries = rows.filter(row => Number(row[valueKey]) > 0);
    const total = entries.reduce((sum, row) => sum + Number(row[valueKey]), 0);
    if (!total) return '<div class="empty-state">No workload recorded for this period.</div>';
    let angle = -Math.PI / 2;
    const slices = entries.map((row, i) => {
      const share = Number(row[valueKey]) / total;
      const start = [70 + 62 * Math.cos(angle), 70 + 62 * Math.sin(angle)];
      angle += share * Math.PI * 2;
      const end = [70 + 62 * Math.cos(angle), 70 + 62 * Math.sin(angle)];
      const title = `<title>${escape(row[labelKey])}: ${number(row[valueKey])} tests (${number(share * 100)}%)</title>`;
      const color = colors[i % colors.length];
      return entries.length === 1 ? `<circle cx="70" cy="70" r="62" fill="${color}">${title}</circle>` : `<path d="M70 70 L${start.join(' ')} A62 62 0 ${share > .5 ? 1 : 0} 1 ${end.join(' ')} Z" fill="${color}" stroke="white" stroke-width="1.5">${title}</path>`;
    }).join('');
    return `<div class="report-distribution report-pie"><svg viewBox="0 0 140 140" role="img" aria-label="Requested tests by facility, ${total} tests total">${slices}</svg><ul>${entries.map((row, i) => `<li><i style="--series-color:${colors[i % colors.length]}"></i><span>${escape(row[labelKey])}</span><strong>${number(row[valueKey])}</strong><span>${number(Number(row[valueKey]) / total * 100)}%</span></li>`).join('')}</ul></div>`;
  }
  root.ClinicReportCharts = { timeline, bars, distribution, pie };
  if (typeof module !== "undefined") module.exports = root.ClinicReportCharts;
})(typeof window !== "undefined" ? window : globalThis);
