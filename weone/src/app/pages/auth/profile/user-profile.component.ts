import { AuthService } from '@/pages/services/auth.service';
import { SecureConvexService } from '@/pages/services/secure-convex.service';
import { ConvexService } from '@/pages/services/sponsor.service';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

interface UserProfile {
    firstName: string;
    email: string;
}
@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [
        CommonModule,
        DatePipe,
        CurrencyPipe,
        TableModule,
        ButtonModule,
    ],

    templateUrl: './profile.component.html',
    styleUrl: './profile.component.scss'
})

// 🎯 IMPLEMENT OnInit
export class ProfileComponent implements OnInit {
    // --- Injections ---
    public authService = inject(AuthService);
    private convex = inject(ConvexService);
    private secureConvex = inject(SecureConvexService);
    // 🎯 FIX 1: Convert user$ Observable from AuthService to a Signal
    public sponsorships = this.secureConvex.sponsorships;
    public sponsorshipsLoading = this.secureConvex.sponsorshipsLoading;
    public isCancelling = signal(false); // Keep local for button state
    public user: Signal<UserProfile | null> = toSignal(this.authService.user$, {
        // We use a safe, empty object as the initial value to prevent 'undefined' issues,
        // and the Signal type itself is now explicitly declared.
        initialValue: null
    }) as Signal<UserProfile | null>;
    ngOnInit(): void {
        this.secureConvex.loadMySponsorships(); // 🎯 Calls the secure load method
    }

    async onCancel(sponsorshipId: string) {
        if (confirm('Are you sure you want to cancel this sponsorship?')) {
            this.isCancelling.set(true);
            try {
                await this.secureConvex.cancelSponsorship(sponsorshipId); // 🎯 Calls the secure mutation
                this.secureConvex.loadMySponsorships();
            } catch (error) {
                // ... error handling ...
            } finally {
                this.isCancelling.set(false);
            }
        }
    }
}
