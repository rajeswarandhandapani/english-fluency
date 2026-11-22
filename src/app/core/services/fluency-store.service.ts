// IndexedDB state store and reactive Signals for English Fluency.
// Preserves exact DB name ('english-fluency', v1) and stores ('days', 'recordings', 'kv').

import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { createDb, requestPersist } from '../../kit/idb';
import { ToastService } from '../../kit/toast.service';
import { DEFAULT_REMINDER, isEmptyDay, localToday } from '../logic/logic';
import type {
  DayLog,
  RecordingMeta,
  RecordingRecord,
  Settings,
  StepId,
} from '../models';

export const defaultSettings = (): Settings => ({
  startDate: null,
  dailyGoal: 25,
  challengeSec: 120,
  rate: 1.0,
  voiceName: null,
  beep: true,
  reminder: { ...DEFAULT_REMINDER, days: [...DEFAULT_REMINDER.days] },
  lastBackup: null,
  lastReminder: null,
});

@Injectable({ providedIn: 'root' })
export class FluencyStoreService {
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly db = createDb({
    name: 'english-fluency',
    version: 1,
    stores: [
      { name: 'days', keyPath: 'date' },
      { name: 'recordings', keyPath: 'date' },
      { name: 'kv' },
    ],
  });

  readonly ready = signal(false);
  readonly today = signal(localToday());
  readonly selectedDate = signal(localToday());
  readonly days = signal<Record<string, DayLog>>({});
  readonly settings = signal<Settings>(defaultSettings());
  readonly recMeta = signal<RecordingMeta[]>([]);
  readonly recUrls = signal<Record<string, string>>({});
  readonly rolePlay = signal(false);
  readonly refSearch = signal('');
  readonly refCategory = signal<'All' | 'Work' | 'Casual'>('All');

