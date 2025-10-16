import { CommonModule, CurrencyPipe } from '@angular/common';
import {
    Component,
    ChangeDetectionStrategy,
    inject,
    signal,
    computed,
    effect
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { DatePickerModule, DatePicker } from 'primeng/datepicker';import {
    Zone,
    District,
    LocalBody,
    SponsorType,
    CartItem,
    Ward
} from '../interfaces/sponsor.interface';
import { ConvexService } from '../services/sponsor.service';
import { ScrollAnimateDirective } from '../shared/scroll-animate.directive';
import { DialogModule } from 'primeng/dialog';

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
    ScrollAnimateDirective,
    DatePicker
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
    selectedWards = signal<Ward[]>([]);
    selectedLocalBodyType = signal<'All' | 'P' | 'M' | 'C'>('All');
    localBodyTypeOptions = signal([
        { label: 'All Types', value: 'All' },
        { label: 'Panchayat', value: 'P' },
        { label: 'Municipality', value: 'M' },
        { label: 'Corporation', value: 'C' }
    ]);

    isBulkSponsorDialogVisible = signal(false);
    bulkSponsoredExecutivesCount = signal(1);
    bulkSponsorshipStartDate = signal<Date | null>(null);
    bulkSponsorshipEndDate = signal<Date | null>(null);
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
    today = new Date();

    minEndDate = computed(() => {
    const startDate = this.sponsorshipStartDate();
    if (!startDate) return this.today;
    // Set minimum end date to be 1 month after the start date
    const minDate = new Date(startDate);
    minDate.setMonth(minDate.getMonth() + 1);
    return minDate;
  });
  bulkMinEndDate = computed(() => {
    const startDate = this.bulkSponsorshipStartDate();
    if (!startDate) return this.today;
    const minDate = new Date(startDate);
    minDate.setMonth(minDate.getMonth() + 1);
    return minDate;
  });

    filteredWards = computed(() => {
        const allWards = this.wards();
        const typeFilter = this.selectedLocalBodyType();
        const search = this.searchText().toLowerCase();
        console.log('=== FILTER DEBUG ===');
        console.log(
            'Type filter selected:',
            typeFilter,
            'Type:',
            typeof typeFilter
        );
        console.log(
            'Sample ward localBodyType:',
            allWards[0]?.localBodyType,
            'Type:',
            typeof allWards[0]?.localBodyType
        );
        console.log('All unique types in wards:', [
            ...new Set(allWards.map((w) => w.localBodyType))
        ]);
        console.log('==================');

        let wardsToDisplay = allWards;

        // 1. Apply Local Body Type Filter
        if (typeFilter !== 'All') {
            wardsToDisplay = wardsToDisplay.filter(
                (ward) =>
                    ward.localBodyType.trim().charAt(0).toUpperCase() ===
                    typeFilter
            );
        }

        // 2. Apply Search Filter
        if (search) {
            wardsToDisplay = wardsToDisplay.filter(
                (ward) =>
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
    sponsorshipStartDate = signal<Date | null>(null);
    sponsorshipEndDate = signal<Date | null>(null);

    // ==========================================
    // COMPUTED - Max Executives
    // ==========================================
    maxExecutives = computed(() => {
        const ward = this.selectedWardForSponsorship();
        if (!ward) return 1;

        switch (ward.localBodyType) {
            case 'C':
                return 5;
            case 'M':
                return 3;
            case 'P':
                return 1;
            default:
                return 1;
        }
    });

    // Helper to get max executives for any ward
    getMaxExecutives(localBodyType: 'P' | 'M' | 'C'): number {
        switch (localBodyType) {
            case 'C':
                return 5;
            case 'M':
                return 3;
            case 'P':
                return 1;
            default:
                return 1;
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
        return (
            this.sponsorName().trim() !== '' &&
            this.sponsorEmail().trim() !== '' &&
            this.cartItems().length > 0
        );
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
    // --- Set default dates ---
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(startDate.getMonth() + 1);
    this.sponsorshipStartDate.set(startDate);
    this.sponsorshipEndDate.set(endDate);
    
    this.isVolunteerDialogVisible.set(true);
  }
addToCart() {
    const ward = this.selectedWardForSponsorship();
    const count = this.sponsoredExecutivesCount();
    const startDate = this.sponsorshipStartDate();
    const endDate = this.sponsorshipEndDate();

    if (!ward || count < 1 || !startDate || !endDate) return;

    const newItem: CartItem = {
      ward,
      executivesSponsored: count,
      monthlyRate: 15000,
      costPerMonth: count * 15000,
      startDate,
      endDate,
    };

    // Use a helper function to add/update item in cart
    this.upsertCartItem(newItem);
    this.isVolunteerDialogVisible.set(false);
  }
openBulkSponsorDialog() {
      // Set default dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(startDate.getMonth() + 1);
      this.bulkSponsorshipStartDate.set(startDate);
      this.bulkSponsorshipEndDate.set(endDate);
      this.bulkSponsoredExecutivesCount.set(1);
      this.isBulkSponsorDialogVisible.set(true);
  }

  addSelectedWardsToCart() {
    const wards = this.selectedWards();
    const count = this.bulkSponsoredExecutivesCount();
    const startDate = this.bulkSponsorshipStartDate();
    const endDate = this.bulkSponsorshipEndDate();

    if (wards.length === 0 || count < 1 || !startDate || !endDate) return;

    wards.forEach(ward => {
      const newItem: CartItem = {
        ward,
        executivesSponsored: count,
        monthlyRate: 15000,
        costPerMonth: count * 15000,
        startDate,
        endDate,
      };
      this.upsertCartItem(newItem);
    });

    this.isBulkSponsorDialogVisible.set(false);
    this.selectedWards.set([]); // Clear selection after adding to cart
  }

  private upsertCartItem(newItem: CartItem) {
    this.cartItems.update(currentItems => {
      const existingIndex = currentItems.findIndex(item => item.ward._id === newItem.ward._id);
      if (existingIndex > -1) {
        // Update existing item
        const updatedItems = [...currentItems];
        updatedItems[existingIndex] = newItem;
        return updatedItems;
      } else {
        // Add new item
        return [...currentItems, newItem];
      }
    });
  }
    removeFromCart(wardId: string) {
        this.cartItems.update((items) =>
            items.filter((item) => item.ward._id !== wardId)
        );
    }

    // ==========================================
    // PAYMENT HANDLER
    // ==========================================
proceedToPayment() {
    // ...
    const paymentData = {
      // ... (sponsor info)
      items: this.cartItems().map(item => ({
        wardId: item.ward._id,
        wardName: item.ward.wardName,
        // ... (other ward details)
        executivesSponsored: item.executivesSponsored,
        costPerMonth: item.costPerMonth,
        // --- ADDED DATES ---
        sponsorshipStartDate: item.startDate.toISOString(),
        sponsorshipEndDate: item.endDate.toISOString()
      })),
      // ... (summary info)
    };
    console.log('Processing payment with dates:', paymentData);
    // ...
  }

  // ... (rest of the component)


    // ==========================================
    // UTILITY
    // ==========================================
    getLocalBodyTypeLabel(type: 'P' | 'M' | 'C'): string {
        switch (type) {
            case 'P':
                return 'Panchayat';
            case 'M':
                return 'Municipality';
            case 'C':
                return 'Corporation';
            default:
                return '';
        }
    }
}
