// Pure dates, weekly totals, dictation diff, streaks, calendar export, and backup checks.
// No DOM or Angular runtime dependencies so unit tests run directly under Node.

import {
  ALL_LESSONS, CHALLENGE_TIMERS, CONFIDENCE_LEVELS, DAILY_GOAL_OPTIONS,
  TOTAL_DAYS, WEEKS, WEEKLY_GOAL_MIN, lessonForDay,
} from '../data/plan';
import {
  addDays, daysBetween, fromIso, localToday, mondayOf, toIso, weekDates, weekdayOf,
} from '../../kit/dates';
import { makeCalendar as kitMakeCalendar, reminderDue as kitReminderDue } from '../../kit/ics';
import type {
  ConfidenceId, DayKind, DayLog, DayStatus, DictationDiff, DictationEntry, DictationToken,
  FluencyPoint, ReminderSettings, Settings, StepId, StepsMap, WeekRow,
} from '../models';

export { toIso, fromIso, localToday, addDays, weekdayOf, mondayOf, daysBetween, weekDates };

export const STEPS: StepId[] = ['listen', 'shadow', 'story', 'speak', 'review'];
export const REVIEW_STEPS: StepId[] = ['recap', 'story', 'impromptu', 'reflect'];
export const STEP_IDS: StepId[] = [...new Set([...STEPS, ...REVIEW_STEPS])];

/** 1-based day number from the user's plan start date (<= 0 before start). */
export const dayNumberFor = (iso: string, startDate?: string | null): number =>
  startDate ? daysBetween(startDate, iso) + 1 : 1;

/** Clamps/wraps into 1..84 so practice continues smoothly past Week 12. */
export const planDayFor = (iso: string, startDate?: string | null): number => {
  const raw = dayNumberFor(iso, startDate);
  if (raw <= 1) return 1;
  return ((raw - 1) % TOTAL_DAYS) + 1;
};

/** 1-based week number from the plan start date (matches Day 1..7 = Week 1). */
export const programWeek = (iso: string, startDate: string): number =>
  Math.floor(daysBetween(startDate, iso) / 7) + 1;

export const dayKindFor = (iso: string, startDate?: string | null): DayKind => {
  const num = dayNumberFor(iso, startDate);
  return num >= 1 && num % 7 === 0 ? 'review' : 'practice';
};

export const stepsFor = (kind: DayKind): StepId[] =>
  kind === 'review' ? REVIEW_STEPS : STEPS;

export function stepsDone(day: DayLog | undefined | null, kind: DayKind = 'practice'): number {
  const list = stepsFor(kind);
  return list.filter(id => day?.steps?.[id] === true).length;
}

export function dayMinutes(day: DayLog | undefined | null, dailyGoal = 25, kind: DayKind = 'practice'): number {
  if (typeof day?.minutes === 'number' && day.minutes > 0) return day.minutes;
  const list = stepsFor(kind);
  const done = stepsDone(day, kind);
  if (done > 0) return Math.max(5, Math.round((done / list.length) * dailyGoal));
  if ((day?.transcript || '').trim() || Object.keys(day?.dictation || {}).length > 0 || day?.hasRecording) return 5;
  return 0;
}

export function isEmptyDay(day: DayLog | undefined | null): boolean {
  if (!day) return true;
  const hasSteps = STEP_IDS.some(id => day.steps?.[id] === true);
  const hasDictation = Object.keys(day.dictation || {}).length > 0;
  const hasReps = Object.values(day.reps || {}).some(n => n > 0);
  const hasMastered = (day.mastered || []).length > 0;
  return !hasSteps && !hasDictation && !hasReps && !hasMastered
    && !(day.transcript || '').trim()
    && !day.confidence
    && !(day.win || '').trim()
    && !((day.minutes ?? 0) > 0)
    && !day.hasRecording
    && !((day.durationSec ?? 0) > 0);
}

