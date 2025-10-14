import { Component, ChangeDetectionStrategy, AfterViewInit, ViewChild, ElementRef, OnDestroy, effect, signal, viewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { ScrollAnimateDirective } from '../shared/scroll-animate.directive';


@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [CommonModule, ScrollAnimateDirective],
  templateUrl: './insights.component.html',
  styleUrl: './insights.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InsightsComponent {
}