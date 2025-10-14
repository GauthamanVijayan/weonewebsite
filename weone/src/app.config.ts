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

        // 2. Provide the ConvexClient directly
        {
            provide: ConvexClient,
            useValue: new ConvexClient(environment.CONVEX_URL),
        },

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

// 3. REMOVE the old, unimplemented function
// function provideConvex(convexUrl: string): ... { ... }