  private openStepsMap: Record<string, Record<string, boolean>> = {};
  private recLoading: Record<string, boolean> = {};
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  lastBackup: string | null = null;
  lastReminder: string | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.revokeAllAudioUrls();
    });
  }

  async init(): Promise<void> {
    if (this.ready()) return;
    this.today.set(localToday());
    this.selectedDate.set(this.today());

    const [savedDays, savedSettings] = await Promise.all([
      this.db.getAll<DayLog>('days').catch(() => [] as DayLog[]),
      this.db.getKv<Partial<Settings>>('settings').catch(() => null),
    ]);

    const dayMap: Record<string, DayLog> = {};
    for (const d of savedDays || []) {
      dayMap[d.date] = d;
    }
    this.days.set(dayMap);

    if (savedSettings) {
      const merged: Settings = { ...defaultSettings(), ...savedSettings };
      if (savedSettings.reminder) {
        merged.reminder = { ...DEFAULT_REMINDER, ...savedSettings.reminder };
      }
      this.settings.set(merged);
    }
    this.ready.set(true);
  }

  dayFor(date: string): DayLog {
    return this.days()[date] ?? { date };
  }

  stepOpenMap(date: string, keys: StepId[], day: DayLog): Record<string, boolean> {
    if (!this.openStepsMap[date]) {
      const firstOpen = keys.find(k => day.steps?.[k] !== true) ?? keys[0];
      const map: Record<string, boolean> = {};
      for (const k of keys) map[k] = k === firstOpen;
      this.openStepsMap[date] = map;
    }
    return this.openStepsMap[date];
  }

  setStepOpen(date: string, id: string, isOpen: boolean): void {
    const cur = this.openStepsMap[date] ?? {};
    cur[id] = isOpen;
    this.openStepsMap[date] = cur;
  }

  mutateDay(
    date: string,
    updater: (prev: DayLog) => DayLog,
    { debounce = false }: { debounce?: boolean } = {},
  ): DayLog {
    const prev = this.days()[date] ?? { date };
    const next = updater(prev);
    this.days.update(map => ({ ...map, [date]: next }));
    if (debounce) this.scheduleSaveDay(next);
    else void this.saveDay(next);
    return next;
  }

  async saveDay(day: DayLog): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    requestPersist();
    try {
      if (isEmptyDay(day)) await this.db.del('days', day.date);
      else await this.db.put('days', day);
    } catch {
      this.toast.show('Could not save on this device. Check available browser storage.');
    }
  }

  scheduleSaveDay(day: DayLog): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.saveDay(day);
    }, 180);
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    const next = { ...this.settings(), ...patch };
    this.settings.set(next);
    await this.db.setKv('settings', next);
  }

  async refreshRecordingMeta(): Promise<void> {
    const list = await this.db.getAll<RecordingRecord>('recordings').catch(() => [] as RecordingRecord[]);
    this.recMeta.set(
      (list || []).map(r => ({
        date: r.date,
        durationSec: r.durationSec || 0,
        size: r.blob?.size || 0,
        createdAt: r.createdAt || null,
      })),
    );
  }

  async ensureRecordingLoaded(date: string, day: DayLog): Promise<void> {
    if (!day?.hasRecording || this.recUrls()[date] || this.recLoading[date]) return;
    this.recLoading[date] = true;
    try {
      const rec = await this.db.get<RecordingRecord>('recordings', date);
      if (rec?.blob) {
        const url = URL.createObjectURL(rec.blob);
        this.recUrls.update(urls => ({ ...urls, [date]: url }));
      }
    } catch { }
    this.recLoading[date] = false;
  }

  async saveRecording(rec: RecordingRecord): Promise<void> {
    await this.db.put('recordings', rec);
    const oldUrl = this.recUrls()[rec.date];
    if (oldUrl) {
      try { URL.revokeObjectURL(oldUrl); } catch { }
    }
    const url = URL.createObjectURL(rec.blob);
    this.recUrls.update(urls => ({ ...urls, [rec.date]: url }));
  }

  async removeRecording(date: string): Promise<void> {
    const url = this.recUrls()[date];
    if (url) {
      try { URL.revokeObjectURL(url); } catch { }
    }
    this.recUrls.update(urls => {
      const next = { ...urls };
      delete next[date];
      return next;
    });
    await this.db.del('recordings', date).catch(() => { });
    this.mutateDay(date, prev => {
      const copy: DayLog = { ...prev };
      delete copy.hasRecording;
      return copy;
    });
  }

  async clearAllRecordings(): Promise<void> {
    await this.db.clear('recordings');
    this.revokeAllAudioUrls();
    const updated: Record<string, DayLog> = { ...this.days() };
    for (const [date, day] of Object.entries(updated)) {
      if (day.hasRecording) {
        const copy: DayLog = { ...day };
        delete copy.hasRecording;
        updated[date] = copy;
        await this.saveDay(copy);
      }
    }
    this.days.set(updated);
    this.recMeta.set([]);
  }

  async restoreBackup(daysList: DayLog[], nextSettings: Settings): Promise<void> {
    await this.db.run(['days', 'kv'], 'readwrite', t => {
      const dayStore = t.objectStore('days');
      dayStore.clear();
      daysList.forEach(d => dayStore.put(d));
      t.objectStore('kv').put(nextSettings, 'settings');
    });
    this.settings.set(nextSettings);
    this.days.set(Object.fromEntries(daysList.map(d => [d.date, d])));
    this.openStepsMap = {};
    this.selectedDate.set(this.today());
  }

  async eraseAll(): Promise<void> {
    await this.db.eraseAll();
    this.revokeAllAudioUrls();
    this.days.set({});
    this.settings.set(defaultSettings());
    this.openStepsMap = {};
    this.recMeta.set([]);
    this.selectedDate.set(this.today());
  }

  revokeAllAudioUrls(): void {
    for (const url of Object.values(this.recUrls())) {
      try { URL.revokeObjectURL(url); } catch { }
    }
    this.recUrls.set({});
    this.recLoading = {};
  }
}
