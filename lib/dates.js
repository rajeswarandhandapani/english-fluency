// DST-safe noon-anchored ISO date helpers (YYYY-MM-DD). Zero DOM dependencies.

const pad = n => String(n).padStart(2, '0');

export const toIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Anchors at local noon so daylight-saving shifts never skip or repeat a day. */
export const fromIso = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export const localToday = () => toIso(new Date());

export const addDays = (iso, n) => {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
};

export const weekdayOf = iso => fromIso(iso).getDay();

export const mondayOf = iso => addDays(iso, -((weekdayOf(iso) + 6) % 7));

export const nextMonday = iso => (weekdayOf(iso) === 1 ? iso : addDays(mondayOf(iso), 7));

export const daysBetween = (a, b) => Math.round((fromIso(b) - fromIso(a)) / 86400000);

export const weekDates = startIso => Array.from({ length: 7 }, (_, i) => addDays(startIso, i));
