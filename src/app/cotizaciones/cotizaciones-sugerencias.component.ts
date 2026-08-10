import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { ApiService, QuoteProductItem, SuggestionItem, SuggestionResponseItem } from '../services/api.service';
import { CotizacionesDataService } from './cotizaciones-data.service';
import { NgToastService } from 'ng-angular-popup';
import Swal from 'sweetalert2';
import { catchError, forkJoin, of } from 'rxjs';

type ModalMode = 'create' | 'edit';

@Component({
  selector: 'app-cotizaciones-sugerencias',
  templateUrl: './cotizaciones-sugerencias.component.html',
  styleUrl: './cotizaciones-sugerencias.component.scss'
})
export class CotizacionesSugerenciasComponent {
  suggestions: SuggestionItem[] = [];
  loading = false;
  search = '';
  currentPage = 1;
  perPage = 10;
  selectedIds = new Set<string>();
  deletingId: string | null = null;

  modalOpen = false;
  modalMode: ModalMode = 'create';
  saving = false;
  editingId: string | null = null;
  form: FormGroup;

  sidePanelOpen = false;
  selectedForSidebar: SuggestionItem | null = null;

  products: QuoteProductItem[] = [];
  productsMap = new Map<string, QuoteProductItem>();

  actionFilter: '' | 'add' | 'remove' = '';

