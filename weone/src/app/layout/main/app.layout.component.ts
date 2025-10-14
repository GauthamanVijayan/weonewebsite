import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppFooter } from '../common/footer/app.footer.component';
import { AppTopbar } from '../common/header/app.topbar';

// Import our custom header and footer

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppTopbar,   
    AppFooter    
  ],
  templateUrl: './app.layout.component.html',
  styleUrl: './app.layout.component.scss'
})
export class AppLayoutComponent {
  // The class can be empty! All the logic was for the demo sidebars we removed.
}