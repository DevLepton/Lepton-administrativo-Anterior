import { Component } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { ApiService, QuoteItem } from '../services/api.service';
import { CotizacionesDataService } from './cotizaciones-data.service';
import { NgToastService } from 'ng-angular-popup';
import { FormBuilder } from '@angular/forms';

@Component({
  selector: 'app-cotizaciones',
  templateUrl: './cotizaciones.component.html',
  styleUrl: './cotizaciones.component.scss'
})
export class CotizacionesComponent {
  quotes: QuoteItem[] = [];
  loading = false;
  search = '';
  currentPage = 1;
  perPage = 10;
  selectedIds = new Set<string>();

  constructor(private api: ApiService, private quoteData: CotizacionesDataService, private toast: NgToastService, private fb: FormBuilder) {
    // this.form = this.fb.group({
    //   type: ['GPS', Validators.required],
    //   name: ['', [Validators.required, Validators.maxLength(160)]],
    //   description: [''],
    //   price: [0, [Validators.required, Validators.min(0)]],
    //   priceIVA: [0, [Validators.required, Validators.min(0)]],
    //   discount: [0, [Validators.min(0)]],
    //   duration: [''],
    //   comments: ['']
    // });
  }

  ngOnInit(): void {
    this.loadQuotes();
  }

  loadQuotes(forceRefresh = false): void {
    this.loading = true;

    this.quoteData.getCatalogData(forceRefresh).subscribe({
      next: data => {
        this.quotes = [...data.quotes].sort((a, b) => this.createdTime(b) - this.createdTime(a));
        this.currentPage = 1;
        this.clearSelection();
      },
      error: error => {
        console.error('Error al cargar cotizaciones:', error);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar las cotizaciones', duration: 5000 });
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  get filteredQuotes(): QuoteItem[] {
    const q = this.normalize(this.search);

    return this.quotes.filter(item =>
      !q ||
      this.normalize(item.quoteNum).includes(q) ||
      this.normalize(item.clientName).includes(q) ||
      this.normalize(item.companyName).includes(q) ||
      this.normalize(item.place).includes(q)
    );
  }

  get displayedQuotes(): QuoteItem[] {
    const start = (this.currentPage - 1) * this.perPage;
    return this.filteredQuotes.slice(start, start + this.perPage);
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get canViewOrEdit(): boolean {
    return this.selectedCount === 1;
  }

  updateSearch(value: string): void {
    this.search = (value ?? '').trim();
    this.currentPage = 1;
  }

  onPageChange(event: PageEvent): void {
    this.perPage = event.pageSize;
    this.currentPage = event.pageIndex + 1;
  }

  refresh(): void {
    this.currentPage = 1;
    this.clearSelection();
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleRowSelection(item: QuoteItem, checked: boolean): void {
    if (checked) this.selectedIds.add(item._id);
    else this.selectedIds.delete(item._id);
  }

  toggleRowByClick(item: QuoteItem): void {
    this.toggleRowSelection(item, !this.isSelected(item._id));
  }

  toggleSelectAllVisible(checked: boolean): void {
    if (checked) this.displayedQuotes.forEach(item => this.selectedIds.add(item._id));
    else this.displayedQuotes.forEach(item => this.selectedIds.delete(item._id));
  }

  get allVisibleSelected(): boolean {
    const visible = this.displayedQuotes;
    return visible.length > 0 && visible.every(item => this.selectedIds.has(item._id));
  }

  get someVisibleSelected(): boolean {
    const visible = this.displayedQuotes;
    return visible.some(item => this.selectedIds.has(item._id)) && !this.allVisibleSelected;
  }

  trackById(_index: number, item: QuoteItem): string {
    return item._id;
  }

  private clearSelection(): void {
    this.selectedIds.clear();
  }

  private createdTime(item: QuoteItem): number {
    const date = item.createdAt ? new Date(item.createdAt) : null;
    return date && !isNaN(date.getTime()) ? date.getTime() : 0;
  }

  private normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }
}
