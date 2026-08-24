import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { NgToastService } from 'ng-angular-popup';
import Swal from 'sweetalert2';
import { catchError, forkJoin, map, of } from 'rxjs';
import {
  ApiService,
  ForeignTechnicianItem,
  TravelExpenseExtraItem,
  TravelExpenseItem
} from '../services/api.service';
import { CotizacionesDataService } from './cotizaciones-data.service';
import { NgxCurrencyConfig } from 'ngx-currency';

type TechnicianModalMode = 'create' | 'edit';
type TravelExpenseModalMode = 'create' | 'edit';

@Component({
  selector: 'app-cotizaciones-foraneos',
  templateUrl: './cotizaciones-foraneos.component.html',
  styleUrl: './cotizaciones-foraneos.component.scss'
})
export class CotizacionesForaneosComponent implements OnInit {
  activeTabIndex = 0;
  tabs = ['Técnicos foráneos', 'Viáticos', 'Extras'];

  technicians: ForeignTechnicianItem[] = [];
  travelExpenses: TravelExpenseItem[] = [];
  travelExpenseExtras: TravelExpenseExtraItem[] = [];
  loading = false;
  search = '';
  currentPage = 1;
  perPage = 10;
  selectedIds = new Set<string>();
  deletingId: string | null = null;

  modalOpen = false;
  modalMode: TechnicianModalMode = 'create';
  saving = false;
  editingId: string | null = null;
  form: FormGroup;

  travelExpenseModalOpen = false;
  travelExpenseModalMode: TravelExpenseModalMode = 'create';
  travelExpenseSaving = false;
  travelExpenseEditingId: string | null = null;
  travelExpenseForm: FormGroup;

  extraForm: FormGroup;
  extraSaving = false;

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
  selectedForSidebar: ForeignTechnicianItem | null = null;
  selectedTravelExpenseForSidebar: TravelExpenseItem | null = null;

