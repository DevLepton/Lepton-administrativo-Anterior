import { Component, EventEmitter, Input, OnChanges, OnInit, Output, ViewChild } from '@angular/core';
import { NgToastService } from 'ng-angular-popup';
import Swal from 'sweetalert2';
import { catchError, forkJoin, of } from 'rxjs';
import { NewSimModalComponent } from '../../../modals/new-sim-modal/new-sim-modal.component';
import { ViewSimModalComponent } from '../../../modals/view-sim-modal/view-sim-modal.component';
import { EditSimModalComponent } from '../../../modals/edit-sim-modal/edit-sim-modal.component';
import { ApiService, DeviceStatus } from '../../../services/api.service';
import { PageEvent } from '@angular/material/paginator';

interface SimItem {
  id: string;            // _id
  iccid: string;
  modelo: string;        // model
  compania: string;      // company
  estatus: DeviceStatus;
  fechaCompra: string | Date | null;
  fechaIngresoLepton: string | Date | null;
  cliente?: string;
  comments?: string;
  netPrice: string | null;
  grossPrice: string | null;
  satCode: string | null;
}

@Component({
  selector: 'app-sims-tab',
  templateUrl: './sims-tab.component.html',
  styleUrl: '../almacen.component.scss'
})
export class SimsTabComponent implements OnChanges {
  @Input() simsData: any[] = [];
  @Input() isInventoryUser = false;

  @Output() refreshRequested = new EventEmitter<void>();

  @ViewChild(NewSimModalComponent) newSimModal?: NewSimModalComponent;
  @ViewChild(ViewSimModalComponent) viewSimModal!: ViewSimModalComponent;
  @ViewChild(EditSimModalComponent) editSimModal!: EditSimModalComponent;

  constructor(private apiService: ApiService, private toast: NgToastService) { }

  sims: SimItem[] = [];
  simsLoading = false;
  simsDeletingId: string | null = null;

  selectedIds = new Set<string>();

  // paginado
  simsPerPage = 10;
  simsCurrentPage = 1;

  // filtros
  simsSearch = '';
  simsFilterCompany = '';
  simsFilterStatus = '';
  purchaseDateFilter: Date | null = null;
  entryDateFilter: Date | null = null;

  // ordenación
  private simsInitial: SimItem[] = [];
  sortKey: keyof SimItem | 'no' = 'no';
  sortDir: 'asc' | 'desc' = 'desc';

  ngOnChanges() {
    if (this.simsData.length > 0) {
      this.sims = this.simsData.map(d => this.mapDeviceToSimItem(d));
      this.simsInitial = [...this.sims];
    }
  }

  onPage(e: PageEvent) {
    this.simsPerPage = e.pageSize;
    this.simsCurrentPage = e.pageIndex + 1;
  }

  // ===== Helpers =====
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

  private mapDeviceToSimItem(d: any): SimItem {
    return {
      id: String(d._id),
      iccid: d.iccid ?? '',
      modelo: d.model ?? '',
      compania: d.company ?? '',
      estatus: d.status ?? 'En inventario',
      fechaCompra: d.purchaseDate ?? null,
      fechaIngresoLepton: d.entryDate ?? null,
      cliente: d.client ?? '',
      comments: d.comments ?? '',
      netPrice: d.netPrice ?? null,
      grossPrice: d.grossPrice ?? null,
      satCode: d.satCode ?? null,
    };
  }

  private clearSelection() {
    this.selectedIds.clear();
  }

  // ===== Carga =====
  loadSims(): void {
    this.simsLoading = true;
    this.apiService.getSims().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        this.sims = list
          .map((d: any) => this.mapDeviceToSimItem(d))
          .sort((a: SimItem, b: SimItem) => this.objectIdEpoch(b.id) - this.objectIdEpoch(a.id));

        this.simsInitial = [...this.sims];
        this.simsCurrentPage = 1;
        this.sortKey = 'no';
        this.sortDir = 'desc';

        this.clearSelection();
      },
      error: (err) => {
        console.error('Error al cargar SIMs:', err);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los SIMs', duration: 5000 });
      },
      complete: () => (this.simsLoading = false)
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleRowSelection(sim: SimItem, checked: boolean) {
    if (checked) this.selectedIds.add(sim.id);
    else this.selectedIds.delete(sim.id);
  }

