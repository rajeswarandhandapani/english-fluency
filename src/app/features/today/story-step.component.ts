import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { DayLog, Lesson } from '../../core/models';
import { FluencyStoreService } from '../../core/services/fluency-store.service';
import { SpeechService } from '../../core/services/speech.service';

interface StorySegment {
  text: string;
  isConn: boolean;
}

const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function splitConnectors(text: string, connectors: string[] = []): StorySegment[] {
  if (!connectors.length) return [{ text, isConn: false }];
  const re = new RegExp(`(${connectors.map(escRe).join('|')})`, 'gi');
  return text.split(re).filter(Boolean).map(part => ({
    text: part,
    isConn: connectors.some(c => c.toLowerCase() === part.toLowerCase()),
  }));
}

@Component({
  selector: 'ef-story-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details
      class="card bg-base-100 border border-base-300 shadow-xs step-card overflow-hidden"
      data-step="story"
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
            {{ done() ? '✓' : '3' }}
          </span>
          <span>
            <strong>Story Flow &amp; Dialogue</strong>
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
        @for (st of highlightedStories(); track st.title; let idx = $index) {
          <div class="rounded-box bg-base-200 border border-base-300 p-3 flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span
                  class="badge badge-soft text-xs font-semibold"
                  [class.badge-primary]="st.kind === 'Work'"
                  [class.badge-secondary]="st.kind !== 'Work'"
                >
                  {{ st.kind }}
                </span>
                <strong class="text-sm">{{ st.title }}</strong>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-outline min-w-9 px-2"
                [attr.aria-label]="'Listen to story ' + (idx + 1)"
                (click)="speakText.emit({ text: st.text, rateOffset: 0 })"
              >
                🔊
              </button>
            </div>

            <p class="text-sm leading-relaxed">
              @for (seg of st.segments; track $index) {
                @if (seg.isConn) {
                  <mark class="conn">{{ seg.text }}</mark>
                } @else {
                  <span>{{ seg.text }}</span>
                }
              }
            </p>

            <p class="text-xs opacity-70">Connectors highlighted: {{ st.connectors.join(', ') }}</p>
          </div>
        }

        <div class="rounded-box bg-base-200 border border-base-300 p-3 flex flex-col gap-2.5">
          <div class="flex items-center justify-between gap-2">
            <strong class="text-sm">Dialogue · {{ lesson().dialogue.kind }}</strong>
            <button
              type="button"
              class="btn btn-sm btn-soft btn-primary"
              (click)="toggleDialogue()"
            >
              {{ isPlayingHere() ? '⏹ Stop' : '▶ Play Dialogue' }}
            </button>
          </div>

          <p class="text-xs opacity-75">{{ lesson().dialogue.context }}</p>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-primary]="store.rolePlay()"
              [class.btn-soft]="store.rolePlay()"
              [class.border-primary]="store.rolePlay()"
              [class.font-semibold]="store.rolePlay()"
              [class.btn-outline]="!store.rolePlay()"
              data-testid="roleplay-toggle"
              [attr.aria-pressed]="store.rolePlay() ? 'true' : 'false'"
              (click)="toggleRolePlay()"
            >
              Role-Play Mode (You speak)
            </button>
          </div>

          @if (waitingTurn(); as turn) {
            <div class="rounded-lg bg-primary/10 p-3 flex items-center justify-between gap-2 flex-wrap">
              <strong class="text-xs">Your turn — speak your line aloud, then tap Next.</strong>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                (click)="turn.resume?.()"
              >
                Next line →
              </button>
            </div>
          }

          <div class="flex flex-col gap-2">
            @for (turn of lesson().dialogue.turns; track $index; let idx = $index) {
              <div
                class="rounded-box border border-base-300 p-2.5 text-sm"
                [class.bg-base-100]="turn.speaker === 'You'"
                [class.turn-you]="turn.speaker === 'You'"
                [class.bg-base-200]="turn.speaker !== 'You'"
                [class.turn-active]="activeTurnIndex() === idx"
              >
                <div
                  class="text-xs font-bold uppercase tracking-wide mb-0.5"
                  [class.text-primary]="turn.speaker === 'You'"
                  [class.opacity-70]="turn.speaker !== 'You'"
                >
                  {{ turn.speaker }}
                </div>
                <p>{{ turn.text }}</p>
              </div>
            }
          </div>
        </div>

        <div class="flex justify-end">
          <button
            type="button"
            class="btn"
            [class.btn-success]="done()"
            [class.btn-outline]="!done()"
            data-testid="done-story"
            (click)="toggleDone()"
          >
            {{ done() ? 'Step 3 done ✓' : 'Mark Step 3 done' }}
          </button>
        </div>
      </div>
    </details>
  `,
})
export class StoryStepComponent {
  readonly store = inject(FluencyStoreService);
  private readonly speech = inject(SpeechService);

  readonly date = input.required<string>();
  readonly day = input.required<DayLog>();
  readonly lesson = input.required<Lesson>();
  readonly open = input(false);

  readonly stepToggled = output<boolean>();
  readonly speakText = output<{ text: string; rateOffset: number }>();

  readonly done = computed(() => this.day().steps?.story === true);

  readonly highlightedStories = computed(() =>
    this.lesson().stories.map(st => ({
      ...st,
      segments: splitConnectors(st.text, st.connectors),
    })),
  );

  readonly isPlayingHere = computed(() => this.speech.activeTurn()?.date === this.date());

  readonly activeTurnIndex = computed(() => {
    const active = this.speech.activeTurn();
    return active?.date === this.date() ? active.index : -1;
  });

  readonly waitingTurn = computed(() => {
    const active = this.speech.activeTurn();
    return active?.date === this.date() && active.waitingForYou ? active : null;
  });

  onToggle(event: Event): void {
    this.stepToggled.emit((event.target as HTMLDetailsElement).open);
  }

  toggleRolePlay(): void {
    this.store.rolePlay.update(v => !v);
  }

  toggleDialogue(): void {
    if (this.isPlayingHere()) {
      this.speech.stopSpeaking();
      return;
    }
    const settings = this.store.settings();
    this.speech.playDialogue(this.date(), this.lesson().dialogue.turns, {
      voiceName: settings.voiceName,
      rate: settings.rate,
      rolePlay: this.store.rolePlay(),
    });
  }

  toggleDone(): void {
    const next = !this.done();
    this.store.mutateDay(this.date(), prev => ({
      ...prev,
      steps: { ...(prev.steps || {}), story: next },
    }));
  }
}
