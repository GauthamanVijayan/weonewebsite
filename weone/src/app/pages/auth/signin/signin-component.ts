import { AuthService } from "@/pages/services/auth.service";
import { CommonModule } from "@angular/common";
import { Component, ChangeDetectionStrategy, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";

@Component({
    selector: 'app-approval',
    standalone: true,
    // We only import CommonModule and ClerkSignInComponent,
    // removing the need for FormsModule, InputTextModule, and ButtonModule here.
    imports: [CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    ],
    templateUrl: './signin-component.html',
    styleUrl: './signin-component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  // --- Injections ---
  private authService = inject(AuthService);
  private router = inject(Router);

  // --- State Signals ---
  email = signal('');
  password = signal('');
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  /**
   * Handles the login form submission.
   */
  async onLogin(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      // Call the login method from your AuthService
      const result = await this.authService.login(this.email(), this.password());
      
      if (result.success) {
        // On successful login, navigate to the user's profile page
        this.router.navigate(['/userProfile']);
      } else {
        this.errorMessage.set(result.message || 'An unknown error occurred.');
      }
    } catch (error: any) {
      // Handle unexpected errors
      console.error('Login failed:', error);
      this.errorMessage.set(error.message || 'Failed to connect to the server.');
    } finally {
      this.isLoading.set(false);
    }
  }
}