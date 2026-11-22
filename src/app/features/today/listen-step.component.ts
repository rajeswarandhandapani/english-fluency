import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, effect } from '@angular/core';
import { youglishUrl } from '../../core/data/plan';
import { compareDictation } from '../../core/logic/logic';
import type { DayLog, DictationDiff, Lesson } from '../../core/models';
import { FluencyStoreService } from '../../core/services/fluency-store.service';

@Component({
  selector: 'ef-listen-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details
      class="card bg-base-100 border border-base-300 shadow-xs step-card overflow-hidden"
      data-step="listen"
      [open]="open()"
      (toggle)="onToggle($event)"
    >
      <summary class="flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px]">
        <span class="flex items-center gap-2.5 min-w-0">
          <span
            class="w-7 h-7 rounded-full grid place-items-center text-sm font-bold flex-none"
            [class.bg-success]="done()"
            [class.text-success-content]="done()"
            [class.bg-base-300]="!done()"
            [class.text-base-content]="!done()"
            aria-hidden="true"
          >
            {{ done() ? '✓' : '1' }}
          </span>
          <span>
            <strong>Listen &amp; Decode</strong>
            <span class="opacity-70 text-xs"> (~5 min)</span>
          </span>
        </span>
        @if (done()) {
          <span class="badge badge-success badge-soft font-semibold">Done</span>
        } @else {
          <span class="opacity-70 text-xs">Open</span>
        }
      </summary>

      <div class="border-t border-base-300 px-4 pb-4 pt-3.5 flex flex-col gap-3.5">
        <p class="text-sm opacity-75">
          Press Play, listen without peeking, type every word you hear, then Check to reveal fast American sound links.
        </p>

        @for (clip of lesson().dictation; track clip.text; let i = $index) {
          <div class="rounded-box bg-base-200 border border-base-300 p-3 flex flex-col gap-2.5">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="badge badge-primary badge-soft text-xs font-semibold">{{ clip.context }}</span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="btn btn-sm btn-soft btn-primary"
                  (click)="speakText.emit({ text: clip.text, rateOffset: 0 })"
                >
                  ▶ Play {{ i + 1 }}
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline"
                  (click)="speakText.emit({ text: clip.text, rateOffset: -0.22 })"
                >
                  0.8× Slow {{ i + 1 }}
                </button>
              </div>
            </div>

            <input
              type="text"
              class="input input-bordered w-full bg-base-100"
              placeholder="Type exactly what you hear..."
              [attr.aria-label]="'Type what you hear clip ' + (i + 1)"
              [value]="inputs()[i]"
              (input)="onInput(i, $event)"
            />

            <div class="flex justify-end">
              <button
                type="button"
                class="btn btn-primary btn-sm min-h-10 px-4"
                [attr.data-testid]="'check-clip-' + i"
                (click)="checkClip(i)"
              >
                Check
              </button>
            </div>

            <div class="flex flex-col gap-2" [attr.data-testid]="'diff-clip-' + i">
              @if (diffs()[i]; as diff) {
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <strong class="text-xs">Match: {{ diff.score }}% ({{ diff.matched }}/{{ diff.total }} words)</strong>
                  <span class="text-xs opacity-70">Green = hit · Underline = missed</span>
                </div>
                <div class="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-base-100 border border-base-300">
                  @for (tok of diff.tokens; track $index) {
                    <span [class]="'tok tok-' + tok.state">{{ tok.word }}</span>
                  }
                </div>
                <div class="rounded-lg bg-primary/10 p-3 text-sm flex flex-col gap-1">
                  <div><strong>Actual words: </strong>{{ clip.text }}</div>
                  <div><strong>Fast sound: </strong>{{ clip.sound }}</div>
                  <div class="text-xs opacity-75">{{ clip.tip }}</div>
                </div>
              }
            </div>
          </div>
        }

        <div class="rounded-box bg-base-200 border border-base-300 p-3 flex flex-col gap-2">
          <strong class="text-xs">Hear real Americans say today's phrases (YouGlish US)</strong>
          <div class="flex flex-wrap gap-2">
            <a
              class="btn btn-outline btn-sm"
              [href]="proUrl()"
              target="_blank"
              rel="noopener noreferrer"
            >
              Hear "{{ lesson().pro.phrase }}" ↗
            </a>
            <a
              class="btn btn-outline btn-sm"
              [href]="casualUrl()"
              target="_blank"
              rel="noopener noreferrer"
            >
              Hear "{{ lesson().casual.phrase }}" ↗
            </a>
          </div>
        </div>

        <div class="flex justify-end">
          <button
            type="button"
            class="btn"
            [class.btn-success]="done()"
            [class.btn-outline]="!done()"
            data-testid="done-listen"
            (click)="toggleDone()"
          >
            {{ done() ? 'Step 1 done ✓' : 'Mark Step 1 done' }}
          </button>
        </div>
      </div>
    </details>
  `,
})
export class ListenStepComponent {
  private readonly store = inject(FluencyStoreService);

  readonly date = input.required<string>();
  readonly day = input.required<DayLog>();
  readonly lesson = input.required<Lesson>();
  readonly open = input(false);

  readonly stepToggled = output<boolean>();
  readonly speakText = output<{ text: string; rateOffset: number }>();

  readonly inputs = signal<[string, string]>(['', '']);

  constructor() {
    effect(() => {
      const d = this.day();
      this.inputs.set([
        d.dictation?.['0']?.text || '',
        d.dictation?.['1']?.text || '',
      ]);
    });
  }

  readonly done = computed(() => this.day().steps?.listen === true);
  readonly proUrl = computed(() => youglishUrl(this.lesson().pro.phrase));
  readonly casualUrl = computed(() => youglishUrl(this.lesson().casual.phrase));

  readonly diffs = computed<[DictationDiff | null, DictationDiff | null]>(() => {
    const d = this.day();
    const clips = this.lesson().dictation;
    return [0, 1].map(idx => {
      const saved = d.dictation?.[String(idx)];
      if (!saved || !clips[idx]) return null;
      return compareDictation(clips[idx].text, saved.text);
    }) as [DictationDiff | null, DictationDiff | null];
  });

  onToggle(event: Event): void {
    this.stepToggled.emit((event.target as HTMLDetailsElement).open);
  }

  onInput(idx: number, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.inputs.update(cur => {
      const next: [string, string] = [...cur] as [string, string];
      next[idx] = val;
      return next;
    });
  }

  checkClip(idx: number): void {
    const typed = this.inputs()[idx];
    const clip = this.lesson().dictation[idx];
    if (!clip) return;
    const diff = compareDictation(clip.text, typed);
    const key = String(idx);
    this.store.mutateDay(this.date(), prev => {
      const nextDict = { ...(prev.dictation || {}), [key]: { text: typed, score: diff.score } };
      const bothChecked = Boolean(nextDict['0'] && nextDict['1']);
      return {
        ...prev,
        dictation: nextDict,
        steps: bothChecked ? { ...(prev.steps || {}), listen: true } : prev.steps,
      };
    });
  }

  toggleDone(): void {
    const next = !this.done();
    this.store.mutateDay(this.date(), prev => ({
      ...prev,
      steps: { ...(prev.steps || {}), listen: next },
    }));
  }
}
