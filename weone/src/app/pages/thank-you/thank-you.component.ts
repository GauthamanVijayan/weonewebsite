import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-thank-you',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule],
  templateUrl: './thank-you.component.html',
  styleUrl: './thank-you.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThankYouComponent { }