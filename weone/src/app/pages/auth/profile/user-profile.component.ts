import { AuthService } from '@/pages/services/auth.service';
import { SecureConvexService, SponsorshipFilters } from '@/pages/services/secure-convex.service';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal, Signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';

interface UserProfile {
    firstName: string;
    email: string;
}

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [
        CommonModule,
        DatePipe,
        CurrencyPipe,
        TableModule,
        ButtonModule,
        InputTextModule,
        Select,
        FormsModule,
        DialogModule
    ],
    templateUrl: './profile.component.html',
    styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
    public authService = inject(AuthService);
    public secureConvex = inject(SecureConvexService);
    
    public sponsorships = this.secureConvex.sponsorships;
    public sponsorshipsLoading = this.secureConvex.sponsorshipsLoading;
    public isCancelling = signal(false);
    
    public user: Signal<UserProfile | null> = toSignal(this.authService.user$, {
        initialValue: null
    }) as Signal<UserProfile | null>;

    // ✅ Filter signals
    public searchText = signal('');
    public selectedZone = signal<string | null>(null);
    public selectedDistrict = signal<string | null>(null);
    public selectedSubdistrict = signal<string | null>(null);
    public selectedLocalBody = signal<string | null>(null);
    public selectedStatus = signal<string>('active');
    public isDetailsDialogVisible = false;
public selectedSponsorship: any = null;


    // ✅ Get filter data from service (complete data from wards)
    public zones = computed(() => {
        return this.secureConvex.zones().map(z => ({ label: z.name, value: z.name }));
    });

    public districts = computed(() => {
        return this.secureConvex.districts().map(d => ({ label: d.name, value: d.name }));
    });

    public subdistricts = computed(() => {
        return this.secureConvex.subdistricts().map(sd => ({ label: sd.name, value: sd.name }));
    });

    public localBodies = computed(() => {
        return this.secureConvex.localBodies().map(lb => ({ label: lb.name, value: lb.name }));
    });

    public statusOptions = [
        { label: 'Active', value: 'active' },
        { label: 'Pending', value: 'pending' },
        { label: 'Expired', value: 'expired' },
        { label: 'All', value: '' }
    ];

    async ngOnInit() {
        // ✅ Load complete filter data first
        await this.secureConvex.loadFilterData();
        
        // ✅ Then load sponsorships
        this.loadWithFilters();
    }

    // ✅ Handle zone change
    public async onZoneChange() {
        this.selectedDistrict.set(null);
        this.selectedSubdistrict.set(null);
        this.selectedLocalBody.set(null);
        
        const zone = this.selectedZone();
        if (zone) {
            await this.secureConvex.loadDistrictsByZone(zone);
        } else {
            this.secureConvex.districts.set([]);
        }
        
        this.applyFilters();
    }

    // ✅ Handle district change
    public async onDistrictChange() {
        this.selectedSubdistrict.set(null);
        this.selectedLocalBody.set(null);
        
        const district = this.selectedDistrict();
        if (district) {
            await this.secureConvex.loadSubdistrictsByDistrict(district);
        } else {
            this.secureConvex.subdistricts.set([]);
        }
        
        this.applyFilters();
    }
public viewSponsorshipDetails(sponsorship: any) {
    this.selectedSponsorship = sponsorship;
    this.isDetailsDialogVisible = true;
}
    // ✅ Handle subdistrict change
    public async onSubdistrictChange() {
        this.selectedLocalBody.set(null);
        
        const subdistrict = this.selectedSubdistrict();
        if (subdistrict) {
            await this.secureConvex.loadLocalBodiesInSubdistrict(subdistrict);
        } else {
            this.secureConvex.localBodies.set([]);
        }
        
        this.applyFilters();
    }

    // ✅ Apply filters
    public applyFilters() {
        const filters: SponsorshipFilters = {
            searchText: this.searchText() || undefined,
            zone: this.selectedZone() || undefined,
            district: this.selectedDistrict() || undefined,
            subdistrict: this.selectedSubdistrict() || undefined,
            localBodyName: this.selectedLocalBody() || undefined,
            status: this.selectedStatus() || undefined,
        };
        
        this.secureConvex.loadMySponsorships(filters);
    }

    // ✅ Clear filters
    public clearFilters() {
        this.searchText.set('');
        this.selectedZone.set(null);
        this.selectedDistrict.set(null);
        this.selectedSubdistrict.set(null);
        this.selectedLocalBody.set(null);
        this.selectedStatus.set('active');
        
        // Reset cascading data
        this.secureConvex.districts.set([]);
        this.secureConvex.subdistricts.set([]);
        this.secureConvex.localBodies.set([]);
        
        this.loadWithFilters();
    }

    private loadWithFilters() {
        this.applyFilters();
    }

    async onCancel(sponsorshipId: string) {
        if (confirm('Are you sure you want to cancel this sponsorship?')) {
            this.isCancelling.set(true);
            try {
                await this.secureConvex.cancelSponsorship(sponsorshipId);
                this.applyFilters(); // Reload with current filters
            } catch (error) {
                console.error('Failed to cancel:', error);
            } finally {
                this.isCancelling.set(false);
            }
        }
    }
}