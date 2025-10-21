// weone/src/app/pages/services/secure-convex.service.ts

import { Injectable, inject } from '@angular/core';
import { ConvexClient } from 'convex/browser';
import { AuthService } from './auth.service';
import { signal } from '@angular/core';
import { api } from 'convex';

@Injectable({
  providedIn: 'root'
})
export class SecureConvexService {
    // Injections
    private client: any = inject(ConvexClient);
    private authService = inject(AuthService);

    // State for Profile Component
    public sponsorships = signal<any[]>([]);
    public sponsorshipsLoading = signal(false);

    private async getAuthToken(): Promise<string | null> {
return this.authService.getConvexToken();    }

    // 🎯 Wrapper for secure calls (mutations and queries)
    private async authenticatedCall(name: string, args: any): Promise<any> {
        const token = await this.getAuthToken(); 
    if (!token) {
        throw new Error("Client not authenticated.");
    }
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

    if (name.includes('get')) {
        return (this.client as any).query(name, args); // No manual headers
    } else {
        return (this.client as any).mutation(name, args); // No manual headers
    }
    }

    // ----------------------------------------------------
    // Public Methods for Profile Component
    // ----------------------------------------------------

    public async loadMySponsorships() {
        this.sponsorshipsLoading.set(true);
        try {
const data = await this.authenticatedCall("sponsorships:getAllSponsorshipsForAdmin", {});            this.sponsorships.set(data || []);
        } catch (error) {
            console.error("Failed to load secure sponsorships:", error);
            this.sponsorships.set([]);
        } finally {
            this.sponsorshipsLoading.set(false);
        }
    }

    public async cancelSponsorship(sponsorshipId: string): Promise<any> {
        return this.authenticatedCall("sponsorships:cancelSponsorship", { sponsorshipId });
    }
}