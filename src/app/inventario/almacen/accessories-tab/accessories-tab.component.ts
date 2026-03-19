import { Component, EventEmitter, Input, OnChanges, OnInit, Output, ViewChild } from '@angular/core';
import { NgToastService } from 'ng-angular-popup';
import Swal from 'sweetalert2';
import { catchError, forkJoin, of } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { NewAccessoryModalComponent } from '../../../modals/new-accessory-modal/new-accessory-modal.component';
import { ViewAccessoryModalComponent } from '../../../modals/view-accessory-modal/view-accessory-modal.component';
import { EditAccessoryModalComponent } from '../../../modals/edit-accessory-modal/edit-accessory-modal.component';
import { PageEvent } from '@angular/material/paginator';

interface AccessoryItem {
  id: string;                         // _id
  idAccesorio: string;                // schema id
  sn: string;
  nombre: string;
  marca: string;
  modelo: string;
  estatus: 'En inventario' | 'En configuración' | 'Instalado' | string;
  fechaCompra: string | Date | null;
  fechaIngresoLepton: string | Date | null;
  cliente?: string | null;
  comments?: string | null;
  installationDate?: string | Date | null;
}

@Component({
  selector: 'app-accessories-tab',
  templateUrl: './accessories-tab.component.html',
  styleUrl: '../almacen.component.scss'
})
export class AccessoriesTabComponent implements OnChanges {
  @Input() accessoriesData: any[] = [];
  @Input() isInventoryUser = false;

  @Output() refreshRequested = new EventEmitter<void>();

  @ViewChild(NewAccessoryModalComponent) newAccessoryModal?: NewAccessoryModalComponent;
  @ViewChild(ViewAccessoryModalComponent) viewAccessoryModal!: ViewAccessoryModalComponent;
  @ViewChild(EditAccessoryModalComponent) editAccessoryModal!: EditAccessoryModalComponent;

  constructor(private apiService: ApiService, private toast: NgToastService) { }

  // data
  accessories: AccessoryItem[] = [];
  accessoriesLoading = false;
  accessoriesDeletingId: string | null = null;

  // paginado/filtros
  accessoriesPerPage = 10;
  accessoriesCurrentPage = 1;

  accessorySearch = '';
  accessoryFilterBrand = '';
  accessoryFilterStatus = '';
  accessoryFilterModel = '';
  accessoryPurchaseDateFilter: Date | null = null;
  accessoryEntryDateFilter: Date | null = null;

  // sort
  private accessoriesInitial: AccessoryItem[] = [];
  accessorySortKey: keyof AccessoryItem | 'no' = 'no';
  accessorySortDir: 'asc' | 'desc' = 'desc';

  ngOnChanges() {
    if (this.accessoriesData.length > 0) {
      this.accessories = this.accessoriesData.map(d => this.mapDeviceToAccessoryItem(d));
      this.accessoriesInitial = [...this.accessories];
    }
  }

  onPage(e: PageEvent) {
    this.accessoriesPerPage = e.pageSize;
    this.accessoriesCurrentPage = e.pageIndex + 1;
  }

  private objectIdEpoch(id: string): number {
    return parseInt(id.substring(0, 8), 16);
  }

  private s(v: any): string {
    return (v ?? '').toString().trim().toLowerCase();
  }

