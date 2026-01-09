import { Component, OnInit, ViewChild } from '@angular/core';
import { NgToastService } from 'ng-angular-popup';
import Swal from 'sweetalert2';
import { catchError, forkJoin, of } from 'rxjs';
import { NewGpsModalComponent } from '../../../modals/new-gps-modal/new-gps-modal.component';
import { ViewGpsModalComponent } from '../../../modals/view-gps-modal/view-gps-modal.component';
import { EditGpsModalComponent } from '../../../modals/edit-gps-modal/edit-gps-modal.component';
import { ApiService, CreateGpsPayload } from '../../../services/api.service';

interface GpsItem {
  id: string;                         // _id de Mongo
  imei: string;
  sn: string;
  nombre: string;                     // name
  marca: string;                      // brand
  modelo: string;                     // model
  estatus: 'En inventario' | 'En configuración' | 'Instalado' | string;
  fechaCompra: string | Date | null;
  fechaIngresoLepton: string | Date | null;
  cliente?: string | null;
  comments?: string | null;
  installationDate?: string | Date | null;
}

@Component({
  selector: 'app-gps-tab',
  templateUrl: './gps-tab.component.html',
  styleUrl: '../almacen.component.scss'
})
export class GpsTabComponent implements OnInit {
  @ViewChild(NewGpsModalComponent) newGpsModal!: NewGpsModalComponent;
  @ViewChild(ViewGpsModalComponent) viewGpsModal!: ViewGpsModalComponent;
  @ViewChild(EditGpsModalComponent) editGpsModal!: EditGpsModalComponent;

  constructor(private apiService: ApiService, private toast: NgToastService) {}

  // ===== DATA =====
  gps: GpsItem[] = [];
  gpsLoading = false;
  gpsDeletingId: string | null = null;

  // paginado/filtros
  gpsPerPage = 10;
  gpsCurrentPage = 1;
  gpsShowAll = true;

  gpsSearch = '';
  gpsFilterBrand = '';
  gpsFilterStatus = '';
  gpsFilterModel = '';
  gpsPurchaseDateFilter: Date | null = null;
  gpsEntryDateFilter: Date | null = null;

  // ordenación
  private gpsInitial: GpsItem[] = [];
  gpsSortKey: keyof GpsItem | 'no' = 'no';
  gpsSortDir: 'asc' | 'desc' = 'desc';

  ngOnInit(): void {
    this.loadGps();
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

  // ===== Mapper API -> UI =====
  private mapDeviceToGpsItem(d: any): GpsItem {
    return {
      id: String(d._id),
      imei: d.imei ?? '',
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

  // ===== Carga =====
  loadGps(): void {
    this.gpsLoading = true;

    this.apiService.getGps().subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        this.gps = list
          .map((d: any) => this.mapDeviceToGpsItem(d))
          .sort((a: GpsItem, b: GpsItem) => this.objectIdEpoch(b.id) - this.objectIdEpoch(a.id));

        this.gpsInitial = [...this.gps];
        this.gpsCurrentPage = 1;
        this.gpsSortKey = 'no';
        this.gpsSortDir = 'desc';

        this.clearGpsSelection();
      },
      error: (err) => {
        console.error('Error al cargar GPS:', err);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los GPS', duration: 5000 });
      },
      complete: () => (this.gpsLoading = false),
    });
  }

  // ===== Paginado / filtros =====
  get gpsFiltered(): GpsItem[] {
    const q = this.s(this.gpsSearch);
    const fBrand = this.s(this.gpsFilterBrand);
    const fModel = this.s(this.gpsFilterModel);
    const fStatus = this.s(this.gpsFilterStatus);

    const purchaseKey = this.dayKeyFromPickerLocal(this.gpsPurchaseDateFilter);
    const entryKey = this.dayKeyFromPickerLocal(this.gpsEntryDateFilter);

    return (this.gps ?? []).filter(g => {
      const okSearch = !q || this.s(g.imei).includes(q) || this.s(g.sn).includes(q);
      const okBrand = !fBrand || this.s(g.marca) === fBrand;
      const okModel = !fModel || this.s(g.modelo) === fModel;
      const okStatus = !fStatus || this.s(g.estatus) === fStatus;

      const pKey = this.dayKeyUTC(g.fechaCompra);
      const eKey = this.dayKeyUTC(g.fechaIngresoLepton);
      const okPurchase = !purchaseKey || (pKey !== null && pKey === purchaseKey);
      const okEntry = !entryKey || (eKey !== null && eKey === entryKey);

      return okSearch && okBrand && okModel && okStatus && okPurchase && okEntry;
    });
  }

