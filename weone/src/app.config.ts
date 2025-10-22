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
import { MessageService } from 'primeng/api';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(routes),
        provideAnimations(),
        provideHttpClient(),
        MessageService,
  
     {
            provide: ConvexClient,
            useValue: new ConvexClient(environment.CONVEX_URL as any), // Added 'as any' for safety
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
        }),
        
    ]
};