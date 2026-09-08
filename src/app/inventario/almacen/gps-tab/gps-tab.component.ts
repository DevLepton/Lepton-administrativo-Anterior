import { Component, EventEmitter, Input, OnChanges, OnInit, Output, ViewChild } from '@angular/core';
import { NgToastService } from 'ng-angular-popup';
import Swal from 'sweetalert2';
import { catchError, forkJoin, of } from 'rxjs';
import { NewGpsModalComponent } from '../../../modals/new-gps-modal/new-gps-modal.component';
import { ViewGpsModalComponent } from '../../../modals/view-gps-modal/view-gps-modal.component';
import { EditGpsModalComponent } from '../../../modals/edit-gps-modal/edit-gps-modal.component';
import { ApiService, DeviceStatus, GpsPayload } from '../../../services/api.service';
import { PageEvent } from '@angular/material/paginator';
import { ConfirmModalService } from '../../../services/confirm-modal/confirm-modal-service';

export interface GpsItem {
  id: string;                         // _id de Mongo
  imei: string;
  sn: string;
  supplier: string;
  name?: string | null;                     // name
  brand: string;                      // brand
  model: string;                     // model
  status: DeviceStatus;
  purchaseDate: string | Date | null;
  entryDate: string | Date | null;
  client?: string | null;
  comments?: string | null;
  installationDate?: string | Date | null;
  netPrice?: string | null;
  grossPrice?: string | null;
  satCode?: string | null;
}

@Component({
  selector: 'app-gps-tab',
  templateUrl: './gps-tab.component.html',
  styleUrl: '../almacen.component.scss'
})
export class GpsTabComponent implements OnChanges {
  @Input() gpsData: any[] = [];
  @Input() isInventoryUser = false;
  @Input() isSupportUser = false;

  @Output() refreshRequested = new EventEmitter<void>();

  @ViewChild(NewGpsModalComponent) newGpsModal?: NewGpsModalComponent;
  @ViewChild(ViewGpsModalComponent) viewGpsModal!: ViewGpsModalComponent;
  @ViewChild(EditGpsModalComponent) editGpsModal!: EditGpsModalComponent;

  constructor(private apiService: ApiService, private toast: NgToastService, private confirmModal: ConfirmModalService) { }

  // ===== DATA =====
  gps: GpsItem[] = [];
  gpsLoading = false;
  gpsDeletingId: string | null = null;

  // paginado/filtros
  gpsPerPage = 25;
  gpsCurrentPage = 1;

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

  ngOnChanges() {
    if (this.gpsData.length > 0) {
      this.gps = this.gpsData.map(d => this.mapDeviceToGpsItem(d));
      this.gpsInitial = [...this.gps];
    }
  }