  // selecciona TODO lo visible (filtrado + paginado si aplica)
  toggleSelectAllVisible(checked: boolean) {
    const visible = this.displayedSims;
    if (checked) visible.forEach(s => this.selectedIds.add(s.id));
    else visible.forEach(s => this.selectedIds.delete(s.id));
  }

  get visibleSelectedCount(): number {
    const visibleIds = new Set(this.displayedSims.map(s => s.id));
    let c = 0;
    this.selectedIds.forEach(id => { if (visibleIds.has(id)) c++; });
    return c;
  }

  get isAllVisibleSelected(): boolean {
    const visible = this.displayedSims;
    return visible.length > 0 && visible.every(s => this.selectedIds.has(s.id));
  }

  get isSomeVisibleSelected(): boolean {
    const visible = this.displayedSims;
    return visible.some(s => this.selectedIds.has(s.id)) && !this.isAllVisibleSelected;
  }

  get selectedSims(): SimItem[] {
    const map = new Map(this.sims.map(s => [s.id, s] as const));
    return Array.from(this.selectedIds)
      .map(id => map.get(id))
      .filter(Boolean) as SimItem[];
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get canViewOrEdit(): boolean {
    return this.selectedCount === 1;
  }

  // ===== Paginado =====
  get simsTotalPages(): number {
    const total = Math.ceil(this.simsFiltered.length / this.simsPerPage);
    return Math.max(1, total);
  }

  onPageChange(e: PageEvent) {
    this.simsPerPage = e.pageSize;
    this.simsCurrentPage = e.pageIndex + 1;
  }

  get displayedSims(): SimItem[] {
    const src = this.simsFiltered;
    const start = (this.simsCurrentPage - 1) * this.simsPerPage;
    return src.slice(start, start + this.simsPerPage);
  }

  setSimsPage(p: number) {
    const total = this.simsTotalPages;
    this.simsCurrentPage = Math.min(Math.max(1, p), total);
  }

  toggleRowByClick(sim: SimItem) {
    const currentlySelected = this.isSelected(sim.id);
    this.toggleRowSelection(sim, !currentlySelected);
  }

  // ===== Filtros =====
  updateSimSearch(v: string) {
    this.simsSearch = (v ?? '').trim();
    this.simsCurrentPage = 1;
  }

  onSimFilterChange() {
    this.simsCurrentPage = 1;
  }

  onPurchaseDateChange(d: Date | null) {
    this.purchaseDateFilter = d;
    this.simsCurrentPage = 1;
  }
  clearPurchaseDate() { this.onPurchaseDateChange(null); }

  onEntryDateChange(d: Date | null) {
    this.entryDateFilter = d;
    this.simsCurrentPage = 1;
  }
  clearEntryDate() { this.onEntryDateChange(null); }

  get simsFiltered(): SimItem[] {
    const q = this.s(this.simsSearch);
    const fc = this.s(this.simsFilterCompany);
    const fs = this.s(this.simsFilterStatus);

    const purchaseKey = this.dayKeyFromPickerLocal(this.purchaseDateFilter);
    const entryKey = this.dayKeyFromPickerLocal(this.entryDateFilter);

    return (this.sims ?? []).filter(sim => {
      const okSearch = !q || this.s(sim.iccid).includes(q);
      const okCompany = !fc || this.s(sim.compania) === fc;
      const okStatus = !fs || this.s(sim.estatus) === fs;

      const simPurchaseKey = this.dayKeyUTC(sim.fechaCompra);
      const simEntryKey = this.dayKeyUTC(sim.fechaIngresoLepton);

      const okPurchase = !purchaseKey || (simPurchaseKey !== null && simPurchaseKey === purchaseKey);
      const okEntry = !entryKey || (simEntryKey !== null && simEntryKey === entryKey);

      return okSearch && okCompany && okStatus && okPurchase && okEntry;
    });
  }

  // ===== Ordenación =====
  resetSort() {
    this.sims = [...this.simsInitial];
    this.sortKey = 'no';
    this.sortDir = 'desc';
    this.simsCurrentPage = 1;
  }

  sortBy(key: keyof SimItem | 'no') {
    if (this.sortKey === key) {
      if (this.sortDir === 'asc') this.sortDir = 'desc';
      else { this.resetSort(); return; }
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }

    if (key === 'no') return;
    const dir = this.sortDir === 'asc' ? 1 : -1;

    this.sims = [...this.sims].sort((a, b) => {
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

    this.simsCurrentPage = 1;
  }

  arrowFor(key: keyof SimItem | 'no'): string {
    if (this.sortKey !== key) return '';
    return this.sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  // ===== Uniques =====
  get uniqueSimModels(): string[] {
    return Array.from(new Set((this.sims ?? []).map(s => s.modelo).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }

  get uniqueSimCompanies(): string[] {
    return Array.from(new Set((this.sims ?? []).map(s => s.compania).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }

  get uniqueSimStatuses(): string[] {
    return Array.from(new Set((this.sims ?? []).map(s => s.estatus).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }

  // ===== Acciones =====
  nuevoSim() {
    this.newSimModal?.open();
  }

  onSimCreated(evt: any) {
    if (!this.isInventoryUser) return;
    this.apiService.createSim(evt).subscribe({
      next: () => {
        this.toast.success({ detail: 'Éxito', summary: 'SIM registrado con éxito', duration: 4000 });
        this.refreshRequested.emit();
      },
      error: (err) => {
        const msg = err?.error?.error || 'Error al registrar SIM';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      }
    });
  }

  onSimsBulkCreated(list: any[]) {
    if (!this.isInventoryUser) return;
    if (!Array.isArray(list) || list.length === 0) {
      this.toast.warning({ detail: 'Aviso', summary: 'No hay SIMs para registrar.', duration: 3000 });
      return;
    }

    const payloads = list.map(item => ({ ...item, iccid: String(item.iccid || '').trim() }));
    const requests = payloads.map(p => this.apiService.createSim(p).pipe(catchError(err => of({ __error: err }))));

    forkJoin(requests).subscribe({
      next: (results: any[]) => {
        const successes = results.filter(r => !r?.__error).length;
        const failures = results.length - successes;

        if (successes > 0) {
          this.toast.success({ detail: 'Éxito', summary: `Se registraron ${successes} SIM(s).`, duration: 5000 });
        }
        if (failures > 0) {
          this.toast.error({ detail: 'Error', summary: `No se pudieron registrar ${failures} SIM(s).`, duration: 6000 });
        }
        this.refreshRequested.emit();
      },
      error: () => {
        this.toast.error({ detail: 'Error', summary: 'Falló el registro masivo.', duration: 6000 });
        this.refreshRequested.emit();
      }
    });
  }

  verSim(sim: SimItem) {
    const found = this.sims.find(s => s.id === sim.id);
    if (!found) return this.toast.error({ detail: 'Error', summary: 'SIM no encontrado', duration: 4000 });

    this.viewSimModal.open({
      id: found.id,
      iccid: found.iccid,
      modelo: found.modelo,
      compania: found.compania,
      estatus: found.estatus,
      fechaCompra: found.fechaCompra ?? null,
      fechaIngresoLepton: found.fechaIngresoLepton ?? null,
      cliente: found.cliente ?? '',
      comentarios: found.comments ?? '',
      netPrice: found.netPrice ?? null,
      grossPrice: found.grossPrice ?? null,
      satCode: found.satCode ?? null,
    });
  }

  editarSim(sim: SimItem) {
    const found = this.sims.find(s => s.id === sim.id);
    if (!found) return this.toast.error({ detail: 'Error', summary: 'SIM no encontrado', duration: 4000 });

    this.editSimModal.open({
      id: found.id,
      iccid: found.iccid,
      model: found.modelo,
      company: found.compania,
      status: (found.estatus as any) || 'En inventario',
      purchaseDate: found.fechaCompra ?? null,
      entryDate: found.fechaIngresoLepton ?? null,
      installationDate: null,
      client: found.cliente ?? '',
      comments: found.comments ?? ''
    });
  }

  onSimUpdated(evt: { id: string; payload: any }) {
    this.apiService.updateSim(evt.id, evt.payload).subscribe({
      next: () => {
        this.toast.success({ detail: 'Éxito', summary: 'SIM actualizado con éxito', duration: 4000 });
        this.refreshRequested.emit();
      },
      error: (err) => {
        const msg = err?.error?.error || 'Error al actualizar SIM';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      }
    });
  }

  viewSelected() {
    if (!this.canViewOrEdit) return;
    const sim = this.selectedSims[0];
    this.verSim(sim);
  }

  editSelected() {
    if (!this.canViewOrEdit) return;
    const sim = this.selectedSims[0];
    this.editarSim(sim);
  }

  deleteSelected() {
    if (!this.isInventoryUser) return;
    if (this.selectedCount === 0) return;

    const selected = this.selectedSims;
    const htmlList = selected.slice(0, 8).map(s => `
      <div><b>${s.iccid}</b> — ${s.modelo} — ${s.compania}</div>
    `).join('');

    Swal.fire({
      title: `¿Eliminar ${selected.length} SIM(s)?`,
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

      // borra en lote con resumen de resultados
      const reqs = selected.map(s =>
        this.apiService.deleteSim(s.id).pipe(catchError(err => of({ __error: err, id: s.id })))
      );

      this.simsDeletingId = '__bulk__';

      forkJoin(reqs).subscribe({
        next: (res: any[]) => {
          const okIds = res.filter(r => !r?.__error).map((_, idx) => selected[idx].id);
          const failures = res.filter(r => r?.__error).length;

          if (okIds.length) {
            // quita local
            const okSet = new Set(okIds);
            this.sims = this.sims.filter(s => !okSet.has(s.id));
            this.simsInitial = this.simsInitial.filter(s => !okSet.has(s.id));
            okIds.forEach(id => this.selectedIds.delete(id));

            this.toast.success({
              detail: 'Éxito',
              summary: `Se eliminaron ${okIds.length} SIM(s).`,
              duration: 5000
            });
          }
          if (failures) {
            this.toast.error({
              detail: 'Error',
              summary: `No se pudieron eliminar ${failures} SIM(s).`,
              duration: 6000
            });
          }

          // ajusta paginado si aplica
          const totalPages = Math.max(1, Math.ceil(this.simsFiltered.length / this.simsPerPage));
          if (this.simsCurrentPage > totalPages) this.simsCurrentPage = totalPages;

          this.refreshRequested.emit();
        },
        error: () => {
          this.toast.error({ detail: 'Error', summary: 'Falló la eliminación masiva.', duration: 6000 });
        },
        complete: () => {
          this.simsDeletingId = null;
        }
      });
    });
  }

  eliminarSim(sim: SimItem) {
    Swal.fire({
      title: '¿Estás seguro de eliminar este SIM?',
      html: `
        <div style="text-align:center">
          <div><b>ICCID:</b> ${sim.iccid}</div>
          <div><b>Modelo:</b> ${sim.modelo}</div>
          <div><b>Compañía:</b> ${sim.compania}</div>
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

      this.simsDeletingId = sim.id;

      this.apiService.deleteSim(sim.id).subscribe({
        next: () => {
          this.sims = this.sims.filter(s => s.id !== sim.id);
          this.simsInitial = this.simsInitial.filter(s => s.id !== sim.id);

          const totalPages = Math.max(1, Math.ceil(this.sims.length / this.simsPerPage));
          if (this.simsCurrentPage > totalPages) this.simsCurrentPage = totalPages;

          this.toast.success({ detail: 'Éxito', summary: 'SIM eliminado correctamente', duration: 4000 });
          this.refreshRequested.emit();
        },
        error: (err) => {
          const msg = err?.error?.error || 'No se pudo eliminar el SIM';
          this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
        },
        complete: () => { this.simsDeletingId = null; }
      });
    });
  }
}
