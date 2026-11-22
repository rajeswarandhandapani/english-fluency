import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ToastService } from '../../kit/toast.service';
import { DAILY_GOAL_OPTIONS } from '../../core/data/plan';
import { FluencyStoreService } from '../../core/services/fluency-store.service';

@Component({
  selector: 'ef-setup-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-bold tracking-tight">Start your 12 weeks</h1>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-3">
        <p class="text-sm">
          Build crisp American listening and confident storytelling in 20–30 minutes a day—for both US IT work and everyday life.
        </p>

        <label class="flex flex-col gap-1">
          <span class="text-sm opacity-75">Day 1 starts on</span>
          <input
            type="date"
            class="input input-bordered w-full"
            aria-label="Plan start date"
            [value]="startDate()"
            (change)="onDateChange($event)"
          />
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-sm opacity-75">Daily routine target</span>
          <select
            class="select select-bordered w-full"
            aria-label="Daily practice goal"
            [value]="dailyGoal()"
            (change)="onGoalChange($event)"
          >
            @for (m of goalOptions; track m) {
              <option [value]="m">{{ m }} minutes / day</option>
            }
          </select>
        </label>

        <p class="text-sm opacity-75">
          Practice transcripts, recordings, and logs stay privately on this device.
        </p>

        <button type="button" class="btn btn-primary" (click)="startPlan()">
          Start the plan
        </button>
      </div>
    </section>

    <section class="card bg-base-100 border border-base-300 shadow-xs">
      <div class="card-body p-4 gap-2 text-sm">
        <h2 class="text-base font-bold">Your 5-step daily loop (~25 min)</h2>
        <p class="opacity-75">1. Listen &amp; Decode (5m): Blind micro-dictation of fast American speech reductions.</p>
        <p class="opacity-75">2. Phrase Upgrade (6m): 1 US work idiom + 1 casual phrasal verb + clarity drill.</p>
        <p class="opacity-75">3. Story &amp; Role-Play (5m): Connected mini-stories and spoken dialogue.</p>
        <p class="opacity-75">4. Speak &amp; Record (7m): 2-minute BLUF/PREP story with local voice recording.</p>
        <p class="opacity-75">5. Habit Check (3m): Offline check for common Tamil-to-US habits + confidence.</p>
      </div>
    </section>
  `,
})
export class SetupViewComponent {
  private readonly store = inject(FluencyStoreService);
  private readonly toast = inject(ToastService);

  readonly goalOptions = DAILY_GOAL_OPTIONS;
  readonly startDate = signal(this.store.today());
  readonly dailyGoal = signal(this.store.settings().dailyGoal);

  onDateChange(event: Event): void {
    this.startDate.set((event.target as HTMLInputElement).value);
  }

  onGoalChange(event: Event): void {
    this.dailyGoal.set(Number((event.target as HTMLSelectElement).value));
  }

  async startPlan(): Promise<void> {
    const start = this.startDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      this.toast.show('Choose a start date first.');
      return;
    }
    await this.store.updateSettings({
      startDate: start,
      dailyGoal: this.dailyGoal(),
    });
    const today = this.store.today();
    this.store.selectedDate.set(start <= today ? today : start);
  }
}
