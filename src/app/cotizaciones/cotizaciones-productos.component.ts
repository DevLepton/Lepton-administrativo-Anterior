import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { NgToastService } from 'ng-angular-popup';
import Swal from 'sweetalert2';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ApiService, QuoteProductItem, QuoteProductType } from '../services/api.service';
import { CotizacionesDataService } from './cotizaciones-data.service';
import { NgxCurrencyConfig } from 'ngx-currency';

interface ProductTab {
  label: string;
  type: QuoteProductType;
}

type ProductModalMode = 'create' | 'edit';

@Component({
  selector: 'app-cotizaciones-productos',
  templateUrl: './cotizaciones-productos.component.html',
  styleUrl: './cotizaciones-productos.component.scss'
})
export class CotizacionesProductosComponent implements OnInit {
  tabs: ProductTab[] = [
    { label: 'GPS', type: 'GPS' },
    { label: 'Accesorios', type: 'Accesorio' },
    { label: 'Servicios', type: 'Servicio' },
    { label: 'Planes', type: 'Plan' }
  ];

  activeTabIndex = 0;
  products: QuoteProductItem[] = [];
  loading = false;
  search = '';
  currentPage = 1;
  perPage = 25;
  selectedIds = new Set<string>();
  deletingId: string | null = null;

  modalOpen = false;
  modalMode: ProductModalMode = 'create';
  saving = false;
  editingId: string | null = null;
  form: FormGroup;

  discountDisplay = '0.00';

  private originalFormValue: any = null;
  priceDiscountChanged = false;

  currencyOptions: Partial<NgxCurrencyConfig> = {
    align: 'left',
    allowNegative: false,
    allowZero: true,
    decimal: '.',
    precision: 2,
    prefix: '$ ',
    suffix: '',
    thousands: ',',
    nullable: false
  };

  sidePanelOpen = false;
  selectedForSidebar: QuoteProductItem | null = null;

  constructor(private api: ApiService, private quoteData: CotizacionesDataService, private toast: NgToastService, private fb: FormBuilder) {
    this.form = this.fb.group({
      type: ['GPS', Validators.required],
      name: ['', [Validators.required, Validators.maxLength(160)]],
      concept: ['', [Validators.required, Validators.maxLength(160)]],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      priceIVA: [0, [Validators.required, Validators.min(0)]],
      discount: [0, [Validators.min(0), Validators.max(100)]],
      discountPrice: [0, [Validators.min(0)]],
      duration: [''],
      comments: ['']
    });
  }

  ngOnInit(): void {
    this.setupPriceSync();
    this.setupDiscountSync();
    this.setupPriceDiscountCommentValidation();
    this.loadProducts();

    this.form.get('type')?.valueChanges.subscribe(type => {
      const duration = this.form.get('duration');

      if (!duration) return;

      if (type === 'Plan') {
        duration.setValidators([Validators.required]);
      } else {
        duration.clearValidators();
        duration.setValue('', { emitEvent: false });
      }

      duration.updateValueAndValidity({ emitEvent: false });
    });
  }

  get activeType(): QuoteProductType {
    return this.tabs[this.activeTabIndex]?.type ?? 'GPS';
  }

  get filteredProducts(): QuoteProductItem[] {
    const q = this.normalize(this.search);

    return this.products
      .filter(item => item.type === this.activeType)
      .filter(item => !q ||
        this.normalize(item.name).includes(q) ||
        this.normalize(item.concept).includes(q) ||
        this.normalize(item.description).includes(q) ||
        this.normalize(item.comments).includes(q)
      );
  }

