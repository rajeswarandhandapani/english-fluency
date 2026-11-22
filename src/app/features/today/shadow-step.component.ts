import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { drillById, swapById } from '../../core/data/plan';
import type { DayLog, Lesson, PhraseItem, PhraseKind } from '../../core/models';
import { FluencyStoreService } from '../../core/services/fluency-store.service';

@Component({
  selector: 'ef-shadow-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details
      class="card bg-base-100 border border-base-300 shadow-xs step-card overflow-hidden"
      data-step="shadow"
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
            {{ done() ? '✓' : '2' }}
          </span>
          <span>
            <strong>Phrase Upgrade &amp; Shadowing</strong>
            <span class="opacity-70 text-xs"> (~6 min)</span>
          </span>
        </span>
        @if (done()) {
          <span class="badge badge-success badge-soft font-semibold">Done</span>
        } @else {
          <span class="opacity-70 text-xs">Open</span>
        }
      </summary>

      <div class="border-t border-base-300 px-4 pb-4 pt-3.5 flex flex-col gap-3.5">
        @for (card of phraseCards(); track card.kind) {
          <div class="rounded-box bg-base-200 border border-base-300 p-3 flex flex-col gap-2.5">
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-col gap-1">
                <span
                  class="badge badge-soft text-xs font-semibold"
                  [class.badge-primary]="card.kind === 'pro'"
                  [class.badge-secondary]="card.kind !== 'pro'"
                >
                  {{ card.label }} · {{ card.data.pos }}
                </span>
                <div class="text-xl font-bold">{{ card.data.phrase }}</div>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-soft btn-primary"
                [attr.aria-label]="'Listen to ' + card.data.phrase"
                (click)="speakText.emit({ text: card.data.phrase, rateOffset: 0 })"
              >
                🔊 Listen
              </button>
            </div>

            <p class="text-sm">{{ card.data.meaning }}</p>

            <div class="flex flex-wrap gap-1.5">
              <span class="badge badge-outline h-auto whitespace-normal text-left py-1 px-2 text-xs">
                <strong>Stress: </strong>{{ card.data.stress }}
              </span>
              <span class="badge badge-outline h-auto whitespace-normal text-left py-1 px-2 text-xs">
                <strong>Fast link: </strong>{{ card.data.fastLink }}
              </span>
            </div>

            <div class="flex flex-wrap gap-1.5">
              @for (c of card.data.collocations; track c) {
                <span class="rounded-md bg-base-100 border border-base-300 px-2 py-0.5 text-xs opacity-80">
                  {{ c }}
                </span>
              }
            </div>

            <div class="divide-y divide-base-300">
              @for (s of card.data.sentences; track $index; let idx = $index) {
                <div class="grid grid-cols-[auto_1fr_auto] gap-2 items-start py-2 first:pt-0 last:pb-0">
                  <span class="badge badge-neutral badge-soft badge-xs font-bold uppercase mt-1">
                    {{ s.tag }}
                  </span>
                  <span class="text-sm">{{ s.text }}</span>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      class="btn btn-sm btn-outline min-w-9 px-2"
                      [attr.aria-label]="'Play ' + card.kind + ' sentence ' + (idx + 1)"
                      (click)="playSentence(s.text, s.tag)"
                    >
                      🔊
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm min-w-11 px-2 tabular-nums font-semibold"
                      [class.btn-success]="repCount(card.kind, idx) >= 3"
                      [class.btn-soft]="repCount(card.kind, idx) >= 3"
                      [class.border-success]="repCount(card.kind, idx) >= 3"
                      [class.hit]="repCount(card.kind, idx) >= 3"
                      [class.btn-outline]="repCount(card.kind, idx) < 3"
                      [attr.data-testid]="'rep-' + card.kind + '-' + idx"
                      [attr.aria-label]="'Speak count for ' + card.kind + ' sentence ' + (idx + 1) + ': ' + repCount(card.kind, idx) + ' of 3'"
                      (click)="bumpRep(card.kind, idx)"
                    >
                      {{ repCount(card.kind, idx) }}/3
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <div class="rounded-box bg-base-200 border border-base-300 p-3 flex flex-col gap-1.5 text-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="badge badge-warning badge-soft font-semibold">Daily Swap · {{ swap().category }}</span>
            <button
              type="button"
              class="btn btn-sm btn-outline min-w-9 px-2"
              aria-label="Hear swap example"
              (click)="speakText.emit({ text: swap().example, rateOffset: 0 })"
            >
              🔊
            </button>
          </div>
          <p><strong>Instead of: </strong>{{ swap().habit }}</p>
          <p><strong>Say: </strong>{{ swap().natural.join(' / ') }}</p>
          <p class="text-xs opacity-75">{{ swap().why }}</p>
          <p class="text-xs"><strong>Example: </strong>{{ swap().example }}</p>
        </div>

        <div class="rounded-box bg-base-200 border border-base-300 p-3 flex flex-col gap-2 text-sm">
          <span class="badge badge-primary badge-soft font-semibold">60-Second Clarity Drill</span>
          <strong>{{ drill().title }}</strong>
          <p class="text-xs opacity-75">{{ drill().cue }}</p>
          <div class="flex flex-wrap gap-1.5">
            @for (pair of drill().pairs; track pair) {
              <button
                type="button"
                class="btn btn-outline btn-sm h-auto min-h-9 py-1.5 whitespace-normal text-left"
                (click)="speakText.emit({ text: pair.replace('—', ', '), rateOffset: -0.1 })"
              >
                🔊 {{ pair }}
              </button>
            }
          </div>
        </div>

        <div class="flex justify-end">
          <button
            type="button"
            class="btn"
            [class.btn-success]="done()"
            [class.btn-outline]="!done()"
            data-testid="done-shadow"
            (click)="toggleDone()"
          >
            {{ done() ? 'Step 2 done ✓' : 'Mark Step 2 done' }}
          </button>
        </div>
      </div>
    </details>
  `,
})
export class ShadowStepComponent {
  private readonly store = inject(FluencyStoreService);

  readonly date = input.required<string>();
  readonly day = input.required<DayLog>();
  readonly lesson = input.required<Lesson>();
  readonly open = input(false);

  readonly stepToggled = output<boolean>();
  readonly speakText = output<{ text: string; rateOffset: number }>();

  readonly done = computed(() => this.day().steps?.shadow === true);
  readonly swap = computed(() => swapById(this.lesson().swapId));
  readonly drill = computed(() => drillById(this.lesson().drillId));

  readonly phraseCards = computed<Array<{ kind: PhraseKind; label: string; data: PhraseItem }>>(() => [
    { kind: 'pro', label: 'Work Upgrade', data: this.lesson().pro },
    { kind: 'casual', label: 'Casual Everyday', data: this.lesson().casual },
  ]);

  onToggle(event: Event): void {
    this.stepToggled.emit((event.target as HTMLDetailsElement).open);
  }

  repCount(kind: PhraseKind, idx: number): number {
    return this.day().reps?.[`${kind}-${idx}`] || 0;
  }

  bumpRep(kind: PhraseKind, idx: number): void {
    const key = `${kind}-${idx}`;
    this.store.mutateDay(this.date(), prev => {
      const next = ((prev.reps?.[key] || 0) + 1) % 6;
      return { ...prev, reps: { ...(prev.reps || {}), [key]: next } };
    });
  }

  playSentence(text: string, tag: string): void {
    const rateOffset = tag === 'Slow' ? -0.18 : tag === 'Fast' ? 0.14 : 0;
    this.speakText.emit({ text, rateOffset });
  }

  toggleDone(): void {
    const next = !this.done();
    this.store.mutateDay(this.date(), prev => ({
      ...prev,
      steps: { ...(prev.steps || {}), shadow: next },
    }));
  }
}
