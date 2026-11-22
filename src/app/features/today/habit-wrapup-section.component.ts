import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { copyText } from '../../kit/storage-utils';
import { ToastService } from '../../kit/toast.service';
import { CONFIDENCE_LEVELS } from '../../core/data/plan';
import { analyzeTranscript, buildAiCoachPrompt } from '../../core/logic/analyzer';
import type { ConfidenceId, DayLog, Lesson, PlanInfo, StepId } from '../../core/models';
import { FluencyStoreService } from '../../core/services/fluency-store.service';

@Component({
  selector: 'ef-habit-wrapup-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3.5">
      <div class="flex flex-col gap-2" data-testid="analyzer-output">
        <div class="flex flex-wrap gap-1.5">
          <span class="rounded-lg bg-base-200 border border-base-300 px-2.5 py-1 text-xs font-medium">
            {{ analysis().words }} words
          </span>
          @if (analysis().wpm != null) {
            <span class="rounded-lg bg-base-200 border border-base-300 px-2.5 py-1 text-xs font-medium">
              {{ analysis().wpm }} WPM
            </span>
          }
          <span class="rounded-lg bg-base-200 border border-base-300 px-2.5 py-1 text-xs font-medium">
            {{ analysis().sentences }} sentences
          </span>
        </div>

        <p class="text-xs opacity-75">{{ analysis().paceNote }}</p>

        @if (analysis().words > 0 && analysis().flags.length === 0) {
          <div class="rounded-box bg-base-200 border border-base-300 p-3">
            <span class="badge badge-success badge-soft font-semibold">
              Clean! No common L1 habit traps detected.
            </span>
          </div>
        } @else if (analysis().flags.length > 0) {
          <div class="flex flex-col gap-2">
            <strong class="text-xs">
              Habit check caught {{ analysis().flags.length }} item{{ analysis().flags.length === 1 ? '' : 's' }}:
            </strong>
            @for (f of analysis().flags; track f.id) {
              <div class="rounded-lg bg-warning/15 border-l-4 border-warning px-3 py-2 text-sm flex flex-col gap-1">
                <div><strong>{{ f.label }}</strong> (“{{ f.match }}”)</div>
                <p class="text-xs opacity-85">{{ f.suggestion }}</p>
              </div>
            }
          </div>
        }

        <div class="flex">
          <button type="button" class="btn btn-outline btn-sm" (click)="copyPrompt()">
            📋 Copy AI Coach Prompt
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <span class="text-xs opacity-75">How did speaking feel today?</span>
        <div class="grid grid-cols-3 max-[440px]:grid-cols-1 gap-2">
          @for (c of confidenceLevels; track c.id) {
            <button
              type="button"
              class="btn btn-sm min-h-11"
              [class.btn-primary]="day().confidence === c.id"
              [class.btn-soft]="day().confidence === c.id"
              [class.border-primary]="day().confidence === c.id"
              [class.font-semibold]="day().confidence === c.id"
              [class.btn-outline]="day().confidence !== c.id"
              [attr.data-confidence]="c.id"
              [attr.aria-pressed]="day().confidence === c.id ? 'true' : 'false'"
              (click)="setConfidence(c.id)"
            >
              {{ c.label }}
            </button>
          }
        </div>
      </div>

      <label class="flex flex-col gap-1">
        <span class="text-sm opacity-75">One win to remember today</span>
        <input
          type="text"
          class="input input-bordered w-full bg-base-100"
          placeholder="e.g., Used BLUF cleanly in morning standup"
          aria-label="Win of the day"
          [value]="day().win || ''"
          (input)="onWinInput($event)"
          (blur)="flushSave()"
        />
      </label>

      <div class="flex items-end justify-between gap-3 flex-wrap">
        <label class="flex flex-col gap-1 max-w-[140px]">
          <span class="text-sm opacity-75">Minutes practiced</span>
          <input
            type="number"
            inputmode="numeric"
            min="1"
            max="180"
            class="input input-bordered w-full text-center tabular-nums bg-base-100"
            aria-label="Minutes practiced"
            [value]="day().minutes || store.settings().dailyGoal"
            (change)="onMinutesChange($event)"
          />
        </label>

        <button
          type="button"
          class="btn"
          [class.btn-success]="done()"
          [class.btn-primary]="!done()"
          data-testid="finish-day"
          (click)="finishDay()"
        >
          {{ done() ? 'Day Completed ✓' : 'Finish Day' }}
        </button>
      </div>
    </div>
  `,
})
export class HabitWrapupSectionComponent {
  readonly store = inject(FluencyStoreService);
  private readonly toast = inject(ToastService);

  readonly date = input.required<string>();
  readonly day = input.required<DayLog>();
  readonly stepKey = input.required<StepId>();
  readonly planInfo = input.required<PlanInfo>();
  readonly lesson = input<Lesson | null>(null);
  readonly targets = input<string[]>([]);

  readonly confidenceLevels = CONFIDENCE_LEVELS;

  readonly done = computed(() => this.day().steps?.[this.stepKey()] === true);

  readonly analysis = computed(() =>
    analyzeTranscript(this.day().transcript || '', {
      durationSec: this.day().durationSec || 0,
      targets: this.targets(),
    }),
  );

  async copyPrompt(): Promise<void> {
    const info = this.planInfo();
    const les = this.lesson();
    const firstWeekLesson = info.kind === 'review' ? info.lessons[0] : info.lesson;
    const proPhrase = les ? les.pro.phrase : firstWeekLesson.pro.phrase;
    const casualPhrase = les ? les.casual.phrase : firstWeekLesson.casual.phrase;

    const prompt = buildAiCoachPrompt({
      dayNumber: info.dayNumber,
      topic: les ? les.topic : `Week ${info.week} Review`,
      proPhrase,
      casualPhrase,
      challengeTitle: les ? les.challenge.title : 'Weekly Story Integration',
      transcript: this.day().transcript || '',
      flags: this.analysis().flags,
    });
    const ok = await copyText(prompt);
    this.toast.show(ok ? 'AI Coach prompt copied! Paste into any AI chat for feedback.' : 'Could not copy to clipboard.');
  }

  setConfidence(id: ConfidenceId): void {
    this.store.mutateDay(this.date(), prev => ({ ...prev, confidence: id }));
  }

  onWinInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value.slice(0, 500);
    this.store.mutateDay(this.date(), prev => ({ ...prev, win: val }), { debounce: true });
  }

  onMinutesChange(event: Event): void {
    const val = Number.parseInt((event.target as HTMLInputElement).value, 10);
    if (Number.isFinite(val) && val > 0) {
      this.store.mutateDay(this.date(), prev => ({
        ...prev,
        minutes: Math.min(300, val),
      }));
    }
  }

  flushSave(): void {
    void this.store.saveDay(this.store.dayFor(this.date()));
  }

  finishDay(): void {
    const key = this.stepKey();
    const goal = this.store.settings().dailyGoal;
    this.store.mutateDay(this.date(), prev => ({
      ...prev,
      steps: { ...(prev.steps || {}), [key]: true },
      minutes: prev.minutes && prev.minutes > 0 ? Math.min(300, prev.minutes) : goal,
      confidence: prev.confidence || 'steady',
    }));
    this.toast.show('Great work! Day logged on this device.');
  }
}
