
import { Routes } from '@angular/router';
import { AboutComponent } from './pages/about/about.component';
import { HomeComponent } from './pages/home/home.component';
import { InsightsComponent } from './pages/insights/insights.component';
import { InvoiceComponent } from './pages/invoice/invoice.component';
import { SponsorWardComponent } from './pages/sponsor-ward/sponsor-ward.component';
import { ThankYouComponent } from './pages/thank-you/thank-you.component';
import { AppLayoutComponent } from './layout/main/app.layout.component';
import { ProfileComponent } from './pages/auth/profile/user-profile.component';
import { SigninComponent } from './pages/auth/signin/signin-component';

export const routes: Routes = [
    {
        path: '',
        component: AppLayoutComponent,
        children: [
            { path: '', component: HomeComponent },
            { path: 'about', component: AboutComponent },
            { path: 'insights', component: InsightsComponent },
            { path: 'sponsor', component: SponsorWardComponent },
            { path: 'thank-you', component: ThankYouComponent }
        ]
    },
    // --- Standalone routes that DO NOT use the main layout ---
    {
        path: 'invoice/:id',
        component: InvoiceComponent
    },
    {
        path: 'signin', // The hidden page for the client
        component: SigninComponent
    },
   
    {
        path:'userProfile',
        component:ProfileComponent
    }
];