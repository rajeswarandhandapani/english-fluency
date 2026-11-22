import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { addDays, longDate, shortDate } from '../../kit/dates';
import { ToastService } from '../../kit/toast.service';
import { TimerService } from '../../kit/timer.service';
import { TOTAL_DAYS, lessonForDay } from '../../core/data/plan';
import { dayNumberFor, planDayFor, stepsDone } from '../../core/logic/logic';
import type { StepId } from '../../core/models';
import { FluencyStoreService } from '../../core/services/fluency-store.service';
import { SpeechService } from '../../core/services/speech.service';
import { HabitWrapupSectionComponent } from './habit-wrapup-section.component';
import { ListenStepComponent } from './listen-step.component';
import { SetupViewComponent } from './setup-view.component';
import { ShadowStepComponent } from './shadow-step.component';
import { SpeakRecordSectionComponent } from './speak-record-section.component';
import { StoryStepComponent } from './story-step.component';
import { WeekStripComponent } from './week-strip.component';

@Component({
  selector: 'ef-today-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SetupViewComponent,
    WeekStripComponent,
    ListenStepComponent,
    ShadowStepComponent,
    StoryStepComponent,
    SpeakRecordSectionComponent,
    HabitWrapupSectionComponent,
  ],
  template: `
    @if (!hasStartDate()) {
      <ef-setup-view />
    } @else {
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-outline btn-square text-2xl leading-none"
          aria-label="Previous day"
          (click)="moveDay(-1)"
        >
          ‹
        </button>

        <div class="flex-1 min-w-0 text-center">
          <h1 class="text-xl font-bold tracking-tight">{{ headingText() }}</h1>
          <p class="text-sm opacity-75">{{ subtitleText() }}</p>
          @if (date() !== store.today()) {
            <button
              type="button"
              class="btn btn-xs btn-outline rounded-full mt-1.5"
              (click)="goToday()"
            >
              Back to today →
            </button>
          }
        </div>

        <button
          type="button"
          class="btn btn-outline btn-square text-2xl leading-none"
          aria-label="Next day"
          [disabled]="date() >= store.today()"
          (click)="moveDay(1)"
        >
          ›
        </button>
      </div>

      <ef-week-strip [date]="date()" />

      @if (planInfo(); as info) {
        @if (info.kind === 'practice') {
          <section class="card bg-base-100 border border-base-300 border-l-4 border-l-primary shadow-xs">
            <div class="card-body p-4 gap-2">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <h2 class="text-base font-bold">{{ info.lesson.topic }}</h2>
                <span class="badge badge-primary badge-soft font-semibold" data-testid="step-count">
                  {{ practiceDoneCount() }} of 5 steps
                </span>
              </div>
              <div class="flex flex-wrap gap-2">
                <span class="badge badge-primary badge-soft font-semibold">Work: {{ info.lesson.pro.phrase }}</span>
                <span class="badge badge-secondary badge-soft font-semibold">Casual: {{ info.lesson.casual.phrase }}</span>
              </div>
            </div>
          </section>

          <ef-listen-step
            [date]="date()"
            [day]="day()"
            [lesson]="info.lesson"
            [open]="isOpen('listen')"
            (stepToggled)="onStepToggle('listen', $event)"
            (speakText)="onSpeak($event)"
          />

          <ef-shadow-step
            [date]="date()"
            [day]="day()"
            [lesson]="info.lesson"
            [open]="isOpen('shadow')"
            (stepToggled)="onStepToggle('shadow', $event)"
            (speakText)="onSpeak($event)"
          />

          <ef-story-step
            [date]="date()"
            [day]="day()"
            [lesson]="info.lesson"
            [open]="isOpen('story')"
            (stepToggled)="onStepToggle('story', $event)"
            (speakText)="onSpeak($event)"
          />

          <details
            class="card bg-base-100 border border-base-300 shadow-xs step-card overflow-hidden"
            data-step="speak"
            [open]="isOpen('speak')"
            (toggle)="onStepToggleEvent('speak', $event)"
          >
            <summary class="flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px]">
              <span class="flex items-center gap-2.5 min-w-0">
                <span
                  class="w-7 h-7 rounded-full grid place-items-center text-sm font-bold flex-none"
                  [class.bg-success]="stepDone('speak')"
                  [class.text-success-content]="stepDone('speak')"
                  [class.bg-base-300]="!stepDone('speak')"
                  [class.text-base-content]="!stepDone('speak')"
                  aria-hidden="true"
                >
                  {{ stepDone('speak') ? '✓' : '4' }}
                </span>
                <span>
                  <strong>Speak &amp; Record</strong>
                  <span class="opacity-70 text-xs"> (~7 min)</span>
                </span>
              </span>
              @if (stepDone('speak')) {
                <span class="badge badge-success badge-soft font-semibold">Done</span>
              } @else {
                <span class="opacity-70 text-xs">Open</span>
              }
            </summary>

            <div class="border-t border-base-300 px-4 pb-4 pt-3.5 flex flex-col gap-3.5">
              <ef-speak-record-section
                [date]="date()"
                [day]="day()"
                [framework]="info.lesson.challenge.framework"
                [title]="info.lesson.challenge.title"
                [prompt]="info.lesson.challenge.prompt"
                [bullets]="info.lesson.challenge.bullets"
                [targets]="[info.lesson.pro.phrase, info.lesson.casual.phrase]"
              />
              <div class="flex justify-end">
                <button
                  type="button"
                  class="btn"
                  [class.btn-success]="stepDone('speak')"
                  [class.btn-outline]="!stepDone('speak')"
                  data-testid="done-speak"
                  (click)="toggleStep('speak')"
                >
                  {{ stepDone('speak') ? 'Step 4 done ✓' : 'Mark Step 4 done' }}
                </button>
              </div>
            </div>
          </details>

          <details
            class="card bg-base-100 border border-base-300 shadow-xs step-card overflow-hidden"
            data-step="review"
            [open]="isOpen('review')"
            (toggle)="onStepToggleEvent('review', $event)"
          >
            <summary class="flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px]">
              <span class="flex items-center gap-2.5 min-w-0">
                <span
                  class="w-7 h-7 rounded-full grid place-items-center text-sm font-bold flex-none"
                  [class.bg-success]="stepDone('review')"
                  [class.text-success-content]="stepDone('review')"
                  [class.bg-base-300]="!stepDone('review')"
                  [class.text-base-content]="!stepDone('review')"
                  aria-hidden="true"
                >
                  {{ stepDone('review') ? '✓' : '5' }}
                </span>
                <span>
                  <strong>Habit Check &amp; Wrap-up</strong>
                  <span class="opacity-70 text-xs"> (~3 min)</span>
                </span>
              </span>
              @if (stepDone('review')) {
                <span class="badge badge-success badge-soft font-semibold">Done</span>
              } @else {
                <span class="opacity-70 text-xs">Open</span>
              }
            </summary>

            <div class="border-t border-base-300 px-4 pb-4 pt-3.5">
              <ef-habit-wrapup-section
                [date]="date()"
                [day]="day()"
                stepKey="review"
                [planInfo]="info"
                [lesson]="info.lesson"
                [targets]="[info.lesson.pro.phrase, info.lesson.casual.phrase]"
              />
            </div>
          </details>
        } @else {
          <section class="card bg-base-100 border border-base-300 border-l-4 border-l-primary shadow-xs">
            <div class="card-body p-4 gap-2">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="badge badge-primary badge-soft font-semibold">
                  Weekly Story Review · Week {{ info.week }}
                </span>
                <span class="badge badge-primary badge-soft font-semibold" data-testid="step-count">
                  {{ reviewDoneCount() }} of 4 steps
                </span>
              </div>
              <h2 class="text-base font-bold">12-Phrase Integration &amp; Spontaneous Fluency</h2>
              <p class="text-xs opacity-75">
                Check off phrases that already feel natural, weave your week into one smooth story, and tackle three 60-second prompts.
              </p>
            </div>
          </section>

          <details
            class="card bg-base-100 border border-base-300 shadow-xs step-card overflow-hidden"
            data-step="recap"
            [open]="isOpen('recap')"
            (toggle)="onStepToggleEvent('recap', $event)"
          >
            <summary class="flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px]">
              <span class="flex items-center gap-2.5 min-w-0">
                <span
                  class="w-7 h-7 rounded-full grid place-items-center text-sm font-bold flex-none"
                  [class.bg-success]="stepDone('recap')"
                  [class.text-success-content]="stepDone('recap')"
                  [class.bg-base-300]="!stepDone('recap')"
                  [class.text-base-content]="!stepDone('recap')"
                  aria-hidden="true"
                >
                  {{ stepDone('recap') ? '✓' : '1' }}
                </span>
                <span>
                  <strong>Week in Review — 12 Phrases</strong>
                  <span class="opacity-70 text-xs"> (~6 min)</span>
                </span>
              </span>
              @if (stepDone('recap')) {
                <span class="badge badge-success badge-soft font-semibold">Done</span>
              } @else {
                <span class="opacity-70 text-xs">Open</span>
              }
            </summary>

            <div class="border-t border-base-300 px-4 pb-4 pt-3.5 flex flex-col gap-3">
              <p class="text-sm opacity-75">
                Listen and tick every phrase from this week that feels natural to use in real conversation:
              </p>

              @for (l of info.lessons; track l.id; let idx = $index) {
                <div class="flex flex-col gap-1.5">
                  <span class="text-xs opacity-70">
                    Day {{ (info.week - 1) * 7 + idx + 1 }} · {{ l.topic }}
                  </span>

                  <div class="rounded-box bg-base-200 border border-base-300 px-3 py-2 flex items-center justify-between gap-2">
                    <label class="flex items-center gap-2.5 flex-1 cursor-pointer min-h-10">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-primary checkbox-sm"
                        [checked]="isMastered(l.pro.phrase)"
                        [attr.aria-label]="'Feels natural: ' + l.pro.phrase"
                        (change)="toggleMastered(l.pro.phrase, $event)"
                      />
                      <span class="badge badge-primary badge-soft text-xs font-semibold">Work</span>
                      <strong class="text-sm">{{ l.pro.phrase }}</strong>
                    </label>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline min-w-9 px-2"
                      [attr.aria-label]="'Listen to ' + l.pro.phrase"
                      (click)="onSpeak({ text: l.pro.phrase, rateOffset: 0 })"
                    >
                      🔊
                    </button>
                  </div>

                  <div class="rounded-box bg-base-200 border border-base-300 px-3 py-2 flex items-center justify-between gap-2">
                    <label class="flex items-center gap-2.5 flex-1 cursor-pointer min-h-10">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-primary checkbox-sm"
                        [checked]="isMastered(l.casual.phrase)"
                        [attr.aria-label]="'Feels natural: ' + l.casual.phrase"
                        (change)="toggleMastered(l.casual.phrase, $event)"
                      />
                      <span class="badge badge-secondary badge-soft text-xs font-semibold">Casual</span>
                      <strong class="text-sm">{{ l.casual.phrase }}</strong>
                    </label>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline min-w-9 px-2"
                      [attr.aria-label]="'Listen to ' + l.casual.phrase"
                      (click)="onSpeak({ text: l.casual.phrase, rateOffset: 0 })"
                    >
                      🔊
                    </button>
                  </div>
                </div>
              }

              <div class="flex justify-end">
                <button
                  type="button"
                  class="btn"
                  [class.btn-success]="stepDone('recap')"
                  [class.btn-outline]="!stepDone('recap')"
                  data-testid="done-recap"
                  (click)="toggleStep('recap')"
                >
                  {{ stepDone('recap') ? 'Review Step 1 done ✓' : 'Mark Review Step 1 done' }}
                </button>
              </div>
            </div>
          </details>

          <details
            class="card bg-base-100 border border-base-300 shadow-xs step-card overflow-hidden"
            data-step="story"
            [open]="isOpen('story')"
            (toggle)="onStepToggleEvent('story', $event)"
          >
            <summary class="flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px]">
              <span class="flex items-center gap-2.5 min-w-0">
                <span
                  class="w-7 h-7 rounded-full grid place-items-center text-sm font-bold flex-none"
                  [class.bg-success]="stepDone('story')"
                  [class.text-success-content]="stepDone('story')"
                  [class.bg-base-300]="!stepDone('story')"
                  [class.text-base-content]="!stepDone('story')"
                  aria-hidden="true"
                >
                  {{ stepDone('story') ? '✓' : '2' }}
                </span>
                <span>
                  <strong>The Week in Stories</strong>
                  <span class="opacity-70 text-xs"> (~5 min)</span>
                </span>
              </span>
              @if (stepDone('story')) {
                <span class="badge badge-success badge-soft font-semibold">Done</span>
              } @else {
                <span class="opacity-70 text-xs">Open</span>
              }
            </summary>

            <div class="border-t border-base-300 px-4 pb-4 pt-3.5 flex flex-col gap-3">
              <p class="text-sm">
                Tell one continuous 3-minute story about your real week (work wins, tricky moments, and weekend life) using 4–6 phrases above.
              </p>
              <div class="flex">
                <button
                  type="button"
                  class="btn btn-soft btn-primary btn-sm min-h-10"
                  (click)="startWeekStoryTimer()"
                >
                  ⏱ Start 3:00 story timer
                </button>
              </div>
              <div class="flex justify-end">
                <button
                  type="button"
                  class="btn"
                  [class.btn-success]="stepDone('story')"
                  [class.btn-outline]="!stepDone('story')"
                  data-testid="done-story"
                  (click)="toggleStep('story')"
                >
                  {{ stepDone('story') ? 'Review Step 2 done ✓' : 'Mark Review Step 2 done' }}
                </button>
              </div>
            </div>
          </details>

          <details
            class="card bg-base-100 border border-base-300 shadow-xs step-card overflow-hidden"
            data-step="impromptu"
            [open]="isOpen('impromptu')"
            (toggle)="onStepToggleEvent('impromptu', $event)"
          >
            <summary class="flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px]">
              <span class="flex items-center gap-2.5 min-w-0">
                <span
                  class="w-7 h-7 rounded-full grid place-items-center text-sm font-bold flex-none"
                  [class.bg-success]="stepDone('impromptu')"
                  [class.text-success-content]="stepDone('impromptu')"
                  [class.bg-base-300]="!stepDone('impromptu')"
                  [class.text-base-content]="!stepDone('impromptu')"
                  aria-hidden="true"
                >
                  {{ stepDone('impromptu') ? '✓' : '3' }}
                </span>
                <span>
                  <strong>60-Second Impromptu Prompts</strong>
                  <span class="opacity-70 text-xs"> (~8 min)</span>
                </span>
              </span>
              @if (stepDone('impromptu')) {
                <span class="badge badge-success badge-soft font-semibold">Done</span>
              } @else {
                <span class="opacity-70 text-xs">Open</span>
              }
            </summary>

            <div class="border-t border-base-300 px-4 pb-4 pt-3.5 flex flex-col gap-3">
              <ef-speak-record-section
                [date]="date()"
                [day]="day()"
                framework="STORY"
                title="60-Second Impromptu Prompts"
                prompt="Pick one prompt below, think for 10 seconds, then speak non-stop for 60 seconds:"
                [bullets]="info.prompts"
                [targets]="weekTargets()"
                [timerOverrideSec]="60"
                [isReviewMode]="true"
              />
              <div class="flex justify-end">
                <button
                  type="button"
                  class="btn"
                  [class.btn-success]="stepDone('impromptu')"
                  [class.btn-outline]="!stepDone('impromptu')"
                  data-testid="done-impromptu"
                  (click)="toggleStep('impromptu')"
                >
                  {{ stepDone('impromptu') ? 'Review Step 3 done ✓' : 'Mark Review Step 3 done' }}
                </button>
              </div>
            </div>
          </details>

          <details
            class="card bg-base-100 border border-base-300 shadow-xs step-card overflow-hidden"
            data-step="reflect"
            [open]="isOpen('reflect')"
            (toggle)="onStepToggleEvent('reflect', $event)"
          >
            <summary class="flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px]">
              <span class="flex items-center gap-2.5 min-w-0">
                <span
                  class="w-7 h-7 rounded-full grid place-items-center text-sm font-bold flex-none"
                  [class.bg-success]="stepDone('reflect')"
                  [class.text-success-content]="stepDone('reflect')"
                  [class.bg-base-300]="!stepDone('reflect')"
                  [class.text-base-content]="!stepDone('reflect')"
                  aria-hidden="true"
                >
                  {{ stepDone('reflect') ? '✓' : '4' }}
                </span>
                <span>
                  <strong>Habit Check &amp; Week Reflection</strong>
                  <span class="opacity-70 text-xs"> (~4 min)</span>
                </span>
              </span>
              @if (stepDone('reflect')) {
                <span class="badge badge-success badge-soft font-semibold">Done</span>
              } @else {
                <span class="opacity-70 text-xs">Open</span>
              }
            </summary>

            <div class="border-t border-base-300 px-4 pb-4 pt-3.5">
              <ef-habit-wrapup-section
                [date]="date()"
                [day]="day()"
                stepKey="reflect"
                [planInfo]="info"
                [targets]="weekTargets()"
              />
            </div>
          </details>
        }
      }
    }
  `,
})
export class TodayPageComponent {
  readonly store = inject(FluencyStoreService);
  private readonly speech = inject(SpeechService);
  private readonly toast = inject(ToastService);
  private readonly timer = inject(TimerService);

