// Shared time-series helpers for revenue charts (Dashboard KPI sparklines
// and the Ingresos/reporte-de-ventas card).

// Buckets records into a fixed number of trailing days (counts, or a summed
// value when valueFn is given).
export function buildDailySeries(records, dateField, valueFn, days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return { time: d.getTime(), total: 0 };
  });
  records.forEach(r => {
    const raw = r[dateField];
    if (!raw) return;
    const d = new Date(raw);
    d.setHours(0, 0, 0, 0);
    const bucket = buckets.find(b => b.time === d.getTime());
    if (bucket) bucket.total += valueFn ? valueFn(r) : 1;
  });
  return buckets.map(b => b.total);
}

// Revenue series bucketed to fit a given period: daily for short windows,
// grouped into ~14 points for longer ones so the chart stays readable.
export function buildPeriodSeries(sales, period) {
  const now = new Date();
  const days = { today: 1, '7d': 7, '30d': 30, month: now.getDate(), '3m': 90, year: 365 }[period] || 30;
  const notCancelled = sales.filter(s => s.status !== 'Cancelada');
  const daily = buildDailySeries(notCancelled, 'date', s => Number(s.total_amount) || 0, days);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const maxPoints = 14;
  if (days <= maxPoints) {
    return daily.map((v, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      return { label: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }), value: v };
    });
  }
  const bucketSize = Math.ceil(days / maxPoints);
  const grouped = [];
  for (let i = 0; i < days; i += bucketSize) {
    const slice = daily.slice(i, i + bucketSize);
    const d = new Date(start); d.setDate(d.getDate() + i);
    grouped.push({ label: d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }), value: slice.reduce((a, b) => a + b, 0) });
  }
  return grouped;
}
