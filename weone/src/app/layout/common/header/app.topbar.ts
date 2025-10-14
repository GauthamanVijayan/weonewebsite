import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LayoutService } from '@/layout/service/layout.service';

@Component({
    selector: '[app-topbar]',
    standalone: true,
    imports: [RouterModule, CommonModule],
    // --- We've changed 'template' to 'templateUrl' and added 'styleUrl' ---
    templateUrl: './app.topbar.component.html',
    styleUrl: './app.topbar.component.scss'
})
export class AppTopbar {
    @ViewChild('menubutton') menuButton!: ElementRef;
    @ViewChild('topbarmenu') menu!: ElementRef;
    
    constructor(public layoutService: LayoutService) {}

    onMenuButtonClick() {
        this.layoutService.onMenuToggle();
    }

    closeMobileMenu() {
        // Only close on mobile
        if (this.layoutService.isMobile()) {
            this.layoutService.onMenuToggle();
        }
    }
}