  readonly date = this.store.selectedDate;
  readonly hasStartDate = computed(() => Boolean(this.store.settings().startDate));

  readonly planInfo = computed(() => {
    const start = this.store.settings().startDate || this.store.today();
    const num = planDayFor(this.date(), start);
    return lessonForDay(num);
  });

  readonly day = computed(() => this.store.dayFor(this.date()));

  readonly headingText = computed(() => {
    const d = this.date();
    return d === this.store.today() ? `Today, ${shortDate(d)}` : longDate(d);
  });

  readonly subtitleText = computed(() => {
    const start = this.store.settings().startDate || this.store.today();
    const rawNum = dayNumberFor(this.date(), start);
    const info = this.planInfo();
    if (rawNum <= 0) return `Starts ${shortDate(start)}`;
    if (rawNum > TOTAL_DAYS) {
      return `Day ${rawNum} (Cycle ${info.dayNumber} of ${TOTAL_DAYS}) · Week ${info.week}: ${info.phase.name}`;
    }
    return `Day ${info.dayNumber} of ${TOTAL_DAYS} · Week ${info.week}: ${info.phase.name}`;
  });

  readonly practiceDoneCount = computed(() => stepsDone(this.day(), 'practice'));
  readonly reviewDoneCount = computed(() => stepsDone(this.day(), 'review'));