  onPage(e: PageEvent) {
    this.gpsPerPage = e.pageSize;
    this.gpsCurrentPage = e.pageIndex + 1;
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
      supplier: d.supplier ?? '',
      name: d.name ?? '',
      brand: d.brand ?? '',
      model: d.model ?? '',
      status: d.status ?? 'En inventario',

      purchaseDate: d.purchaseDate ?? null,
      entryDate: d.entryDate ?? null,

      client: d.client ?? null,
      comments: d.comments ?? null,
      installationDate: d.installationDate ?? null,

      netPrice: d.netPrice ?? null,
      grossPrice: d.grossPrice ?? null,
      satCode: d.satCode ?? null,
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
      const okBrand = !fBrand || this.s(g.brand) === fBrand;
      const okModel = !fModel || this.s(g.model) === fModel;
      const okStatus = !fStatus || this.s(g.status) === fStatus;

      const pKey = this.dayKeyUTC(g.purchaseDate);
      const eKey = this.dayKeyUTC(g.entryDate);
      const okPurchase = !purchaseKey || (pKey !== null && pKey === purchaseKey);
      const okEntry = !entryKey || (eKey !== null && eKey === entryKey);

      return okSearch && okBrand && okModel && okStatus && okPurchase && okEntry;
    });
  }

  get displayedGps(): GpsItem[] {
    const src = this.gpsFiltered;
    const start = (this.gpsCurrentPage - 1) * this.gpsPerPage;
    return src.slice(start, start + this.gpsPerPage);
  }

  get gpsTotalPages(): number {
    const total = Math.ceil(this.gpsFiltered.length / this.gpsPerPage);
    return Math.max(1, total);
  }

  onPageChange(e: PageEvent) {
    this.gpsPerPage = e.pageSize;
    this.gpsCurrentPage = e.pageIndex + 1;
  }

  updateGpsSearch(v: string) { this.gpsSearch = (v ?? '').trim(); this.gpsCurrentPage = 1; }
  onGpsFilterChange() { this.gpsCurrentPage = 1; }
  setGpsPage(p: number) { this.gpsCurrentPage = Math.min(Math.max(1, p), this.gpsTotalPages); }

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

      if (key === 'purchaseDate' || key === 'entryDate') {
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
    return this.gpsSortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  // ===== Unique options para filtros/modales =====
  get uniqueGpsBrands(): string[] {
    return Array.from(new Set((this.gps ?? []).map(g => g.brand).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }
  get uniqueGpsModels(): string[] {
    return Array.from(new Set((this.gps ?? []).map(g => g.model).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }
  get uniqueGpsStatuses(): string[] {
    return Array.from(new Set((this.gps ?? []).map(g => g.status).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }

  get gpsModelOptions(): string[] { return this.uniqueGpsModels; }
  get gpsBrandOptions(): string[] { return this.uniqueGpsBrands; }

  // ===== CRUD =====
  nuevoGps() { this.newGpsModal?.open(); }

  onGpsCreated(evt: GpsPayload) {
    if (!this.isInventoryUser) return;
    this.apiService.createGps(evt as any).subscribe({
      next: () => { this.toast.success({ detail: 'Éxito', summary: 'GPS registrado', duration: 4000 }); this.refreshRequested.emit(); },
      error: (err) => {
        const msg = err?.error?.error || 'Error al registrar GPS';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      }
    });
  }

  onGpsBulkCreated(list: Array<any>) {
    if (!this.isInventoryUser) return;
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
        this.refreshRequested.emit();
      },
      error: () => {
        this.toast.error({ detail: 'Error', summary: 'Falló el registro masivo.', duration: 6000 });
        this.refreshRequested.emit();
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
      supplier: found.supplier ?? '',
      brand: found.brand,
      model: found.model,
      status: (found.status as any) || 'En inventario',
      purchaseDate: found.purchaseDate ?? null,
      entryDate: found.entryDate ?? null,
      installationDate: found.installationDate ?? null,
      client: found.client ?? '',
      comments: found.comments ?? '',
    });
  }

  onGpsUpdated(evt: {
    ids: string[];
    payload: Partial<Omit<GpsPayload, 'type'>>;
  }) {

    this.apiService.bulkUpdateGps(
      evt.ids,
      evt.payload
    ).subscribe({

      next: () => {

        this.toast.success({
          detail: 'Éxito',
          summary: `${evt.ids.length} GPS actualizado(s)`,
          duration: 4000
        });

        this.refreshRequested.emit();
      },

      error: (err) => {

        const msg = err?.error?.error || 'Error al actualizar GPS';

        this.toast.error({
          detail: 'Error',
          summary: msg,
          duration: 6000
        });
      }
    });
  }

  eliminarGps(g: GpsItem) {
    if (!this.isInventoryUser) return;
    Swal.fire({
      title: '¿Eliminar GPS?',
      html: `
        <div style="text-align:center">
          <div><b>IMEI:</b> ${g.imei}</div>
          <div><b>Serie:</b> ${g.sn}</div>
          <div><b>Modelo:</b> ${g.model}</div>
          <div><b>Marca:</b> ${g.brand}</div>
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

          const totalPages = Math.max(1, Math.ceil(this.gpsFiltered.length / this.gpsPerPage));
          if (this.gpsCurrentPage > totalPages) this.gpsCurrentPage = totalPages;

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
      supplier: found.supplier,
      name: found.name ?? null,
      brand: found.brand,
      model: found.model,
      status: found.status,
      purchaseDate: found.purchaseDate ?? null,
      entryDate: found.entryDate ?? null,
      client: found.client ?? '',
      comments: found.comments ?? '',
      netPrice: found.netPrice ?? null,
      grossPrice: found.grossPrice ?? null,
      satCode: found.satCode ?? null,
    });
  }

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

    if (this.gpsSelectedCount === 0) return;

    this.editGpsModal.open(
      this.selectedGpsItems
    );
  }

  deleteSelectedGps() {
    if (!this.isInventoryUser) return;
    if (this.gpsSelectedCount === 0) return;

    const selected = this.selectedGpsItems;

    const htmlList = selected.slice(0, 8).map(g => `
    <div><b>${g.imei}</b> — ${g.sn} — ${g.model}</div>
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

            const totalPages = Math.max(1, Math.ceil(this.gpsFiltered.length / this.gpsPerPage));
            if (this.gpsCurrentPage > totalPages) this.gpsCurrentPage = totalPages;

            this.toast.success({ detail: 'Éxito', summary: `Se eliminaron ${okIds.length} GPS(s).`, duration: 5000 });
          }

          if (failures) {
            this.toast.error({ detail: 'Error', summary: `No se pudieron eliminar ${failures} GPS(s).`, duration: 6000 });
          }

          this.refreshRequested.emit();
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

  gpsPanelCollapsed = false;

  statusClass(status: string): string {
    const s = (status || '').toLowerCase();

    if (s.includes('inventario')) return 'inv';
    if (s.includes('configuración')) return 'cfg';
    if (s.includes('instalado')) return 'inst';
    if (s.includes('listo')) return 'ready';

    return 'default';
  }

  toggleGpsPanel() {
    this.gpsPanelCollapsed = !this.gpsPanelCollapsed;
  }

  get gpsStatsSource(): GpsItem[] {
    return this.gpsFiltered; // usa filtros activos
  }

  get gpsTotalCount(): number {
    return this.gpsStatsSource.length;
  }

  countByStatus(status: string): number {
    return this.gpsStatsSource.filter(x => x.status === status).length;
  }

  get gpsStatusCounts() {
    const map = new Map<string, number>();

    this.gpsStatsSource.forEach(g => {
      map.set(g.status, (map.get(g.status) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);
  }

  get gpsModelCounts() {
    const map = new Map<string, number>();

    this.gpsStatsSource.forEach(g => {
      const key = g.model || 'Sin modelo';
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);
  }

  // async syncGpsWithApi() {
  //   const gpsInConfig = this.gps.filter(
  //     g => g.status === 'En configuración'
  //   );

  //   if (!gpsInConfig.length) {
  //     this.toast.warning({
  //       detail: 'Aviso',
  //       summary: 'No hay GPS en configuración.',
  //       duration: 4000
  //     });

  //     return;
  //   }

  //   // ===== MOSTRAR GPS EN CONFIGURACIÓN =====
  //   const gpsConfigHtml = gpsInConfig.map(g => `
  //   <div style="
  //     padding:.65rem 0;
  //     border-bottom:1px solid rgba(255,255,255,.08);
  //   ">
  //     <div>
  //       <b>${g.imei}</b>
  //     </div>

  //     <div style="
  //       opacity:.8;
  //       font-size:.9rem;
  //     ">
  //       ${g.brand} ${g.model}
  //     </div>
  //   </div>
  // `).join('');
  //   const confirmed = await this.confirmModal.open({
  //     title: `GPS en configuración (${gpsInConfig.length})`,
  //     message: `
  //     <div style="
  //       text-align:left;
  //       max-height:350px;
  //       overflow:auto;
  //       padding-right:.35rem;
  //     ">
  //       ${gpsConfigHtml}
  //     </div>
  //     <br>
  //     <div style="
  //       text-align:center;
  //       font-weight:500;
  //     ">
  //       ¿Deseas sincronizar estos GPS?
  //     </div>
  //   `,
  //     confirmText: 'Sincronizar',
  //     cancelText: 'Cancelar'
  //   });

  //   if (!confirmed) {
  //     return;
  //   }

  //   // ===== CONSULTAR API =====
  //   this.gpsLoading = true;
  //   this.apiService.syncGpsWithNavixy(46207).subscribe({
  //     next: async (res: any) => {
  //       const trackers = res?.trackers || [];
  //       const imeis = new Set(
  //         trackers
  //           .map((t: any) => String(t.imei || '').trim())
  //           .filter(Boolean)
  //       );

  //       const matches = gpsInConfig.filter(g =>
  //         imeis.has(String(g.imei || '').trim())
  //       );

  //       if (!matches.length) {
  //         this.gpsLoading = false;

  //         await this.confirmModal.open({
  //           title: 'Sin coincidencias',
  //           message: `
  //           <div style="text-align:center;">
  //             Ningún GPS fue encontrado en la API.
  //           </div>
  //         `,
  //           confirmText: 'Aceptar',
  //           cancelText: ''
  //         });

  //         return;
  //       }

  //       // ===== ACTUALIZAR =====
  //       const updates = matches.map(g =>
  //         this.apiService.updateGps(g.id, {
  //           status: 'Listo para usar'
  //         })
  //       );

  //       forkJoin(updates).subscribe({
  //         next: async () => {
  //           matches.forEach(g => {
  //             g.status = 'Listo para usar';
  //           });
  //           const syncedHtml = matches.map(g => `
  //             <div style="
  //               padding:.65rem 0;
  //               border-bottom:1px solid rgba(255,255,255,.08);
  //             ">
  //               <div>
  //                 <b>${g.imei}</b>
  //               </div>

  //               <div style="
  //                 opacity:.8;
  //                 font-size:.9rem;
  //               ">
  //                 ${g.brand} ${g.model}
  //               </div>
  //             </div>
  //         `).join('');

  //           await this.confirmModal.open({
  //             title: 'Sincronización completada',
  //             message: `
  //               <div style="
  //                 text-align:left;
  //                 max-height:350px;
  //                 overflow:auto;
  //                 padding-right:.35rem;
  //               ">
  //                 ${syncedHtml}
  //               </div>
  //               <br>
  //               <div style="
  //                 margin-top:1rem;
  //                 text-align:center;
  //                 font-weight:500;
  //               ">
  //                 ${matches.length} GPS sincronizado(s) correctamente.
  //               </div>
  //             `,
  //             confirmText: 'Aceptar',
  //             cancelText: ''
  //           });

  //           this.refreshRequested.emit();
  //         },

  //         error: async () => {
  //           await this.confirmModal.open({
  //             title: 'Error',
  //             message: `
  //               <div style="text-align:center;">
  //                 No se pudieron sincronizar los GPS.
  //               </div>
  //             `,
  //             confirmText: 'Aceptar',
  //             cancelText: ''
  //           });
  //         },

  //         complete: () => {
  //           this.gpsLoading = false;
  //         }
  //       });
  //     },

  //     error: async () => {
  //       this.gpsLoading = false;

  //       await this.confirmModal.open({
  //         title: 'Error',
  //         message: `
  //           <div style="text-align:center;">
  //             No se pudo consultar la API.
  //           </div>
  //         `,
  //         confirmText: 'Aceptar',
  //         cancelText: ''
  //       });
  //     }
  //   });
  // }

  async syncGpsWithApi() {

    const gpsInConfig = this.gps.filter(
      g => g.status === 'En configuración'
    );

    if (!gpsInConfig.length) {
      this.toast.warning({
        detail: 'Aviso',
        summary: 'No hay GPS en configuración.',
        duration: 4000
      });

      return;
    }

    const gpsConfigHtml = gpsInConfig.map(g => `
    <div style="
      padding:.65rem 0;
      border-bottom:1px solid rgba(255,255,255,.08);
    ">
      <div><b>${g.imei}</b></div>
      <div style="opacity:.8;font-size:.9rem;">
        ${g.brand} ${g.model}
      </div>
    </div>
  `).join('');

    const confirmed = await this.confirmModal.open({
      title: `GPS en configuración (${gpsInConfig.length})`,
      message: `
      <div style="
        text-align:left;
        max-height:350px;
        overflow:auto;
        padding-right:.35rem;
      ">
        ${gpsConfigHtml}
      </div>
      <br>
      <div style="
        text-align:center;
        font-weight:500;
      ">
        ¿Deseas sincronizar estos GPS?
      </div>
    `,
      confirmText: 'Continuar',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    // ===== SELECCIONAR ALCANCE =====

    const scopeResult = await Swal.fire({
      title: 'Origen de búsqueda',
      text: '¿Dónde deseas buscar los GPS?',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Solo soporte',
      denyButtonText: 'Todas las cuentas',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--color-success)',
      denyButtonColor: 'var(--color-warning)',
      cancelButtonColor: 'var(--color-primary)',
      reverseButtons: true
    });

    if (scopeResult.isDismissed) return;

    const userId = scopeResult.isConfirmed ? 46207 : 0;

    // ===== CONSULTAR API =====
    this.gpsLoading = true;

    this.apiService.syncGpsWithNavixy(userId).subscribe({
      next: async (res: any) => {
        const trackers = res?.trackers || [];

        const imeis = new Set(
          trackers
            .map((t: any) => String(t.imei || '').trim())
            .filter(Boolean)
        );

        const matches = gpsInConfig.filter(g =>
          imeis.has(String(g.imei || '').trim())
        );

        if (!matches.length) {

          this.gpsLoading = false;

          await this.confirmModal.open({
            title: 'Sin coincidencias',
            message: `
              <div style="text-align:center;">
                Ningún GPS fue encontrado en la API.
              </div>
            `,
            confirmText: 'Aceptar',
            cancelText: ''
          });

          return;
        }

        const updates = matches.map(g =>
          this.apiService.updateGps(g.id, {
            status: 'Listo para usar'
          })
        );

        forkJoin(updates).subscribe({
          next: async () => {
            matches.forEach(g => {
              g.status = 'Listo para usar';
            });

            const syncedHtml = matches.map(g => `
              <div style="
                padding:.65rem 0;
                border-bottom:1px solid rgba(255,255,255,.08);
              ">
                <div><b>${g.imei}</b></div>
                <div style="opacity:.8;font-size:.9rem;">
                  ${g.brand} ${g.model}
                </div>
              </div>
            `).join('');

            await this.confirmModal.open({
              title: 'Sincronización completada',
              message: `
              <div style="
                text-align:left;
                max-height:350px;
                overflow:auto;
                padding-right:.35rem;
              ">
                ${syncedHtml}
              </div>

              <br>

              <div style="
                text-align:center;
                font-weight:500;
              ">
                ${matches.length} GPS sincronizado(s) correctamente.
              </div>
            `,
              confirmText: 'Aceptar',
              cancelText: ''
            });

            this.refreshRequested.emit();
          },

          error: async () => {

            await this.confirmModal.open({
              title: 'Error',
              message: `
              <div style="text-align:center;">
                No se pudieron sincronizar los GPS.
              </div>
            `,
              confirmText: 'Aceptar',
              cancelText: ''
            });
          },

          complete: () => {
            this.gpsLoading = false;
          }
        });
      },

      error: async () => {

        this.gpsLoading = false;

        await this.confirmModal.open({
          title: 'Error',
          message: `
          <div style="text-align:center;">
            No se pudo consultar la API.
          </div>
        `,
          confirmText: 'Aceptar',
          cancelText: ''
        });
      }
    });
  }

}
