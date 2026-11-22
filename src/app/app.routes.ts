import type { Routes } from '@angular/router';
import { TodayPageComponent } from './features/today/today-page.component';

export const routes: Routes = [
  { path: '', component: TodayPageComponent, pathMatch: 'full' },
  {
    path: 'progress',
    loadComponent: () => import('./features/progress/progress-page.component').then(m => m.ProgressPageComponent),
  },
  {
    path: 'reference',
    loadComponent: () => import('./features/reference/reference-page.component').then(m => m.ReferencePageComponent),
  },
  {
    path: 'data',
    loadComponent: () => import('./features/data/data-page.component').then(m => m.DataPageComponent),
  },
  { path: '**', redirectTo: '' },
];
