// in weone/src/app/pages/profile/profile.component.ts

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs'; // For reactive data handling
import { toSignal } from '@angular/core/rxjs-interop'; // 👈 ADD THIS IMPORT


// 🎯 USE YOUR SERVICES 🎯
import { ClerkUserButtonComponent } from 'ngx-clerk'; // Use the ngx-clerk component

// --- PrimeNG Imports ---
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AuthService } from '@/pages/services/auth.service';
import { ConvexService } from '@/pages/services/sponsor.service';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [
        CommonModule,
        DatePipe,
        CurrencyPipe,
        TableModule,
        ButtonModule,
        ClerkUserButtonComponent, // Correct component from ngx-clerk
        TagModule
    ],
    templateUrl: './profile.component.html',
    styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
    // --- Services ---
    private authService = inject(AuthService);
    private convexService = inject(ConvexService);

    // --- Component State (Signals) ---
    // Use signals for better reactivity and template binding
    public sponsorships = signal<any[]>([]); // Data signal
    public isLoadingSponsorships = signal(true);
    public isCancelling = signal(false);

    // 🎯 FIX: Expose Auth State as a Signal for the Template
    // We use toSignal to convert the AuthService observable into an Angular Signal.
    public user = toSignal(this.authService.user$, { initialValue: null });

    constructor() {
        // Automatically fetch data when the component initializes
        // We will call this in ngOnInit instead of the constructor.
    }

    ngOnInit(): void {
        // We defer the fetch until ngOnInit to ensure services are fully initialized.
        this.fetchSponsorships();
    }

    async fetchSponsorships() {
        // Ensure this only runs if the user is authenticated.
        const isAuthenticated = await firstValueFrom(
            this.authService.isSignedIn$
        );
        if (!isAuthenticated) {
            this.sponsorships.set([]);
            this.isLoadingSponsorships.set(false);
            return;
        }

        this.isLoadingSponsorships.set(true);
        try {
            // 🎯 CORRECT CALL: Use the service method
            const data = await this.convexService.getMySponsorships();
            this.sponsorships.set(data);
        } catch (error) {
            console.error('Failed to load sponsorships:', error);
            this.sponsorships.set([]);
        } finally {
            this.isLoadingSponsorships.set(false);
        }
    }

    async onCancel(sponsorshipId: string) {
        if (confirm('Are you sure you want to cancel this sponsorship?')) {
            this.isCancelling.set(true);
            try {
                await this.convexService.cancelSponsorship(sponsorshipId);

                // Refresh the data immediately after the mutation
                this.fetchSponsorships();
            } catch (error) {
                console.error('Failed to cancel sponsorship:', error);
                alert(
                    'There was an error canceling your sponsorship. Please try again.'
                );
            } finally {
                this.isCancelling.set(false);
            }
        }
    }
}
