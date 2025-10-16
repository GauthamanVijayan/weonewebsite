import {
    Component,
    ChangeDetectionStrategy,
    signal,
    inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ClerkSignInComponent } from 'ngx-clerk';
import { AfterViewInit } from '@angular/core';

@Component({
    selector: 'app-approval',
    standalone: true,
    // We only import CommonModule and ClerkSignInComponent,
    // removing the need for FormsModule, InputTextModule, and ButtonModule here.
    imports: [CommonModule, ClerkSignInComponent],
    templateUrl: './signin-component.html',
    styleUrl: './signin-component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SigninComponent implements AfterViewInit {
    private router = inject(Router); // We don't need these since Clerk handles the form, but keep them for template compatibility

    email = signal('');
    loading = signal(false);
    message = signal('');

    ngAfterViewInit(): void {
        // 🎯 FIX: Render the Vanilla Clerk Sign-In component into a container div
        this.renderClerkSignIn();
    }

    private renderClerkSignIn(): void {
        // This function checks for the global Clerk object and mounts the Sign-In UI
        const container = document.getElementById('clerk-sign-in-container');
        const clerk = (window as any).Clerk;

        if (container && clerk && clerk.mountSignIn) {
            clerk.mountSignIn({
                mountElement: container,
                // Redirect the user to the root after successful sign-in
                afterSignInUrl: '/',
                afterSignUpUrl: '/' // Keep this for completeness, even if not used
            });
        } else {
            console.warn('Clerk object not found or mount container missing.');
        }
    }

    // NOTE: The original logic in the template must be removed/disabled.
}