/** Cell status: full, review, partial, missed, future, or open. */
export function statusOf(
  day: DayLog | undefined | null,
  iso: string,
  { today, start }: { today: string; start?: string | null },
): DayStatus {
  const kind: DayKind = start ? dayKindFor(iso, start) : 'practice';
  const list = stepsFor(kind);
  const done = stepsDone(day, kind);
  if (kind === 'review' && (done === list.length || ((day?.minutes ?? 0) >= 15 && Boolean(day?.confidence)))) {
    return 'review';
  }
  if (done === list.length || ((day?.minutes ?? 0) >= 20 && Boolean(day?.confidence))) {
    return 'full';
  }
  if (!isEmptyDay(day)) return 'partial';
  if (iso > today) return 'future';
  if (start && iso >= start && iso < today) return 'missed';
  return 'open';
}

export function planWeekDates(startDate: string, week: number): string[] {
  const first = addDays(startDate, (week - 1) * 7);
  return weekDates(first);
}

export function weekSummary(
  days: Record<string, DayLog>,
  startOrDates: string | string[],
  dailyGoal = 25,
  startDate: string | null = null,
): { minutes: number; sessions: number } {
  const dates = Array.isArray(startOrDates) ? startOrDates : weekDates(startOrDates);
  let minutes = 0;
  let sessions = 0;
  for (const iso of dates) {
    const d = days[iso];
    const kind: DayKind = startDate ? dayKindFor(iso, startDate) : 'practice';
    minutes += dayMinutes(d, dailyGoal, kind);
    if (!isEmptyDay(d)) sessions += 1;
  }
  return { minutes, sessions };
}

export function programRows(
  days: Record<string, DayLog>,
  start: string,
  dailyGoal = 25,
  count = WEEKS,
): WeekRow[] {
  const latest = Object.keys(days).filter(d => !isEmptyDay(days[d])).sort().pop();
  const totalWeeks = Math.max(count, latest && latest >= start ? programWeek(latest, start) : 0);
  return Array.from({ length: totalWeeks }, (_, i) => {
    const week = i + 1;
    const dates = planWeekDates(start, week);
    return { week, startDate: dates[0], ...weekSummary(days, dates, dailyGoal, start) };
  });
}

export function programTotals(
  days: Record<string, DayLog>,
  rows: WeekRow[],
  startDate: string,
): { sessions: number; minutes: number; goalWeeks: number; phrases: number } {
  const activeDates = Object.keys(days).filter(d => !isEmptyDay(days[d]));
  const phrasesSet = new Set<string>();
  for (const iso of activeDates) {
    const d = days[iso];
    const p = lessonForDay(planDayFor(iso, startDate));
    if (p.kind === 'practice' && (stepsDone(d, 'practice') >= 2 || (d?.minutes ?? 0) >= 10 || (d?.transcript || '').trim())) {
      phrasesSet.add(p.lesson.pro.phrase);
      phrasesSet.add(p.lesson.casual.phrase);
    }
    for (const phrase of d?.mastered || []) phrasesSet.add(phrase);
  }
  return {
    sessions: rows.reduce((n, r) => n + r.sessions, 0),
    minutes: rows.reduce((n, r) => n + r.minutes, 0),
    goalWeeks: rows.filter(r => r.minutes >= WEEKLY_GOAL_MIN).length,
    phrases: phrasesSet.size,
  };
}

export function streaks(days: Record<string, DayLog>, today: string): { current: number; best: number } {
  const active = new Set(Object.keys(days).filter(d => d <= today && !isEmptyDay(days[d])));
  if (!active.size) return { current: 0, best: 0 };

  let current = 0;
  let cursor = active.has(today) ? today : addDays(today, -1);
  while (active.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...active].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const iso of sorted) {
    run = prev && daysBetween(prev, iso) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = iso;
  }
  return { current, best };
}