  constructor(private api: ApiService, private quoteData: CotizacionesDataService, private toast: NgToastService, private fb: FormBuilder) {
    this.form = this.fb.group({
      productId: ['', Validators.required],
      action: ['add', Validators.required],
      description: [''],
      response: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    this.loadSuggestions();
  }

  loadSuggestions(forceRefresh = false): void {
    this.loading = true;

    this.quoteData.getCatalogData(forceRefresh).subscribe({
      next: data => {
        this.suggestions = [...data.suggestions].sort((a, b) => this.createdTime(b) - this.createdTime(a));

        this.products = data.products;

        this.productsMap = new Map(data.products.map(product => [product._id, product]));

        this.currentPage = 1;
        this.clearSelection();
      },
      error: error => {
        console.error('Error al cargar sugerencias:', error);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar las sugerencias', duration: 5000 });
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  private createdTime(item: SuggestionItem): number {
    const date = item.createdAt ? new Date(item.createdAt) : null;
    return date && !isNaN(date.getTime()) ? date.getTime() : 0;
  }

  private clearSelection(): void {
    this.selectedIds.clear();
  }

  openCreateModal(): void {
    this.modalMode = 'create';
    this.editingId = null;
    this.resetForm();
    this.modalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  private resetForm(item?: SuggestionItem): void {
    this.suggestionResponse.clear();

    this.form.reset({
      productId: item?.productId ?? '',
      action: item?.action ?? 'add',
      description: item?.description ?? ''
    });

    const responses = item?.response?.length ? item.response : [{ action: 'add', productId: '' }];
    responses.forEach(response => this.addSuggestionResponse(response));
  }

  addSuggestionResponse(response?: SuggestionResponseItem): void {
    this.suggestionResponse.push(this.fb.group({
      action: [response?.action ?? 'add', Validators.required],
      productId: [response?.productId ?? '', Validators.required]
    }));
  }

  removeSuggestionResponse(index: number): void {
    this.suggestionResponse.removeAt(index);
  }

  getProduct(productId: string): QuoteProductItem | undefined {
    return this.productsMap.get(productId);
  }

  get suggestionResponse(): FormArray {
    return this.form.get('response') as FormArray;
  }

  get selectedItems(): SuggestionItem[] {
    const map = new Map(this.suggestions.map(item => [item._id, item] as const));
    return Array.from(this.selectedIds)
      .map(id => map.get(id))
      .filter((item): item is SuggestionItem => !!item);
  }

  async deleteSelected(): Promise<void> {
    if (this.selectedCount === 0) return;

    const selected = this.selectedItems;
    const html = selected
      .slice(0, 8)
      .map(item => `<div>${item.description}</div>`)
      .join('');

    const result = await Swal.fire({
      title: `¿Eliminar ${selected.length} sugerencias(s)?`,
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
    const requests = selected.map(item =>
      this.api.deleteSuggestion(item._id).pipe(catchError(error => of({ __error: error, id: item._id })))
    );

    forkJoin(requests).subscribe({
      next: (res: any[]) => {
        const failures = res.filter(item => item?.__error).length;
        const success = res.length - failures;

        if (success) {
          this.toast.success({ detail: 'Éxito', summary: `Se eliminaron ${success} sugerencia(s)`, duration: 4000 });
          this.quoteData.clearCache();
          this.refresh();
        }

        if (failures) {
          this.toast.error({ detail: 'Error', summary: `No se pudieron eliminar ${failures} sugerencia(s)`, duration: 6000 });
        }
      },
      error: () => {
        this.toast.error({ detail: 'Error', summary: 'Falló la eliminación de sugerencias', duration: 6000 });
      },
      complete: () => {
        this.deletingId = null;
      }
    });
  }

  get allVisibleSelected(): boolean {
    const visible = this.displayedSuggestions;
    return visible.length > 0 && visible.every(item => this.selectedIds.has(item._id));
  }

  get someVisibleSelected(): boolean {
    const visible = this.displayedSuggestions;
    return visible.some(item => this.selectedIds.has(item._id)) && !this.allVisibleSelected;
  }

  toggleSelectAllVisible(checked: boolean): void {
    if (checked) this.displayedSuggestions.forEach(item => this.selectedIds.add(item._id));
    else this.displayedSuggestions.forEach(item => this.selectedIds.delete(item._id));
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleRowSelection(item: SuggestionItem, checked: boolean): void {
    if (checked) this.selectedIds.add(item._id);
    else this.selectedIds.delete(item._id);
  }

  toggleRowByClick(item: SuggestionItem): void {
    this.toggleRowSelection(item, !this.isSelected(item._id));
  }

  openSidebar(item: SuggestionItem): void {
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

  openEditModal(item: SuggestionItem): void {
    this.modalMode = 'edit';
    this.editingId = item._id;
    this.resetForm(item);
    this.form.enable({ emitEvent: false });
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

  private buildPayload(): Omit<SuggestionItem, '_id' | 'createdAt'> {
    const value = this.form.getRawValue();

    return {
      productId: value.productId,
      action: value.action,
      description: String(value.description ?? '').trim(),
      response: (value.response ?? []).map((item: any) => ({
        action: item.action,
        productId: item.productId
      }))
    };
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning({
        detail: 'Campos incompletos',
        summary: 'Revisa la información requerida',
        duration: 3500
      });
      return;
    }

    const payload = this.buildPayload();
    this.saving = true;

    const request$ = this.modalMode === 'create'
      ? this.api.createSuggestion(payload)
      : this.api.updateSuggestion(this.editingId!, payload);

    request$.subscribe({
      next: () => {
        this.toast.success({
          detail: 'Éxito',
          summary: this.modalMode === 'create' ? 'Sugerencia creada' : 'Sugerencia actualizada',
          duration: 3500
        });

        this.quoteData.clearCache();
        this.closeModal();
        this.sidePanelOpen = false;
        this.refresh();
      },
      error: err => {
        console.error(err);

        this.toast.error({
          detail: 'Error',
          summary: err?.error?.error || err?.error?.message || 'No se pudo guardar la sugerencia',
          duration: 6000
        });

        this.saving = false;
      }
    });
  }

  get title(): string {
    return this.modalMode === 'create' ? 'Nueva sugerencia' : 'Editar sugerencia';
  }

  get filteredSuggestions(): SuggestionItem[] {
    const q = this.normalize(this.search);

    return this.suggestions.filter(item => {
      const productName = this.getProduct(item.productId)?.name ?? '';
      const matchesSearch = !q || this.normalize(item.description).includes(q) || this.normalize(productName).includes(q);
      const matchesAction = !this.actionFilter || item.action === this.actionFilter;

      return matchesSearch && matchesAction;
    });
  }

  get displayedSuggestions(): SuggestionItem[] {
    const start = (this.currentPage - 1) * this.perPage;
    return this.filteredSuggestions.slice(start, start + this.perPage);
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get canViewOrEdit(): boolean {
    return this.selectedCount === 1;
  }

  refresh(): void {
    this.loadSuggestions(true);
    this.currentPage = 1;
    this.selectedIds.clear();
  }

  updateSearch(value: string): void {
    this.search = (value ?? '').trim();
    this.currentPage = 1;
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }

  onPageChange(event: PageEvent): void {
    this.perPage = event.pageSize;
    this.currentPage = event.pageIndex + 1;
  }

  trackById(_index: number, item: SuggestionItem): string {
    return item._id;
  }

  private normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }
}