  readonly weekTargets = computed(() => {
    const info = this.planInfo();
    return info.kind === 'review'
      ? info.lessons.flatMap(l => [l.pro.phrase, l.casual.phrase])
      : [];
  });

  stepDone(id: StepId): boolean {
    return this.day().steps?.[id] === true;
  }

  isOpen(id: StepId): boolean {
    const info = this.planInfo();
    const keys: StepId[] = info.kind === 'review'
      ? ['recap', 'story', 'impromptu', 'reflect']
      : ['listen', 'shadow', 'story', 'speak', 'review'];
    return Boolean(this.store.stepOpenMap(this.date(), keys, this.day())[id]);
  }

  onStepToggle(id: StepId, open: boolean): void {
    this.store.setStepOpen(this.date(), id, open);
  }

  onStepToggleEvent(id: StepId, event: Event): void {
    this.store.setStepOpen(this.date(), id, (event.target as HTMLDetailsElement).open);
  }

  toggleStep(id: StepId): void {
    const cur = this.stepDone(id);
    this.store.mutateDay(this.date(), prev => ({
      ...prev,
      steps: { ...(prev.steps || {}), [id]: !cur },
    }));
  }

  isMastered(phrase: string): boolean {
    return (this.day().mastered || []).includes(phrase);
  }

