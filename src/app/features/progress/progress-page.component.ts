import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { dayName } from '../../kit/dates';
import { ALL_LESSONS, TAMIL_US_SWAPS, TOTAL_DAYS, WEEKS, WEEKLY_GOAL_MIN } from '../../core/data/plan';
import {
  fluencyHistory,
  planWeekDates,
  programRows,
  programTotals,
  programWeek,
  statusOf,
  streaks,
} from '../../core/logic/logic';
import type { DayStatus } from '../../core/models';
import { FluencyStoreService } from '../../core/services/fluency-store.service';
import { SpeechService } from '../../core/services/speech.service';
import { FluencyChartComponent } from './fluency-chart.component';
import { WeeklyBarsChartComponent } from './weekly-bars-chart.component';

const STATUS_WORD: Record<DayStatus, string> = {
  full: 'completed',
  review: 'weekly review completed',
  partial: 'in progress',
  missed: 'missed',
  future: 'upcoming',
  open: 'not started',
};

@Component({
  selector: 'ef-progress-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WeeklyBarsChartComponent, FluencyChartComponent],
  template: `
    <h1 class="text-2xl font-bold tracking-tight">Progress</h1>

    <div class="grid grid-cols-2 max-[440px]:grid-cols-1 gap-2.5">
      <div class="card bg-base-100 border border-base-300 shadow-xs">
        <div class="card-body p-3 gap-0.5">
          <span class="text-sm opacity-75">Practice sessions</span>
          <b class="text-lg tabular-nums" data-testid="total-sessions">{{ totals().sessions }} of {{ totalDays }}</b>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-300 shadow-xs">
        <div class="card-body p-3 gap-0.5">
          <span class="text-sm opacity-75">Total minutes</span>
          <b class="text-lg tabular-nums" data-testid="total-minutes">{{ totals().minutes }}</b>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-300 shadow-xs">
        <div class="card-body p-3 gap-0.5">
          <span class="text-sm opacity-75">Current streak</span>
          <b class="text-lg tabular-nums" data-testid="current-streak">
            {{ streakInfo().current }} day{{ streakInfo().current === 1 ? '' : 's' }}
          </b>
          <span class="text-xs opacity-70">Best: {{ streakInfo().best }}</span>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-300 shadow-xs">
        <div class="card-body p-3 gap-0.5">
          <span class="text-sm opacity-75">Phrases practiced</span>
          <b class="text-lg tabular-nums" data-testid="phrases-practiced">
            {{ totals().phrases }} of {{ totalPhrases }}
          </b>
        </div>
      </div>
    </div>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">12-Week Calendar</h2>

        <div class="calendar flex flex-col gap-1.5">
          @for (row of calendarWeeks(); track row.week) {
            <div class="cal-row">
              <span class="text-xs opacity-70 tabular-nums">W{{ row.week }}</span>
              @for (cell of row.cells; track cell.iso) {
                <button
                  type="button"
                  class="cell"
                  [class.is-today]="cell.iso === store.today()"
                  [attr.data-s]="cell.status"
                  [attr.data-date]="cell.iso"
                  [disabled]="cell.iso > store.today()"
                  [attr.aria-label]="cell.ariaLabel"
                  (click)="openDate(cell.iso)"
                >
                  @if (cell.glyph) {
                    <span>{{ cell.glyph }}</span>
                  } @else {
                    <span class="text-xs font-medium opacity-80">{{ cell.dayNumLabel }}</span>
                  }
                </button>
              }
            </div>
          }
        </div>

        <div class="flex flex-wrap gap-2.5 text-xs opacity-75">
          <span class="inline-flex items-center gap-1.5">
            <i class="w-3 h-3 rounded-xs inline-block bg-success"></i>Complete
          </span>
          <span class="inline-flex items-center gap-1.5">
            <i class="w-3 h-3 rounded-xs inline-block bg-primary"></i>Story Review
          </span>
          <span class="inline-flex items-center gap-1.5">
            <i class="w-3 h-3 rounded-xs inline-block bg-warning"></i>In progress
          </span>
          <span class="inline-flex items-center gap-1.5">
            <i class="w-3 h-3 rounded-xs inline-block bg-base-200 border border-dashed border-base-content/40"></i>Missed
          </span>
        </div>
      </div>
    </section>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">Minutes per week</h2>
        <ef-weekly-bars-chart [rows]="rows()" [goal]="weeklyGoalMin" [currentWeek]="currentWeek()" />
      </div>
    </section>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">Speaking output over time</h2>
        @if (wordPoints().length > 0) {
          <ef-fluency-chart [points]="wordPoints()" />
        } @else {
          <p class="text-sm opacity-75">
            Save a spoken transcript in Step 4 to chart words spoken and pace over time.
          </p>
        }
      </div>
    </section>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">Top Caught Habits</h2>
        @if (topHabits().length > 0) {
          @for (item of topHabits(); track item.id) {
            <div class="rounded-box bg-base-200 border border-base-300 p-3 flex items-center justify-between gap-2">
              <div class="flex flex-col gap-0.5 text-sm">
                <strong>{{ item.habit }}</strong>
                @if (item.tryText) {
                  <span class="text-xs opacity-75">{{ item.tryText }}</span>
                }
              </div>
              <span class="badge badge-warning badge-soft font-semibold">{{ item.count }}×</span>
            </div>
          }
        } @else {
          <p class="text-sm opacity-75">
            No recurring habits flagged yet—paste or dictate a story in Step 4 to track habits over time.
          </p>
        }
      </div>
    </section>
  `,
})
export class ProgressPageComponent {
  readonly store = inject(FluencyStoreService);
  private readonly router = inject(Router);
  private readonly speech = inject(SpeechService);

