import { Injectable, inject, signal } from '@angular/core';
import { ConvexClient } from 'convex/browser';
import { Observable, firstValueFrom, first } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

interface AuthResult {
    success: boolean;
    message?: string;
    userId?: string;
}

interface UserProfile {
    firstName: string;
    email: string;
}

const userSignal = signal<UserProfile | null>(null);
const isSignedInSignal = signal(false);

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private client: any = inject(ConvexClient);
    private router = inject(Router);

    public user$ = toObservable(userSignal.asReadonly());
    public isSignedIn$: Observable<boolean> = toObservable(
        isSignedInSignal.asReadonly()
    );

    private async callAuthFunction(name: string, args: any): Promise<any> {
        return (this.client as any).action(name, args);
    }

    constructor() {
        this.initializeAuth();
    }

    private async initializeAuth() {
        const token = localStorage.getItem('CONVEX_AUTH_TOKEN');
        console.log(token + 'convextoken');
        if (token) {
            // ✅ CRITICAL: Set auth callback that returns the token
(this.client as any).setAuth(async () => token);
            // Optionally restore user state from localStorage
            const userDataStr = localStorage.getItem('USER_DATA');
            if (userDataStr) {
                try {
                    const userData = JSON.parse(userDataStr);
                    userSignal.set(userData);
                    isSignedInSignal.set(true);
                } catch (e) {
                    console.error('Failed to parse user data:', e);
                }
            }
        }
    }

    public async login(email: string, password: string): Promise<AuthResult> {
        try {
            const result = await this.callAuthFunction('auth:login', {
                email,
                password
            });

            if (result && result.authId) {
                const token = result.authId;

                // Store both token AND userId
                localStorage.setItem('CONVEX_AUTH_TOKEN', token);
                localStorage.setItem('CONVEX_USER_ID', result.userId); // ✅ Store user ID

                // Set auth on client
                this.client.setAuth(async () => token);

                // Store full user data
                const userData = {
                    firstName: result.firstName || 'Manager',
                    email: result.email || email,
                    userId: result.userId // ✅ Include userId
                };
                localStorage.setItem('USER_DATA', JSON.stringify(userData));

                userSignal.set(userData);
                isSignedInSignal.set(true);

                await new Promise((resolve) => setTimeout(resolve, 100));

                return { success: true, userId: result.userId };
            }

            return { success: false, message: 'Invalid credentials.' };
        } catch (error: any) {
            console.error('Login error:', error);
            return {
                success: false,
                message: error.message || 'Login failed.'
            };
        }
    }

    public signOut(): void {
        // 1. Clear localStorage
        localStorage.removeItem('CONVEX_AUTH_TOKEN');
        localStorage.removeItem('USER_DATA');

        // 2. Clear Convex auth

        // 3. Reset signals
        userSignal.set(null);
        isSignedInSignal.set(false);

        // 4. Navigate to login
        this.router.navigate(['/signin']);
    }

    public async getConvexToken(): Promise<string | null> {
        return localStorage.getItem('CONVEX_AUTH_TOKEN');
    }

    public getUserId(): string | null {
    return localStorage.getItem('CONVEX_USER_ID');
}
}
