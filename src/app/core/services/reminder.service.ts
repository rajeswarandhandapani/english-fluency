// Checks due practice reminder on startup and every minute.

import { DestroyRef, Injectable, inject } from '@angular/core';
import { ToastService } from '../../kit/toast.service';
import { reminderDue, reminderFor } from '../logic/logic';
import { FluencyStoreService } from './fluency-store.service';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly store = inject(FluencyStoreService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.check();
    this.timer = setInterval(() => this.check(), 60000);
    this.destroyRef.onDestroy(() => {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    });
  }

  check(): void {
    const today = this.store.today();
    const settings = this.store.settings();
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    if (!reminderDue({
      reminder: settings.reminder,
      date: today,
      nowTime: `${hh}:${mm}`,
      day: this.store.days()[today],
      lastSent: this.store.lastReminder,
    })) return;

    this.store.lastReminder = today;
    const info = reminderFor(today, settings.startDate);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(info.title, { body: info.body });
      } catch {
        this.toast.show(info.title);
      }
    } else {
      this.toast.show(info.title);
    }
  }
}
