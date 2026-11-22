import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, type SafeUrl } from '@angular/platform-browser';
import { TimerService } from '../../kit/timer.service';
import { ToastService } from '../../kit/toast.service';
import { analyzeTranscript } from '../../core/logic/analyzer';
import type { DayLog } from '../../core/models';
import { FluencyStoreService } from '../../core/services/fluency-store.service';
import { SpeechService } from '../../core/services/speech.service';

const stamp = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

@Component({
  selector: 'ef-speak-record-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <div class="rounded-box bg-base-200 border border-base-300 p-3 flex flex-col gap-2 text-sm">
        <div class="flex items-center justify-between gap-2">
          <strong>{{ title() }}</strong>
          <span class="badge badge-primary badge-soft text-xs font-semibold">{{ framework() }}</span>
        </div>
        <p>{{ prompt() }}</p>
        <ul class="list-disc pl-5 space-y-1 text-sm">
          @for (b of bullets(); track b) {
            <li>{{ b }}</li>
          }
        </ul>
      </div>

      @if (isReviewMode()) {
        <div class="flex flex-wrap gap-1.5">
          <span
            class="badge badge-soft font-semibold"
            [class.badge-success]="reviewUsedCount() >= 3"
            [class.badge-primary]="reviewUsedCount() < 3"
          >
            {{ reviewUsedCount() }} of {{ targets().length }} week phrases spotted in story
          </span>
          @for (hit of usedReviewHits(); track hit.phrase) {
            <span class="badge badge-success badge-soft font-semibold">✓ {{ hit.phrase }}</span>
          }
        </div>
      } @else {
        <div class="flex flex-wrap gap-1.5">
          @for (hit of analysis().targetHits; track hit.phrase) {
            <span
              class="badge badge-soft font-semibold"
              [class.badge-success]="hit.used"
              [class.badge-primary]="!hit.used"
              [attr.data-target-chip]="hit.phrase"
            >
              {{ hit.used ? '✓ Used: ' + hit.phrase : 'Try: ' + hit.phrase }}
            </span>
          }
        </div>
      }

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-soft btn-primary btn-sm min-h-10"
          data-testid="start-speaking-timer"
          (click)="startTimer()"
        >
          ⏱ Start {{ formattedTimerLabel() }} timer
        </button>

        <button
          type="button"
          class="btn btn-sm min-h-10 btn-error"
          [class.text-error-content]="isRecordingHere()"
          [class.btn-outline]="!isRecordingHere()"
          data-testid="record-btn"
          (click)="toggleRecord()"
        >
          @if (isRecordingHere()) {
            <span class="rec-dot"></span>
            <span> Stop recording</span>
          } @else {
            <span>🎙 Record voice</span>
          }
        </button>

        @if (canDictate) {
          <button
            type="button"
            class="btn btn-sm min-h-10"
            [class.btn-primary]="isDictatingHere()"
            [class.btn-soft]="isDictatingHere()"
            [class.border-primary]="isDictatingHere()"
            [class.font-semibold]="isDictatingHere()"
            [class.btn-outline]="!isDictatingHere()"
            [attr.aria-pressed]="isDictatingHere() ? 'true' : 'false'"
            (click)="toggleDictation()"
          >
            {{ isDictatingHere() ? '⏹ Stop captions' : '💬 Live captions' }}
          </button>
        }
      </div>

      @if (safeAudioUrl(); as url) {
        <div class="flex flex-col gap-2">
          <audio controls class="w-full h-11" [src]="url"></audio>
          <div class="flex justify-end">
            <button type="button" class="btn btn-outline btn-sm" (click)="deleteAudio()">
              Delete audio
            </button>
          </div>
        </div>
      } @else if (day().hasRecording) {
        <p class="text-xs opacity-70">Loading saved voice recording...</p>
      }

      <label class="flex flex-col gap-1">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm opacity-75">Spoken transcript / notes (for Habit Check)</span>
          <span class="text-xs opacity-70" data-testid="transcript-status">{{ transcriptStatus() }}</span>
        </div>
        <textarea
          class="textarea textarea-bordered w-full min-h-28 bg-base-100 leading-relaxed"
          placeholder="Speak with live captions, paste voice-to-text from your phone, or jot key spoken sentences here for an offline habit check..."
          aria-label="Spoken transcript or key points"
          [value]="day().transcript || ''"
          (input)="onTranscriptInput($event)"
          (blur)="flushSave()"
        ></textarea>
      </label>

      @if (!canDictate) {
        <p class="text-xs opacity-70">
          Tip: Use your phone/OS keyboard mic button or paste a voice memo transcript above for instant offline analysis.
        </p>
      }
    </div>
  `,
})
export class SpeakRecordSectionComponent {
  private readonly store = inject(FluencyStoreService);
  private readonly speech = inject(SpeechService);
  private readonly timer = inject(TimerService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly date = input.required<string>();
  readonly day = input.required<DayLog>();
  readonly framework = input.required<string>();
  readonly title = input.required<string>();
  readonly prompt = input.required<string>();
  readonly bullets = input.required<string[]>();
  readonly targets = input.required<string[]>();
  readonly timerOverrideSec = input<number | null>(null);
  readonly isReviewMode = input(false);

  readonly canDictate = this.speech.canDictate();
  readonly recordingDate = signal<string | null>(null);
  readonly dictatingDate = signal<string | null>(null);
  readonly justEdited = signal(false);

  private dictationPrefix = '';

  constructor() {
    effect(() => {
      const d = this.day();
      const date = this.date();
      this.justEdited.set(false);
      if (d.hasRecording && !this.store.recUrls()[date]) {
        void this.store.ensureRecordingLoaded(date, d);
      }
    });
  }

  readonly effectiveSec = computed(() =>
    this.timerOverrideSec() || this.store.settings().challengeSec || 120,
  );
  readonly formattedTimerLabel = computed(() => stamp(this.effectiveSec()));

  readonly analysis = computed(() =>
    analyzeTranscript(this.day().transcript || '', {
      durationSec: this.day().durationSec || 0,
      targets: this.targets(),
    }),
  );

  readonly usedReviewHits = computed(() =>
    this.analysis().targetHits.filter(t => t.used),
  );
  readonly reviewUsedCount = computed(() => this.usedReviewHits().length);

  readonly isRecordingHere = computed(() => this.recordingDate() === this.date());
  readonly isDictatingHere = computed(() => this.dictatingDate() === this.date());

  readonly transcriptStatus = computed(() =>
    this.justEdited() || Boolean(this.day().transcript) ? 'Saved' : '',
  );

  readonly safeAudioUrl = computed<SafeUrl | null>(() => {
    const raw = this.store.recUrls()[this.date()];
    return raw ? this.sanitizer.bypassSecurityTrustUrl(raw) : null;
  });

  startTimer(): void {
    const date = this.date();
    this.timer.start(this.effectiveSec(), {
      beep: this.store.settings().beep,
      label: this.title(),
      chimeHz: 784,
      onFinish: elapsed => {
        this.store.mutateDay(date, prev => ({
          ...prev,
          durationSec: Math.max(prev.durationSec || 0, elapsed),
        }));
        this.toast.show(`Logged ${elapsed}s of speaking.`);
      },
    });
  }

  async toggleRecord(): Promise<void> {
    const date = this.date();
    if (this.recordingDate() === date) {
      try {
        const out = await this.speech.stopRecording();
        this.recordingDate.set(null);
        if (out?.blob) {
          await this.store.saveRecording({
            date,
            blob: out.blob,
            mimeType: out.mimeType,
            durationSec: out.durationSec,
            createdAt: Date.now(),
          });
          this.store.mutateDay(date, prev => ({
            ...prev,
            hasRecording: true,
            durationSec: Math.max(prev.durationSec || 0, out.durationSec),
          }));
          this.toast.show(`Saved ${out.durationSec}s voice recording on device.`);
        }
      } catch {
        this.recordingDate.set(null);
        this.toast.show('Could not finish recording.');
      }
      return;
    }

    if (!this.speech.canRecord()) {
      this.toast.show('Microphone recording is unavailable in this browser.');
      return;
    }
    try {
      await this.speech.startRecording();
      this.recordingDate.set(date);
    } catch {
      this.toast.show('Microphone permission was denied or unavailable.');
    }
  }

  toggleDictation(): void {
    const date = this.date();
    if (this.dictatingDate() === date) {
      this.speech.stopDictation();
      this.dictatingDate.set(null);
      return;
    }
    try {
      const cur = (this.day().transcript || '').trim();
      this.dictationPrefix = cur;
      this.speech.startDictation({
        onResult: ({ finalText, interimText }) => {
          const combined = [this.dictationPrefix, finalText, interimText].filter(Boolean).join(' ');
          this.applyTranscript(combined, true);
        },
        onError: () => {
          this.dictatingDate.set(null);
          this.toast.show('Live speech captions stopped. You can type or paste text below.');
        },
        onEnd: () => {
          if (this.dictatingDate() === date) this.dictatingDate.set(null);
        },
      });
      this.dictatingDate.set(date);
    } catch {
      this.toast.show('Live captions could not start in this browser.');
    }
  }

  async deleteAudio(): Promise<void> {
    await this.store.removeRecording(this.date());
    this.toast.show('Audio recording removed.');
  }

  onTranscriptInput(event: Event): void {
    this.applyTranscript((event.target as HTMLTextAreaElement).value, true);
  }

  flushSave(): void {
    void this.store.saveDay(this.store.dayFor(this.date()));
  }

  private applyTranscript(val: string, debounce: boolean): void {
    const analysis = analyzeTranscript(val, {
      durationSec: this.day().durationSec || 0,
      targets: this.targets(),
    });
    this.justEdited.set(true);
    this.store.mutateDay(
      this.date(),
      prev => ({
        ...prev,
        transcript: val,
        flags: analysis.flags.map(f => f.id),
      }),
      { debounce },
    );
  }
}
