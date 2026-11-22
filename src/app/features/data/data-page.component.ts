import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmDialogService } from '../../kit/confirm-dialog.service';
import { downloadFile } from '../../kit/storage-utils';
import { KIT_THEMES, ThemeService } from '../../kit/theme.service';
import { ToastService } from '../../kit/toast.service';
import { CHALLENGE_TIMERS, DAILY_GOAL_OPTIONS } from '../../core/data/plan';
import {
  DEFAULT_REMINDER,
  isEmptyDay,
  makeBackup,
  makeCalendar,
  parseBackup,
  reminderFor,
} from '../../core/logic/logic';
import { FluencyStoreService, defaultSettings } from '../../core/services/fluency-store.service';
import { SpeechService } from '../../core/services/speech.service';

const stamp = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const DAYS = [
  { num: 1, short: 'Mon', full: 'Monday' },
  { num: 2, short: 'Tue', full: 'Tuesday' },
  { num: 3, short: 'Wed', full: 'Wednesday' },
  { num: 4, short: 'Thu', full: 'Thursday' },
  { num: 5, short: 'Fri', full: 'Friday' },
  { num: 6, short: 'Sat', full: 'Saturday' },
  { num: 0, short: 'Sun', full: 'Sunday' },
] as const;

@Component({
  selector: 'ef-data-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-bold tracking-tight">Data &amp; Settings</h1>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">Appearance</h2>
        <label class="flex flex-col gap-1">
          <span class="text-sm opacity-75">Theme</span>
          <select
            class="select select-bordered w-full"
            aria-label="Theme"
            [value]="themeSvc.theme()"
            (change)="onThemeChange($event)"
          >
            @for (t of themes; track t.id) {
              <option [value]="t.id">{{ t.label }}</option>
            }
          </select>
        </label>
      </div>
    </section>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">Speech &amp; Practice Settings</h2>

        <label class="flex flex-col gap-1">
          <span class="text-sm opacity-75">American voice</span>
          <select
            class="select select-bordered w-full"
            aria-label="American voice"
            [value]="store.settings().voiceName || ''"
            (change)="onVoiceChange($event)"
          >
            <option value="">Default browser US English</option>
            @for (v of voices; track v.name) {
              <option [value]="v.name">{{ v.name }} ({{ v.lang }})</option>
            }
          </select>
        </label>

        <div>
          <button type="button" class="btn btn-outline btn-sm" (click)="testVoice()">
            🔊 Test voice
          </button>
        </div>

        <label class="flex flex-col gap-1">
          <span class="text-sm opacity-75">Speech speed</span>
          <select
            class="select select-bordered w-full"
            aria-label="Speech speed"
            [value]="'' + (store.settings().rate || 1)"
            (change)="onRateChange($event)"
          >
            <option value="0.85">0.85× Slow &amp; clear</option>
            <option value="1">1.0× Natural US pace</option>
            <option value="1.1">1.1× Brisk</option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-sm opacity-75">Daily goal</span>
          <select
            class="select select-bordered w-full"
            aria-label="Daily goal minutes"
            [value]="'' + store.settings().dailyGoal"
            (change)="onGoalChange($event)"
          >
            @for (m of goalOptions; track m) {
              <option [value]="m">{{ m }} min / day</option>
            }
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-sm opacity-75">Default speaking timer</span>
          <select
            class="select select-bordered w-full"
            aria-label="Speaking challenge timer"
            [value]="'' + store.settings().challengeSec"
            (change)="onTimerChange($event)"
          >
            @for (sec of timerOptions; track sec) {
              <option [value]="sec">{{ formatStamp(sec) }}</option>
            }
          </select>
        </label>

        <label class="flex items-center gap-2.5 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            class="checkbox checkbox-primary checkbox-sm"
            [checked]="store.settings().beep"
            (change)="onBeepChange($event)"
          />
          <span class="text-sm">Timer finish chime</span>
        </label>
      </div>
    </section>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">Daily Reminder</h2>

        <label class="flex items-center gap-2.5 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            class="checkbox checkbox-primary checkbox-sm"
            [checked]="store.settings().reminder.enabled"
            (change)="onReminderToggle($event)"
          />
          <span class="text-sm">Daily practice reminder</span>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-sm opacity-75">Reminder time</span>
          <input
            type="time"
            class="input input-bordered w-full"
            aria-label="Reminder time"
            [value]="store.settings().reminder.time"
            (change)="onReminderTimeChange($event)"
          />
        </label>

        <div class="flex flex-wrap gap-1.5">
          @for (d of daysList; track d.num) {
            <button
              type="button"
              class="btn btn-sm min-w-11"
              [class.btn-primary]="hasReminderDay(d.num)"
              [class.btn-outline]="!hasReminderDay(d.num)"
              [attr.aria-label]="'Remind on ' + d.full"
              [attr.aria-pressed]="hasReminderDay(d.num) ? 'true' : 'false'"
              (click)="toggleReminderDay(d.num)"
            >
              {{ d.short }}
            </button>
          }
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-outline btn-sm" (click)="testReminder()">
            Test reminder
          </button>
          <button type="button" class="btn btn-outline btn-sm" (click)="exportIcs()">
            Add to calendar (.ics)
          </button>
        </div>
      </div>
    </section>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">Local Voice Recordings</h2>
        <p class="text-sm opacity-75">
          {{ store.recMeta().length }} voice recording{{ store.recMeta().length === 1 ? '' : 's' }} saved on this device ({{ audioMb() }} MB). Audio stays strictly local and is not included in JSON backups.
        </p>
        <div>
          <button
            type="button"
            class="btn btn-outline btn-sm"
            [disabled]="store.recMeta().length === 0"
            (click)="clearAudio()"
          >
            Clear saved audio
          </button>
        </div>
      </div>
    </section>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">Backup &amp; Reset</h2>
        <p class="text-sm opacity-75">
          Download a JSON backup of your daily progress, dictation scores, transcripts, and settings anytime.
        </p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary" (click)="downloadBackup()">
            Download backup
          </button>
          <label class="btn btn-outline relative overflow-hidden cursor-pointer">
            Restore backup
            <input
              type="file"
              accept="application/json,.json"
              class="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Restore backup file"
              (change)="restoreBackup($event)"
            />
          </label>
        </div>
        <div>
          <button type="button" class="btn btn-outline btn-error" (click)="eraseAll()">
            Erase all data
          </button>
        </div>
      </div>
    </section>
  `,
})
export class DataPageComponent {
  readonly store = inject(FluencyStoreService);
  readonly themeSvc = inject(ThemeService);
  private readonly speech = inject(SpeechService);
  private readonly toast = inject(ToastService);
  private readonly confirmDlg = inject(ConfirmDialogService);
  private readonly router = inject(Router);

  readonly themes = KIT_THEMES;
  readonly goalOptions = DAILY_GOAL_OPTIONS;
  readonly timerOptions = CHALLENGE_TIMERS;
  readonly daysList = DAYS;
  readonly voices = this.speech.listEnUsVoices();

  constructor() {
    void this.store.refreshRecordingMeta();
  }

  readonly audioMb = computed(() => {
    const bytes = this.store.recMeta().reduce((n, r) => n + (r.size || 0), 0);
    return (bytes / (1024 * 1024)).toFixed(1);
  });

  formatStamp(sec: number): string {
    return stamp(sec);
  }

  hasReminderDay(dayNum: number): boolean {
    return this.store.settings().reminder.days.includes(dayNum);
  }

  onThemeChange(event: Event): void {
    this.themeSvc.setTheme((event.target as HTMLSelectElement).value);
  }

  async onVoiceChange(event: Event): Promise<void> {
    const v = (event.target as HTMLSelectElement).value || null;
    await this.store.updateSettings({ voiceName: v });
  }

  testVoice(): void {
    const s = this.store.settings();
    if (!this.speech.canSpeak()) {
      this.toast.show('Speech synthesis is unavailable in this browser.');
      return;
    }
    this.speech.speak('Let\'s do a quick sanity check so we stay on the same page.', {
      voiceName: s.voiceName,
      rate: s.rate || 1.0,
    });
  }

  async onRateChange(event: Event): Promise<void> {
    await this.store.updateSettings({ rate: Number((event.target as HTMLSelectElement).value) });
  }

  async onGoalChange(event: Event): Promise<void> {
    await this.store.updateSettings({ dailyGoal: Number((event.target as HTMLSelectElement).value) });
  }

  async onTimerChange(event: Event): Promise<void> {
    await this.store.updateSettings({ challengeSec: Number((event.target as HTMLSelectElement).value) });
  }

  async onBeepChange(event: Event): Promise<void> {
    await this.store.updateSettings({ beep: (event.target as HTMLInputElement).checked });
  }

  async onReminderToggle(event: Event): Promise<void> {
    const enabled = (event.target as HTMLInputElement).checked;
    if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => { });
    }
    const cur = this.store.settings().reminder;
    await this.store.updateSettings({ reminder: { ...cur, enabled } });
  }

  async onReminderTimeChange(event: Event): Promise<void> {
    const time = (event.target as HTMLInputElement).value;
    if (!time) return;
    const cur = this.store.settings().reminder;
    await this.store.updateSettings({ reminder: { ...cur, time } });
  }

  async toggleReminderDay(dayNum: number): Promise<void> {
    const cur = this.store.settings().reminder;
    const next = new Set(cur.days);
    if (next.has(dayNum)) next.delete(dayNum);
    else next.add(dayNum);
    await this.store.updateSettings({ reminder: { ...cur, days: [...next] } });
  }

  testReminder(): void {
    const info = reminderFor(this.store.today(), this.store.settings().startDate);
    this.toast.show(info.title);
  }

  exportIcs(): void {
    const s = this.store.settings();
    const ics = makeCalendar({ startDate: s.startDate, reminder: s.reminder, today: this.store.today() });
    downloadFile('english-fluency-reminders.ics', ics, 'text/calendar');
    this.toast.show('Downloaded calendar reminders (.ics).');
  }

  async clearAudio(): Promise<void> {
    const ok = await this.confirmDlg.confirm(
      'Clear saved audio?',
      'This deletes all locally stored voice recordings while keeping your transcripts and streak.',
      'Clear audio',
    );
    if (!ok) return;
    await this.store.clearAllRecordings();
    this.toast.show('Saved voice recordings cleared.');
  }

  downloadBackup(): void {
    const list = Object.values(this.store.days()).filter(d => !isEmptyDay(d));
    const json = makeBackup(list, this.store.settings(), new Date().toISOString());
    downloadFile(`english-fluency-${this.store.today()}.json`, json, 'application/json');
    this.store.lastBackup = this.store.today();
    this.toast.show('Backup downloaded.');
  }

  async restoreBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    let parsed;
    try {
      parsed = parseBackup(await file.text());
    } catch (err) {
      this.toast.show((err as Error).message);
      return;
    }

    const body = `Replace current logs with ${parsed.days.length} saved day${parsed.days.length === 1 ? '' : 's'} from this backup?`;
    const ok = await this.confirmDlg.confirm('Replace current data?', body, 'Replace');
    if (!ok) return;

    const nextSettings = { ...defaultSettings(), ...parsed.settings };
    if (parsed.settings.reminder) {
      nextSettings.reminder = { ...DEFAULT_REMINDER, ...parsed.settings.reminder };
    }
    await this.store.restoreBackup(parsed.days, nextSettings);
    this.toast.show('Backup restored.');
    void this.router.navigateByUrl('/');
  }

  async eraseAll(): Promise<void> {
    const ok = await this.confirmDlg.confirm(
      'Erase all data?',
      'This removes all practice logs, transcripts, voice recordings, and settings from this device.',
      'Erase',
    );
    if (!ok) return;
    await this.store.eraseAll();
    this.toast.show('All data erased.');
    void this.router.navigateByUrl('/');
  }
}