  get displayedGps(): GpsItem[] {
    const src = this.gpsFiltered;
    if (this.gpsShowAll) return src;
    const start = (this.gpsCurrentPage - 1) * this.gpsPerPage;
    return src.slice(start, start + this.gpsPerPage);
  }

  get gpsTotalPages(): number {
    const total = Math.ceil(this.gpsFiltered.length / this.gpsPerPage);
    return Math.max(1, total);
  }

  updateGpsSearch(v: string) { this.gpsSearch = (v ?? '').trim(); this.gpsCurrentPage = 1; }
  onGpsFilterChange() { this.gpsCurrentPage = 1; }
  setGpsPage(p: number) { this.gpsCurrentPage = Math.min(Math.max(1, p), this.gpsTotalPages); }
  toggleGpsShowAll() { this.gpsShowAll = !this.gpsShowAll; this.gpsCurrentPage = 1; }

  onGpsPurchaseDateChange(d: Date | null) { this.gpsPurchaseDateFilter = d; this.gpsCurrentPage = 1; }
  clearGpsPurchaseDate() { this.onGpsPurchaseDateChange(null); }
  onGpsEntryDateChange(d: Date | null) { this.gpsEntryDateFilter = d; this.gpsCurrentPage = 1; }
  clearGpsEntryDate() { this.onGpsEntryDateChange(null); }

  // ===== Ordenación =====
  resetGpsSort() {
    this.gps = [...this.gpsInitial];
    this.gpsSortKey = 'no';
    this.gpsSortDir = 'desc';
    this.gpsCurrentPage = 1;
  }