export function fluencyHistory(days: Record<string, DayLog>): FluencyPoint[] {
  const confScore: Record<ConfidenceId, number> = { rough: 1, steady: 2, smooth: 3 };
  return Object.keys(days).sort().flatMap(date => {
    const d = days[date];
    const text = (d?.transcript || '').trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    if (!words && !d?.confidence) return [];
    const durationSec = d?.durationSec ?? 0;
    const wpm = words > 0 && durationSec >= 10 ? Math.round((words / durationSec) * 60) : null;
    const confidence = d?.confidence || null;
    return [{
      date,
      words,
      wpm,
      confidence,
      confidenceRank: confidence ? confScore[confidence] : 0,
      flags: (d?.flags || []).length,
    }];
  });
}

/* ---------- Dictation LCS Word Diff ---------- */

const CONTRACTIONS: Record<string, string[]> = {
  "i'm": ['i', 'am'], "you're": ['you', 'are'], "we're": ['we', 'are'], "they're": ['they', 'are'],
  "he's": ['he', 'is'], "she's": ['she', 'is'], "it's": ['it', 'is'], "that's": ['that', 'is'],
  "what's": ['what', 'is'], "there's": ['there', 'is'], "here's": ['here', 'is'], "who's": ['who', 'is'],
  "i've": ['i', 'have'], "you've": ['you', 'have'], "we've": ['we', 'have'], "they've": ['they', 'have'],
  "i'll": ['i', 'will'], "you'll": ['you', 'will'], "we'll": ['we', 'will'], "they'll": ['they', 'will'],
  "he'll": ['he', 'will'], "she'll": ['she', 'will'], "it'll": ['it', 'will'],
  "i'd": ['i', 'would'], "you'd": ['you', 'would'], "we'd": ['we', 'would'], "they'd": ['they', 'would'],
  "don't": ['do', 'not'], "doesn't": ['does', 'not'], "didn't": ['did', 'not'],
  "isn't": ['is', 'not'], "aren't": ['are', 'not'], "wasn't": ['was', 'not'], "weren't": ['were', 'not'],
  "haven't": ['have', 'not'], "hasn't": ['has', 'not'], "hadn't": ['had', 'not'],
  "won't": ['will', 'not'], "wouldn't": ['would', 'not'], "couldn't": ['could', 'not'], "shouldn't": ['should', 'not'],
  "can't": ['can', 'not'], cannot: ['can', 'not'],
  "let's": ['let', 'us'], gonna: ['going', 'to'], wanna: ['want', 'to'], gotta: ['got', 'to'],
};

export function tokenizeForDiff(text: string): string[] {
  const raw = String(text || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
  const out: string[] = [];
  for (const w of raw) {
    const clean = w.replace(/^'+|'+$/g, '');
    if (!clean) continue;
    if (CONTRACTIONS[clean]) out.push(...CONTRACTIONS[clean]);
    else out.push(clean.replace(/'/g, ''));
  }
  return out;
}

/** Longest Common Subsequence word diff for listening dictation feedback. */
export function compareDictation(expected: string, typed: string): DictationDiff {
  const a = tokenizeForDiff(expected);
  const b = tokenizeForDiff(typed);
  const n = a.length;
  const m = b.length;
  if (!n) return { score: 0, matched: 0, total: 0, tokens: [] };
  if (!m) return { score: 0, matched: 0, total: n, tokens: a.map(word => ({ word, state: 'miss' })) };

  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const tokens: DictationToken[] = [];
  let i = 0;
  let j = 0;
  let matched = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ word: a[i], state: 'match' });
      matched += 1;
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ word: a[i], state: 'miss' });
      i += 1;
    } else {
      tokens.push({ word: b[j], state: 'extra' });
      j += 1;
    }
  }
  while (i < n) tokens.push({ word: a[i++], state: 'miss' });
  while (j < m) tokens.push({ word: b[j++], state: 'extra' });

  return {
    score: Math.round((matched / n) * 100),
    matched,
    total: n,
    tokens,
  };
}

/* ---------- Reminders & Calendar ---------- */

