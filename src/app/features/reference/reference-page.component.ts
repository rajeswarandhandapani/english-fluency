import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ToastService } from '../../kit/toast.service';
import { ALL_LESSONS, CLARITY_DRILLS, FRAMEWORKS, PHASES, TAMIL_US_SWAPS } from '../../core/data/plan';
import { FluencyStoreService } from '../../core/services/fluency-store.service';
import { SpeechService } from '../../core/services/speech.service';

@Component({
  selector: 'ef-reference-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-bold tracking-tight">Reference</h1>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">Tamil → US English Upgrade Cheat Sheet</h2>

        <input
          type="search"
          class="input input-bordered w-full"
          placeholder="Search Tamil-to-US swaps, e.g. doubt, prepone, only..."
          aria-label="Search upgrades, idioms, or drills"
          [value]="store.refSearch()"
          (input)="onSearch($event)"
        />

        <div class="flex flex-wrap gap-2">
          @for (cat of categories; track cat) {
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-primary]="store.refCategory() === cat"
              [class.btn-soft]="store.refCategory() === cat"
              [class.border-primary]="store.refCategory() === cat"
              [class.font-semibold]="store.refCategory() === cat"
              [class.btn-outline]="store.refCategory() !== cat"
              [attr.aria-pressed]="store.refCategory() === cat ? 'true' : 'false'"
              (click)="store.refCategory.set(cat)"
            >
              {{ cat }}
            </button>
          }
        </div>

        <div class="flex flex-col gap-2" data-testid="swap-list">
          @if (filteredSwaps().length === 0) {
            <p class="text-sm opacity-75">No matching upgrades found.</p>
          } @else {
            @for (s of filteredSwaps(); track s.id) {
              <div class="rounded-box bg-base-200 border border-base-300 p-3 flex flex-col gap-1.5 text-sm" [attr.data-swap]="s.id">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="badge badge-soft text-xs font-semibold"
                    [class.badge-primary]="s.category === 'Work'"
                    [class.badge-secondary]="s.category !== 'Work'"
                  >
                    {{ s.category }}
                  </span>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline min-w-9 px-2"
                    [attr.aria-label]="'Hear ' + s.id + ' example'"
                    (click)="say(s.example, 0)"
                  >
                    🔊
                  </button>
                </div>
                <p><strong>Habit: </strong>{{ s.habit }}</p>
                <p><strong>Natural US: </strong>{{ s.natural.join(' · ') }}</p>
                <p class="text-xs opacity-75">{{ s.why }}</p>
                <p class="text-xs"><strong>Say: </strong>{{ s.example }}</p>
              </div>
            }
          }
        </div>
      </div>
    </section>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">4 Physical Clarity Drills</h2>
        @for (d of drills; track d.id) {
          <div class="rounded-box bg-base-200 border border-base-300 p-3 flex flex-col gap-2 text-sm">
            <strong>{{ d.title }}</strong>
            <p class="text-xs opacity-75">{{ d.why }}</p>
            <p class="text-xs"><strong>Physical cue: </strong>{{ d.cue }}</p>
            <div class="flex flex-wrap gap-1.5">
              @for (p of d.pairs; track p) {
                <button
                  type="button"
                  class="btn btn-outline btn-sm h-auto min-h-9 py-1.5 whitespace-normal text-left"
                  (click)="say(p.replace('—', ', '), -0.1)"
                >
                  🔊 {{ p }}
                </button>
              }
            </div>
          </div>
        }
      </div>
    </section>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <h2 class="text-base font-bold">Speaking Frameworks</h2>
        @for (f of frameworks; track f.id) {
          <div class="rounded-box bg-base-200 border border-base-300 p-3 flex flex-col gap-1.5 text-sm">
            <strong>{{ f.name }}</strong>
            <span class="text-xs opacity-75">Best for: {{ f.when }}</span>
            <p class="text-xs">{{ f.why }}</p>
            <ul class="list-disc pl-5 space-y-0.5 text-xs">
              @for (step of f.steps; track step) {
                <li>{{ step }}</li>
              }
            </ul>
            <p class="text-xs"><strong>Example: </strong>{{ f.example }}</p>
          </div>
        }
      </div>
    </section>

    <h2 class="text-base font-bold">12-Week Curriculum Index</h2>

    @for (phase of phaseGroups; track phase.id) {
      <details class="card bg-base-100 border border-base-300 shadow-xs step-card overflow-hidden" [open]="phase.id === 1">
        <summary class="flex items-center justify-between gap-2 px-4 py-3.5 min-h-[52px]">
          <span class="font-bold text-sm">
            Phase {{ phase.id }}: {{ phase.name }} (Weeks {{ phase.weeks[0] }}–{{ phase.weeks[1] }})
          </span>
          <span class="text-xs opacity-70">24 lessons</span>
        </summary>
        <div class="border-t border-base-300 px-4 pb-4 pt-3 flex flex-col gap-2">
          <p class="text-xs opacity-75">{{ phase.focus }}</p>
          @for (item of phase.lessons; track item.lesson.id) {
            <div class="rounded-box bg-base-200 border border-base-300 p-2.5 flex items-center justify-between gap-2">
              <div class="flex flex-col gap-0.5">
                <span class="text-xs opacity-70">Day {{ item.planDay }} · {{ item.lesson.topic }}</span>
                <div class="text-xs">
                  <strong>{{ item.lesson.pro.phrase }}</strong> · {{ item.lesson.casual.phrase }}
                </div>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-outline min-w-9 px-2"
                [attr.aria-label]="'Listen to Day ' + item.planDay + ' phrases'"
                (click)="say(item.lesson.pro.phrase + '. ' + item.lesson.casual.phrase, 0)"
              >
                🔊
              </button>
            </div>
          }
        </div>
      </details>
    }
  `,
})
export class ReferencePageComponent {
  readonly store = inject(FluencyStoreService);
  private readonly speech = inject(SpeechService);
  private readonly toast = inject(ToastService);

  readonly categories: Array<'All' | 'Work' | 'Casual'> = ['All', 'Work', 'Casual'];
  readonly drills = CLARITY_DRILLS;
  readonly frameworks = FRAMEWORKS;

  readonly phaseGroups = PHASES.map((phase, pIdx) => {
    const startIdx = pIdx * 24;
    const lessons = ALL_LESSONS.slice(startIdx, startIdx + 24).map((lesson, idx) => {
      const absIdx = startIdx + idx;
      const week = Math.floor(absIdx / 6) + 1;
      const dayInWeek = (absIdx % 6) + 1;
      return { lesson, planDay: (week - 1) * 7 + dayInWeek };
    });
    return { ...phase, lessons };
  });

  readonly filteredSwaps = computed(() => {
    const q = this.store.refSearch().trim().toLowerCase();
    const cat = this.store.refCategory();
    return TAMIL_US_SWAPS.filter(s => {
      if (cat !== 'All' && s.category !== cat) return false;
      if (!q) return true;
      return [s.habit, s.why, s.example, ...s.natural].some(t => t.toLowerCase().includes(q));
    });
  });

  onSearch(event: Event): void {
    this.store.refSearch.set((event.target as HTMLInputElement).value);
  }

  say(text: string, rateOffset: number): void {
    const s = this.store.settings();
    const rate = Math.max(0.7, Math.min(1.25, (s.rate || 1.0) + rateOffset));
    if (!this.speech.canSpeak()) {
      this.toast.show('Speech synthesis is unavailable in this browser.');
      return;
    }
    this.speech.speak(text, { voiceName: s.voiceName, rate });
  }
}