  constructor(
    private api: ApiService,
    private quoteData: CotizacionesDataService,
    private toast: NgToastService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      type: ['Foráneo', Validators.required],
      name: ['', [Validators.required, Validators.maxLength(160)]],
      cel: ['', [Validators.required, Validators.minLength(10), Validators.pattern(/^\d{10,}$/)]],
      bill: [false],
      city: [''],
      ownLocal: [false],
      address: [''],
      installationPrice: [0, [Validators.min(0)]],
      inspectionFee: [0, [Validators.min(0)]],
      withdrawalPrice: [0, [Validators.min(0)]],
      priceFalseReversal: [0, [Validators.min(0)]],
      travelExpensesPrice: [0, [Validators.min(0)]],
      transferPrice: [0, [Validators.min(0)]],
      comments: ['']
    });

    this.travelExpenseForm = this.fb.group({
      place: ['', [Validators.required, Validators.maxLength(160)]],
      km: [0, [Validators.required, Validators.min(0)]],
      booths: this.fb.array([])
    });

    this.extraForm = this.fb.group({
      kmRate: [0, [Validators.required, Validators.min(0)]],
      lodging: [0, [Validators.required, Validators.min(0)]],
      breakfast: [0, [Validators.required, Validators.min(0)]],
      lunch: [0, [Validators.required, Validators.min(0)]],
      dinner: [0, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.loadCatalog();
  }

  get filteredTechnicians(): ForeignTechnicianItem[] {
    const q = this.normalize(this.search);

    return this.technicians
      .filter(item => this.normalize(item.type).startsWith('for'))
      .filter(item => !q ||
        this.normalize(item.name).includes(q) ||
        this.normalize(item.cel).includes(q) ||
        this.normalize(item.city).includes(q) ||
        this.normalize(item.address).includes(q) ||
        this.normalize(item.comments).includes(q)
      );
  }

  get displayedTechnicians(): ForeignTechnicianItem[] {
    const start = (this.currentPage - 1) * this.perPage;
    return this.filteredTechnicians.slice(start, start + this.perPage);
  }

  get filteredTravelExpenses(): TravelExpenseItem[] {
    const q = this.normalize(this.search);

    return this.travelExpenses.filter(item => !q ||
      this.normalize(item.place).includes(q) ||
      this.normalize(item.km).includes(q) ||
      item.booths.some(booth =>
        this.normalize(booth.name).includes(q) ||
        this.normalize(booth.cost).includes(q)
      )
    );
  }

  get displayedTravelExpenses(): TravelExpenseItem[] {
    const start = (this.currentPage - 1) * this.perPage;
    return this.filteredTravelExpenses.slice(start, start + this.perPage);
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get canViewOrEdit(): boolean {
    return this.selectedCount === 1;
  }

  get selectedItems(): ForeignTechnicianItem[] {
    const map = new Map(this.technicians.map(item => [item._id, item] as const));
    return Array.from(this.selectedIds)
      .map(id => map.get(id))
      .filter((item): item is ForeignTechnicianItem => !!item);
  }

  get selectedTravelExpenseItems(): TravelExpenseItem[] {
    const map = new Map(this.travelExpenses.map(item => [item._id, item] as const));
    return Array.from(this.selectedIds)
      .map(id => map.get(id))
      .filter((item): item is TravelExpenseItem => !!item);
  }

  get allVisibleSelected(): boolean {
    const visible = this.activeTabIndex === 1 ? this.displayedTravelExpenses : this.displayedTechnicians;
    return visible.length > 0 && visible.every(item => this.selectedIds.has(item._id));
  }

  get someVisibleSelected(): boolean {
    const visible = this.activeTabIndex === 1 ? this.displayedTravelExpenses : this.displayedTechnicians;
    return visible.some(item => this.selectedIds.has(item._id)) && !this.allVisibleSelected;
  }

  get title(): string {
    return this.modalMode === 'create' ? 'Nuevo técnico foráneo' : 'Editar técnico foráneo';
  }

  get travelExpenseTitle(): string {
    return this.travelExpenseModalMode === 'create' ? 'Nuevo viático' : 'Editar viático';
  }

  get boothsFormArray(): FormArray {
    return this.travelExpenseForm.get('booths') as FormArray;
  }

  get currentExtra(): TravelExpenseExtraItem | null {
    return this.travelExpenseExtras[0] ?? null;
  }

  get mealsTotal(): number {
    const value = this.extraForm.getRawValue();
    return Number(value.breakfast ?? 0) + Number(value.lunch ?? 0) + Number(value.dinner ?? 0);
  }

  selectInput(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    input.select();
  }

  loadCatalog(forceRefresh = false): void {
    this.loading = true;

    const request$ = this.getCatalogRequest(forceRefresh);

    request$.subscribe({
      next: data => {
        const travelExpenses = data.travelExpenses ?? [];
        const travelExpenseExtras = data.travelExpenseExtras ?? [];

        this.technicians = data.foreignTechnicians;
        this.travelExpenses = [...travelExpenses].sort((a, b) => this.createdTime(b) - this.createdTime(a));
        this.travelExpenseExtras = [...travelExpenseExtras];
        this.resetExtraForm(this.currentExtra ?? undefined);
        this.currentPage = 1;
        this.clearSelection();
        this.closeSidebar();
      },
      error: error => {
        console.error('Error al cargar catalogos de foráneos:', error);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los datos de foráneos', duration: 5000 });
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  refresh(): void {
    this.loadCatalog(true);
    this.currentPage = 1;
    this.selectedIds.clear();
  }

  private getCatalogRequest(forceRefresh = false) {
    if (!forceRefresh) return this.quoteData.getCatalogData();

    if (this.activeTabIndex === 1) {
      return this.quoteData.getTravelExpenses(true).pipe(map(travelExpenses => ({
        foreignTechnicians: this.technicians,
        travelExpenses,
        travelExpenseExtras: this.travelExpenseExtras
      })));
    }

    if (this.activeTabIndex === 2) {
      return this.quoteData.getTravelExpenseExtras(true).pipe(map(travelExpenseExtras => ({
        foreignTechnicians: this.technicians,
        travelExpenses: this.travelExpenses,
        travelExpenseExtras
      })));
    }

    return this.quoteData.getForeignTechnicians(true).pipe(map(foreignTechnicians => ({
      foreignTechnicians,
      travelExpenses: this.travelExpenses,
      travelExpenseExtras: this.travelExpenseExtras
    })));
  }

  private loadTechnicians(forceRefresh = false): void {
    this.loading = true;

    this.quoteData.getForeignTechnicians(forceRefresh).subscribe({
      next: technicians => {
        this.technicians = technicians;
        this.currentPage = 1;
        this.clearSelection();
        this.closeSidebar();
      },
      error: error => {
        console.error('Error al cargar técnicos foráneos:', error);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los técnicos', duration: 5000 });
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  private loadTravelExpenses(forceRefresh = false): void {
    this.loading = true;

    this.quoteData.getTravelExpenses(forceRefresh).subscribe({
      next: travelExpenses => {
        this.travelExpenses = [...travelExpenses].sort((a, b) => this.createdTime(b) - this.createdTime(a));
        this.currentPage = 1;
        this.clearSelection();
        this.closeSidebar();
      },
      error: error => {
        console.error('Error al cargar viáticos:', error);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los viáticos', duration: 5000 });
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  private loadTravelExpenseExtras(forceRefresh = false): void {
    this.loading = true;

    this.quoteData.getTravelExpenseExtras(forceRefresh).subscribe({
      next: travelExpenseExtras => {
        this.travelExpenseExtras = [...travelExpenseExtras];
        this.resetExtraForm(this.currentExtra ?? undefined);
        this.currentPage = 1;
        this.clearSelection();
      },
      error: error => {
        console.error('Error al cargar extras de viaticos:', error);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los extras', duration: 5000 });
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  onTabChange(index: number): void {
    this.activeTabIndex = index;
    this.currentPage = 1;
    this.search = '';
    this.clearSelection();
    this.closeSidebar();
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

  toggleRowSelection(item: { _id: string }, checked: boolean): void {
    if (checked) this.selectedIds.add(item._id);
    else this.selectedIds.delete(item._id);
  }

  toggleRowByClick(item: { _id: string }): void {
    this.toggleRowSelection(item, !this.isSelected(item._id));
  }

  toggleSelectAllVisible(checked: boolean): void {
    const visible = this.activeTabIndex === 1 ? this.displayedTravelExpenses : this.displayedTechnicians;

    if (checked) visible.forEach(item => this.selectedIds.add(item._id));
    else visible.forEach(item => this.selectedIds.delete(item._id));
  }

  openSidebar(item: ForeignTechnicianItem): void {
    if (this.sidePanelOpen && this.selectedForSidebar?._id === item._id) {
      this.closeSidebar();
      return;
    }

    const technician = this.technicians.find(t => t._id === item._id);

    this.selectedForSidebar = technician ?? item;
    this.selectedTravelExpenseForSidebar = null;
    this.sidePanelOpen = true;
  }

  openTravelExpenseSidebar(item: TravelExpenseItem): void {
    if (this.sidePanelOpen && this.selectedTravelExpenseForSidebar?._id === item._id) {
      this.closeSidebar();
      return;
    }

    const expense = this.travelExpenses.find(t => t._id === item._id);

    this.selectedForSidebar = null;
    this.selectedTravelExpenseForSidebar = expense ?? item;
    this.sidePanelOpen = true;
  }

  closeSidebar(): void {
    this.sidePanelOpen = false;
    this.selectedForSidebar = null;
    this.selectedTravelExpenseForSidebar = null;
  }

  openCreateModal(): void {
    this.modalMode = 'create';
    this.editingId = null;
    this.resetForm();
    this.modalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  viewSelected(): void {
    if (!this.canViewOrEdit) return;

    if (this.activeTabIndex === 1) {
      this.openTravelExpenseSidebar(this.selectedTravelExpenseItems[0]);
      return;
    }

    this.openSidebar(this.selectedItems[0]);
  }

  editSelected(): void {
    if (!this.canViewOrEdit) return;

    if (this.activeTabIndex === 1) {
      this.openTravelExpenseEditModal(this.selectedTravelExpenseItems[0]);
      return;
    }

    this.openEditModal(this.selectedItems[0]);
  }

  openEditModal(item: ForeignTechnicianItem): void {
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

  openTravelExpenseCreateModal(): void {
    this.travelExpenseModalMode = 'create';
    this.travelExpenseEditingId = null;
    this.resetTravelExpenseForm();
    this.travelExpenseModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  openTravelExpenseEditModal(item: TravelExpenseItem): void {
    this.travelExpenseModalMode = 'edit';
    this.travelExpenseEditingId = item._id;
    this.resetTravelExpenseForm(item);
    this.travelExpenseForm.enable({ emitEvent: false });
    this.travelExpenseModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeTravelExpenseModal(): void {
    this.travelExpenseModalOpen = false;
    this.travelExpenseSaving = false;
    this.travelExpenseEditingId = null;
    this.travelExpenseForm.enable({ emitEvent: false });
    document.body.style.overflow = '';
  }

  addBooth(booth?: { name?: string; cost?: number }): void {
    this.boothsFormArray.push(this.fb.group({
      name: [booth?.name ?? '', [Validators.required, Validators.maxLength(120)]],
      cost: [booth?.cost ?? 0, [Validators.required, Validators.min(0)]]
    }));
  }

  removeBooth(index: number): void {
    this.boothsFormArray.removeAt(index);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning({ detail: 'Campos incompletos', summary: 'Revisa la informacion requerida', duration: 3500 });
      return;
    }

    const payload = this.buildPayload();
    this.saving = true;

    const request$ = this.modalMode === 'create'
      ? this.api.createForeignTechnician(payload)
      : this.api.updateForeignTechnician(this.editingId!, payload);

    request$.subscribe({
      next: () => {
        this.toast.success({
          detail: 'Exito',
          summary: this.modalMode === 'create' ? 'Tecnico creado' : 'Tecnico actualizado',
          duration: 3500
        });
        this.closeModal();
        this.loadTechnicians(true);
      },
      error: err => {
        console.error(err);
        const msg = err?.error?.error || err?.error?.message || 'No se pudo guardar el tecnico';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
        this.saving = false;
      }
    });
  }

  submitTravelExpense(): void {
    if (this.travelExpenseForm.invalid) {
      this.travelExpenseForm.markAllAsTouched();
      this.toast.warning({ detail: 'Campos incompletos', summary: 'Revisa la informacion requerida', duration: 3500 });
      return;
    }

    const payload = this.buildTravelExpensePayload();
    this.travelExpenseSaving = true;

    const request$ = this.travelExpenseModalMode === 'create'
      ? this.api.createTravelExpense(payload)
      : this.api.updateTravelExpense(this.travelExpenseEditingId!, payload);

    request$.subscribe({
      next: () => {
        this.toast.success({
          detail: 'Exito',
          summary: this.travelExpenseModalMode === 'create' ? 'Viatico creado' : 'Viatico actualizado',
          duration: 3500
        });
        this.closeTravelExpenseModal();
        this.loadTravelExpenses(true);
      },
      error: err => {
        console.error(err);
        const msg = err?.error?.error || err?.error?.message || 'No se pudo guardar el viatico';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
        this.travelExpenseSaving = false;
      }
    });
  }

  saveExtras(): void {
    if (this.extraForm.invalid) {
      this.extraForm.markAllAsTouched();
      this.toast.warning({ detail: 'Campos incompletos', summary: 'Revisa la informacion de extras', duration: 3500 });
      return;
    }

    const payload = this.buildExtraPayload();
    const current = this.currentExtra;

    if (!current?._id) {
      this.toast.error({
        detail: 'Error',
        summary: 'No se encontró el registro de extras para actualizar',
        duration: 6000
      });
      this.loadTravelExpenseExtras(true);
      return;
    }

    this.extraSaving = true;

    this.api.updateTravelExpenseExtra(current._id, payload).subscribe({
      next: () => {
        this.toast.success({ detail: 'Exito', summary: 'Extras actualizados', duration: 3500 });
        this.loadTravelExpenseExtras(true);
      },
      error: err => {
        console.error(err);
        const msg = err?.error?.error || err?.error?.message || 'No se pudieron guardar los extras';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      },
      complete: () => {
        this.extraSaving = false;
      }
    });
  }

  async deleteSelected(): Promise<void> {
    if (this.selectedCount === 0) return;

    if (this.activeTabIndex === 1) {
      await this.deleteSelectedTravelExpenses();
      return;
    }

    const selected = this.selectedItems;
    const html = selected
      .slice(0, 8)
      .map(item => `<div><b>${item.name || '-'}</b> - ${item.city || 'Sin ciudad'}</div>`)
      .join('');

    const result = await Swal.fire({
      title: `Eliminar ${selected.length} tecnico(s)?`,
      html: `
        <div style="text-align:center">
          ${html}
          ${selected.length > 8 ? `<div style="margin-top:.5rem; opacity:.8">...y ${selected.length - 8} mas</div>` : ''}
        </div>
        <br>Esta accion no se puede deshacer.
      `,
      icon: 'warning',
      showCancelButton: true,
      cancelButtonColor: 'var(--color-primary)',
      confirmButtonColor: 'var(--color-danger)',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Si, eliminar',
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    this.deletingId = '__bulk__';
    const requests = selected.map(item =>
      this.api.deleteForeignTechnician(item._id).pipe(catchError(error => of({ __error: error, id: item._id })))
    );

    forkJoin(requests).subscribe({
      next: (res: any[]) => {
        const failures = res.filter(item => item?.__error).length;
        const success = res.length - failures;

        if (success) {
          this.toast.success({ detail: 'Exito', summary: `Se eliminaron ${success} tecnico(s)`, duration: 4000 });
          this.closeSidebar();
          this.loadTechnicians(true);
        }

        if (failures) {
          this.toast.error({ detail: 'Error', summary: `No se pudieron eliminar ${failures} tecnico(s)`, duration: 6000 });
        }
      },
      error: () => {
        this.toast.error({ detail: 'Error', summary: 'Fallo la eliminacion de tecnicos', duration: 6000 });
      },
      complete: () => {
        this.deletingId = null;
      }
    });
  }

  trackById(_index: number, item: ForeignTechnicianItem): string {
    return item._id;
  }

  trackTravelExpenseById(_index: number, item: TravelExpenseItem): string {
    return item._id;
  }

  boothTotal(item: TravelExpenseItem): number {
    return item.booths.reduce((sum, booth) => sum + Number(booth.cost ?? 0), 0);
  }

  travelExpenseTotal(item: TravelExpenseItem): number {
    const rate = Number(this.currentExtra?.kmRate ?? 0);
    return (Number(item.km ?? 0) * rate) + this.boothTotal(item);
  }

  private clearSelection(): void {
    this.selectedIds.clear();
  }

  private resetForm(item?: ForeignTechnicianItem): void {
    this.form.reset({
      type: item?.type ?? 'Foráneo',
      name: item?.name ?? '',
      cel: item?.cel ?? '',
      bill: item?.bill ?? false,
      city: item?.city ?? '',
      ownLocal: item?.ownLocal ?? false,
      address: item?.address ?? '',
      installationPrice: item?.installationPrice ?? 0,
      inspectionFee: item?.inspectionFee ?? 0,
      withdrawalPrice: item?.withdrawalPrice ?? 0,
      priceFalseReversal: item?.priceFalseReversal ?? 0,
      travelExpensesPrice: item?.travelExpensesPrice ?? 0,
      transferPrice: item?.transferPrice ?? 0,
      comments: item?.comments ?? ''
    });
  }

  private resetTravelExpenseForm(item?: TravelExpenseItem): void {
    this.boothsFormArray.clear();

    this.travelExpenseForm.reset({
      place: item?.place ?? '',
      km: item?.km ?? 0
    });

    (item?.booths?.length ? item.booths : []).forEach(booth => this.addBooth(booth));
  }

  private resetExtraForm(item?: TravelExpenseExtraItem): void {
    this.extraForm.reset({
      kmRate: item?.kmRate ?? 0,
      lodging: item?.lodging ?? 0,
      breakfast: item?.breakfast ?? 0,
      lunch: item?.lunch ?? 0,
      dinner: item?.dinner ?? 0
    }, { emitEvent: false });

    this.extraForm.markAsPristine();
    this.extraForm.markAsUntouched();
  }

  private buildPayload(): Omit<ForeignTechnicianItem, '_id'> {
    const value = this.form.getRawValue();

    return {
      type: value.type,
      name: String(value.name ?? '').trim(),
      cel: String(value.cel ?? '').trim(),
      bill: Boolean(value.bill),
      city: String(value.city ?? '').trim(),
      ownLocal: Boolean(value.ownLocal),
      address: String(value.address ?? '').trim(),
      installationPrice: Number(value.installationPrice ?? 0),
      inspectionFee: Number(value.inspectionFee ?? 0),
      withdrawalPrice: Number(value.withdrawalPrice ?? 0),
      priceFalseReversal: Number(value.priceFalseReversal ?? 0),
      travelExpensesPrice: Number(value.travelExpensesPrice ?? 0),
      transferPrice: Number(value.transferPrice ?? 0),
      comments: String(value.comments ?? '').trim()
    };
  }

  private buildTravelExpensePayload(): Omit<TravelExpenseItem, '_id' | 'createdAt'> {
    const value = this.travelExpenseForm.getRawValue();

    return {
      place: String(value.place ?? '').trim(),
      km: Number(value.km ?? 0),
      booths: (value.booths ?? []).map((booth: any) => ({
        name: String(booth.name ?? '').trim(),
        cost: Number(booth.cost ?? 0)
      }))
    };
  }

  private buildExtraPayload(): Omit<TravelExpenseExtraItem, '_id' | 'createdAt'> {
    const value = this.extraForm.getRawValue();

    return {
      kmRate: Number(value.kmRate ?? 0),
      lodging: Number(value.lodging ?? 0),
      breakfast: Number(value.breakfast ?? 0),
      lunch: Number(value.lunch ?? 0),
      dinner: Number(value.dinner ?? 0)
    };
  }

  private async deleteSelectedTravelExpenses(): Promise<void> {
    const selected = this.selectedTravelExpenseItems;
    const html = selected
      .slice(0, 8)
      .map(item => `<div><b>${item.place || '-'}</b> - ${item.km || 0} km</div>`)
      .join('');

    const result = await Swal.fire({
      title: `Eliminar ${selected.length} viatico(s)?`,
      html: `
        <div style="text-align:center">
          ${html}
          ${selected.length > 8 ? `<div style="margin-top:.5rem; opacity:.8">...y ${selected.length - 8} mas</div>` : ''}
        </div>
        <br>Esta accion no se puede deshacer.
      `,
      icon: 'warning',
      showCancelButton: true,
      cancelButtonColor: 'var(--color-primary)',
      confirmButtonColor: 'var(--color-danger)',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Si, eliminar',
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    this.deletingId = '__bulk__';
    const requests = selected.map(item =>
      this.api.deleteTravelExpense(item._id).pipe(catchError(error => of({ __error: error, id: item._id })))
    );

    forkJoin(requests).subscribe({
      next: (res: any[]) => {
        const failures = res.filter(item => item?.__error).length;
        const success = res.length - failures;

        if (success) {
          this.toast.success({ detail: 'Exito', summary: `Se eliminaron ${success} viatico(s)`, duration: 4000 });
          this.closeSidebar();
          this.loadTravelExpenses(true);
        }

        if (failures) {
          this.toast.error({ detail: 'Error', summary: `No se pudieron eliminar ${failures} viatico(s)`, duration: 6000 });
        }
      },
      error: () => {
        this.toast.error({ detail: 'Error', summary: 'Fallo la eliminacion de viaticos', duration: 6000 });
      },
      complete: () => {
        this.deletingId = null;
      }
    });
  }

  private createdTime(item: { createdAt?: string | Date }): number {
    const date = item.createdAt ? new Date(item.createdAt) : null;
    return date && !isNaN(date.getTime()) ? date.getTime() : 0;
  }

  private normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }
}