  get displayedProducts(): QuoteProductItem[] {
    const start = (this.currentPage - 1) * this.perPage;
    return this.filteredProducts.slice(start, start + this.perPage);
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get canViewOrEdit(): boolean {
    return this.selectedCount === 1;
  }

  get selectedItems(): QuoteProductItem[] {
    const map = new Map(this.products.map(item => [item._id, item] as const));
    return Array.from(this.selectedIds)
      .map(id => map.get(id))
      .filter((item): item is QuoteProductItem => !!item);
  }

  get allVisibleSelected(): boolean {
    const visible = this.displayedProducts;
    return visible.length > 0 && visible.every(item => this.selectedIds.has(item._id));
  }

  get someVisibleSelected(): boolean {
    const visible = this.displayedProducts;
    return visible.some(item => this.selectedIds.has(item._id)) && !this.allVisibleSelected;
  }

  get title(): string {
    return this.modalMode === 'create' ? 'Nuevo producto' : 'Editar producto';
  }

  private normalizeFormValue(value: any): any {
    return {
      type: value.type,
      name: String(value.name ?? '').trim(),
      concept: String(value.concept ?? '').trim(),
      description: String(value.description ?? '').trim(),
      price: Number(value.price ?? 0),
      priceIVA: Number(value.priceIVA ?? 0),
      discount: Number(value.discount ?? 0),
      duration: value.type === 'Plan' ? String(value.duration ?? '').trim() : undefined,
      comments: String(value.comments ?? '').trim()
    };
  }

  private hasFormChanges(): boolean {
    if (!this.originalFormValue) return false;

    const current = this.normalizeFormValue(this.buildPayload());
    const original = this.normalizeFormValue(this.originalFormValue);

    return JSON.stringify(current) !== JSON.stringify(original);
  }

  private updateCommentsValidator(): void {
    const comments = this.form.get('comments');

    if (!comments) return;

    if (this.priceDiscountChanged) {
      comments.setValidators([this.commentsChangeValidator]);
      comments.updateValueAndValidity({ emitEvent: false });
      comments.markAsTouched();
    } else {
      comments.clearValidators();
      comments.updateValueAndValidity({ emitEvent: false });
      comments.markAsUntouched();
    }
  }

  private commentsChangeValidator = () => {
    if (!this.priceDiscountChanged) return null;

    const currentComments = String(this.form.get('comments')?.value ?? '').trim();
    const originalComments = String(this.originalFormValue?.comments ?? '').trim();

    if (!currentComments) {
      return { required: true };
    }

    if (currentComments === originalComments) {
      return { unchanged: true };
    }

    return null;
  };

  get canSave(): boolean {
    if (this.saving || this.form.invalid) return false;

    const name = String(this.form.get('name')?.value ?? '').trim();
    const concept = String(this.form.get('concept')?.value ?? '').trim();

    if (!name || !concept) return false;

    if (this.form.get('type')?.value === 'Plan' && !this.form.get('duration')?.value) {
      return false;
    }

    if (this.modalMode === 'edit') {
      const comments = String(this.form.get('comments')?.value ?? '').trim();
      const originalComments = String(this.originalFormValue?.comments ?? '').trim();

      if (this.priceDiscountChanged && (!comments || comments === originalComments)) {
        return false;
      }

      return this.hasFormChanges();
    }

    return true;
  }
  selectInput(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    input.select();
  }

  loadProducts(forceRefresh = false): void {
    this.loading = true;

    const request$ = forceRefresh
      ? this.quoteData.getProducts(true)
      : this.quoteData.getCatalogData().pipe(map(data => data.products));

    request$.subscribe({
      next: products => {
        this.products = [...products].sort((a, b) => this.createdTime(b) - this.createdTime(a));
        this.currentPage = 1;
        this.clearSelection();
      },
      error: error => {
        console.error('Error al cargar productos de cotización:', error);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los productos', duration: 5000 });
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  refresh(): void {
    this.loadProducts(true);
    this.currentPage = 1;
    this.selectedIds.clear();
  }

  onTabChange(index: number): void {
    this.activeTabIndex = index;
    this.currentPage = 1;
    this.search = '';
    this.closeSidebar();
    this.clearSelection();
  }

  updateSearch(value: string): void {
    this.search = (value ?? '').trim();
    this.currentPage = 1;
  }

  onPageChange(event: PageEvent): void {
    this.perPage = event.pageSize;
    this.currentPage = event.pageIndex + 1;
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleRowSelection(item: QuoteProductItem, checked: boolean): void {
    if (checked) this.selectedIds.add(item._id);
    else this.selectedIds.delete(item._id);
  }

  toggleRowByClick(item: QuoteProductItem): void {
    this.toggleRowSelection(item, !this.isSelected(item._id));
  }

  toggleSelectAllVisible(checked: boolean): void {
    if (checked) this.displayedProducts.forEach(item => this.selectedIds.add(item._id));
    else this.displayedProducts.forEach(item => this.selectedIds.delete(item._id));
  }

  openCreateModal(): void {
    this.modalMode = 'create';
    this.editingId = null;
    this.originalFormValue = null;
    this.priceDiscountChanged = false;

    this.resetForm();

    this.updateCommentsValidator();

    this.form.markAsPristine();
    this.form.markAsUntouched();

    this.modalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  viewSelected(): void {
    if (!this.canViewOrEdit) return;
    this.openSidebar(this.selectedItems[0]);
  }

  editSelected(): void {
    if (!this.canViewOrEdit) return;
    this.openEditModal(this.selectedItems[0]);
  }

  openSidebar(item: QuoteProductItem): void {
    if (this.sidePanelOpen && this.selectedForSidebar?._id === item._id) {
      this.closeSidebar();
      return;
    }

    this.selectedForSidebar = item;
    this.sidePanelOpen = true;
  }

  closeSidebar(): void {
    this.sidePanelOpen = false;
    this.selectedForSidebar = null;
  }

  openEditModal(item: QuoteProductItem): void {
    this.modalMode = 'edit';
    this.editingId = item._id;

    this.resetForm(item);
    this.form.enable({ emitEvent: false });

    this.originalFormValue = this.normalizeFormValue(this.buildPayload());

    this.priceDiscountChanged = false;
    this.updateCommentsValidator();

    this.form.markAsPristine();
    this.form.markAsUntouched();

    this.modalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.modalOpen = false;
    this.saving = false;
    this.editingId = null;
    this.form.enable({ emitEvent: false });
    document.body.style.overflow = '';
  }

  submit(): void {
    if (this.modalMode === 'edit' && this.priceDiscountChanged) {
      const comments = String(this.form.get('comments')?.value ?? '').trim();
      const originalComments = String(this.originalFormValue?.comments ?? '').trim();

      if (!comments || comments === originalComments) {
        this.form.get('comments')?.markAsTouched();
        this.toast.warning({ detail: 'Comentario requerido', summary: 'Debes indicar la razón del cambio de dichos valores', duration: 5000 });

        return;
      }
    }

    if (!this.canSave) {
      this.form.markAllAsTouched();
      this.toast.warning({ detail: 'Campos incompletos', summary: 'Revisa la información requerida', duration: 3500 });

      return;
    }

    const payload = this.buildPayload();

    this.saving = true;
    const request$ = this.modalMode === 'create' ? this.api.createQuoteProduct(payload) : this.api.updateQuoteProduct(this.editingId!, payload);

    request$.subscribe({
      next: () => {
        this.toast.success({ detail: 'Éxito', summary: this.modalMode === 'create' ? 'Producto creado' : 'Producto actualizado', duration: 3500 });
        this.closeModal();
        this.refresh();
      }, error: err => {
        console.error(err);
        const msg = err?.error?.error || err?.error?.message || 'No se pudo guardar el producto';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
        this.saving = false;
      }
    });
  }

  async deleteSelected(): Promise<void> {
    if (this.selectedCount === 0) return;

    const selected = this.selectedItems;

    const html = selected
      .slice(0, 8)
      .map(item => `<div><b>${item.name || '-'}</b> - ${item.type}</div>`)
      .join('');

    const result = await Swal.fire({
      title: `¿Eliminar ${selected.length} producto(s)?`,
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

    this.deletingId = '__bulk__';

    this.api.deleteQuoteProducts(selected.map(item => item._id)).subscribe({
      next: response => {
        this.toast.success({
          detail: 'Éxito',
          summary: response?.message || `Se eliminaron ${selected.length} producto(s)`,
          duration: 4000
        });

        this.refresh();
      },
      error: error => {
        console.error('Error al eliminar productos:', error);

        this.toast.error({
          detail: 'Error',
          summary: error?.error?.error || 'No se pudieron eliminar los productos seleccionados',
          duration: 6000
        });

        this.deletingId = null;
      },
      complete: () => {
        this.deletingId = null;
      }
    });
  }

  trackById(_index: number, item: QuoteProductItem): string {
    return item._id;
  }

  private clearSelection(): void {
    this.selectedIds.clear();
  }

  private resetForm(item?: QuoteProductItem): void {
    const priceIVA = Number(item?.priceIVA ?? 0);
    const discount = Number(item?.discount ?? 0);

    this.form.reset({
      type: item?.type ?? this.activeType,
      name: item?.name ?? '',
      concept: item?.concept ?? '',
      description: item?.description ?? '',
      price: item?.price ?? 0,
      priceIVA,
      discount,
      discountPrice: +(priceIVA * discount / 100).toFixed(2),
      duration: item?.duration ?? '',
      comments: item?.comments ?? ''
    });

    this.updateDiscountDisplay();
  }

  private buildPayload(): Omit<QuoteProductItem, '_id' | 'createdAt'> {
    const value = this.form.getRawValue();

    return {
      type: value.type,
      name: String(value.name ?? '').trim(),
      concept: String(value.concept ?? '').trim(),
      description: String(value.description ?? '').trim(),
      price: Number(value.price ?? 0),
      priceIVA: Number(value.priceIVA ?? 0),
      discount: Number(value.discount ?? 0),
      duration: value.type === 'Plan' ? value.duration : undefined,
      comments: String(value.comments ?? '').trim()
    };
  }

  private createdTime(item: QuoteProductItem): number {
    const date = item.createdAt ? new Date(item.createdAt) : null;
    return date && !isNaN(date.getTime()) ? date.getTime() : 0;
  }

  private normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private setupPriceSync(): void {
    const price = this.form.get('price');
    const priceIVA = this.form.get('priceIVA');

    if (!price || !priceIVA) return;

    // Precio sin IVA -> Precio con IVA
    price.valueChanges.subscribe(value => {
      const base = Number(value || 0);
      const total = +(base * 1.16).toFixed(2);

      priceIVA.setValue(total, { emitEvent: false });

      this.syncDiscountPrice();
    });

    // Precio con IVA -> Precio sin IVA
    priceIVA.valueChanges.subscribe(value => {
      const total = Number(value || 0);
      const base = +(total / 1.16).toFixed(2);

      price.setValue(base, { emitEvent: false });

      this.syncDiscountPrice();
    });
  }

  private updatePriceDiscountChanged(): void {
    if (this.modalMode !== 'edit' || !this.originalFormValue) {
      this.priceDiscountChanged = false;
      return;
    }

    const current = this.normalizeFormValue(this.buildPayload());
    const original = this.normalizeFormValue(this.originalFormValue);

    this.priceDiscountChanged =
      current.price !== original.price ||
      current.priceIVA !== original.priceIVA ||
      current.discount !== original.discount;
  }

  onDiscountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    this.form.get('discount')?.setValue(
      value === '' ? 0 : Number(value),
      { emitEvent: true }
    );

    this.discountDisplay = value;
  }

  onDiscountBlur(): void {
    const value = Number(this.form.get('discount')?.value || 0);
    this.discountDisplay = value.toFixed(2);
  }

  private updateDiscountDisplay(): void {
    const value = Number(this.form.get('discount')?.value || 0);
    this.discountDisplay = value.toFixed(2);
  }

  private syncDiscountPrice(): void {
    const priceIVA = Number(this.form.get('priceIVA')?.value || 0);
    const discount = Number(this.form.get('discount')?.value || 0);

    const discountPrice = +(priceIVA * discount / 100).toFixed(2);

    this.form.get('discountPrice')?.setValue(discountPrice, {
      emitEvent: false
    });
  }

  private setupDiscountSync(): void {
    const discount = this.form.get('discount');
    const discountPrice = this.form.get('discountPrice');

    if (!discount || !discountPrice) return;

    // Descuento % -> Descuento $
    discount.valueChanges.subscribe(value => {
      const percentage = Math.min(100, Math.max(0, Number(value || 0)));
      const priceIVA = Number(this.form.get('priceIVA')?.value || 0);

      if (priceIVA <= 0) {
        discountPrice.setValue(0, { emitEvent: false });
        return;
      }

      const amount = +(priceIVA * percentage / 100).toFixed(2);

      discountPrice.setValue(amount, { emitEvent: false });
    });

    // Descuento $ -> Descuento %
    discountPrice.valueChanges.subscribe(value => {
      const amount = Math.max(0, Number(value || 0));
      const priceIVA = Number(this.form.get('priceIVA')?.value || 0);

      if (priceIVA <= 0) {
        discount.setValue(0, { emitEvent: false });
        this.discountDisplay = '0.00';
        return;
      }

      const percentage = Math.min(100, (amount / priceIVA) * 100);

      // Valor real
      discount.setValue(percentage, { emitEvent: false });

      // Valor visual
      this.discountDisplay = percentage.toFixed(2);
    });
  }

  private setupPriceDiscountCommentValidation(): void {
    ['price', 'priceIVA', 'discount', 'discountPrice'].forEach(field => {
      this.form.get(field)?.valueChanges.subscribe(() => {
        this.updatePriceDiscountChanged();
        this.updateCommentsValidator();
      });
    });

    this.form.get('comments')?.valueChanges.subscribe(() => {
      if (this.priceDiscountChanged) {
        this.form.get('comments')?.updateValueAndValidity({ emitEvent: false });
      }
    });
  }
}
