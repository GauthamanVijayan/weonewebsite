import { Injectable, inject } from '@angular/core';
import { ClerkService, UserResource } from 'ngx-clerk';
import { Observable } from 'rxjs';
import { filter, map, first } from 'rxjs/operators';
import { Clerk } from '@clerk/types';
import { firstValueFrom } from 'rxjs';

interface ClientSignInAPI {
    signIn: {
        create: (params: any) => Promise<any>;
        prepareEmailLinkFlow: (params: any) => Promise<any>;
        [key: string]: any;
    };
    [key: string]: any;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private clerkService = inject(ClerkService);

    // Observable that provides the raw Clerk instance when fully loaded.
    // We use this for methods like getToken() and signOut().
    private clerkLoaded$: Observable<Clerk> = this.clerkService.clerk$.pipe(
        // Filters out null/undefined values until Clerk is initialized.
        filter((clerk) => !!clerk && clerk.loaded),
        map((clerk) => clerk as Clerk)
    );

    // Public Observable for component visibility/state management.
    public isSignedIn$: Observable<boolean> = this.clerkService.session$.pipe(
        map((session:any) => !!session && session.status === 'active')
    );

    // Public Observable for retrieving user profile data.
    public user$: Observable<UserResource | null | undefined> =
(this.clerkService.user$ as Observable<UserResource | null | undefined>);
    /**
     * Fetches the JWT token required by the Convex backend for authenticated calls.
     * * @param templateName The name of the JWT template configured in Clerk (default: 'convex').
     * @returns A promise resolving to the Bearer token string or null if unauthenticated.
     */
    public async getConvexToken(
        templateName: string = 'convex'
    ): Promise<string | null> {
        // Await the raw Clerk instance to ensure the token method is available.
        // Use firstValueFrom for a synchronous-like call on the Observable.
        const clerkInstance = await firstValueFrom(
            this.clerkLoaded$.pipe(first())
        );

        // Check if the instance and session are available before trying to get the token.
        if (!clerkInstance || !clerkInstance.session) {
            return null;
        }

        // Call getToken() on the raw session object, requesting the specific JWT template.
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

  public async createMagicLinkSignIn(email: string): Promise<void> {
    const clerkInstance = await firstValueFrom(
        this.clerkLoaded$.pipe(first())
    );

    if (!clerkInstance) {
        throw new Error('Clerk client not loaded.');
    }
    
    // 🎯 FIX: Assert the dynamic client instance to the custom interface.
    const ClerkClientAPI = ((window as any).Clerk || clerkInstance) as ClientSignInAPI;
    
    // 1. Create the new sign-in object
    // This line now passes compilation because ClerkClientAPI is asserted as having 'signIn'.
    const signIn = await ClerkClientAPI.signIn.create({
        identifier: email,
        strategy: 'email_link',
        redirectUrl: '/'
    });

    // 2. Request the magic link email to be sent
    if (signIn?.status === 'needs_identifier' && signIn.identifierId) 
    {
        await ClerkClientAPI.signIn.prepareEmailLinkFlow({
            emailAddressId: signIn.identifierId
        });
        
    } else if (signIn?.status === 'complete') {
        return; 
    } 
    else {
        console.error('Clerk Sign-in Status:', signIn?.status, signIn);
        throw new Error('Could not initiate email link sign-in flow. Check if the user exists.');
    }
}
}