  private ymdUtcMs(v: any): number {
    if (!v) return 0;
    const d = new Date(v);
    if (isNaN(d.getTime())) return 0;
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  private dayKeyUTC(d: any): number | null {
    if (!d) return null;
    const x = new Date(d);
    if (isNaN(x.getTime())) return null;
    return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
  }

  private dayKeyFromPickerLocal(d: Date | null): number | null {
    if (!d) return null;
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private mapDeviceToAccessoryItem(d: any): AccessoryItem {
    return {
      id: String(d._id),
      idAccesorio: String(d.id ?? ''),
      sn: d.sn ?? '',
      nombre: d.name ?? '',
      marca: d.brand ?? '',
      modelo: d.model ?? '',
      estatus: d.status ?? 'En inventario',
      fechaCompra: d.purchaseDate ?? null,
      fechaIngresoLepton: d.entryDate ?? null,
      cliente: d.client ?? null,
      comments: d.comments ?? null,
      installationDate: d.installationDate ?? null,
    };
  }

  loadAccessories(): void {
    this.accessoriesLoading = true;

    this.apiService.getAccessories().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        this.accessories = list
          .map((d: any) => this.mapDeviceToAccessoryItem(d))
          .sort((a: AccessoryItem, b: AccessoryItem) => this.objectIdEpoch(b.id) - this.objectIdEpoch(a.id));

        this.accessoriesInitial = [...this.accessories];
        this.accessoriesCurrentPage = 1;
        this.accessorySortKey = 'no';
        this.accessorySortDir = 'desc';

        this.clearAccessorySelection();
      },
      error: (err) => {
        console.error('Error al cargar Accesorios:', err);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los Accesorios', duration: 5000 });
      },
      complete: () => (this.accessoriesLoading = false),
    });
  }

  // ===== pagination =====
  get displayedAccessories(): AccessoryItem[] {
    const src = this.accessoriesFiltered;
    const start = (this.accessoriesCurrentPage - 1) * this.accessoriesPerPage;
    return src.slice(start, start + this.accessoriesPerPage);
  }

  get accessoriesTotalPages(): number {
    const total = Math.ceil(this.accessoriesFiltered.length / this.accessoriesPerPage);
    return Math.max(1, total);
  }

  onPageChange(e: PageEvent) {
    this.accessoriesPerPage = e.pageSize;
    this.accessoriesCurrentPage = e.pageIndex + 1;
  }

  setAccessoriesPage(p: number) {
    this.accessoriesCurrentPage = Math.min(Math.max(1, p), this.accessoriesTotalPages);
  }

  // ===== filters =====
  updateAccessorySearch(v: string) { this.accessorySearch = (v ?? '').trim(); this.accessoriesCurrentPage = 1; }
  onAccessoryFilterChange() { this.accessoriesCurrentPage = 1; }
  onAccessoryPurchaseDateChange(d: Date | null) { this.accessoryPurchaseDateFilter = d; this.accessoriesCurrentPage = 1; }
  clearAccessoryPurchaseDate() { this.onAccessoryPurchaseDateChange(null); }
  onAccessoryEntryDateChange(d: Date | null) { this.accessoryEntryDateFilter = d; this.accessoriesCurrentPage = 1; }
  clearAccessoryEntryDate() { this.onAccessoryEntryDateChange(null); }

  get accessoriesFiltered(): AccessoryItem[] {
    const q = this.s(this.accessorySearch);
    const fBrand = this.s(this.accessoryFilterBrand);
    const fModel = this.s(this.accessoryFilterModel);
    const fStatus = this.s(this.accessoryFilterStatus);

    const purchaseKey = this.dayKeyFromPickerLocal(this.accessoryPurchaseDateFilter);
    const entryKey = this.dayKeyFromPickerLocal(this.accessoryEntryDateFilter);

    return (this.accessories ?? []).filter(a => {
      const okSearch = !q || this.s(a.idAccesorio).includes(q) || this.s(a.sn).includes(q);
      const okBrand = !fBrand || this.s(a.marca) === fBrand;
      const okModel = !fModel || this.s(a.modelo) === fModel;
      const okStatus = !fStatus || this.s(a.estatus) === fStatus;

      const pKey = this.dayKeyUTC(a.fechaCompra);
      const eKey = this.dayKeyUTC(a.fechaIngresoLepton);
      const okPurchase = !purchaseKey || (pKey !== null && pKey === purchaseKey);
      const okEntry = !entryKey || (eKey !== null && eKey === entryKey);

      return okSearch && okBrand && okModel && okStatus && okPurchase && okEntry;
    });
  }

  // ===== sort =====
  resetAccessorySort() {
    this.accessories = [...this.accessoriesInitial];
    this.accessorySortKey = 'no';
    this.accessorySortDir = 'desc';
    this.accessoriesCurrentPage = 1;
  }

  sortAccessoryBy(key: keyof AccessoryItem | 'no') {
    if (this.accessorySortKey === key) {
      if (this.accessorySortDir === 'asc') this.accessorySortDir = 'desc';
      else { this.resetAccessorySort(); return; }
    } else { this.accessorySortKey = key; this.accessorySortDir = 'asc'; }

    if (key === 'no') return;
    const dir = this.accessorySortDir === 'asc' ? 1 : -1;

    this.accessories = [...this.accessories].sort((a, b) => {
      const av: any = (a as any)[key];
      const bv: any = (b as any)[key];

      if (key === 'fechaCompra' || key === 'fechaIngresoLepton') {
        return (this.ymdUtcMs(av) - this.ymdUtcMs(bv)) * dir;
      }

      const as = this.s(av), bs = this.s(bv);
      if (as < bs) return -1 * dir;
      if (as > bs) return 1 * dir;
      return 0;
    });

    this.accessoriesCurrentPage = 1;
  }

  arrowForAccessory(key: keyof AccessoryItem | 'no'): string {
    if (this.accessorySortKey !== key) return '';
    return this.accessorySortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  // ===== uniques =====
  get uniqueAccessoryBrands(): string[] {
    return Array.from(new Set((this.accessories ?? []).map(a => a.marca).filter(Boolean) as string[]))
      .sort((x, y) => x.localeCompare(y));
  }
  get uniqueAccessoryModels(): string[] {
    return Array.from(new Set((this.accessories ?? []).map(a => a.modelo).filter(Boolean) as string[]))
      .sort((x, y) => x.localeCompare(y));
  }
  get uniqueAccessoryStatuses(): string[] {
    return Array.from(new Set((this.accessories ?? []).map(a => a.estatus).filter(Boolean) as string[]))
      .sort((x, y) => x.localeCompare(y));
  }

  get accessoryModelOptions(): string[] { return this.uniqueAccessoryModels; }
  get accessoryBrandOptions(): string[] { return this.uniqueAccessoryBrands; }

  // ===== actions =====
  nuevoAccesorio() { this.newAccessoryModal?.open(); }

  verAccesorio(a: AccessoryItem) {
    const found = this.accessories.find(x => x.id === a.id);
    if (!found) return this.toast.error({ detail: 'Error', summary: 'Accesorio no encontrado', duration: 4000 });

    this.viewAccessoryModal.open({
      idMongo: found.id,
      id: found.idAccesorio,
      sn: found.sn,
      nombre: found.nombre,
      marca: found.marca,
      modelo: found.modelo,
      estatus: found.estatus,
      fechaCompra: found.fechaCompra,
      fechaIngresoLepton: found.fechaIngresoLepton,
      cliente: found.cliente ?? '',
      comentarios: found.comments ?? ''
    });
  }

  editarAccesorio(a: AccessoryItem) {
    const found = this.accessories.find(x => x.id === a.id);
    if (!found) return this.toast.error({ detail: 'Error', summary: 'Accesorio no encontrado', duration: 4000 });

    this.editAccessoryModal.open({
      id: found.id,
      accId: found.idAccesorio,
      sn: found.sn,
      name: found.nombre,
      brand: found.marca,
      model: found.modelo,
      status: (found.estatus as any) || 'En inventario',
      purchaseDate: found.fechaCompra ?? null,
      entryDate: found.fechaIngresoLepton ?? null,
      installationDate: found.installationDate ?? null,
      client: found.cliente ?? '',
      comments: found.comments ?? ''
    });
  }

  eliminarAccesorio(a: AccessoryItem) {
    Swal.fire({
      title: '¿Eliminar Accesorio?',
      html: `
        <div style="text-align:center">
          <div><b>ID:</b> ${a.idAccesorio || '—'}</div>
          <div><b>S/N:</b> ${a.sn || '—'}</div>
          <div><b>Modelo:</b> ${a.modelo || '—'}</div>
          <div><b>Marca:</b> ${a.marca || '—'}</div>
        </div>
        <br>Esta acción no se puede deshacer.
      `,
      icon: 'warning',
      showCancelButton: true,
      cancelButtonColor: 'var(--color-primary)',
      confirmButtonColor: 'var(--color-danger)',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, eliminar',
      reverseButtons: true,
    }).then(result => {
      if (!result.isConfirmed) return;

      this.accessoriesDeletingId = a.id;

      this.apiService.deleteAccessory(a.id).subscribe({
        next: () => {
          this.accessories = this.accessories.filter(x => x.id !== a.id);
          this.accessoriesInitial = this.accessoriesInitial.filter(x => x.id !== a.id);

          const totalPages = Math.max(1, Math.ceil(this.accessoriesFiltered.length / this.accessoriesPerPage));
          if (this.accessoriesCurrentPage > totalPages) this.accessoriesCurrentPage = totalPages;

          this.toast.success({ detail: 'Éxito', summary: 'Accesorio eliminado', duration: 4000 });
          this.refreshRequested.emit();
        },
        error: (err) => {
          const msg = err?.error?.error || 'No se pudo eliminar el Accesorio';
          this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
        },
        complete: () => { this.accessoriesDeletingId = null; }
      });
    });
  }

  onAccessoryCreated(evt: any) {
    if (!this.isInventoryUser) return;
    this.apiService.createAccessory(evt).subscribe({
      next: () => { this.toast.success({ detail: 'Éxito', summary: 'Accesorio registrado', duration: 4000 }); this.refreshRequested.emit(); },
      error: (err) => {
        const msg = err?.error?.error || 'Error al registrar Accesorio';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      }
    });
  }

  onAccessoriesBulkCreated(list: any[]) {
    if (!this.isInventoryUser) return;
    if (!Array.isArray(list) || list.length === 0) {
      this.toast.warning({ detail: 'Aviso', summary: 'No hay Accesorios para registrar.', duration: 3000 });
      return;
    }

    const payloads = list.map(x => ({ ...x, id: String(x.id || '').trim(), sn: String(x.sn || '').trim() }));
    const reqs = payloads.map(p => this.apiService.createAccessory(p).pipe(catchError(err => of({ __error: err }))));

    forkJoin(reqs).subscribe({
      next: (res: any[]) => {
        const ok = res.filter(r => !r?.__error).length;
        const ko = res.length - ok;
        if (ok) this.toast.success({ detail: 'Éxito', summary: `${ok} Accesorio(s) registrado(s).`, duration: 5000 });
        if (ko) this.toast.error({ detail: 'Error', summary: `${ko} Accesorio(s) no se registraron.`, duration: 6000 });
        this.refreshRequested.emit();
      },
      error: () => {
        this.toast.error({ detail: 'Error', summary: 'Falló el registro masivo.', duration: 6000 });
        this.refreshRequested.emit();
      }
    });
  }

  onAccessoryUpdated(evt: { id: string; payload: any }) {
    this.apiService.updateAccessory(evt.id, evt.payload).subscribe({
      next: () => { this.toast.success({ detail: 'Éxito', summary: 'Accesorio actualizado', duration: 4000 }); this.refreshRequested.emit(); },
      error: (err) => {
        const msg = err?.error?.error || 'Error al actualizar Accesorio';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      }
    });
  }

  // ✅ NUEVO: selección
  selectedAccessoryIds = new Set<string>();

  private clearAccessorySelection() {
    this.selectedAccessoryIds.clear();
  }

  isAccessorySelected(id: string): boolean {
    return this.selectedAccessoryIds.has(id);
  }

  toggleAccessoryRowSelection(a: AccessoryItem, checked: boolean) {
    if (checked) this.selectedAccessoryIds.add(a.id);
    else this.selectedAccessoryIds.delete(a.id);
  }

  toggleAccessoryRowByClick(a: AccessoryItem) {
    this.toggleAccessoryRowSelection(a, !this.isAccessorySelected(a.id));
  }

  toggleSelectAllAccessoriesVisible(checked: boolean) {
    const visible = this.displayedAccessories;
    if (checked) visible.forEach(x => this.selectedAccessoryIds.add(x.id));
    else visible.forEach(x => this.selectedAccessoryIds.delete(x.id));
  }

  get isAllAccessoriesVisibleSelected(): boolean {
    const visible = this.displayedAccessories;
    return visible.length > 0 && visible.every(x => this.selectedAccessoryIds.has(x.id));
  }

  get isSomeAccessoriesVisibleSelected(): boolean {
    const visible = this.displayedAccessories;
    return visible.some(x => this.selectedAccessoryIds.has(x.id)) && !this.isAllAccessoriesVisibleSelected;
  }

  get accessoriesSelectedCount(): number {
    return this.selectedAccessoryIds.size;
  }

  get canViewOrEditAccessory(): boolean {
    return this.accessoriesSelectedCount === 1;
  }

  get selectedAccessoriesItems(): AccessoryItem[] {
    const map = new Map(this.accessories.map(x => [x.id, x] as const));
    return Array.from(this.selectedAccessoryIds)
      .map(id => map.get(id))
      .filter(Boolean) as AccessoryItem[];
  }

  viewSelectedAccessory() {
    if (!this.canViewOrEditAccessory) return;
    this.verAccesorio(this.selectedAccessoriesItems[0]);
  }

  editSelectedAccessory() {
    if (!this.canViewOrEditAccessory) return;
    this.editarAccesorio(this.selectedAccessoriesItems[0]);
  }

  deleteSelectedAccessories() {
    if (!this.isInventoryUser) return;
    if (this.accessoriesSelectedCount === 0) return;

    const selected = this.selectedAccessoriesItems;

    const htmlList = selected.slice(0, 8).map(a => `
    <div><b>${a.idAccesorio}</b> — ${a.sn} — ${a.modelo}</div>
  `).join('');

    Swal.fire({
      title: `¿Eliminar ${selected.length} accesorio(s)?`,
      html: `
      <div style="text-align:center">
        ${htmlList}
        ${selected.length > 8 ? `<div style="margin-top:.5rem; opacity:.8">…y ${selected.length - 8} más</div>` : ''}
      </div>
      <br>Esta acción no se puede deshacer.
    `,
      icon: 'warning',
      showCancelButton: true,
      cancelButtonColor: 'var(--color-primary)',
      confirmButtonColor: 'var(--color-danger)',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, eliminar',
      reverseButtons: true,
    }).then(result => {
      if (!result.isConfirmed) return;

      const reqs = selected.map(item =>
        this.apiService.deleteAccessory(item.id).pipe(catchError(err => of({ __error: err, id: item.id })))
      );

      this.accessoriesDeletingId = '__bulk__';

      forkJoin(reqs).subscribe({
        next: (res: any[]) => {
          const okIds: string[] = [];
          res.forEach((r, i) => { if (!r?.__error) okIds.push(selected[i].id); });

          const failures = res.length - okIds.length;

          if (okIds.length) {
            const okSet = new Set(okIds);

            this.accessories = this.accessories.filter(x => !okSet.has(x.id));
            this.accessoriesInitial = this.accessoriesInitial.filter(x => !okSet.has(x.id));
            okIds.forEach(id => this.selectedAccessoryIds.delete(id));

            const totalPages = Math.max(1, Math.ceil(this.accessoriesFiltered.length / this.accessoriesPerPage));
            if (this.accessoriesCurrentPage > totalPages) this.accessoriesCurrentPage = totalPages;

            this.toast.success({ detail: 'Éxito', summary: `Se eliminaron ${okIds.length} accesorio(s).`, duration: 5000 });
          }

          if (failures) {
            this.toast.error({ detail: 'Error', summary: `No se pudieron eliminar ${failures} accesorio(s).`, duration: 6000 });
          }
          this.refreshRequested.emit();
        },
        error: () => {
          this.toast.error({ detail: 'Error', summary: 'Falló la eliminación masiva.', duration: 6000 });
        },
        complete: () => {
          this.accessoriesDeletingId = null;
        }
      });
    });
  }

}