const APP = 'english-fluency';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const NOT_BACKUP = 'That file is not an English Fluency backup.';

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, time: '19:00', days: [1, 2, 3, 4, 5, 6, 0] };

export function reminderFor(date: string, startDate?: string | null): { title: string; body: string } {
  const dayNum = startDate ? planDayFor(date, startDate) : 1;
  const info = lessonForDay(dayNum);
  if (info.kind === 'review') {
    return {
      title: `English Fluency · Day ${info.dayNumber} Story Review`,
      body: `25 min · Week ${info.week} story integration and 60s prompts.`,
    };
  }
  return {
    title: `English Fluency · Day ${info.dayNumber}: ${info.lesson.pro.phrase} + ${info.lesson.casual.phrase}`,
    body: `25 min · ${info.lesson.topic}. Open English Fluency to practice.`,
  };
}

export function reminderDue({
  reminder,
  date,
  nowTime,
  day,
  lastSent,
}: {
  reminder?: Partial<ReminderSettings> | null;
  date: string;
  nowTime: string;
  day?: DayLog | null;
  lastSent?: string | null;
}): boolean {
  return kitReminderDue({
    reminder,
    date,
    nowTime,
    isDone: !isEmptyDay(day),
    lastSent,
  });
}

export function makeCalendar({
  startDate,
  reminder = DEFAULT_REMINDER,
  today,
}: {
  startDate?: string | null;
  reminder?: Partial<ReminderSettings>;
  today: string;
}): string {
  const base = ISO.test(startDate ?? '') ? (startDate as string) : today;
  return kitMakeCalendar({
    prodId: '-//English Fluency//EN',
    uidPrefix: 'english-fluency',
    startDate: base,
    today,
    time: reminder?.time,
    durationMin: 25,
    days: Array.isArray(reminder?.days) ? reminder.days : DEFAULT_REMINDER.days,
    weeks: WEEKS,
    eventFor: firstIso => reminderFor(firstIso, base),
  });
}

/* ---------- Backup Sanitization ---------- */

const KNOWN_PHRASES = new Set(ALL_LESSONS.flatMap(l => [l.pro.phrase, l.casual.phrase]));
const CONF_IDS = new Set<string>(CONFIDENCE_LEVELS.map(c => c.id));
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

function cleanDay(raw: Record<string, unknown>): DayLog {
  const day: DayLog = { date: String(raw['date']) };
  const rawSteps = raw['steps'];
  if (rawSteps && typeof rawSteps === 'object') {
    const stepsRecord = rawSteps as Record<string, unknown>;
    const cleanSteps: StepsMap = {};
    let count = 0;
    for (const id of STEP_IDS) {
      if (stepsRecord[id] === true) {
        cleanSteps[id] = true;
        count += 1;
      }
    }
    if (count) day.steps = cleanSteps;
  }

  const rawDict = raw['dictation'];
  if (rawDict && typeof rawDict === 'object') {
    const dictRecord = rawDict as Record<string, unknown>;
    const clean: Record<string, DictationEntry> = {};
    for (const key of ['0', '1']) {
      const item = dictRecord[key];
      if (item && typeof item === 'object') {
        const entry = item as Record<string, unknown>;
        if (typeof entry['text'] === 'string') {
          clean[key] = {
            text: entry['text'].slice(0, 500),
            score: Math.min(100, Math.max(0, Math.round(num(entry['score'])))),
          };
        }
      }
    }
    if (Object.keys(clean).length) day.dictation = clean;
  }

  const rawReps = raw['reps'];
  if (rawReps && typeof rawReps === 'object') {
    const reps: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawReps as Record<string, unknown>)) {
      if (/^(pro|casual)-[0-3]$/.test(k) && typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 20) {
        reps[k] = v;
      }
    }
    if (Object.keys(reps).length) day.reps = reps;
  }

  const rawMastered = raw['mastered'];
  if (Array.isArray(rawMastered)) {
    const m = [...new Set(rawMastered.filter((p): p is string => typeof p === 'string' && KNOWN_PHRASES.has(p)))].slice(0, 20);
    if (m.length) day.mastered = m;
  }

  const rawTranscript = raw['transcript'];
  if (typeof rawTranscript === 'string' && rawTranscript) day.transcript = rawTranscript.slice(0, 8000);

  const rawDuration = raw['durationSec'];
  if (typeof rawDuration === 'number' && Number.isInteger(rawDuration) && rawDuration > 0) {
    day.durationSec = Math.min(3600, rawDuration);
  }

  const rawMinutes = raw['minutes'];
  if (typeof rawMinutes === 'number' && Number.isFinite(rawMinutes) && rawMinutes > 0) {
    day.minutes = Math.min(300, Math.round(rawMinutes));
  }

  const rawConf = raw['confidence'];
  if (typeof rawConf === 'string' && CONF_IDS.has(rawConf)) {
    day.confidence = rawConf as ConfidenceId;
  }

  const rawWin = raw['win'];
  if (typeof rawWin === 'string' && rawWin) day.win = rawWin.slice(0, 500);

  const rawFlags = raw['flags'];
  if (Array.isArray(rawFlags)) {
    const f = rawFlags.filter((x): x is string => typeof x === 'string').map(x => x.slice(0, 40)).slice(0, 30);
    if (f.length) day.flags = f;
  }

  return day;
}

