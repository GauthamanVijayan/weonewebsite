import { Injectable, inject, signal } from '@angular/core';
import { ConvexClient } from 'convex/browser';
import { Observable, firstValueFrom, first } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop'; // 🎯 NEW: Import the Observable interop helper
interface AuthResult {
    success: boolean;
    message?: string;
    userId?: string;
}
interface UserProfile {
    firstName: string;
    email: string;
}

const userSignal = signal<UserProfile | null>({
    firstName: 'Admin',
    email: 'admin@weone.com'
}); // 🎯 FIX 1: Provide a full initial value for safety
const isSignedInSignal = signal(false);

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    // --- Injections ---
    private client: any = inject(ConvexClient); // Assuming ConvexClient is injected

public user$ = toObservable(userSignal.asReadonly()); // 🎯 FIX 1: Convert Signal to Observable
public isSignedIn$: Observable<boolean> = toObservable(isSignedInSignal.asReadonly()); // 🎯 FIX 1: Convert Signal to Observable    // Utility wrapper (from ConvexService logic, adapted here)
    private async callAuthMutation(name: string, args: any): Promise<any> {
        // In a custom system, you'd retrieve a simple session token/cookie here.
        // For simplicity, we just call the mutation directly (no header needed for login).
        return this.client.mutation(name, args);
    }

    // 🎯 The core logic needed by LoginComponent
    public async login(email: string, password: string): Promise<AuthResult> {
        try {
            // Call the backend mutation to verify credentials
            const result = await this.callAuthMutation('auth:login', {
                email,
                password
            });

            // if (result && result.userId) {
            //     // On success, set local state and return success
            //     userSignal.set({ firstName: 'Manager' }); // Set mock user data
            //     isSignedInSignal.set(true);
            //     return { success: true };
            // }
            return { success: false, message: 'Invalid credentials.' };
        } catch (error: any) {
            return {
                success: false,
                message: error.message || 'Login failed.'
            };
        }
    }

    // Rest of the methods can be simplified/removed since Clerk is gone
    public signOut(): void {
        userSignal.set(null);
        isSignedInSignal.set(false);
    }

    public async getConvexToken(): Promise<string | null> {
        // Since we are not using Clerk/JWT, the "token" is the user's logged-in status.
        // We will return a simple string ID when signed in, and null otherwise.
        // In a real application, this should retrieve a secure session cookie or token.
        // For this management portal, we'll return a fixed value if signed in.
        const isSignedIn = await firstValueFrom(this.isSignedIn$.pipe(first()));
        return (await isSignedIn) ? 'user-session-id' : null;
    }
}
