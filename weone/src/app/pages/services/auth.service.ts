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
    private async callAuthFunction(name: string, args: any): Promise<any> {
        
       return (this.client as any).action(name, args);
    }

public async login(email: string, password: string): Promise<AuthResult> {
        try {
            // 1. Call the backend mutation to verify credentials
            // The result now contains { userId: Id<"users">, authId: string }
            const result = await this.callAuthFunction('auth:login', {
                email,
                password
            });

            if (result && result.authId) {
                const token = result.authId;
                localStorage.setItem('CONVEX_AUTH_TOKEN', result.authId); 
                (this.client as any).setAuth(async () => token);
                
                userSignal.set({ firstName: result.firstName || 'Manager', email }); 
                isSignedInSignal.set(true);
                return { success: true };
            }
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
       return localStorage.getItem('CONVEX_AUTH_TOKEN');
    }
}