  toggleMastered(phrase: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.store.mutateDay(this.date(), prev => {
      const set = new Set(prev.mastered || []);
      if (checked) set.add(phrase);
      else set.delete(phrase);
      return { ...prev, mastered: [...set] };
    });
  }

  startWeekStoryTimer(): void {
    const date = this.date();
    this.timer.start(180, {
      beep: this.store.settings().beep,
      label: 'Week in Stories',
      chimeHz: 784,
      onFinish: elapsed => {
        this.store.mutateDay(date, prev => ({
          ...prev,
          durationSec: Math.max(prev.durationSec || 0, elapsed),
        }));
      },
    });
  }

  moveDay(offset: number): void {
    this.speech.stopSpeaking();
    this.store.selectedDate.set(addDays(this.date(), offset));
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  goToday(): void {
    this.speech.stopSpeaking();
    this.store.selectedDate.set(this.store.today());
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  onSpeak({ text, rateOffset }: { text: string; rateOffset: number }): void {
    const settings = this.store.settings();
    const rate = Math.max(0.7, Math.min(1.25, (settings.rate || 1.0) + rateOffset));
    if (!this.speech.canSpeak()) {
      this.toast.show('Speech synthesis is unavailable in this browser.');
      return;
    }
    this.speech.speak(text, { voiceName: settings.voiceName, rate });
  }
}