  readonly totalDays = TOTAL_DAYS;
  readonly weeklyGoalMin = WEEKLY_GOAL_MIN;
  readonly totalPhrases = ALL_LESSONS.length * 2;

  readonly startDate = computed(() => this.store.settings().startDate || this.store.today());
  readonly currentWeek = computed(() => Math.max(1, programWeek(this.store.today(), this.startDate())));

  readonly rows = computed(() =>
    programRows(this.store.days(), this.startDate(), this.store.settings().dailyGoal, WEEKS),
  );

  readonly totals = computed(() =>
    programTotals(this.store.days(), this.rows(), this.startDate()),
  );

  readonly streakInfo = computed(() => streaks(this.store.days(), this.store.today()));

  readonly wordPoints = computed(() =>
    fluencyHistory(this.store.days()).filter(p => p.words > 0),
  );

  readonly calendarWeeks = computed(() => {
    const start = this.startDate();
    const days = this.store.days();
    const today = this.store.today();

    return Array.from({ length: WEEKS }, (_, wIdx) => {
      const week = wIdx + 1;
      const dates = planWeekDates(start, week);
      return {
        week,
        cells: dates.map((iso, dIdx) => {
          const status = statusOf(days[iso], iso, { today, start });
          let glyph = '';
          if (status === 'full') glyph = '✓';
          else if (status === 'review') glyph = '★';
          else if (status === 'partial') glyph = '•';
          else if (status === 'missed') glyph = '–';
          return {
            iso,
            status,
            glyph,
            dayNumLabel: dIdx === 6 ? 'R' : String(wIdx * 7 + dIdx + 1),
            ariaLabel: `${dayName(iso)}: ${STATUS_WORD[status]}`,
          };
        }),
      };
    });
  });

  readonly topHabits = computed(() => {
    const counts: Record<string, number> = {};
    for (const d of Object.values(this.store.days())) {
      for (const f of d.flags || []) counts[f] = (counts[f] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const swap = TAMIL_US_SWAPS.find(s => s.id === id);
        return {
          id,
          count,
          habit: swap ? swap.habit : id,
          tryText: swap ? `Try: ${swap.natural[0]}` : '',
        };
      });
  });

  openDate(iso: string): void {
    this.speech.stopSpeaking();
    this.store.selectedDate.set(iso);
    void this.router.navigateByUrl('/');
  }
}
