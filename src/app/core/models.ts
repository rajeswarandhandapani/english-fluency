// Domain types for English Fluency.

export type StepId =
  | 'listen'
  | 'shadow'
  | 'story'
  | 'speak'
  | 'review'
  | 'recap'
  | 'impromptu'
  | 'reflect';

export type DayKind = 'practice' | 'review';
export type DayStatus = 'full' | 'review' | 'partial' | 'missed' | 'future' | 'open';
export type ConfidenceId = 'rough' | 'steady' | 'smooth';
export type PhraseKind = 'pro' | 'casual';
export type SwapCategory = 'Work' | 'Casual';

export interface StepsMap {
  listen?: boolean;
  shadow?: boolean;
  story?: boolean;
  speak?: boolean;
  review?: boolean;
  recap?: boolean;
  impromptu?: boolean;
  reflect?: boolean;
}

export interface DictationClip {
  context: string;
  text: string;
  sound: string;
  tip: string;
}

export interface SentenceExample {
  tag: string;
  text: string;
}

export interface PhraseItem {
  phrase: string;
  pos: string;
  meaning: string;
  stress: string;
  fastLink: string;
  collocations: string[];
  sentences: SentenceExample[];
}

export interface StoryItem {
  kind: SwapCategory;
  title: string;
  text: string;
  connectors: string[];
}

export interface DialogueTurn {
  speaker: string;
  text: string;
}

export interface DialogueSpec {
  kind: string;
  context: string;
  turns: DialogueTurn[];
}

export interface ChallengeSpec {
  framework: string;
  title: string;
  prompt: string;
  bullets: string[];
}

export interface Lesson {
  id: string;
  topic: string;
  swapId: string;
  drillId: string;
  pro: PhraseItem;
  casual: PhraseItem;
  dictation: DictationClip[];
  stories: StoryItem[];
  dialogue: DialogueSpec;
  challenge: ChallengeSpec;
}

export interface SwapItem {
  id: string;
  category: SwapCategory;
  habit: string;
  natural: string[];
  why: string;
  example: string;
}

export interface ClarityDrill {
  id: string;
  title: string;
  why: string;
  cue: string;
  pairs: string[];
}

export interface FrameworkItem {
  id: string;
  name: string;
  when: string;
  why: string;
  steps: string[];
  example: string;
}

export interface PhaseInfo {
  id: number;
  weeks: [number, number];
  name: string;
  focus: string;
}

export interface DictationEntry {
  text: string;
  score: number;
}

export interface DayLog {
  date: string;
  steps?: StepsMap;
  dictation?: Record<string, DictationEntry>;
  reps?: Record<string, number>;
  mastered?: string[];
  transcript?: string;
  durationSec?: number;
  minutes?: number;
  confidence?: ConfidenceId;
  win?: string;
  flags?: string[];
  hasRecording?: boolean;
}

export interface RecordingRecord {
  date: string;
  blob: Blob;
  mimeType: string;
  durationSec: number;
  createdAt: number;
}

export interface RecordingMeta {
  date: string;
  durationSec: number;
  size: number;
  createdAt: number | null;
}

export interface ReminderSettings {
  enabled: boolean;
  time: string;
  days: number[];
}

export interface Settings {
  startDate: string | null;
  dailyGoal: number;
  challengeSec: number;
  rate: number;
  voiceName: string | null;
  beep: boolean;
  reminder: ReminderSettings;
  lastBackup: string | null;
  lastReminder: string | null;
}

export interface HabitFlag {
  id: string;
  label: string;
  match: string;
  suggestion: string;
}

export interface TargetHit {
  phrase: string;
  used: boolean;
}

export interface TranscriptAnalysis {
  words: number;
  sentences: number;
  wpm: number | null;
  paceNote: string;
  flags: HabitFlag[];
  targetHits: TargetHit[];
}

export interface DictationToken {
  word: string;
  state: 'match' | 'miss' | 'extra';
}

export interface DictationDiff {
  score: number;
  matched: number;
  total: number;
  tokens: DictationToken[];
}

export interface WeekRow {
  week: number;
  startDate: string;
  minutes: number;
  sessions: number;
}

export interface FluencyPoint {
  date: string;
  words: number;
  wpm: number | null;
  confidence: ConfidenceId | null;
  confidenceRank: number;
  flags: number;
}

export interface PracticePlanInfo {
  kind: 'practice';
  dayNumber: number;
  week: number;
  dayInWeek: number;
  phase: PhaseInfo;
  lesson: Lesson;
}

export interface ReviewPlanInfo {
  kind: 'review';
  dayNumber: number;
  week: number;
  dayInWeek: number;
  phase: PhaseInfo;
  lessons: Lesson[];
  prompts: string[];
}

export type PlanInfo = PracticePlanInfo | ReviewPlanInfo;
