import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { dayLetter, dayName } from '../../kit/dates';
import { WEEKLY_GOAL_MIN } from '../../core/data/plan';
import { planWeekDates, programWeek, statusOf, weekSummary } from '../../core/logic/logic';
import type { DayStatus } from '../../core/models';
import { FluencyStoreService } from '../../core/services/fluency-store.service';
import { SpeechService } from '../../core/services/speech.service';

const STATUS_WORD: Record<DayStatus, string> = {
  full: 'completed',
  review: 'weekly review completed',
  partial: 'in progress',
  missed: 'missed',
  future: 'upcoming',
  open: 'not started',
};

@Component({
  selector: 'ef-week-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <div class="grid grid-cols-7 gap-1.5 max-w-[440px] w-full mx-auto">
        @for (item of cells(); track item.iso) {
          <div class="flex flex-col items-center gap-0.5">
            <span class="text-xs opacity-70">{{ item.topLabel }}</span>
            <button
              type="button"
              class="cell w-full"
              [class.is-today]="item.iso === today()"
              [class.selected]="item.iso === date()"
              [attr.data-s]="item.status"
              [attr.data-date]="item.iso"
              [disabled]="item.iso > today()"
              [attr.aria-label]="item.ariaLabel"
              (click)="openDate(item.iso)"
            >
              @if (item.glyph) {
                <span>{{ item.glyph }}</span>
              } @else {
                <span class="text-xs font-medium opacity-80">{{ item.dayNumLabel }}</span>
              }
            </button>
          </div>
        }
      </div>

      <div class="grid grid-cols-2 max-[440px]:grid-cols-1 gap-2.5">
        <div class="card bg-base-100 border border-base-300 shadow-xs">
          <div class="card-body p-3 gap-1">
            <span class="text-sm opacity-75">Minutes this week</span>
            <b class="text-lg tabular-nums" data-testid="week-minutes">
              {{ summary().minutes }} of {{ weeklyGoalMin }} min
            </b>
            <progress
              class="progress progress-primary w-full h-2"
              [value]="minPct()"
              max="100"
            ></progress>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300 shadow-xs">
          <div class="card-body p-3 gap-1">
            <span class="text-sm opacity-75">Sessions this week</span>
            <b class="text-lg tabular-nums" data-testid="week-sessions">
              {{ summary().sessions }} of 7 days
            </b>
            <progress
              class="progress progress-primary w-full h-2"
              [value]="sessionPct()"
              max="100"
            ></progress>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class WeekStripComponent {
  private readonly store = inject(FluencyStoreService);
  private readonly speech = inject(SpeechService);

  readonly date = input.required<string>();
  readonly weeklyGoalMin = WEEKLY_GOAL_MIN;

  readonly today = this.store.today;

  readonly weekDates = computed(() => {
    const startDate = this.store.settings().startDate || this.today();
    const week = Math.max(1, programWeek(this.date(), startDate));
    return {
      startDate,
      week,
      dates: planWeekDates(startDate, week),
    };
  });

  readonly cells = computed(() => {
    const { startDate, week, dates } = this.weekDates();
    const days = this.store.days();
    const today = this.today();
    return dates.map((iso, idx) => {
      const status = statusOf(days[iso], iso, { today, start: startDate });
      let glyph = '';
      if (status === 'full') glyph = '✓';
      else if (status === 'review') glyph = '★';
      else if (status === 'partial') glyph = '•';
      else if (status === 'missed') glyph = '–';
      return {
        iso,
        status,
        glyph,
        topLabel: idx === 6 ? 'Rev' : dayLetter(iso),
        dayNumLabel: idx === 6 ? 'R' : String((week - 1) * 7 + idx + 1),
        ariaLabel: `${dayName(iso)}: ${STATUS_WORD[status]}`,
      };
    });
  });

  readonly summary = computed(() => {
    const { startDate, dates } = this.weekDates();
    return weekSummary(this.store.days(), dates, this.store.settings().dailyGoal, startDate);
  });

  readonly minPct = computed(() =>
    Math.min(100, Math.round((this.summary().minutes / WEEKLY_GOAL_MIN) * 100)),
  );

  readonly sessionPct = computed(() =>
    Math.min(100, Math.round((this.summary().sessions / 7) * 100)),
  );

  openDate(iso: string): void {
    this.speech.stopSpeaking();
    this.store.selectedDate.set(iso);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }
}
