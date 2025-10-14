import {
    Component,
    ChangeDetectionStrategy,
    signal,
    computed,
    effect,
    ElementRef,
    viewChildren,
    inject,
    OnInit,
    QueryList,
    ViewChildren,
    PLATFORM_ID
} from '@angular/core';
import { CommonModule, CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

// --- Import all the required PrimeNG Modules ---
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { Select } from 'primeng/select';
import{CartItem,District,LocalBody,SponsorType,Ward, Zone,}from'../interfaces/sponsor.interface'
import { ScrollAnimateDirective } from '../shared/scroll-animate.directive';
import { ConvexService } from '../services/sponsor.service';
@Component({
    selector: 'app-sponsor-ward',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CurrencyPipe,
        TableModule,
        ButtonModule,
        Select,
        DialogModule,
        InputNumberModule,
        InputTextModule,
        SelectButtonModule,
        ScrollAnimateDirective  
    ],
    templateUrl: './sponsor-ward.component.html',
    styleUrl: './sponsor-ward.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SponsorWardComponent {
  // Inject Convex Service
  convex = inject(ConvexService);

  // ==========================================
  // SIGNALS - Selection State
  // ==========================================
  selectedZone = signal<Zone | null>(null);
  selectedDistrict = signal<District | null>(null);
 selectedSubdistrict = signal<LocalBody | null>(null); // NEW

 selectedLocalBodyType = signal<'All' | 'P' | 'M' | 'C'>('All');
  localBodyTypeOptions = signal([
    { label: 'All Types', value: 'All' },
    { label: 'Panchayat', value: 'P' },
    { label: 'Municipality', value: 'M' },
    { label: 'Corporation', value: 'C' }
  ]);
  // ==========================================
  // COMPUTED - Data from Service
  // ==========================================
  zones = this.convex.zones;
  zonesLoading = this.convex.zonesLoading;

  districts = this.convex.districts;
  subDistricts = this.convex.subdistricts; 
  districtsLoading = this.convex.districtsLoading;
  subdistrictsLoading = this.convex.subdistrictsLoading;
  // localBodies = this.convex.localBodies;
  // localBodiesLoading = this.convex.localBodiesLoading;

  wards = this.convex.wards;
  wardsLoading = this.convex.wardsLoading;
   searchText = signal('');

  // ==========================================
  // SIGNALS - Sponsor Form
  // ==========================================
  sponsorType = signal<'individual' | 'company'>('individual');
  sponsorName = signal('');
  sponsorEmail = signal('');

  filteredWards = computed(() => {
    const allWards = this.wards();
    const typeFilter = this.selectedLocalBodyType();
    const search = this.searchText().toLowerCase();
     console.log('=== FILTER DEBUG ===');
  console.log('Type filter selected:', typeFilter, 'Type:', typeof typeFilter);
  console.log('Sample ward localBodyType:', allWards[0]?.localBodyType, 'Type:', typeof allWards[0]?.localBodyType);
  console.log('All unique types in wards:', [...new Set(allWards.map(w => w.localBodyType))]);
  console.log('==================');

    let wardsToDisplay = allWards;

    // 1. Apply Local Body Type Filter
 if (typeFilter !== 'All') {
      
      wardsToDisplay = wardsToDisplay.filter(ward => 
        ward.localBodyType.trim().charAt(0).toUpperCase() === typeFilter
      );
    }

    // 2. Apply Search Filter
    if (search) {
      wardsToDisplay = wardsToDisplay.filter(ward => 
        ward.wardName.toLowerCase().includes(search) || 
        ward.localBodyName.toLowerCase().includes(search)
      );
    }

    return wardsToDisplay;
  });
  constructor() {
    // 2. CREATE AN EFFECT TO WATCH ALL FILTERS
    effect(() => {
      const subdistrict = this.selectedSubdistrict();
      const localBodyType = this.selectedLocalBodyType();
      const searchText = this.searchText();

      if (subdistrict) {
        this.convex.loadWards({ 
          subdistrict: subdistrict.name, 
          localBodyType: localBodyType, 
          searchText: searchText 
        });
      }
    });
  }
  sponsorTypeOptions = signal<SponsorType[]>([
    { label: 'Individual', value: 'individual' },
    { label: 'Company', value: 'company' }
  ]);

  // ==========================================
  // SIGNALS - Cart & Dialog
  // ==========================================
  cartItems = signal<CartItem[]>([]);
  isVolunteerDialogVisible = signal(false);
  selectedWardForSponsorship = signal<Ward | null>(null);
  sponsoredExecutivesCount = signal(1);

  // ==========================================
  // COMPUTED - Max Executives
  // ==========================================
  maxExecutives = computed(() => {
    const ward = this.selectedWardForSponsorship();
    if (!ward) return 1;

    switch (ward.localBodyType) {
      case 'C': return 5;
      case 'M': return 3;
      case 'P': return 1;
      default: return 1;
    }
  });

  // Helper to get max executives for any ward
  getMaxExecutives(localBodyType: 'P' | 'M' | 'C'): number {
    switch (localBodyType) {
      case 'C': return 5;
      case 'M': return 3;
      case 'P': return 1;
      default: return 1;
    }
  }

   onLocalBodyTypeChange() {
    // This function is just here to trigger the computed signal to re-evaluate.
    // The filtering logic is handled automatically by the `filteredWards` computed signal.
  }
  // ==========================================
  // COMPUTED - Cart Calculations
  // ==========================================
  subtotal = computed(() => {
    return this.cartItems().reduce((sum, item) => {
      return sum + item.costPerMonth;
    }, 0);
  });

  gst = computed(() => {
    return Math.round(this.subtotal() * 0.18);
  });

  total = computed(() => {
    return this.subtotal() + this.gst();
  });

  walletBonus = computed(() => {
    return this.total() * 3;
  });

  isFormValid = computed(() => {
    return this.sponsorName().trim() !== '' &&
      this.sponsorEmail().trim() !== '' &&
      this.cartItems().length > 0;
  });

  // ==========================================
  // SELECTION HANDLERS
  // ==========================================
onZoneChange(event: { value: Zone | null }) {
    this.selectedDistrict.set(null);
    this.selectedSubdistrict.set(null);
    this.convex.clearDistricts();
    if (event.value) {
      this.convex.loadDistrictsByZone(event.value.name);
    }
  }

  onDistrictChange(event: { value: District | null }) {
    this.selectedSubdistrict.set(null);
    this.convex.clearSubdistricts();
    if (event.value) {
      this.convex.loadSubdistrictsByDistrict(event.value.name);
    }
  }

  onSubdistrictChange(event: { value: LocalBody | null }) {
    this.convex.clearWards();
  }

  // ==========================================
  // DIALOG HANDLERS
  // ==========================================
  openVolunteerDialog(ward: Ward) {
    this.selectedWardForSponsorship.set(ward);
    this.sponsoredExecutivesCount.set(1);
    this.isVolunteerDialogVisible.set(true);
  }

  addToCart() {
    const ward = this.selectedWardForSponsorship();
    const count = this.sponsoredExecutivesCount();

    if (!ward || count < 1) return;

    const monthlyRate = 15000;
    const costPerMonth = count * monthlyRate;

    const existingIndex = this.cartItems().findIndex(item => item.ward._id === ward._id);

    if (existingIndex >= 0) {
      // Update existing item
      this.cartItems.update(items => {
        const newItems = [...items];
        newItems[existingIndex] = {
          ward,
          executivesSponsored: count,
          monthlyRate,
          costPerMonth
        };
        return newItems;
      });
    } else {
      // Add new item
      this.cartItems.update(items => [
        ...items,
        {
          ward,
          executivesSponsored: count,
          monthlyRate,
          costPerMonth
        }
      ]);
    }

    this.isVolunteerDialogVisible.set(false);
  }

  removeFromCart(wardId: string) {
    this.cartItems.update(items => items.filter(item => item.ward._id !== wardId));
  }

  // ==========================================
  // PAYMENT HANDLER
  // ==========================================
  proceedToPayment() {
    if (!this.isFormValid()) {
      alert('Please fill in all required fields');
      return;
    }

    const paymentData = {
      sponsor: {
        type: this.sponsorType(),
        name: this.sponsorName(),
        email: this.sponsorEmail()
      },
      items: this.cartItems().map(item => ({
        wardId: item.ward._id,
        wardName: item.ward.wardName,
        localBody: item.ward.localBodyName,
        localBodyType: item.ward.localBodyType,
        district: item.ward.districtName,
        zone: item.ward.zoneName,
        executivesSponsored: item.executivesSponsored,
        costPerMonth: item.costPerMonth
      })),
      summary: {
        subtotal: this.subtotal(),
        gst: this.gst(),
        total: this.total(),
        walletBonus: this.walletBonus()
      }
    };

    console.log('Processing payment:', paymentData);
    alert(`Payment processing...\nTotal: ₹${this.total().toLocaleString()}\nWallet Bonus: ₹${this.walletBonus().toLocaleString()}`);
  }

  // ==========================================
  // UTILITY
  // ==========================================
  getLocalBodyTypeLabel(type: 'P' | 'M' | 'C'): string {
    switch (type) {
      case 'P': return 'Panchayat';
      case 'M': return 'Municipality';
      case 'C': return 'Corporation';
      default: return '';
    }
  }
}