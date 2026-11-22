import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppShellComponent, type KitNavItem } from './kit/app-shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppShellComponent, RouterOutlet],
  template: `
    <kit-app-shell brand="English Fluency" [navItems]="navItems">
      <router-outlet />
    </kit-app-shell>
  `,
})
export class App {
  readonly navItems: KitNavItem[] = [
    { label: 'Today', path: '/', exact: true },
    { label: 'Progress', path: '/progress' },
    { label: 'Reference', path: '/reference' },
    { label: 'Data', path: '/data' },
  ];
}