export function cleanSettings(raw: unknown): Partial<Settings> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const out: Partial<Settings> = {};
  if (typeof obj['startDate'] === 'string' && ISO.test(obj['startDate'])) out.startDate = obj['startDate'];
  if (typeof obj['dailyGoal'] === 'number' && (DAILY_GOAL_OPTIONS as readonly number[]).includes(obj['dailyGoal'])) out.dailyGoal = obj['dailyGoal'];
  if (typeof obj['challengeSec'] === 'number' && (CHALLENGE_TIMERS as readonly number[]).includes(obj['challengeSec'])) out.challengeSec = obj['challengeSec'];
  if (typeof obj['rate'] === 'number' && Number.isFinite(obj['rate']) && obj['rate'] >= 0.7 && obj['rate'] <= 1.3) out.rate = obj['rate'];
  if (typeof obj['voiceName'] === 'string' && obj['voiceName']) out.voiceName = obj['voiceName'].slice(0, 120);
  if (typeof obj['beep'] === 'boolean') out.beep = obj['beep'];

  const rawRem = obj['reminder'];
  if (rawRem && typeof rawRem === 'object') {
    const r = rawRem as Record<string, unknown>;
    const days = Array.isArray(r['days'])
      ? [...new Set(r['days'].filter((d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6))]
      : [...DEFAULT_REMINDER.days];
    out.reminder = {
      enabled: r['enabled'] === true,
      time: typeof r['time'] === 'string' && TIME.test(r['time']) ? r['time'] : DEFAULT_REMINDER.time,
      days,
    };
  }
  return out;
}

export const makeBackup = (days: DayLog[], settings: Settings, exportedAt: string): string =>
  JSON.stringify({ app: APP, version: 1, exportedAt, settings, days }, null, 1);

export function parseBackup(text: string): { settings: Partial<Settings>; days: DayLog[] } {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error(NOT_BACKUP);
  }
  if (!file || typeof file !== 'object') throw new Error(NOT_BACKUP);
  const obj = file as Record<string, unknown>;
  if (obj['app'] !== APP || !Array.isArray(obj['days'])) throw new Error(NOT_BACKUP);
  const settings = cleanSettings(obj['settings']);
  const days = obj['days']
    .filter((d): d is Record<string, unknown> => Boolean(d && typeof d === 'object' && typeof (d as Record<string, unknown>)['date'] === 'string' && ISO.test(String((d as Record<string, unknown>)['date']))))
    .map(cleanDay)
    .filter(d => !isEmptyDay(d));
  return { settings, days };
}
