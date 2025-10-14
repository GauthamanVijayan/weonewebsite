// in weone/src/app/app.config.ts

import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

import { routes } from '@/apps.routes';
import { environment } from '../src/environments/environment';

import { ConvexClient } from 'convex/browser'; // 1. Import the actual ConvexClient

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(routes),
        provideAnimations(),
        provideHttpClient(),

        // 🎯 FINAL FIX: Factory Provider with type assertion.
        // This is the cleanest way to bypass the TS2554 error in a monorepo setup.
     {
            provide: ConvexClient,
            useValue: new ConvexClient(environment.CONVEX_URL),
        },
        
        // This line ensures ConvexClient is recognized as a Provider token, 
        // even if the compiler is confused about its constructor type.
        
        providePrimeNG({
            theme: {
                preset: Aura,
                options: {
                    prefix: 'p',
                    darkModeSelector: '.app-dark',
                    cssLayer: false
                }
            }
        })
    ]
};