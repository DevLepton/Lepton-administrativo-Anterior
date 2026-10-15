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
import { AuthService } from '../services/auth.service';

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

  isAdminUser = false;
  isSupportUser = false;
  isInventoryUser = false;
  isBillingUser = false;

  technicians: ForeignTechnicianItem[] = [];
  travelExpenses: TravelExpenseItem[] = [];
  travelExpenseExtras: TravelExpenseExtraItem[] = [];
  loading = false;
  search = '';
  currentPage = 1;
  perPage = 25;
  selectedIds = new Set<string>();
  deletingId: string | null = null;
  technicianSortKey: keyof ForeignTechnicianItem | null = null;
  technicianSortDir: 'asc' | 'desc' = 'asc';
  travelExpenseSortKey: 'place' | 'km' | 'boothCount' | 'boothTotal' | 'estimatedTotal' | 'createdAt' | null = null;
  travelExpenseSortDir: 'asc' | 'desc' = 'asc';

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
  private extraOriginalValues: Record<string, number> = {};

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

  constructor( private api: ApiService, private authService: AuthService, private quoteData: CotizacionesDataService, private toast: NgToastService, private fb: FormBuilder) {
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
      paymentMethods: this.fb.array([]),
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
      dinner: [0, [Validators.required, Validators.min(0)]],
      changeLog: ['']
    });
  }

  ngOnInit(): void {
    const role = this.authService.getUserRole();
    this.isAdminUser = role === 'admin';
    this.isSupportUser = role === 'soporte';
    this.isInventoryUser = role === 'inventario';
    this.isBillingUser = role === 'cobranza';

    this.loadCatalog();

    ['kmRate', 'lodging', 'breakfast', 'lunch', 'dinner'].forEach(field => {
      this.extraForm.get(field)?.valueChanges.subscribe(() => {
        this.updateExtraChangeLogValidator();
      });
    });
  }

  get filteredTechnicians(): ForeignTechnicianItem[] {
    const q = this.normalize(this.search);

    const technicians = this.technicians
      .filter(item => this.normalize(item.type).startsWith('for'))
      .filter(item => !q ||
        this.normalize(item.name).includes(q) ||
        this.normalize(item.cel).includes(q) ||
        this.normalize(item.city).includes(q) ||
        this.normalize(item.address).includes(q) ||
        this.normalize(item.comments).includes(q)
      );

    return this.sortTechnicians(technicians);
  }

  get displayedTechnicians(): ForeignTechnicianItem[] {
    const start = (this.currentPage - 1) * this.perPage;
    return this.filteredTechnicians.slice(start, start + this.perPage);
  }

  get technicianAverages() {
    const technicians = this.technicians.filter(item =>
      this.normalize(item.type).startsWith('for')
    );

    const count = technicians.length || 1;

    return {
      installation: technicians.reduce((sum, item) => sum + Number(item.installationPrice ?? 0), 0) / count,
      inspection: technicians.reduce((sum, item) => sum + Number(item.inspectionFee ?? 0), 0) / count,
      withdrawal: technicians.reduce((sum, item) => sum + Number(item.withdrawalPrice ?? 0), 0) / count,
      falseReversal: technicians.reduce((sum, item) => sum + Number(item.priceFalseReversal ?? 0), 0) / count,
      travelExpenses: technicians.reduce((sum, item) => sum + Number(item.travelExpensesPrice ?? 0), 0) / count,
      transfer: technicians.reduce((sum, item) => sum + Number(item.transferPrice ?? 0), 0) / count
    };
  }

  get filteredTravelExpenses(): TravelExpenseItem[] {
    const q = this.normalize(this.search);

    const travelExpenses = this.travelExpenses.filter(item => !q ||
      this.normalize(item.place).includes(q) ||
      this.normalize(item.km).includes(q) ||
      item.booths.some(booth =>
        this.normalize(booth.name).includes(q) ||
        this.normalize(booth.cost).includes(q)
      )
    );

    return this.sortTravelExpenses(travelExpenses);
  }

  get extraFieldsChanged(): boolean {
    return ['kmRate', 'lodging', 'breakfast', 'lunch', 'dinner']
      .some(field => this.isExtraFieldModified(field));
  }

  private updateExtraChangeLogValidator(): void {
    const changeLog = this.extraForm.get('changeLog');

    if (!changeLog) return;

    if (this.extraFieldsChanged) {
      changeLog.setValidators([Validators.required]);
      changeLog.markAsTouched();
    } else {
      changeLog.clearValidators();
      changeLog.markAsUntouched();
    }

    changeLog.updateValueAndValidity({ emitEvent: false });
  }

  get displayedTravelExpenses(): TravelExpenseItem[] {
    const start = (this.currentPage - 1) * this.perPage;
    return this.filteredTravelExpenses.slice(start, start + this.perPage);
  }

  sortTechniciansBy(key: keyof ForeignTechnicianItem): void {
    if (this.technicianSortKey === key) {
      if (this.technicianSortDir === 'asc') this.technicianSortDir = 'desc';
      else { this.technicianSortKey = null; this.currentPage = 1; return; }
    } else { this.technicianSortKey = key; this.technicianSortDir = 'asc'; }
    this.currentPage = 1;
  }

  technicianSortArrow(key: keyof ForeignTechnicianItem): string {
    return this.technicianSortKey === key ? (this.technicianSortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : '';
  }

  sortTravelExpensesBy(key: NonNullable<CotizacionesForaneosComponent['travelExpenseSortKey']>): void {
    if (this.travelExpenseSortKey === key) {
      if (this.travelExpenseSortDir === 'asc') this.travelExpenseSortDir = 'desc';
      else { this.travelExpenseSortKey = null; this.currentPage = 1; return; }
    } else { this.travelExpenseSortKey = key; this.travelExpenseSortDir = 'asc'; }
    this.currentPage = 1;
  }

  travelExpenseSortArrow(key: NonNullable<CotizacionesForaneosComponent['travelExpenseSortKey']>): string {
    return this.travelExpenseSortKey === key ? (this.travelExpenseSortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : '';
  }

  private sortTechnicians(items: ForeignTechnicianItem[]): ForeignTechnicianItem[] {
    if (!this.technicianSortKey) return items;
    const key = this.technicianSortKey;
    const dir = this.technicianSortDir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => this.compareSortValues(a[key], b[key]) * dir);
  }

  private sortTravelExpenses(items: TravelExpenseItem[]): TravelExpenseItem[] {
    if (!this.travelExpenseSortKey) return items;
    const dir = this.travelExpenseSortDir === 'asc' ? 1 : -1;
    const value = (item: TravelExpenseItem): unknown => {
      switch (this.travelExpenseSortKey) {
        case 'boothCount': return item.booths.length;
        case 'boothTotal': return this.boothTotal(item);
        case 'estimatedTotal': return this.travelExpenseTotal(item);
        default: return item[this.travelExpenseSortKey as keyof TravelExpenseItem];
      }
    };
    return [...items].sort((a, b) => this.compareSortValues(value(a), value(b)) * dir);
  }

  private compareSortValues(a: unknown, b: unknown): number {
    if (a == null || a === '') return b == null || b === '' ? 0 : -1;
    if (b == null || b === '') return 1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    const aDate = new Date(a as string).getTime(), bDate = new Date(b as string).getTime();
    if (!Number.isNaN(aDate) && !Number.isNaN(bDate) && /\d{4}-\d{2}-\d{2}/.test(String(a))) return aDate - bDate;
    return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
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

  get paymentMethodFormArray(): FormArray {
    return this.form.get('paymentMethods') as FormArray;
  }

  get boothsFormArray(): FormArray {
    return this.travelExpenseForm.get('booths') as FormArray;
  }

  get currentExtra(): TravelExpenseExtraItem | null {
    return this.travelExpenseExtras[0] ?? null;
  }

  get canEditExtras(): boolean {
    return this.isAdminUser || this.isSupportUser;
  }

  get mealsTotal(): number {
    const value = this.extraForm.getRawValue();
    return Number(value.breakfast ?? 0) + Number(value.lunch ?? 0) + Number(value.dinner ?? 0);
  }

  isExtraFieldModified(field: string): boolean {
    const control = this.extraForm.get(field);

    if (!control) return false;

    return Number(control.value ?? 0) !== Number(this.extraOriginalValues[field] ?? 0);
  }

  restoreExtraField(field: string): void {
    const control = this.extraForm.get(field);

    if (!control || !(field in this.extraOriginalValues)) return;

    control.setValue(this.extraOriginalValues[field]);

    if (Number(control.value ?? 0) === Number(this.extraOriginalValues[field] ?? 0)) {
      control.markAsPristine();
    }
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
    this.closeSidebar();
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

  addPaymentMethod(paymentMethod?: { holder?: string; bankName?: string; accountNumber?: string; CLABE?: string; cardNumber?: string }): void {
    this.paymentMethodFormArray.push(this.fb.group({
      holder: [paymentMethod?.holder ?? '', [Validators.required, Validators.maxLength(120)]],
      bankName: [paymentMethod?.bankName ?? '', [Validators.required, Validators.maxLength(50)]],
      accountNumber: [paymentMethod?.accountNumber ?? '', [Validators.required, Validators.maxLength(50)]],
      CLABE: [paymentMethod?.CLABE ?? '', [Validators.required, Validators.maxLength(50)]],
      cardNumber: [paymentMethod?.cardNumber ?? '', [Validators.required, Validators.maxLength(50)]]
    }));
  }

  removePaymentMethod(index: number): void {
    this.paymentMethodFormArray.removeAt(index);
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
    if (!this.canEditExtras) return;

    this.updateExtraChangeLogValidator();

    if (!this.extraFieldsChanged) {
      this.toast.warning({
        detail: 'Sin cambios',
        summary: 'No se detectaron cambios en los extras',
        duration: 3500
      });
      return;
    }

    if (this.extraForm.invalid) {
      this.extraForm.markAllAsTouched();

      this.toast.warning({
        detail: 'Registro requerido',
        summary: 'Debes indicar el motivo del cambio realizado',
        duration: 5000
      });

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
        this.toast.success({
          detail: 'Éxito',
          summary: 'Extras actualizados',
          duration: 3500
        });

        this.loadTravelExpenseExtras(true);
      },
      error: err => {
        console.error(err);

        const msg =
          err?.error?.error ||
          err?.error?.message ||
          'No se pudieron guardar los extras';

        this.toast.error({
          detail: 'Error',
          summary: msg,
          duration: 6000
        });
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
    this.paymentMethodFormArray.clear();

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

    (item?.paymentMethods?.length ? item.paymentMethods : []).forEach(paymentMethod => this.addPaymentMethod(paymentMethod));
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
    const values = {
      kmRate: Number(item?.kmRate ?? 0),
      lodging: Number(item?.lodging ?? 0),
      breakfast: Number(item?.breakfast ?? 0),
      lunch: Number(item?.lunch ?? 0),
      dinner: Number(item?.dinner ?? 0)
    };

    this.extraOriginalValues = { ...values };

    this.extraForm.reset({
      ...values,
      changeLog: ''
    }, { emitEvent: false });

    this.extraForm.markAsPristine();
    this.extraForm.markAsUntouched();

    this.updateExtraChangeLogValidator();

    if (this.canEditExtras) {
      this.extraForm.enable({ emitEvent: false });
    } else {
      this.extraForm.disable({ emitEvent: false });
    }
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
      paymentMethods: (value.paymentMethods ?? []).map((paymentMethod: any) => ({
        holder: String(paymentMethod.holder ?? '').trim(),
        bankName: String(paymentMethod.bankName ?? '').trim(),
        accountNumber: String(paymentMethod.accountNumber ?? '').trim(),
        CLABE: String(paymentMethod.CLABE ?? '').trim(),
        cardNumber: String(paymentMethod.cardNumber ?? '').trim()
      })),
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

  private buildExtraPayload(): any {
    const value = this.extraForm.getRawValue();

    return {
      kmRate: Number(value.kmRate ?? 0),
      lodging: Number(value.lodging ?? 0),
      breakfast: Number(value.breakfast ?? 0),
      lunch: Number(value.lunch ?? 0),
      dinner: Number(value.dinner ?? 0),
      changeLog: String(value.changeLog ?? '').trim()
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
