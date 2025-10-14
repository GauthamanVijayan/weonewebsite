import { Component, ChangeDetectionStrategy, effect, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';

// --- Define the data structure for an invoice ---
interface Invoice {
  company: { name: string; address: string; location: string };
  billTo: { name: string; email: string };
  invoiceNumber: string;
  date: Date;
  status: 'Paid' | 'Awaiting';
  items: { description: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  gst: number;
  total: number;
}

@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule, ButtonModule, DatePipe, CurrencyPipe],
  templateUrl: './invoice.component.html',
  styleUrl: './invoice.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceComponent {
  invoiceId = signal<string | null>(null);
  invoiceData = signal<Invoice | null>(null);
  loading = signal(true);

  constructor(private route: ActivatedRoute) {
    // Effect to fetch invoice data when the URL parameter changes
    effect(() => {
      const id = this.route.snapshot.paramMap.get('id');
      this.invoiceId.set(id);
      if (id) {
        this.fetchInvoiceData(id);
      }
    }, { allowSignalWrites: true });
  }

  fetchInvoiceData(id: string): void {
    this.loading.set(true);

    // *** FAKE CONVEX CALL FOR NOW ***
    // In a real app, this would be a call to your Convex backend
    console.log(`Fetching invoice data for ID: ${id}`);
    setTimeout(() => {
        const fakeInvoice: Invoice = {
            company: { name: 'WeOne Platform by INTIA', address: 'Trivandrum, Kerala', location: 'India' },
            billTo: { name: 'Corporate Sponsor Inc.', email: 'sponsor@example.com' },
            invoiceNumber: `INV-${id}`,
            date: new Date(),
            status: 'Paid',
            items: [
                { description: 'Sponsorship for Kazhakootam (Corporation)', quantity: 3, unitPrice: 15000, lineTotal: 45000 },
                { description: 'Sponsorship for Vattiyoorkavu (Municipality)', quantity: 1, unitPrice: 15000, lineTotal: 15000 }
            ],
            subtotal: 60000,
            gst: 10800,
            total: 70800
        };
        this.invoiceData.set(fakeInvoice);
        this.loading.set(false);
    }, 1000);
  }

  printInvoice(): void {
    window.print();
  }
}