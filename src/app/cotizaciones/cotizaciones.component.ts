import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import {
  ApiService,
  BankAccountItem,
  BillingClientItem,
  CreateBankAccountPayload,
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

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { CotizacionesPdfService } from '../services/cotizaciones-pdf.service';

type QuoteView = 'list' | 'builder';
type QuoteSection = 'client' | 'products' | 'payment';
type DiscountType = '%' | '$';
type BillableFilter = 'all' | 'billable' | 'nonBillable';

interface QuoteBuilderProduct extends QuoteProduct {
  productId: string;
  type: QuoteProductType;
  lockedAmount?: boolean;
}

interface QuoteDraft {
  activeView?: QuoteView;
  client: any;
  selectedBillingClientId?: string;
  productsForm: any;
  products: QuoteBuilderProduct[];
  payment: any;
  productSearch?: string;
  activeSection?: QuoteSection;
  ignoredSuggestions?: PendingQuoteSuggestion[];
  replicationNotices?: QuoteReplicationNotice[];
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

interface PendingClientDiscount {
  productId: string;
  clientId: string;
  clientName: string;
  categoryLabel: string;
  discountKey: keyof BillingClientItem['discounts'];
  clientDiscount: number;
  productDiscount: number;
}

interface QuoteReplicationNotice {
  productName: string;
  type: QuoteProductType;
  message: string;
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

  isAdminUser = false;

  loading = false;
  builderLoading = false;
  savingQuote = false;
  bankAccountsLoading = false;
  savingBankAccount = false;
  deletingBankAccount = false;
  search = '';
  quoteUsers: string[] = [];
  selectedQuoteUsers: string[] = [];
  billableFilter: BillableFilter = 'all';
  currentPage = 1;
  perPage = 25;
  selectedIds = new Set<string>();
  previewPdfUrl: SafeResourceUrl | null = null;
  previewQuote: QuoteItem | null = null;

  clientForm: FormGroup;
  productsForm: FormGroup;
  paymentForm: FormGroup;
  bankAccountForm: FormGroup;
  leptonForeignForm: FormGroup;
  externalTechnicianForm: FormGroup;

  quoteProducts: QuoteBuilderProduct[] = [];
  productSearch = '';
  productTypeFilter: QuoteProductType | '' = '';
  selectedProductId = '';
  foreignServiceModalOpen = false;
  bankAccountModalOpen = false;
  bankAccountModalMode: 'create' | 'edit' = 'create';
  bankAccountEditingId = '';
  suggestionModalOpen = false;
  clientDiscountModalOpen = false;
  replicationNoticeModalOpen = false;
  activeSuggestion: PendingQuoteSuggestion | null = null;
  activeClientDiscount: PendingClientDiscount | null = null;

  private suggestionQueue: PendingQuoteSuggestion[] = [];
  private clientDiscountQueue: PendingClientDiscount[] = [];

  ignoredSuggestions: PendingQuoteSuggestion[] = [];
  replicationNotices: QuoteReplicationNotice[] = [];
  selectedBillingClientId = '';
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

  bankAccounts: BankAccountItem[] = [];

  private discountAmounts: Record<string, number> = {};

  constructor(private api: ApiService, private authService: AuthService, private quoteData: CotizacionesDataService, private toast: NgToastService, private fb: FormBuilder, private auth: AuthService, private sanitizer: DomSanitizer, private pdfService: CotizacionesPdfService) {
    this.clientForm = this.fb.group({
      clientName: ['', Validators.required],
      companyName: ['', Validators.required],
      place: ['', Validators.required],
      validity: [this.defaultValidityDate(), Validators.required]
    });

    this.productsForm = this.fb.group({
      units: [1, [Validators.required, Validators.min(1)]],
      model: ['', Validators.required],
      billable: [false]
    });

    this.paymentForm = this.fb.group({
      bankAccountId: ['', Validators.required],
      paymentMethodHolder: ['', Validators.required],
      bankName: ['', Validators.required],
      accountNumber: ['', Validators.required],
      CLABE: ['', Validators.required],
      comments: ['']
    });

    this.bankAccountForm = this.fb.group({
      holder: ['', Validators.required],
      bankName: ['', Validators.required],
      accountNumber: ['', Validators.required],
      CLABE: ['', Validators.required]
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
    const role = this.authService.getUserRole();
    this.isAdminUser = role === 'admin';

    this.restoreDraft();
    this.loadQuotes();
    this.loadBuilderCatalogs();
    this.loadBankAccounts();
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
        this.syncQuoteUserFilter();
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

  loadBankAccounts(selectId?: string): void {
    this.bankAccountsLoading = true;

    this.api.getBankAccounts().subscribe({
      next: response => {
        this.bankAccounts = this.extractList(response)
          .map(item => this.mapBankAccount(item))
          .sort((a, b) => a.holder.localeCompare(b.holder, 'es'));

        if (selectId && this.bankAccounts.some(item => item._id === selectId)) {
          this.onBankAccountSelected(selectId);
        } else {
          this.syncPaymentBankAccountSelection();
        }
      },

      error: error => {
        console.error('Error al cargar métodos de pago:', error);
        this.toast.error({
          detail: 'Error',
          summary: 'No se pudieron cargar los métodos de pago',
          duration: 5000
        });
      },

      complete: () => {
        this.bankAccountsLoading = false;
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
        console.error('Error al cargar catálogos del cotizador:', error);
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
    const selectedUsers = new Set(this.selectedQuoteUsers.map(user => this.normalize(user)));

    return this.quotes.filter(item =>
      (
        !q ||
        this.normalize(item.quoteNum).includes(q) ||
        this.normalize(item.clientName).includes(q) ||
        this.normalize(item.companyName).includes(q) ||
        this.normalize(item.place).includes(q)
      ) &&
      selectedUsers.has(this.normalize(this.getQuoteUserName(item))) &&
      (
        this.billableFilter === 'all' ||
        (this.billableFilter === 'billable' && item.billable) ||
        (this.billableFilter === 'nonBillable' && !item.billable)
      )
    );
  }

  get allQuoteUsersSelected(): boolean {
    return this.quoteUsers.length > 0 && this.selectedQuoteUsers.length === this.quoteUsers.length;
  }

  get selectedQuoteUsersLabel(): string {
    if (!this.quoteUsers.length) return 'Sin usuarios';
    if (this.allQuoteUsersSelected) return 'Todos los usuarios';
    if (!this.selectedQuoteUsers.length) return 'Ningun usuario';

    return `${this.selectedQuoteUsers.length} usuario${this.selectedQuoteUsers.length === 1 ? '' : 's'}`;
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
    return this.roundMoney(this.quoteProducts.reduce((sum, item) => sum + (item.priceIVA * item.amount), 0));
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

  get selectedBillingClient(): BillingClientItem | null {
    if (!this.selectedBillingClientId) return null;

    const client = this.billingClients.find(item => item._id === this.selectedBillingClientId);
    if (!client) return null;

    const formClientName = this.clientForm.get('clientName')?.value;
    return this.normalize(formClientName) === this.normalize(client.billingName) ? client : null;
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
    this.selectedBillingClientId = client._id;
    this.clientForm.patchValue({
      clientName: client.billingName,
      companyName: client.companyName || ''
    });
    this.saveDraft();
  }

  displayBillingClient(client: BillingClientItem | string): string {
    if (!client) return '';
    return typeof client === 'string' ? client : client.billingName;
  }

  get selectedBankAccount(): BankAccountItem | null {
    const id = this.paymentForm.get('bankAccountId')?.value;
    return this.bankAccounts.find(item => item._id === id) ?? null;
  }

  onBankAccountSelected(id: string): void {
    const account = this.bankAccounts.find(item => item._id === id);
    if (!account) return;

    this.paymentForm.patchValue({
      bankAccountId: account._id,
      paymentMethodHolder: account.holder,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      CLABE: account.CLABE
    });
  }

  openBankAccountCreateModal(): void {
    this.bankAccountModalMode = 'create';
    this.bankAccountEditingId = '';
    this.bankAccountForm.reset({
      holder: '',
      bankName: '',
      accountNumber: '',
      CLABE: ''
    });
    this.bankAccountModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  openBankAccountEditModal(): void {
    const account = this.selectedBankAccount;
    if (!account) return;

    this.bankAccountModalMode = 'edit';
    this.bankAccountEditingId = account._id;
    this.bankAccountForm.reset({
      holder: account.holder,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      CLABE: account.CLABE
    });
    this.bankAccountModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeBankAccountModal(): void {
    this.bankAccountModalOpen = false;
    this.bankAccountEditingId = '';
    document.body.style.overflow = this.foreignServiceModalOpen || this.suggestionModalOpen || this.clientDiscountModalOpen || this.replicationNoticeModalOpen ? 'hidden' : '';
  }

  submitBankAccount(): void {
    if (this.bankAccountForm.invalid || this.savingBankAccount) {
      this.bankAccountForm.markAllAsTouched();
      return;
    }

    const payload = this.buildBankAccountPayload();
    const request$ = this.bankAccountModalMode === 'create'
      ? this.api.createBankAccount(payload)
      : this.api.updateBankAccount(this.bankAccountEditingId, payload);

    this.savingBankAccount = true;

    request$.subscribe({
      next: response => {
        const saved = this.mapBankAccount(response?.data ?? response?.bankAccount ?? response);
        this.toast.success({
          detail: 'Exito',
          summary: this.bankAccountModalMode === 'create' ? 'Método de pago creado' : 'Método de pago actualizado',
          duration: 3500
        });
        this.closeBankAccountModal();
        this.loadBankAccounts(saved._id);

        if (saved._id) {
          this.paymentForm.patchValue({ bankAccountId: saved._id });
          this.onBankAccountSelected(saved._id);
        }
      },
      error: error => {
        console.error('Error al guardar método de pago:', error);
        this.toast.error({ detail: 'Error', summary: error?.error?.error || error?.error?.message || 'No se pudo guardar el método de pago', duration: 6000 });
      },
      complete: () => {
        this.savingBankAccount = false;
      }
    });
  }

  async deleteSelectedBankAccount(): Promise<void> {
    const account = this.selectedBankAccount;
    if (!account || this.deletingBankAccount) return;

    const result = await Swal.fire({
      title: 'Eliminar método de pago',
      text: `Se eliminará ${account.holder} - ${account.bankName}.`,
      icon: 'warning',
      showCancelButton: true,
      cancelButtonColor: 'var(--color-primary)',
      confirmButtonColor: 'var(--color-danger)',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, eliminar',
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    this.deletingBankAccount = true;

    this.api.deleteBankAccount(account._id).subscribe({
      next: () => {
        this.toast.success({ detail: 'Exito', summary: 'Método de pago eliminado', duration: 3500 });
        this.paymentForm.patchValue({
          bankAccountId: '',
          paymentMethodHolder: '',
          bankName: '',
          accountNumber: '',
          CLABE: ''
        });
        this.loadBankAccounts();
        this.saveDraft();
      },
      error: error => {
        console.error('Error al eliminar método de pago:', error);
        this.toast.error({ detail: 'Error', summary: error?.error?.error || error?.error?.message || 'No se pudo eliminar el método de pago', duration: 6000 });
      },
      complete: () => {
        this.deletingBankAccount = false;
      }
    });
  }

  addSelectedProduct(): void {
    if (!this.selectedProductId) return;
    this.addProductById(this.selectedProductId, true);
    this.selectedProductId = '';
    this.productSearch = '';
  }

  async previewQuotePdf(quote: QuoteItem): Promise<void> {
    const pdf = await this.pdfService.createQuotePdf(quote);
    const dataUri = pdf.output('datauristring');
    this.previewPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(dataUri);
    this.previewQuote = quote;
  }

  closeQuotePreview(): void {
    this.previewPdfUrl = null;
    this.previewQuote = null;
  }

  replicateQuote(quote: QuoteItem): void {
    if (this.builderLoading) {
      this.toast.warning({ detail: 'Cotizador', summary: 'Espera a que terminen de cargar los catálogos', duration: 3000 });
      return;
    }

    this.clearDraft();
    this.activeView = 'builder';
    this.activeSection = 'products';

    this.clientForm.patchValue({
      clientName: quote.clientName ?? '',
      companyName: quote.companyName ?? '',
      place: quote.place ?? '',
      validity: quote.validity ? new Date(quote.validity) : this.defaultValidityDate()
    }, { emitEvent: false });

    const billingClient = this.billingClients.find(client => this.normalize(client.billingName) === this.normalize(quote.clientName));
    this.selectedBillingClientId = billingClient?._id ?? '';

    this.productsForm.patchValue({
      units: quote.units ?? 1,
      model: quote.model ?? '',
      billable: Boolean(quote.billable)
    }, { emitEvent: false });

    const bankAccount = this.bankAccounts.find(account =>
      this.normalize(account.holder) === this.normalize(quote.paymentMethodHolder) &&
      this.normalize(account.bankName) === this.normalize(quote.bankName) &&
      this.normalize(account.accountNumber) === this.normalize(quote.accountNumber) &&
      this.normalize(account.CLABE) === this.normalize(quote.CLABE)
    );

    this.paymentForm.patchValue({
      bankAccountId: bankAccount?._id ?? '',
      paymentMethodHolder: quote.paymentMethodHolder ?? '',
      bankName: quote.bankName ?? '',
      accountNumber: quote.accountNumber ?? '',
      CLABE: quote.CLABE ?? '',
      comments: quote.comments ?? ''
    }, { emitEvent: false });

    const result = this.buildReplicatedProducts(quote.products ?? []);
    this.quoteProducts = result.products;
    this.replicationNotices = result.notices;
    this.rebuildDiscountAmounts();

    if (!this.quoteProducts.length) this.activeSection = 'client';

    this.saveDraft();
    this.toast.info({
      detail: 'Cotizador',
      summary: this.replicationNotices.length
        ? 'Cotización replicada con avisos'
        : 'Cotización replicada con datos actuales',
      duration: 3500
    });
  }

  openReplicationNotices(): void {
    if (!this.replicationNotices.length) return;
    this.replicationNoticeModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeReplicationNotices(): void {
    this.replicationNoticeModalOpen = false;
    document.body.style.overflow = this.foreignServiceModalOpen || this.suggestionModalOpen || this.clientDiscountModalOpen ? 'hidden' : '';
  }

  getReplicationNoticeTooltip(): string {
    if (!this.replicationNotices.length) return '';
    const count = this.replicationNotices.length;
    return `${count} aviso${count === 1 ? '' : 's'} al replicar la cotización`;
  }

  async downloadSelectedQuotes(): Promise<void> {
    const selected = this.selectedQuotes;

    if (!selected.length) {
      this.toast.warning({ detail: 'Sin seleccion', summary: 'Selecciona al menos una cotización', duration: 3000 });
      return;
    }

    for (const quote of selected) {
      const pdf = await this.pdfService.createQuotePdf(quote);
      const fileName = `Cotización-${this.sanitizeFileName(quote.quoteNum || quote._id)}.pdf`;
      pdf.save(fileName);
    }
  }

  async deleteSelectedQuotes(): Promise<void> {
    if (!this.isAdminUser || this.selectedCount === 0) return;

    const selected = this.selectedQuotes;

    const html = selected
      .slice(0, 8)
      .map(item => `<div><b>${item.quoteNum || '-'}</b> - ${item.clientName || '-'}</div>`)
      .join('');

    const result = await Swal.fire({
      title: `¿Eliminar ${selected.length} ${selected.length === 1 ? 'cotización' : 'cotizaciones'}?`,
      html: `
      <div style="text-align:center">
        ${html}
        ${selected.length > 8 ? `<div style="margin-top:.5rem; opacity:.8">...y ${selected.length - 8} más</div>` : ''}
      </div>
      <br>Esta acción no se puede deshacer.
    `,
      icon: 'warning',
      showCancelButton: true,
      cancelButtonColor: 'var(--color-primary)',
      confirmButtonColor: 'var(--color-danger)',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, eliminar',
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    this.api.deleteQuotes(selected.map(item => item._id)).subscribe({
      next: response => {
        this.toast.success({
          detail: 'Éxito',
          summary: response?.message || `Se eliminaron ${selected.length} ${selected.length === 1 ? 'cotización' : 'cotizaciones'}`,
          duration: 4000
        });

        this.loadQuotes(true);
      },
      error: error => {
        console.error('Error al eliminar cotizaciones:', error);

        this.toast.error({
          detail: 'Error',
          summary: error?.error?.error || 'No se pudieron eliminar las cotizaciones',
          duration: 6000
        });
      }
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
    let quoteProduct: QuoteBuilderProduct;

    if (existing) {
      existing.amount += 1;
      this.recalculateProduct(existing);
      quoteProduct = existing;
    } else {
      const item: QuoteBuilderProduct = {
        productId: product._id,
        type: product.type,
        name: product.name,
        concept: product.concept ?? '',
        description: product.description ?? '',
        price: Number(product.price ?? 0),
        priceIVA: Number(product.priceIVA ?? 0),
        discount: Number(product.discount ?? 0),
        discountType: '%',
        amount: 1,
        total: 0
      };

      this.discountAmounts[item.productId] = this.roundMoney(
        Number(item.priceIVA || 0) * (Number(item.discount || 0) / 100)
      );

      this.recalculateProduct(item);
      this.quoteProducts.push(item);
      quoteProduct = item;
    }

    if (applySuggestion) {
      this.promptClientDiscount(quoteProduct);
      this.promptSuggestions(productId, 'add');
    }
    this.saveDraft();
  }

  removeProduct(productId: string, applySuggestion = true): void {
    this.quoteProducts = this.quoteProducts.filter(item => item.productId !== productId);
    delete this.discountAmounts[productId];
    this.ignoredSuggestions = this.ignoredSuggestions.filter(item => !item.iconProductIds.includes(productId));
    this.clientDiscountQueue = this.clientDiscountQueue.filter(item => item.productId !== productId);

    if (this.activeClientDiscount?.productId === productId) {
      this.closeClientDiscountModal();
    }

    if (applySuggestion) this.promptSuggestions(productId, 'remove');

    this.saveDraft();
  }

  updateProductAmount(item: QuoteBuilderProduct, value: number | null): void {
    if (item.lockedAmount) {
      item.amount = 1;
    } else {
      item.amount = Math.max(1, Number(value || 1));
    }

    this.recalculateProduct(item);
    this.saveDraft();
  }

  updateProductDiscount(item: QuoteBuilderProduct, value: number | null): void {
    const discount = Number(value);
    item.discount = Number.isFinite(discount) && discount >= 0 ? discount : 0;
    this.recalculateProduct(item);
    this.saveDraft();
  }

  updateProductDiscountType(item: QuoteBuilderProduct, value: DiscountType): void {
    item.discountType = value;
    this.recalculateProduct(item);
    this.saveDraft();
  }

  getProductDiscountAmount(item: QuoteBuilderProduct): number {
    return this.discountAmounts[item.productId] ?? 0;
  }

  updateProductDiscountPercent(item: QuoteBuilderProduct, value: number | null): void {
    const percent = Math.min(100, Math.max(0, Number(value || 0)));
    const priceIVA = Number(item.priceIVA || 0);

    item.discount = percent;
    item.discountType = '%';
    this.discountAmounts[item.productId] = this.roundMoney(priceIVA * (percent / 100));

    this.recalculateProduct(item);
    this.saveDraft();
  }

  // updateProductDiscountAmount(item: QuoteBuilderProduct, value: number | null): void {
  //   const discountAmount = Math.max(0, Number(value ?? 0));
  //   const priceIVA = Number(item.priceIVA || 0);

  //   this.discountAmounts[item.productId] = discountAmount;
  //   item.discount = priceIVA > 0 ? this.roundMoney((discountAmount * 100) / priceIVA) : 0;
  //   item.discountType = '%';

  //   this.recalculateProduct(item);
  //   this.saveDraft();
  // }

  updateProductDiscountAmount(item: QuoteBuilderProduct, value: number | null): void {
    const discountAmount = Math.max(0, Number(value ?? 0));
    const priceIVA = Number(item.priceIVA || 0);

    this.discountAmounts[item.productId] = discountAmount;

    // Conservar toda la precisión del porcentaje.
    item.discount = priceIVA > 0 ? (discountAmount * 100) / priceIVA : 0;

    item.discountType = '%';

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
        this.toast.success({ detail: 'Exito', summary: 'Cotización creada correctamente', duration: 3500 });
        this.clearDraft();
        this.activeView = 'list';
        this.loadQuotes(true);
      },
      error: error => {
        console.error('Error al crear cotización:', error);
        const msg = error?.error?.error || error?.error?.message || 'No se pudo crear la cotización';
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

  updateQuoteUserFilter(value: string[]): void {
    this.selectedQuoteUsers = Array.isArray(value) ? value : [];
    this.currentPage = 1;
  }

  selectAllQuoteUsers(): void {
    this.selectedQuoteUsers = [...this.quoteUsers];
    this.currentPage = 1;
  }

  clearQuoteUsers(): void {
    this.selectedQuoteUsers = [];
    this.currentPage = 1;
  }

  updateBillableFilter(value: BillableFilter): void {
    this.billableFilter = value;
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

  getClientDiscountProductName(item: PendingClientDiscount | null): string {
    return item ? this.getProductName(item.productId) : '';
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
    this.showNextClientDiscount();
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

  closeClientDiscountModal(): void {
    this.clientDiscountModalOpen = false;
    this.activeClientDiscount = null;
    document.body.style.overflow = this.foreignServiceModalOpen ? 'hidden' : '';
    this.showNextClientDiscount();
    this.showNextSuggestion();
  }

  applyActiveClientDiscount(): void {
    if (!this.activeClientDiscount) return;

    const item = this.quoteProducts.find(product => product.productId === this.activeClientDiscount?.productId);
    if (item) {
      this.updateProductDiscountPercent(item, this.activeClientDiscount.clientDiscount);
    }

    this.closeClientDiscountModal();
  }

  ignoreActiveClientDiscount(): void {
    if (!this.activeClientDiscount) return;
    this.closeClientDiscountModal();
  }

  selectInput(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    input.select();
  }

  private buildQuotePayload(): Omit<QuoteItem, 'userName' | '_id' | 'quoteNum' | 'createdAt'> {
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
        concept: item.concept ?? '',
        description: item.description ?? '',
        type: item.type,
        price: item.price,
        priceIVA: item.priceIVA,
        discount: item.discount,
        discountType: '%',
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
      billable: Boolean(products.billable),
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
    if (
      this.suggestionModalOpen ||
      this.clientDiscountModalOpen ||
      this.activeSuggestion ||
      this.activeClientDiscount ||
      !this.suggestionQueue.length
    ) return;

    this.activeSuggestion = this.suggestionQueue.shift() ?? null;
    this.suggestionModalOpen = !!this.activeSuggestion;

    if (this.suggestionModalOpen) document.body.style.overflow = 'hidden';
  }

  private promptClientDiscount(item: QuoteBuilderProduct): void {
    const client = this.selectedBillingClient;
    const discountKey = this.getDiscountKeyByProductType(item.type);
    if (!client || !discountKey) return;

    const clientDiscount = this.normalizePercent(client.discounts?.[discountKey]);
    const productDiscount = this.normalizePercent(item.discount);
    if (clientDiscount <= 0 || clientDiscount === productDiscount) return;

    const alreadyPending = [this.activeClientDiscount, ...this.clientDiscountQueue].some(pending =>
      pending?.productId === item.productId &&
      pending?.clientId === client._id &&
      pending?.discountKey === discountKey &&
      pending?.clientDiscount === clientDiscount
    );
    if (alreadyPending) return;

    this.clientDiscountQueue.push({
      productId: item.productId,
      clientId: client._id,
      clientName: client.billingName,
      categoryLabel: this.getDiscountCategoryLabel(discountKey),
      discountKey,
      clientDiscount,
      productDiscount
    });

    this.showNextClientDiscount();
  }

  private showNextClientDiscount(): void {
    if (
      this.clientDiscountModalOpen ||
      this.suggestionModalOpen ||
      this.activeClientDiscount ||
      this.activeSuggestion ||
      !this.clientDiscountQueue.length
    ) return;

    this.activeClientDiscount = this.clientDiscountQueue.shift() ?? null;
    this.clientDiscountModalOpen = !!this.activeClientDiscount;

    if (this.clientDiscountModalOpen) document.body.style.overflow = 'hidden';
  }

  private buildReplicatedProducts(products: QuoteProduct[]): { products: QuoteBuilderProduct[]; notices: QuoteReplicationNotice[] } {
    const replicated: QuoteBuilderProduct[] = [];
    const notices: QuoteReplicationNotice[] = [];

    products.forEach((source, index) => {
      const type = this.resolveQuoteProductType(source);

      if (type === 'Servicio') {
        const service = this.buildReplicatedForeignService(source, index, notices);
        if (service) replicated.push(service);
        return;
      }

      const catalogProduct = this.findCatalogProduct(source.name, type);
      if (!catalogProduct) {
        notices.push({
          productName: source.name || 'Producto sin nombre',
          type,
          message: `No se encontró en la lista general de productos ${type}.`
        });
        return;
      }

      const item = this.buildQuoteProductFromCatalog(catalogProduct, source.amount);
      this.addReplicationUpdateNotices(source, item, notices);
      replicated.push(item);
    });

    return { products: replicated, notices };
  }

  private resolveQuoteProductType(product: QuoteProduct): QuoteProductType {
    const knownTypes: QuoteProductType[] = ['GPS', 'Accesorio', 'Plan', 'Servicio'];
    if (knownTypes.includes(product.type)) return product.type;

    const catalogMatch = this.products.find(item => this.sameName(item.name, product.name));
    return catalogMatch?.type ?? 'Servicio';
  }

  private findCatalogProduct(name: string, type: QuoteProductType): QuoteProductItem | null {
    return this.products.find(item => item.type === type && this.sameName(item.name, name)) ?? null;
  }

  private buildQuoteProductFromCatalog(product: QuoteProductItem, amount: number | null | undefined): QuoteBuilderProduct {
    const item: QuoteBuilderProduct = {
      productId: product._id,
      type: product.type,
      name: product.name,
      concept: product.concept ?? '',
      description: product.description ?? '',
      price: Number(product.price ?? 0),
      priceIVA: Number(product.priceIVA ?? 0),
      discount: Number(product.discount ?? 0),
      discountType: '%',
      amount: Math.max(1, Number(amount || 1)),
      total: 0
    };

    this.recalculateProduct(item);
    return item;
  }

  private buildReplicatedForeignService(source: QuoteProduct, index: number, notices: QuoteReplicationNotice[]): QuoteBuilderProduct | null {
    const place = this.findForeignServicePlace(source.name);
    if (!place) {
      notices.push({
        productName: source.name || 'Servicio sin nombre',
        type: 'Servicio',
        message: 'Verifica que el precio final sea correcto.'
      });
      return null;
    }

    const item: QuoteBuilderProduct = {
      productId: `replicated-foreign-${place._id}-${index}`,
      type: 'Servicio',
      name: `Servicio foráneo realizado por Leptón en ${place.place}`,
      concept: `Servicio foráneo realizado por Leptón en ${place.place}`,
      description: source.description ?? '',
      price: Number(source.price ?? 0),
      priceIVA: Number(source.priceIVA ?? 0),
      discount: Number(source.discount ?? 0),
      discountType: '%',
      amount: Math.max(1, Number(source.amount || 1)),
      total: 0,
      lockedAmount: true
    };

    this.recalculateProduct(item);
    notices.push({
      productName: source.name || item.name,
      type: 'Servicio',
      message: `Verifica que el precio final sea correcto.`
    });

    return item;
  }

  private findForeignServicePlace(name: string): TravelExpenseItem | null {
    const normalizedName = this.normalizeLookup(name);
    return this.travelExpenses.find(item => normalizedName.includes(this.normalizeLookup(item.place))) ?? null;
  }

  private displayPercent(value: unknown): string {
  return Number(value || 0).toFixed(2);
}

  private addReplicationUpdateNotices(source: QuoteProduct, item: QuoteBuilderProduct, notices: QuoteReplicationNotice[]): void {
    const priceChanged = this.roundMoney(source.price) !== this.roundMoney(item.price) || this.roundMoney(source.priceIVA) !== this.roundMoney(item.priceIVA);
    const discountChanged = this.normalizePercent(source.discount) !== this.normalizePercent(item.discount);

    if (!priceChanged && !discountChanged) return;

    const changes = [
      priceChanged ? `el precio $${this.roundMoney(source.priceIVA)} -> $${this.roundMoney(item.priceIVA)} con IVA` : '',
      discountChanged ? `el descuento ${this.displayPercent(source.discount)}% -> ${this.displayPercent(item.discount)}%` : ''
    ].filter(Boolean).join(', ');

    notices.push({
      productName: source.name || item.name,
      type: item.type,
      message: `Se actualizó ${changes}.`
    });
  }

  private rebuildDiscountAmounts(): void {
    this.discountAmounts = {};
    this.quoteProducts.forEach(item => {
      this.discountAmounts[item.productId] = this.roundMoney(
        Number(item.priceIVA || 0) * (Number(item.discount || 0) / 100)
      );
    });
  }

  private sameName(a: string, b: string): boolean {
    return this.normalizeLookup(a) === this.normalizeLookup(b);
  }

  private getDiscountKeyByProductType(type: QuoteProductType): keyof BillingClientItem['discounts'] | null {
    if (type === 'GPS') return 'devices';
    if (type === 'Accesorio') return 'accessories';
    if (type === 'Plan') return 'monthly';
    return null;
  }

  private getDiscountCategoryLabel(key: keyof BillingClientItem['discounts']): string {
    if (key === 'devices') return 'GPS';
    if (key === 'accessories') return 'Accesorios';
    return 'Planes';
  }

  // private normalizePercent(value: unknown): number {
  //   return this.roundMoney(Math.min(100, Math.max(0, Number(value || 0))));
  // }

  private normalizePercent(value: unknown): number {
    return Math.min(100, Math.max(0, Number(value || 0)));
  }

  private recalculateProduct(item: QuoteBuilderProduct): void {
    const amount = item.lockedAmount ? 1 : Math.max(1, Number(item.amount || 1));
    const gross = Number(item.priceIVA || 0) * amount;
    const discountPercent = Math.min(100, Math.max(0, Number(item.discount || 0)));
    const discountAmount = gross * (discountPercent / 100);

    item.amount = amount;
    item.discount = discountPercent;
    item.discountType = '%';
    item.total = this.roundMoney(Math.max(0, gross - discountAmount));
  }

  private buildLeptonForeignProduct(): QuoteBuilderProduct {
    const place = this.selectedTravelExpense?.place ?? '';
    const price = this.leptonForeignSubtotal;

    const item: QuoteBuilderProduct = {
      productId: `foreign-lepton-${Date.now()}`,
      type: 'Servicio',
      name: `Servicio foráneo realizado por Leptón en ${place}`,
      concept: `Servicio foráneo realizado por Leptón en ${place}`,
      description: '',
      price: this.roundMoney(price / 1.16),
      priceIVA: this.roundMoney(price),
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
      name: 'Servicio técnico realizado por instalador certificado',
      concept: 'Servicio técnico realizado por instalador certificado',
      description: '',
      price: this.roundMoney(price / 1.16),
      priceIVA: this.roundMoney(price),
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

  private syncPaymentBankAccountSelection(): void {
    const currentId = this.paymentForm.get('bankAccountId')?.value;
    if (currentId && this.bankAccounts.some(item => item._id === currentId)) {
      this.onBankAccountSelected(currentId);
      return;
    }

    const payment = this.paymentForm.getRawValue();
    const account = this.bankAccounts.find(item =>
      this.normalize(item.holder) === this.normalize(payment.paymentMethodHolder) &&
      this.normalize(item.bankName) === this.normalize(payment.bankName) &&
      this.normalize(item.accountNumber) === this.normalize(payment.accountNumber) &&
      this.normalize(item.CLABE) === this.normalize(payment.CLABE)
    );

    if (account) {
      this.paymentForm.patchValue({ bankAccountId: account._id }, { emitEvent: false });
    }
  }

  private buildBankAccountPayload(): CreateBankAccountPayload {
    const value = this.bankAccountForm.getRawValue();

    return {
      holder: String(value.holder ?? '').trim(),
      bankName: String(value.bankName ?? '').trim(),
      accountNumber: String(value.accountNumber ?? '').trim(),
      CLABE: String(value.CLABE ?? '').trim()
    };
  }

  private setupDraftPersistence(): void {
    this.clientForm.get('clientName')?.valueChanges.subscribe(value => {
      const selected = this.billingClients.find(item => item._id === this.selectedBillingClientId);
      if (selected && this.normalize(value) !== this.normalize(selected.billingName)) {
        this.selectedBillingClientId = '';
      }
    });
    this.clientForm.valueChanges.subscribe(() => this.saveDraft());
    this.productsForm.valueChanges.subscribe(() => this.saveDraft());
    this.paymentForm.valueChanges.subscribe(() => this.saveDraft());
  }

  private saveDraft(): void {
    const draft: QuoteDraft = {
      activeView: this.activeView,
      client: this.clientForm.getRawValue(),
      selectedBillingClientId: this.selectedBillingClientId,
      productsForm: this.productsForm.getRawValue(),
      products: this.quoteProducts,
      payment: this.paymentForm.getRawValue(),
      productSearch: this.productSearch,
      activeSection: this.activeSection,
      ignoredSuggestions: this.ignoredSuggestions,
      replicationNotices: this.replicationNotices
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
          this.discountAmounts[product.productId] = this.roundMoney(
            Number(product.priceIVA || 0) * (Number(product.discount || 0) / 100)
          );
          this.recalculateProduct(product);
          return product;
        })
        : [];

      this.productSearch = draft.productSearch ?? '';
      this.selectedBillingClientId = draft.selectedBillingClientId ?? '';
      this.activeSection = draft.activeSection ?? 'client';
      this.activeView = draft.activeView ?? 'list';
      this.ignoredSuggestions = Array.isArray(draft.ignoredSuggestions) ? draft.ignoredSuggestions : [];
      this.replicationNotices = Array.isArray(draft.replicationNotices) ? draft.replicationNotices : [];
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
      model: '',
      billable: false,
    }, { emitEvent: false });

    this.paymentForm.reset({
      bankAccountId: '',
      paymentMethodHolder: '',
      bankName: '',
      accountNumber: '',
      CLABE: '',
      comments: ''
    }, { emitEvent: false });

    this.quoteProducts = [];
    this.productSearch = '';
    this.productTypeFilter = '';
    this.selectedProductId = '';
    this.ignoredSuggestions = [];
    this.replicationNotices = [];
    this.suggestionQueue = [];
    this.clientDiscountQueue = [];
    this.activeSuggestion = null;
    this.activeClientDiscount = null;
    this.suggestionModalOpen = false;
    this.clientDiscountModalOpen = false;
    this.replicationNoticeModalOpen = false;
    this.bankAccountModalOpen = false;
    this.bankAccountEditingId = '';
    this.selectedBillingClientId = '';
    this.activeSection = 'client';
    localStorage.removeItem(this.draftKey);
  }

  async previewBuilderQuote(): Promise<void> {
    if (!this.quoteComplete) {
      this.clientForm.markAllAsTouched();
      this.productsForm.markAllAsTouched();
      this.paymentForm.markAllAsTouched();
      this.toast.warning({ detail: 'Campos incompletos', summary: 'Completa todas las secciones', duration: 3500 });
      return;
    }

    const payload = this.buildQuotePayload();

    const previewQuote: QuoteItem = {
      ...payload,
      _id: 'preview',
      quoteNum: 'PREVISUALIZACIÓN',
      userName: '',
      createdAt: new Date().toISOString()
    } as QuoteItem;

    await this.previewQuotePdf(previewQuote);
  }

  private sanitizeFileName(value: string): string {
    return String(value || 'cotizacion').replace(/[\\/:*?"<>|]+/g, '-').trim();
  }

  private clearSelection(): void {
    this.selectedIds.clear();
  }

  private syncQuoteUserFilter(): void {
    const previousSelected = new Set(this.selectedQuoteUsers.map(user => this.normalize(user)));
    const hadAllSelected = !this.quoteUsers.length || this.selectedQuoteUsers.length === this.quoteUsers.length;

    this.quoteUsers = Array.from(
      new Set(this.quotes.map(item => this.getQuoteUserName(item)))
    ).sort((a, b) => a.localeCompare(b, 'es'));

    this.selectedQuoteUsers = hadAllSelected
      ? [...this.quoteUsers]
      : this.quoteUsers.filter(user => previousSelected.has(this.normalize(user)));
  }

  private getQuoteUserName(item: QuoteItem): string {
    return String(item.userName || 'Sin usuario').trim() || 'Sin usuario';
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

  private normalizeLookup(value: unknown): string {
    return this.normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
    if (Array.isArray(response?.bankAccounts)) return response.bankAccounts;
    if (Array.isArray(response)) return response;
    return [];
  }

  private mapBankAccount(item: any): BankAccountItem {
    return {
      _id: String(item?._id ?? item?.id ?? ''),
      holder: String(item?.holder ?? ''),
      bankName: String(item?.bankName ?? ''),
      accountNumber: String(item?.accountNumber ?? ''),
      CLABE: String(item?.CLABE ?? '')
    };
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
