import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import {
  ApiService,
  BillingClientItem,
  ForeignTechnicianItem,
  QuoteItem,
  QuoteProduct,
  QuoteProductItem,
  QuoteProductType,
  SuggestionItem,
  TravelExpenseExtraItem,
  TravelExpenseItem
} from '../services/api.service';
import { CotizacionesDataService } from './cotizaciones-data.service';
import { NgToastService } from 'ng-angular-popup';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type QuoteView = 'list' | 'builder';
type QuoteSection = 'client' | 'products' | 'payment';
type DiscountType = '%' | '$';

interface QuoteBuilderProduct extends QuoteProduct {
  productId: string;
  type: QuoteProductType;
  lockedAmount?: boolean;
}

interface BankAccountOption {
  holder: string;
  bankName: string;
  accountNumber: string;
  CLABE: string;
}

interface QuoteDraft {
  activeView?: QuoteView;
  client: any;
  productsForm: any;
  products: QuoteBuilderProduct[];
  payment: any;
  productSearch?: string;
  activeSection?: QuoteSection;
  ignoredSuggestions?: PendingQuoteSuggestion[];
}

type ForeignServiceMode = 'lepton' | 'foreign';

interface ForeignServiceLine {
  key: keyof Pick<ForeignTechnicianItem, 'installationPrice' | 'inspectionFee' | 'withdrawalPrice' | 'priceFalseReversal' | 'travelExpensesPrice' | 'transferPrice'>;
  label: string;
  quantity: number;
}

interface PendingQuoteSuggestion {
  suggestionId: string;
  triggerProductId: string;
  action: 'add' | 'remove';
  iconProductIds: string[];
}

interface QuotePdfLine {
  amount: number;
  name: string;
  description: string;
  unitPrice: number;
  discount: number;
  import: number;
}

interface QuotePdfTotals {
  subtotal?: number;
  discounts: number;
  IVA?: number;
  total: number;
  paymentNextMonthly?: number;
}

@Component({
  selector: 'app-cotizaciones',
  templateUrl: './cotizaciones.component.html',
  styleUrl: './cotizaciones.component.scss'
})
export class CotizacionesComponent implements OnInit {
  private readonly draftKey = 'quote_builder_draft';

  activeView: QuoteView = 'list';
  activeSection: QuoteSection = 'client';

  quotes: QuoteItem[] = [];
  products: QuoteProductItem[] = [];
  suggestions: SuggestionItem[] = [];
  billingClients: BillingClientItem[] = [];
  foreignTechnicians: ForeignTechnicianItem[] = [];
  travelExpenses: TravelExpenseItem[] = [];
  travelExpenseExtras: TravelExpenseExtraItem[] = [];

  loading = false;
  builderLoading = false;
  savingQuote = false;
  search = '';
  currentPage = 1;
  perPage = 10;
  selectedIds = new Set<string>();

  clientForm: FormGroup;
  productsForm: FormGroup;
  paymentForm: FormGroup;
  leptonForeignForm: FormGroup;
  externalTechnicianForm: FormGroup;

  quoteProducts: QuoteBuilderProduct[] = [];
  productSearch = '';
  productTypeFilter: QuoteProductType | '' = '';
  selectedProductId = '';
  foreignServiceModalOpen = false;
  suggestionModalOpen = false;
  activeSuggestion: PendingQuoteSuggestion | null = null;
  private suggestionQueue: PendingQuoteSuggestion[] = [];
  ignoredSuggestions: PendingQuoteSuggestion[] = [];
  foreignServiceMode: ForeignServiceMode = 'lepton';
  selectedBoothIndexes = new Set<number>();
  foreignServiceLines: ForeignServiceLine[] = [
    { key: 'installationPrice', label: 'Instalacion', quantity: 0 },
    { key: 'inspectionFee', label: 'Revision', quantity: 0 },
    { key: 'withdrawalPrice', label: 'Retiro', quantity: 0 },
    { key: 'priceFalseReversal', label: 'Falsa vuelta', quantity: 0 },
    { key: 'travelExpensesPrice', label: 'Viaticos', quantity: 0 },
    { key: 'transferPrice', label: 'Traslado', quantity: 0 }
  ];

  bankAccounts: BankAccountOption[] = [
    {
      holder: 'Lepton Seguridad',
      bankName: 'BBVA Mexico',
      accountNumber: '0123456789',
      CLABE: '012180001234567890'
    },
    {
      holder: 'Lepton Administrativo',
      bankName: 'Santander',
      accountNumber: '9876543210',
      CLABE: '014180009876543210'
    }
  ];

