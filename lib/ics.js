// Generic recurring iCalendar (.ics) exporter and reminder schedule evaluator.

import { addDays, weekdayOf } from './dates.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export function reminderDue({ reminder, date, nowTime, isDone = false, lastSent = null }) {
  if (!reminder?.enabled || lastSent === date || isDone) return false;
  const days = Array.isArray(reminder.days) ? reminder.days : [1, 2, 3, 4, 5, 6, 0];
  if (!days.includes(weekdayOf(date))) return false;
  if (!TIME.test(reminder.time ?? '') || !TIME.test(nowTime ?? '') || nowTime < reminder.time) return false;
  return true;
}

export function makeCalendar({
  prodId = '-//PWA Kit//EN',
  uidPrefix = 'pwa-reminder',
  startDate,
  today,
  time = '19:00',
  durationMin = 25,
  days = [1, 2, 3, 4, 5, 6, 0],
  weeks = 12,
  eventFor = () => ({ title: 'Daily practice', body: 'Open the app to log today.' }),
}) {
  const base = ISO.test(startDate ?? '') ? startDate : today;
  const validTime = TIME.test(time ?? '') ? time : '19:00';
  const [hh, mm] = validTime.split(':');
  const baseWeekday = weekdayOf(base);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
  ];
  for (const d of days) {
    if (!Number.isInteger(d) || d < 0 || d > 6) continue;
    const offset = (d - baseWeekday + 7) % 7;
    const firstIso = addDays(base, offset);
    const firstDate = firstIso.replaceAll('-', '');
    const info = eventFor(firstIso) || {};
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uidPrefix}-${d}@local`,
      `DTSTART:${firstDate}T${hh}${mm}00`,
      `DURATION:PT${Math.max(5, Math.round(durationMin))}M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[d]};COUNT=${Math.max(1, Math.round(weeks))}`,
      `SUMMARY:${info.title || 'Daily practice'}`,
      `DESCRIPTION:${info.body || ''}`,
      'BEGIN:VALARM',
      'TRIGGER:PT0M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${info.title || 'Daily practice'}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
