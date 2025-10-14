import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-approval',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule],
  templateUrl: './approval.component.html',
  styleUrl: './approval.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApprovalComponent {
  email = signal('');
  loading = signal(false);
  message = signal('');

  sendLink() {
    if (!this.email()) {
      this.message.set('Please enter an email address.');
      return;
    }
    this.loading.set(true);
    this.message.set('');

    // *** CONVEX LOGIC WILL GO HERE ***
    // This will call a Convex action to send the magic link
    console.log(`Sending magic link to: ${this.email()}`);

    setTimeout(() => {
        this.loading.set(false);
        this.message.set('If your email is registered, you will receive a login link shortly.');
    }, 1500);
  }
}