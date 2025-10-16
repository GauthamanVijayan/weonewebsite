
import { Injectable, inject } from '@angular/core';
import { ClerkService, UserResource } from 'ngx-clerk';
import { Observable, firstValueFrom, first } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface ClientSignInAPI {
    signIn: {
        create: (params: any) => Promise<any>;
        prepareEmailLinkFlow: (params: any) => Promise<any>;
        [key: string]: any; // Allows other methods/properties
    };
    [key: string]: any; // Allows other methods on the root object (like signOut)
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private clerkService = inject(ClerkService);

    // 🎯 clerkLoaded$: Observable that emits the raw Clerk instance when available.
    // Asserted with 'any' to bypass strict type definition conflicts (TS2339).
    public clerkLoaded$: Observable<any> = this.clerkService.clerk$.pipe(
        filter((clerk: any) => !!clerk && clerk.isLoaded),
        map((clerk: any) => clerk)
    );

    // 🎯 isSignedIn$: Public Observable for tracking authentication status.
    // Asserted with 'any' to avoid type errors on 'session.status'.
    public isSignedIn$: Observable<boolean> = this.clerkService.session$.pipe(
        map((session: any) => !!session && session.status === 'active')
    );

    // 🎯 user$: Public Observable for retrieving user profile data.
    public user$: Observable<UserResource | null | undefined> = this
        .clerkService.user$ as Observable<UserResource | null | undefined>;

    /**
     * Fetches the JWT token required by the Convex backend for authenticated calls.
     */
    public async getConvexToken(
        templateName: string = 'convex'
    ): Promise<string | null> {
        // Await the raw Clerk instance.
        const clerkInstance = await firstValueFrom(
            this.clerkLoaded$.pipe(first())
        );

        // Check if the instance and session are available.
        if (!clerkInstance || !clerkInstance.session) {
            return null;
        }

        // Call getToken() on the raw session object.
        const token = await clerkInstance.session.getToken({
            template: templateName
        });
        return token || null;
    }

    /**
     * Initiates the global sign-out process.
     */
    public async signOut(): Promise<void> {
        const clerkInstance = await firstValueFrom(
            this.clerkLoaded$.pipe(first())
        );
        if (clerkInstance) {
            await clerkInstance.signOut();
        }
    }

    /**
     * Opens the Clerk sign-in UI (used when the Auth Guard redirects).
     */
    public async signIn(): Promise<void> {
        const clerkInstance = await firstValueFrom(
            this.clerkLoaded$.pipe(first())
        );
        if (clerkInstance) {
            clerkInstance.openSignIn({});
        }
    }

    /**
     * Initiates the secure Email Link sign-in flow (custom implementation for styled form).
     */
    public async createMagicLinkSignIn(email: string): Promise<void> {
        const clerkInstance = await firstValueFrom(
            this.clerkLoaded$.pipe(first())
        );

        if (!clerkInstance) {
            throw new Error('Clerk client not loaded.');
        }

        // 🎯 Apply custom interface assertion to allow sign-in API calls.
        const ClerkClientAPI = ((window as any).Clerk ||
            clerkInstance) as ClientSignInAPI;

        // 1. Create the new sign-in object
        const signIn = await ClerkClientAPI.signIn.create({
            identifier: email,
            strategy: 'email_link',
            redirectUrl: '/'
        });

        // 2. Request the magic link email to be sent
        if (signIn?.status === 'needs_identifier' && signIn.identifierId) {
            await ClerkClientAPI.signIn.prepareEmailLinkFlow({
                emailAddressId: signIn.identifierId
            });
        } else if (signIn?.status === 'complete') {
            return;
        } else {
            console.error('Clerk Sign-in Status:', signIn?.status, signIn);
            throw new Error(
                'Could not initiate email link sign-in flow. Check if the user exists.'
            );
        }
    }
}