  sortGpsBy(key: keyof GpsItem | 'no') {
    if (this.gpsSortKey === key) {
      if (this.gpsSortDir === 'asc') this.gpsSortDir = 'desc';
      else { this.resetGpsSort(); return; }
    } else {
      this.gpsSortKey = key;
      this.gpsSortDir = 'asc';
    }

    if (key === 'no') return;
    const dir = this.gpsSortDir === 'asc' ? 1 : -1;

    this.gps = [...this.gps].sort((a, b) => {
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

    this.gpsCurrentPage = 1;
  }

  arrowForGps(key: keyof GpsItem | 'no'): string {
    if (this.gpsSortKey !== key) return '';
    return this.gpsSortDir === 'asc' ? '▲' : '▼';
  }

  // ===== Unique options para filtros/modales =====
  get uniqueGpsBrands(): string[] {
    return Array.from(new Set((this.gps ?? []).map(g => g.marca).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }
  get uniqueGpsModels(): string[] {
    return Array.from(new Set((this.gps ?? []).map(g => g.modelo).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }
  get uniqueGpsStatuses(): string[] {
    return Array.from(new Set((this.gps ?? []).map(g => g.estatus).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }

  get gpsModelOptions(): string[] { return this.uniqueGpsModels; }
  get gpsBrandOptions(): string[] { return this.uniqueGpsBrands; }

  // ===== CRUD =====
  nuevoGps() { this.newGpsModal.open(); }

  onGpsCreated(evt: {
    type: 'gps';
    imei: string;
    sn: string;
    name: string;
    brand: string;
    model: string;
    status: 'En inventario' | 'En configuración' | 'Instalado';
    purchaseDate: string;
    entryDate: string;
    installationDate?: string | null;
    client?: string | null;
    comments?: string | null;
  }) {
    this.apiService.createGps(evt as any).subscribe({
      next: () => { this.toast.success({ detail: 'Éxito', summary: 'GPS registrado', duration: 4000 }); this.loadGps(); },
      error: (err) => {
        const msg = err?.error?.error || 'Error al registrar GPS';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      }
    });
  }

  onGpsBulkCreated(list: Array<any>) {
    if (!Array.isArray(list) || list.length === 0) {
      this.toast.warning({ detail: 'Aviso', summary: 'No hay GPS para registrar.', duration: 3000 });
      return;
    }

    const payloads = list.map(x => ({
      ...x,
      imei: String(x.imei || '').trim(),
      sn: String(x.sn || '').trim(),
    }));

    const reqs = payloads.map(p => this.apiService.createGps(p).pipe(
      catchError(err => of({ __error: err }))
    ));

    forkJoin(reqs).subscribe({
      next: (res: any[]) => {
        const ok = res.filter(r => !r?.__error).length;
        const ko = res.length - ok;
        if (ok) this.toast.success({ detail: 'Éxito', summary: `${ok} GPS registrado(s).`, duration: 5000 });
        if (ko) this.toast.error({ detail: 'Error', summary: `${ko} GPS no se registraron.`, duration: 6000 });
        this.loadGps();
      },
      error: () => {
        this.toast.error({ detail: 'Error', summary: 'Falló el registro masivo.', duration: 6000 });
        this.loadGps();
      }
    });
  }

  editarGps(g: GpsItem) {
    const found = this.gps.find(x => x.id === g.id);
    if (!found) return this.toast.error({ detail: 'Error', summary: 'GPS no encontrado', duration: 4000 });

    this.editGpsModal.open({
      id: found.id,
      imei: found.imei,
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

  onGpsUpdated(evt: { id: string; payload: Partial<Omit<CreateGpsPayload, 'type'>> }) {
    this.apiService.updateGps(evt.id, evt.payload).subscribe({
      next: () => { this.toast.success({ detail: 'Éxito', summary: 'GPS actualizado', duration: 4000 }); this.loadGps(); },
      error: (err) => {
        const msg = err?.error?.error || 'Error al actualizar GPS';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      }
    });
  }

  eliminarGps(g: GpsItem) {
    Swal.fire({
      title: '¿Eliminar GPS?',
      html: `
        <div style="text-align:center">
          <div><b>IMEI:</b> ${g.imei}</div>
          <div><b>Serie:</b> ${g.sn}</div>
          <div><b>Modelo:</b> ${g.modelo}</div>
          <div><b>Marca:</b> ${g.marca}</div>
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

      this.gpsDeletingId = g.id;

      this.apiService.deleteGps(g.id).subscribe({
        next: () => {
          this.gps = this.gps.filter(x => x.id !== g.id);
          this.gpsInitial = this.gpsInitial.filter(x => x.id !== g.id);

          if (!this.gpsShowAll) {
            const totalPages = Math.max(1, Math.ceil(this.gps.length / this.gpsPerPage));
            if (this.gpsCurrentPage > totalPages) this.gpsCurrentPage = totalPages;
          }

          this.toast.success({ detail: 'Éxito', summary: 'GPS eliminado', duration: 4000 });
        },
        error: (err) => {
          const msg = err?.error?.error || 'No se pudo eliminar el GPS';
          this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
        },
        complete: () => { this.gpsDeletingId = null; }
      });
    });
  }

  verGps(g: GpsItem) {
    const found = this.gps.find(x => x.id === g.id);
    if (!found) return this.toast.error({ detail: 'Error', summary: 'GPS no encontrado', duration: 4000 });

    this.viewGpsModal.open({
      id: found.id,
      imei: found.imei,
      sn: found.sn,
      nombre: found.nombre,
      marca: found.marca,
      modelo: found.modelo,
      estatus: found.estatus,
      fechaCompra: found.fechaCompra ?? null,
      fechaIngresoLepton: found.fechaIngresoLepton ?? null,
      cliente: found.cliente ?? '',
      comentarios: found.comments ?? ''
    });
  }

  // ✅ NUEVO: selección
selectedGpsIds = new Set<string>();

private clearGpsSelection() {
  this.selectedGpsIds.clear();
}

isGpsSelected(id: string): boolean {
  return this.selectedGpsIds.has(id);
}

toggleGpsRowSelection(g: GpsItem, checked: boolean) {
  if (checked) this.selectedGpsIds.add(g.id);
  else this.selectedGpsIds.delete(g.id);
}

toggleGpsRowByClick(g: GpsItem) {
  this.toggleGpsRowSelection(g, !this.isGpsSelected(g.id));
}

// Seleccionar todo lo visible (según paginado)
toggleSelectAllGpsVisible(checked: boolean) {
  const visible = this.displayedGps;
  if (checked) visible.forEach(x => this.selectedGpsIds.add(x.id));
  else visible.forEach(x => this.selectedGpsIds.delete(x.id));
}

get isAllGpsVisibleSelected(): boolean {
  const visible = this.displayedGps;
  return visible.length > 0 && visible.every(x => this.selectedGpsIds.has(x.id));
}

get isSomeGpsVisibleSelected(): boolean {
  const visible = this.displayedGps;
  return visible.some(x => this.selectedGpsIds.has(x.id)) && !this.isAllGpsVisibleSelected;
}

get gpsSelectedCount(): number {
  return this.selectedGpsIds.size;
}

get canViewOrEditGps(): boolean {
  return this.gpsSelectedCount === 1;
}

get selectedGpsItems(): GpsItem[] {
  const map = new Map(this.gps.map(x => [x.id, x] as const));
  return Array.from(this.selectedGpsIds)
    .map(id => map.get(id))
    .filter(Boolean) as GpsItem[];
}

viewSelectedGps() {
  if (!this.canViewOrEditGps) return;
  this.verGps(this.selectedGpsItems[0]);
}

editSelectedGps() {
  if (!this.canViewOrEditGps) return;
  this.editarGps(this.selectedGpsItems[0]);
}

deleteSelectedGps() {
  if (this.gpsSelectedCount === 0) return;

  const selected = this.selectedGpsItems;

  const htmlList = selected.slice(0, 8).map(g => `
    <div><b>${g.imei}</b> — ${g.sn} — ${g.modelo}</div>
  `).join('');

  Swal.fire({
    title: `¿Eliminar ${selected.length} GPS(s)?`,
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
      this.apiService.deleteGps(item.id).pipe(catchError(err => of({ __error: err, id: item.id })))
    );

    this.gpsDeletingId = '__bulk__';

    forkJoin(reqs).subscribe({
      next: (res: any[]) => {
        const okIds: string[] = [];
        res.forEach((r, i) => { if (!r?.__error) okIds.push(selected[i].id); });

        const failures = res.length - okIds.length;

        if (okIds.length) {
          const okSet = new Set(okIds);

          this.gps = this.gps.filter(x => !okSet.has(x.id));
          this.gpsInitial = this.gpsInitial.filter(x => !okSet.has(x.id));
          okIds.forEach(id => this.selectedGpsIds.delete(id));

          if (!this.gpsShowAll) {
            const totalPages = Math.max(1, Math.ceil(this.gpsFiltered.length / this.gpsPerPage));
            if (this.gpsCurrentPage > totalPages) this.gpsCurrentPage = totalPages;
          }

          this.toast.success({ detail: 'Éxito', summary: `Se eliminaron ${okIds.length} GPS(s).`, duration: 5000 });
        }

        if (failures) {
          this.toast.error({ detail: 'Error', summary: `No se pudieron eliminar ${failures} GPS(s).`, duration: 6000 });
        }
      },
      error: () => {
        this.toast.error({ detail: 'Error', summary: 'Falló la eliminación masiva.', duration: 6000 });
      },
      complete: () => {
        this.gpsDeletingId = null;
      }
    });
  });
}

}