  constructor(
    private api: ApiService,
    private quoteData: CotizacionesDataService,
    private toast: NgToastService,
    private fb: FormBuilder,
    private auth: AuthService
  ) {
    this.clientForm = this.fb.group({
      clientName: ['', Validators.required],
      companyName: ['', Validators.required],
      place: ['', Validators.required],
      validity: [this.defaultValidityDate(), Validators.required]
    });

    this.productsForm = this.fb.group({
      units: [1, [Validators.required, Validators.min(1)]],
      model: ['', Validators.required]
    });

    this.paymentForm = this.fb.group({
      paymentMethodHolder: ['', Validators.required],
      bankName: ['', Validators.required],
      accountNumber: ['', Validators.required],
      CLABE: ['', Validators.required],
      billable: [false],
      comments: ['']
    });

    this.leptonForeignForm = this.fb.group({
      days: [1, [Validators.required, Validators.min(1)]],
      people: [1, [Validators.required, Validators.min(1)]],
      breakfasts: [0, [Validators.min(0)]],
      lunches: [0, [Validators.min(0)]],
      dinners: [0, [Validators.min(0)]],
      placeId: ['', Validators.required],
      nights: [0, [Validators.min(0)]]
    });

    this.externalTechnicianForm = this.fb.group({
      technicianId: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.restoreDraft();
    this.loadQuotes();
    this.loadBuilderCatalogs();
    this.setupDraftPersistence();
  }

  loadQuotes(forceRefresh = false): void {
    this.loading = true;

    const request$ = forceRefresh
      ? this.quoteData.getQuotes(true)
      : this.quoteData.getCatalogData().pipe(map(data => data.quotes));

    request$.subscribe({
      next: quotes => {
        this.quotes = [...quotes].sort((a, b) => this.createdTime(b) - this.createdTime(a));
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

  loadBuilderCatalogs(forceRefresh = false): void {
    this.builderLoading = true;

    this.quoteData.getCatalogData(false).subscribe({
      next: data => {
        this.products = [...data.products].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        this.suggestions = data.suggestions;
        this.foreignTechnicians = [...data.foreignTechnicians].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        this.travelExpenses = [...data.travelExpenses].sort((a, b) => a.place.localeCompare(b.place, 'es'));
        this.travelExpenseExtras = [...data.travelExpenseExtras].sort((a, b) => this.createdTime(b as any) - this.createdTime(a as any));
      },
      error: error => {
        console.error('Error al cargar catalogos del cotizador:', error);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar productos y sugerencias', duration: 5000 });
      },
      complete: () => {
        this.builderLoading = false;
      }
    });

    this.api.getBillingClientsCached(forceRefresh).subscribe({
      next: response => {
        this.billingClients = this.extractList(response)
          .map(item => this.mapBillingClient(item))
          .sort((a, b) => a.billingName.localeCompare(b.billingName, 'es'));
      },
      error: error => {
        console.error('Error al cargar clientes de cobranza:', error);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los clientes de cobranza', duration: 5000 });
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

  get filteredBillingClients(): BillingClientItem[] {
    const q = this.normalize(this.clientForm.get('clientName')?.value);
    if (!q) return this.billingClients.slice(0, 25);

    return this.billingClients
      .filter(item =>
        this.normalize(item.billingName).includes(q) ||
        this.normalize(item.companyName).includes(q)
      )
      .slice(0, 25);
  }

  get filteredProducts(): QuoteProductItem[] {
    const q = this.normalize(this.productSearch);

    return this.products
      .filter(item => !this.productTypeFilter || item.type === this.productTypeFilter)
      .filter(item =>
        !q ||
        this.normalize(item.name).includes(q) ||
        this.normalize(item.description).includes(q) ||
        this.normalize(item.type).includes(q)
      )
      .slice(0, 30);
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get canViewOrEdit(): boolean {
    return this.selectedCount === 1;
  }

  get selectedQuotes(): QuoteItem[] {
    const selected = new Set(this.selectedIds);
    return this.quotes.filter(item => selected.has(item._id));
  }

  get subtotal(): number {
    return this.roundMoney(this.quoteProducts.reduce((sum, item) => sum + (item.price * item.amount), 0));
  }

  get IVA(): number {
    return this.roundMoney(this.quoteProducts.reduce((sum, item) => sum + ((item.priceIVA - item.price) * item.amount), 0));
  }

  get discounts(): number {
    return this.roundMoney(this.quoteProducts.reduce((sum, item) => {
      const beforeDiscount = item.priceIVA * item.amount;
      return sum + Math.max(0, beforeDiscount - item.total);
    }, 0));
  }

  get total(): number {
    return this.roundMoney(this.quoteProducts.reduce((sum, item) => sum + item.total, 0));
  }

  get paymentNextMonthly(): number {
    const total = this.quoteProducts
      .filter(item => item.type === 'Plan')
      .reduce((sum, item) => sum + (item.priceIVA * item.amount), 0);

    return this.roundMoney(total);
  }

  get hasPlan(): boolean {
    return this.quoteProducts.some(item => item.type === 'Plan');
  }

  get currentTravelExpenseExtra(): TravelExpenseExtraItem | null {
    return this.travelExpenseExtras[0] ?? null;
  }

  get selectedTravelExpense(): TravelExpenseItem | null {
    const placeId = this.leptonForeignForm.get('placeId')?.value;
    return this.travelExpenses.find(item => item._id === placeId) ?? null;
  }

  get selectedForeignTechnician(): ForeignTechnicianItem | null {
    const technicianId = this.externalTechnicianForm.get('technicianId')?.value;
    return this.foreignTechnicians.find(item => item._id === technicianId) ?? null;
  }

  get maxMealCount(): number {
    return Math.max(1, Number(this.leptonForeignForm.get('days')?.value || 1));
  }

  get leptonMealsTotal(): number {
    const extra = this.currentTravelExpenseExtra;
    if (!extra) return 0;

    const people = Math.max(1, Number(this.leptonForeignForm.get('people')?.value || 1));
    const breakfasts = this.clampMealCount(this.leptonForeignForm.get('breakfasts')?.value);
    const lunches = this.clampMealCount(this.leptonForeignForm.get('lunches')?.value);
    const dinners = this.clampMealCount(this.leptonForeignForm.get('dinners')?.value);

    return this.roundMoney(people * (
      breakfasts * Number(extra.breakfast || 0) +
      lunches * Number(extra.lunch || 0) +
      dinners * Number(extra.dinner || 0)
    ));
  }

  get leptonBoothsSubtotal(): number {
    const travelExpense = this.selectedTravelExpense;
    if (!travelExpense) return 0;

    return this.roundMoney(
      travelExpense.booths
        .filter((_booth, index) => this.selectedBoothIndexes.has(index))
        .reduce((sum, booth) => sum + Number(booth.cost || 0), 0)
    );
  }

  get leptonBoothsRoundTripTotal(): number {
    return this.roundMoney(this.leptonBoothsSubtotal * 2);
  }

  get leptonGasSubtotal(): number {
    const travelExpense = this.selectedTravelExpense;
    const extra = this.currentTravelExpenseExtra;
    if (!travelExpense || !extra) return 0;

    return this.roundMoney(Number(travelExpense.km || 0) * Number(extra.kmRate || 0));
  }

  get leptonGasRoundTripTotal(): number {
    return this.roundMoney(this.leptonGasSubtotal * 2);
  }

  get leptonLodgingTotal(): number {
    const extra = this.currentTravelExpenseExtra;
    if (!extra) return 0;

    const nights = Math.max(0, Number(this.leptonForeignForm.get('nights')?.value || 0));
    return this.roundMoney(nights * Number(extra.lodging || 0));
  }

  get leptonForeignSubtotal(): number {
    return this.roundMoney(this.leptonMealsTotal + this.leptonBoothsRoundTripTotal + this.leptonGasRoundTripTotal + this.leptonLodgingTotal);
  }

  get leptonForeignTotalIVA(): number {
    return this.roundMoney(this.leptonForeignSubtotal * 1.16);
  }

  get externalTechnicianSubtotal(): number {
    const technician = this.selectedForeignTechnician;
    if (!technician) return 0;

    return this.roundMoney(this.foreignServiceLines.reduce((sum, line) => {
      return sum + Number(technician[line.key] || 0) * Math.max(0, Number(line.quantity || 0));
    }, 0));
  }

  get externalTechnicianTotalIVA(): number {
    return this.roundMoney(this.externalTechnicianSubtotal * 1.16);
  }

  get canAddForeignService(): boolean {
    if (this.foreignServiceMode === 'lepton') {
      return this.leptonForeignForm.valid && !!this.currentTravelExpenseExtra && !!this.selectedTravelExpense && this.leptonForeignSubtotal > 0;
    }

    return this.externalTechnicianForm.valid && this.externalTechnicianSubtotal > 0;
  }

  get clientComplete(): boolean {
    return this.clientForm.valid;
  }

  get productsComplete(): boolean {
    return this.productsForm.valid && this.quoteProducts.length > 0;
  }

  get paymentComplete(): boolean {
    return this.paymentForm.valid;
  }

  get quoteComplete(): boolean {
    return this.clientComplete && this.productsComplete && this.paymentComplete;
  }

  openBuilder(): void {
    this.activeView = 'builder';
    if (!this.activeSection) this.activeSection = 'client';
    this.saveDraft();
  }

  backToList(): void {
    this.activeView = 'list';
    this.saveDraft();
  }

  setSection(section: QuoteSection): void {
    this.activeSection = section;
    this.saveDraft();
  }

  completeClientSection(): void {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    this.setSection('products');
  }

  completeProductsSection(): void {
    if (!this.productsComplete) {
      this.productsForm.markAllAsTouched();
      this.toast.warning({ detail: 'Campos incompletos', summary: 'Agrega al menos un producto', duration: 3000 });
      return;
    }

    this.setSection('payment');
  }

  onBillingClientSelected(client: BillingClientItem): void {
    this.clientForm.patchValue({
      clientName: client.billingName,
      companyName: client.companyName || ''
    });
  }

  displayBillingClient(client: BillingClientItem | string): string {
    if (!client) return '';
    return typeof client === 'string' ? client : client.billingName;
  }

  onPaymentHolderChange(holder: string): void {
    const account = this.bankAccounts.find(item => item.holder === holder);
    if (!account) return;

    this.paymentForm.patchValue({
      paymentMethodHolder: account.holder,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      CLABE: account.CLABE
    });
  }

  addSelectedProduct(): void {
    if (!this.selectedProductId) return;
    this.addProductById(this.selectedProductId, true);
    this.selectedProductId = '';
    this.productSearch = '';
  }

  downloadSelectedQuotes(): void {
    const selected = this.selectedQuotes;

    if (!selected.length) {
      this.toast.warning({ detail: 'Sin seleccion', summary: 'Selecciona al menos una cotizacion', duration: 3000 });
      return;
    }

    selected.forEach(quote => {
      const pdf = this.createQuotePdf(quote);
      const fileName = `Cotizacion-${this.sanitizeFileName(quote.quoteNum || quote._id)}.pdf`;
      pdf.save(fileName);
    });
  }

  onProductSelected(product: QuoteProductItem): void {
    this.selectedProductId = product._id;
    this.productSearch = product.name;
  }

  displayProduct(product: QuoteProductItem | string): string {
    if (!product) return '';
    return typeof product === 'string' ? product : product.name;
  }

  openForeignServiceModal(): void {
    this.foreignServiceModalOpen = true;
    document.body.style.overflow = 'hidden';

    if (this.selectedTravelExpense && this.selectedBoothIndexes.size === 0) {
      this.selectAllBooths();
    }
  }

  closeForeignServiceModal(): void {
    this.foreignServiceModalOpen = false;
    document.body.style.overflow = '';
  }

  setForeignServiceMode(mode: ForeignServiceMode): void {
    this.foreignServiceMode = mode;
  }

  onTravelExpenseChange(): void {
    this.selectAllBooths();
  }

  isBoothSelected(index: number): boolean {
    return this.selectedBoothIndexes.has(index);
  }

  toggleBooth(index: number, checked: boolean): void {
    if (checked) this.selectedBoothIndexes.add(index);
    else this.selectedBoothIndexes.delete(index);
  }

  updateForeignServiceLine(line: ForeignServiceLine, value: number): void {
    line.quantity = Math.max(0, Number(value || 0));
  }

  addForeignServiceProduct(): void {
    if (!this.canAddForeignService) {
      this.leptonForeignForm.markAllAsTouched();
      this.externalTechnicianForm.markAllAsTouched();
      return;
    }

    const product = this.foreignServiceMode === 'lepton'
      ? this.buildLeptonForeignProduct()
      : this.buildExternalTechnicianProduct();

    this.quoteProducts.push(product);
    this.saveDraft();
    this.closeForeignServiceModal();
    this.resetForeignServiceModal();
  }

  addProductById(productId: string, applySuggestion: boolean): void {
    const product = this.products.find(item => item._id === productId);
    if (!product) return;

    const existing = this.quoteProducts.find(item => item.productId === productId);
    if (existing) {
      existing.amount += 1;
      this.recalculateProduct(existing);
    } else {
      const item: QuoteBuilderProduct = {
        productId: product._id,
        type: product.type,
        name: product.name,
        description: product.description ?? '',
        price: Number(product.price ?? 0),
        priceIVA: Number(product.priceIVA ?? 0),
        discount: Number(product.discount ?? 0),
        discountType: '%',
        amount: 1,
        total: 0
      };

      this.recalculateProduct(item);
      this.quoteProducts.push(item);
    }

    if (applySuggestion) this.promptSuggestions(productId, 'add');
    this.saveDraft();
  }

  removeProduct(productId: string, applySuggestion = true): void {
    this.quoteProducts = this.quoteProducts.filter(item => item.productId !== productId);
    this.ignoredSuggestions = this.ignoredSuggestions.filter(item => !item.iconProductIds.includes(productId));
    if (applySuggestion) this.promptSuggestions(productId, 'remove');
    this.saveDraft();
  }

  updateProductAmount(item: QuoteBuilderProduct, value: number): void {
    if (item.lockedAmount) {
      item.amount = 1;
      this.recalculateProduct(item);
      this.saveDraft();
      return;
    }

    item.amount = Math.max(1, Number(value || 1));
    this.recalculateProduct(item);
    this.saveDraft();
  }

  updateProductDiscount(item: QuoteBuilderProduct, value: number): void {
    item.discount = Math.max(0, Number(value || 0));
    this.recalculateProduct(item);
    this.saveDraft();
  }

  updateProductDiscountType(item: QuoteBuilderProduct, value: DiscountType): void {
    item.discountType = value;
    this.recalculateProduct(item);
    this.saveDraft();
  }

  submitQuote(): void {
    if (!this.quoteComplete) {
      this.clientForm.markAllAsTouched();
      this.productsForm.markAllAsTouched();
      this.paymentForm.markAllAsTouched();
      this.toast.warning({ detail: 'Campos incompletos', summary: 'Completa todas las secciones', duration: 3500 });
      return;
    }

    this.savingQuote = true;

    this.api.createQuote(this.buildQuotePayload()).subscribe({
      next: () => {
        this.toast.success({ detail: 'Exito', summary: 'Cotizacion creada correctamente', duration: 3500 });
        this.clearDraft();
        this.activeView = 'list';
        this.loadQuotes(true);
      },
      error: error => {
        console.error('Error al crear cotizacion:', error);
        const msg = error?.error?.error || error?.error?.message || 'No se pudo crear la cotizacion';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      },
      complete: () => {
        this.savingQuote = false;
      }
    });
  }

  clearBuilder(): void {
    this.clearDraft();
    this.toast.info({ detail: 'Cotizador', summary: 'Campos limpiados', duration: 2500 });
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
    this.loadQuotes(true);
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

  trackByProductId(_index: number, item: QuoteBuilderProduct): string {
    return item.productId;
  }

  hasIgnoredSuggestion(productId: string): boolean {
    return this.ignoredSuggestions.some(item => item.iconProductIds.includes(productId));
  }

  openIgnoredSuggestion(productId: string): void {
    const suggestion = this.ignoredSuggestions.find(item => item.iconProductIds.includes(productId));
    if (!suggestion) return;

    this.activeSuggestion = suggestion;
    this.suggestionModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  getSuggestion(item: PendingQuoteSuggestion | null): SuggestionItem | null {
    if (!item) return null;
    return this.suggestions.find(suggestion => suggestion._id === item.suggestionId) ?? null;
  }

  getProductName(productId: string): string {
    return this.products.find(item => item._id === productId)?.name
      ?? this.quoteProducts.find(item => item.productId === productId)?.name
      ?? 'Producto no encontrado';
  }

  getSuggestionTitle(item: PendingQuoteSuggestion | null): string {
    if (!item) return '';
    const action = item.action === 'add' ? 'agregaste' : 'quitaste';
    return `Cuando ${action} ${this.getProductName(item.triggerProductId)}`;
  }

  closeSuggestionModal(): void {
    this.suggestionModalOpen = false;
    this.activeSuggestion = null;
    document.body.style.overflow = this.foreignServiceModalOpen ? 'hidden' : '';
    this.showNextSuggestion();
  }

  applyActiveSuggestion(): void {
    if (!this.activeSuggestion) return;

    const suggestion = this.getSuggestion(this.activeSuggestion);
    if (!suggestion) {
      this.closeSuggestionModal();
      return;
    }

    this.ignoredSuggestions = this.ignoredSuggestions.filter(item => item.suggestionId !== this.activeSuggestion?.suggestionId);

    suggestion.response.forEach(response => {
      if (response.action === 'add') this.addProductById(response.productId, false);
      if (response.action === 'remove') this.removeProduct(response.productId, false);
    });

    this.saveDraft();
    this.closeSuggestionModal();
  }

  ignoreActiveSuggestion(): void {
    if (!this.activeSuggestion) return;

    const exists = this.ignoredSuggestions.some(item => item.suggestionId === this.activeSuggestion?.suggestionId);
    if (!exists) this.ignoredSuggestions.push(this.activeSuggestion);

    this.saveDraft();
    this.closeSuggestionModal();
  }

  private buildQuotePayload(): Omit<QuoteItem, 'userId' | '_id' | 'quoteNum' | 'createdAt'> {
    const client = this.clientForm.getRawValue();
    const products = this.productsForm.getRawValue();
    const payment = this.paymentForm.getRawValue();

    return {
      clientName: String(client.clientName ?? '').trim(),
      companyName: String(client.companyName ?? '').trim(),
      place: String(client.place ?? '').trim(),
      validity: this.toDateValue(client.validity),
      products: this.quoteProducts.map(item => ({
        name: item.name,
        description: item.description ?? '',
        price: item.price,
        priceIVA: item.priceIVA,
        discount: item.discount,
        discountType: item.discountType,
        amount: item.amount,
        total: item.total
      })),
      subtotal: this.subtotal,
      discounts: this.discounts,
      IVA: this.IVA,
      total: this.total,
      units: Number(products.units ?? 1),
      model: String(products.model ?? '').trim(),
      paymentNextMonthly: this.hasPlan ? this.paymentNextMonthly : undefined,
      billable: Boolean(payment.billable),
      bankName: String(payment.bankName ?? '').trim(),
      paymentMethodHolder: String(payment.paymentMethodHolder ?? '').trim(),
      accountNumber: String(payment.accountNumber ?? '').trim(),
      CLABE: String(payment.CLABE ?? '').trim(),
      comments: String(payment.comments ?? '').trim()
    };
  }

  private promptSuggestions(productId: string, action: 'add' | 'remove'): void {
    const matches = this.suggestions.filter(item => item.productId === productId && item.action === action);

    matches.forEach(suggestion => {
      const pending: PendingQuoteSuggestion = {
        suggestionId: suggestion._id,
        triggerProductId: productId,
        action,
        iconProductIds: action === 'add'
          ? [productId]
          : suggestion.response.map(response => response.productId)
      };

      this.suggestionQueue.push(pending);
    });

    this.showNextSuggestion();
  }

  private showNextSuggestion(): void {
    if (this.suggestionModalOpen || this.activeSuggestion || !this.suggestionQueue.length) return;

    this.activeSuggestion = this.suggestionQueue.shift() ?? null;
    this.suggestionModalOpen = !!this.activeSuggestion;

    if (this.suggestionModalOpen) document.body.style.overflow = 'hidden';
  }

  private recalculateProduct(item: QuoteBuilderProduct): void {
    const amount = item.lockedAmount ? 1 : Math.max(1, Number(item.amount || 1));
    const gross = Number(item.priceIVA || 0) * amount;
    const discount = item.discountType === '%'
      ? gross * (Math.min(Number(item.discount || 0), 100) / 100)
      : Math.min(Number(item.discount || 0), gross);

    item.amount = amount;
    item.total = this.roundMoney(Math.max(0, gross - discount));
  }

  private buildLeptonForeignProduct(): QuoteBuilderProduct {
    const place = this.selectedTravelExpense?.place ?? '';
    const price = this.leptonForeignSubtotal;

    const item: QuoteBuilderProduct = {
      productId: `foreign-lepton-${Date.now()}`,
      type: 'Servicio',
      name: `Servicio foraneo realizado por Lepton en ${place}`,
      description: 'Incluye viaticos y hospedaje',
      price,
      priceIVA: this.roundMoney(price * 1.16),
      discount: 0,
      discountType: '%',
      amount: 1,
      total: 0,
      lockedAmount: true
    };

    this.recalculateProduct(item);
    return item;
  }

  private buildExternalTechnicianProduct(): QuoteBuilderProduct {
    const price = this.externalTechnicianSubtotal;
    const item: QuoteBuilderProduct = {
      productId: `foreign-technician-${Date.now()}`,
      type: 'Servicio',
      name: 'Servicio tecnico realizado por instalador certificado',
      description: 'Incluye viaticos y hospedaje',
      price,
      priceIVA: this.roundMoney(price * 1.16),
      discount: 0,
      discountType: '%',
      amount: 1,
      total: 0,
      lockedAmount: true
    };

    this.recalculateProduct(item);
    return item;
  }

  private resetForeignServiceModal(): void {
    this.foreignServiceMode = 'lepton';
    this.leptonForeignForm.reset({
      days: 1,
      people: 1,
      breakfasts: 0,
      lunches: 0,
      dinners: 0,
      placeId: '',
      nights: 0
    });
    this.externalTechnicianForm.reset({ technicianId: '' });
    this.selectedBoothIndexes.clear();
    this.foreignServiceLines.forEach(line => line.quantity = 0);
  }

  private selectAllBooths(): void {
    this.selectedBoothIndexes.clear();
    this.selectedTravelExpense?.booths.forEach((_booth, index) => this.selectedBoothIndexes.add(index));
  }

  private clampMealCount(value: unknown): number {
    const count = Math.max(0, Number(value || 0));
    return Math.min(count, this.maxMealCount);
  }

  private setupDraftPersistence(): void {
    this.clientForm.valueChanges.subscribe(() => this.saveDraft());
    this.productsForm.valueChanges.subscribe(() => this.saveDraft());
    this.paymentForm.valueChanges.subscribe(() => this.saveDraft());
  }

  private saveDraft(): void {
    const draft: QuoteDraft = {
      activeView: this.activeView,
      client: this.clientForm.getRawValue(),
      productsForm: this.productsForm.getRawValue(),
      products: this.quoteProducts,
      payment: this.paymentForm.getRawValue(),
      productSearch: this.productSearch,
      activeSection: this.activeSection,
      ignoredSuggestions: this.ignoredSuggestions
    };

    localStorage.setItem(this.draftKey, JSON.stringify(draft));
  }

  private restoreDraft(): void {
    const raw = localStorage.getItem(this.draftKey);
    if (!raw) return;

    try {
      const draft = JSON.parse(raw) as QuoteDraft;

      this.clientForm.patchValue({
        ...draft.client,
        validity: draft.client?.validity ? new Date(draft.client.validity) : this.defaultValidityDate()
      }, { emitEvent: false });

      if (draft.productsForm) {
        this.productsForm.patchValue(draft.productsForm, { emitEvent: false });
      }

      if (draft.payment) {
        this.paymentForm.patchValue(draft.payment, { emitEvent: false });
      }

      this.quoteProducts = Array.isArray(draft.products)
        ? draft.products.map(item => {
          const product = { ...item };
          this.recalculateProduct(product);
          return product;
        })
        : [];

      this.productSearch = draft.productSearch ?? '';
      this.activeSection = draft.activeSection ?? 'client';
      this.activeView = draft.activeView ?? 'list';
      this.ignoredSuggestions = Array.isArray(draft.ignoredSuggestions) ? draft.ignoredSuggestions : [];
    } catch {
      localStorage.removeItem(this.draftKey);
    }
  }

  private clearDraft(): void {
    this.clientForm.reset({
      clientName: '',
      companyName: '',
      place: '',
      validity: this.defaultValidityDate()
    }, { emitEvent: false });

    this.productsForm.reset({
      units: 1,
      model: ''
    }, { emitEvent: false });

    this.paymentForm.reset({
      paymentMethodHolder: '',
      bankName: '',
      accountNumber: '',
      CLABE: '',
      billable: false,
      comments: ''
    }, { emitEvent: false });

    this.quoteProducts = [];
    this.productSearch = '';
    this.productTypeFilter = '';
    this.selectedProductId = '';
    this.ignoredSuggestions = [];
    this.suggestionQueue = [];
    this.activeSuggestion = null;
    this.suggestionModalOpen = false;
    this.activeSection = 'client';
    localStorage.removeItem(this.draftKey);
  }

  private createQuotePdf(quote: QuoteItem): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const rows = this.buildPdfLines(quote);
    const totals = this.buildPdfTotals(quote, rows);
    let tableFinalY = 0;

    autoTable(doc, {
      startY: 78,
      margin: { top: 78, right: margin, bottom: 35, left: margin },
      head: [['Cant.', 'Producto / descripcion', 'Precio unitario', 'Descuento', 'Importe']],
      body: rows.map(row => [
        String(row.amount),
        `${row.name}${row.description ? `\n${row.description}` : ''}`,
        this.money(row.unitPrice),
        this.money(row.discount),
        this.money(row.import)
      ]),
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        textColor: [34, 34, 34],
        cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
        valign: 'top'
      },
      headStyles: {
        fontStyle: 'bold',
        textColor: [34, 34, 34],
        lineColor: [168, 168, 168],
        lineWidth: 0.3,
        fillColor: [255, 255, 255]
      },
      columnStyles: {
        0: { cellWidth: 13, halign: 'center' },
        1: { cellWidth: 78 },
        2: { cellWidth: 31, halign: 'right' },
        3: { cellWidth: 29, halign: 'right' },
        4: { cellWidth: 31, halign: 'right' }
      },
      didDrawPage: data => {
        this.drawQuoteHeader(doc, quote, data.pageNumber);
        const footerY = pageHeight - 9;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(104, 104, 104);
        doc.text(`Pagina ${data.pageNumber}`, pageWidth / 2, footerY, { align: 'center' });
      }
    });

    tableFinalY = (doc as any).lastAutoTable?.finalY ?? 78;

    const requiredHeight = 82;
    if (tableFinalY + requiredHeight > pageHeight - 18) {
      doc.addPage();
      this.drawQuoteHeader(doc, quote, doc.getNumberOfPages());
      tableFinalY = 78;
    }

    let y = Math.max(tableFinalY + 10, 90);
    y = this.drawPdfTotals(doc, quote, totals, y, pageWidth, pageHeight);
    y = Math.max(y + 8, 145);
    y = this.drawPdfPayment(doc, quote, y, pageWidth, pageHeight);
    this.drawPdfTerms(doc, y + 8, pageWidth, pageHeight);

    return doc;
  }

  private buildPdfLines(quote: QuoteItem): QuotePdfLine[] {
    return quote.products.map(product => {
      const amount = Math.max(1, Number(product.amount || 1));
      const unitPrice = quote.billable ? Number(product.price || 0) : Number(product.priceIVA || 0);
      const gross = unitPrice * amount;
      const discount = product.discountType === '%'
        ? gross * (Math.min(Number(product.discount || 0), 100) / 100)
        : Math.min(Number(product.discount || 0), gross);

      return {
        amount,
        name: product.name || 'Producto',
        description: product.description || '',
        unitPrice: this.roundMoney(unitPrice),
        discount: this.roundMoney(discount),
        import: this.roundMoney(Math.max(0, gross - discount))
      };
    });
  }

  private buildPdfTotals(quote: QuoteItem, rows: QuotePdfLine[]): QuotePdfTotals {
    const subtotal = this.roundMoney(rows.reduce((sum, row) => sum + (row.unitPrice * row.amount), 0));
    const discounts = this.roundMoney(rows.reduce((sum, row) => sum + row.discount, 0));
    const taxableBase = this.roundMoney(subtotal - discounts);
    const IVA = quote.billable ? this.roundMoney(taxableBase * 0.16) : undefined;
    const total = quote.billable ? this.roundMoney(taxableBase + (IVA ?? 0)) : taxableBase;

    return {
      subtotal: quote.billable ? subtotal : undefined,
      discounts,
      IVA,
      total,
      paymentNextMonthly: quote.paymentNextMonthly != null ? Number(quote.paymentNextMonthly) : undefined
    };
  }

  private drawQuoteHeader(doc: jsPDF, quote: QuoteItem, page: number): void {
    const width = doc.internal.pageSize.getWidth();
    const margin = 14;
    const issueDate = quote.createdAt ? new Date(quote.createdAt) : new Date();
    const validity = quote.validity ? new Date(quote.validity) : null;
    const units = quote.units ?? 1;

    doc.setFillColor(15, 107, 255);
    doc.rect(margin, 14, 13, 13, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('>', margin + 6.5, 23.2, { align: 'center' });

    doc.setTextColor(47, 58, 69);
    doc.setFontSize(17);
    doc.text('Lepton', margin + 17, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(90, 100, 112);
    doc.text('Monitoreo y control GPS', margin + 17, 24);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(page === 1 ? 18 : 16);
    doc.setTextColor(34, 34, 34);
    doc.text('Cotizacion', width - margin, 18, { align: 'right' });

    if (page === 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`Folio: ${quote.quoteNum || '-'}`, width - margin, 25, { align: 'right' });
      doc.text(`Fecha de emision: ${this.formatDate(issueDate)}`, width - margin, 31, { align: 'right' });
      doc.text(`Vencimiento: ${validity ? this.formatDate(validity) : '-'}`, width - margin, 37, { align: 'right' });
      doc.setDrawColor(168, 168, 168);
      doc.setLineWidth(0.3);
      doc.line(margin, 42, width - margin, 42);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(34, 34, 34);
      doc.text('Cliente', margin, 50);
      doc.setFontSize(10.5);
      doc.text(quote.clientName || '-', margin, 56);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(quote.companyName || '-', margin, 62);
      doc.text(quote.place || '-', margin, 68);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Unidades', width - margin, 50, { align: 'right' });
      doc.setFontSize(10.5);
      doc.text(String(units), width - margin, 56, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(quote.model || 'Sin modelo/tipo', width - margin, 62, { align: 'right' });

      doc.setDrawColor(224, 224, 224);
      doc.line(margin, 73, width - margin, 73);
    } else {
      doc.setDrawColor(168, 168, 168);
      doc.setLineWidth(0.3);
      doc.line(margin, 29, width - margin, 29);
    }
  }

  private drawPdfTotals(doc: jsPDF, quote: QuoteItem, totals: QuotePdfTotals, startY: number, width: number, height: number): number {
    let y = startY;
    const labelX = width - 67;
    const valueX = width - 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(34, 34, 34);

    if (quote.billable && totals.subtotal != null) {
      doc.text('Subtotal:', labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(this.money(totals.subtotal), valueX, y, { align: 'right' });
      y += 5.5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Descuentos:', labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(this.money(totals.discounts), valueX, y, { align: 'right' });
    y += 5.5;

    if (quote.billable && totals.IVA != null) {
      doc.setFont('helvetica', 'bold');
      doc.text('IVA 16%:', labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(this.money(totals.IVA), valueX, y, { align: 'right' });
      y += 5.5;
    }

    doc.setDrawColor(168, 168, 168);
    doc.setLineWidth(0.3);
    doc.line(labelX, y, valueX, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('Total:', labelX, y);
    doc.text(this.money(totals.total), valueX, y, { align: 'right' });
    y += 7;

    doc.setFontSize(7.5);
    doc.text(this.amountToWords(totals.total), 14, y);
    y += 6;

    if (totals.paymentNextMonthly != null && totals.paymentNextMonthly > 0) {
      doc.setFontSize(8);
      doc.text('Pago proxima mensualidad:', labelX - 10, y);
      doc.setFont('helvetica', 'normal');
      doc.text(this.money(totals.paymentNextMonthly), valueX, y, { align: 'right' });
      y += 5;
    }

    return Math.min(y, height - 100);
  }

  private drawPdfPayment(doc: jsPDF, quote: QuoteItem, startY: number, width: number, height: number): number {
    let y = startY;
    const margin = 14;

    if (y > height - 72) {
      doc.addPage();
      this.drawQuoteHeader(doc, quote, doc.getNumberOfPages());
      y = 42;
    }

    doc.setDrawColor(224, 224, 224);
    doc.setLineWidth(0.3);
    doc.line(margin, y, width - margin, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(34, 34, 34);
    doc.text('Metodo de pago', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.text(`Titular: ${quote.paymentMethodHolder || '-'}`, margin, y + 7);
    doc.text(`Banco: ${quote.bankName || '-'}`, margin, y + 13);
    doc.text(`Cuenta: ${quote.accountNumber || '-'}`, margin + 75, y + 7);
    doc.text(`CLABE: ${quote.CLABE || '-'}`, margin + 75, y + 13);
    doc.setFontSize(7.5);
    doc.text(`Facturable: ${quote.billable ? 'Si' : 'No'}`, width - margin, y, { align: 'right' });

    if (quote.comments) {
      const commentLines = doc.splitTextToSize(`Comentarios: ${quote.comments}`, width - (margin * 2));
      doc.text(commentLines, margin, y + 21);
      y += 21 + (commentLines.length * 3.5);
    } else {
      y += 19;
    }

    return y;
  }

  private drawPdfTerms(doc: jsPDF, startY: number, width: number, height: number): void {
    const margin = 14;
    let y = startY;

    if (y > height - 47) {
      doc.addPage();
      this.drawQuoteHeader(doc, {} as QuoteItem, doc.getNumberOfPages());
      y = 42;
    }

    doc.setDrawColor(224, 224, 224);
    doc.setLineWidth(0.3);
    doc.line(margin, y, width - margin, y);
    y += 6;

    const terms = [
      'Los precios incluyen IVA.',
      'Los montos estan en pesos mexicanos.',
      'Cualquier accesorio fuera de los especificados en la propuesta se cotizara aparte.',
      'Incluye instalacion, programacion y activacion del servicio en linea segun corresponda.',
      'La inversion inicial sera en una sola exhibicion.'
    ];

    const address = [
      'Av. de la Cultura #25, Ciudad del Valle',
      'Tel.: (311) 456 4344 / (55) 4440 0609',
      'ventas@lepton-seguridad.com',
      'C.P. 63157 Tepic, Nay.'
    ];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(34, 34, 34);
    doc.text('Terminos y condiciones', margin, y);
    doc.text('Domicilio Lepton', width - 69, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    y += 5;

    terms.forEach(term => {
      const lines = doc.splitTextToSize(term, 105);
      doc.text(lines, margin, y);
      y += lines.length * 3.2;
    });

    let addressY = y - (terms.length * 3.2) - 1;
    address.forEach(line => {
      doc.text(line, width - 69, addressY);
      addressY += 3.2;
    });
  }

  private money(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));
  }

  private formatDate(value: Date): string {
    return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(value);
  }

  private amountToWords(value: number): string {
    const pesos = Math.floor(Number(value || 0));
    const cents = Math.round((Number(value || 0) - pesos) * 100);
    return `${this.numberToSpanish(pesos).toUpperCase()} PESOS ${String(cents).padStart(2, '0')}/100 MXN`;
  }

  private numberToSpanish(value: number): string {
    const units = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    if (value < 20) return units[value];
    if (value < 30) return value === 20 ? 'veinte' : `veinti${units[value - 20]}`;
    if (value < 100) return value % 10 === 0 ? tens[Math.floor(value / 10)] : `${tens[Math.floor(value / 10)]} y ${units[value % 10]}`;
    if (value === 100) return 'cien';
    if (value < 1000) return value % 100 === 0 ? hundreds[Math.floor(value / 100)] : `${hundreds[Math.floor(value / 100)]} ${this.numberToSpanish(value % 100)}`;
    if (value < 2000) return value === 1000 ? 'mil' : `mil ${this.numberToSpanish(value % 1000)}`;
    if (value < 1000000) {
      const thousands = Math.floor(value / 1000);
      const rest = value % 1000;
      return rest === 0 ? `${this.numberToSpanish(thousands)} mil` : `${this.numberToSpanish(thousands)} mil ${this.numberToSpanish(rest)}`;
    }

    const millions = Math.floor(value / 1000000);
    const rest = value % 1000000;
    const millionText = millions === 1 ? 'un millon' : `${this.numberToSpanish(millions)} millones`;
    return rest === 0 ? millionText : `${millionText} ${this.numberToSpanish(rest)}`;
  }

  private sanitizeFileName(value: string): string {
    return String(value || 'cotizacion').replace(/[\\/:*?"<>|]+/g, '-').trim();
  }

  private clearSelection(): void {
    this.selectedIds.clear();
  }

  private defaultValidityDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date;
  }

  private createdTime(item: QuoteItem): number {
    const date = item.createdAt ? new Date(item.createdAt) : null;
    return date && !isNaN(date.getTime()) ? date.getTime() : 0;
  }

  private normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private toDateValue(value: string | Date): string | Date {
    if (value instanceof Date) return value;
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date.toISOString();
  }

  private extractList(response: any): any[] {
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  }

  private mapBillingClient(item: any): BillingClientItem {
    return {
      _id: String(item?._id ?? ''),
      type: item?.type ?? 'client',
      userId: item?.userId ?? null,
      billingClientFather: item?.billingClientFather ?? null,
      subBillingClients: Array.isArray(item?.subBillingClients) ? item.subBillingClients : [],
      billingName: String(item?.billingName ?? ''),
      paymentContacts: Array.isArray(item?.paymentContacts) ? item.paymentContacts : [],
      voucherType: item?.voucherType ?? 'Recibo',
      cutoffDay: Number(item?.cutoffDay ?? 1),
      companyName: String(item?.companyName ?? ''),
      RFC: String(item?.RFC ?? ''),
      useInvoice: String(item?.useInvoice ?? ''),
      taxRegime: String(item?.taxRegime ?? ''),
      email: String(item?.email ?? ''),
      cp: item?.cp ?? null,
      street: String(item?.street ?? ''),
      streetNumber: String(item?.streetNumber ?? ''),
      suburb: String(item?.suburb ?? ''),
      locality: String(item?.locality ?? ''),
      state: String(item?.state ?? ''),
      country: String(item?.country ?? ''),
      discounts: item?.discounts ?? { monthly: 0, devices: 0, accessories: 0 },
      blacklist: Boolean(item?.blacklist),
      createdAt: item?.createdAt
    };
  }
}