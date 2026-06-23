import { Component, OnInit } from '@angular/core';
import { ApiService, CreateRequestPayload, DeviceStatus, RequestedDeviceItem } from '../../services/api.service';
import { catchError, forkJoin, of } from 'rxjs';
import { NgToastService } from 'ng-angular-popup';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';

interface MiniItem {
  modelo: string;
  estatus: DeviceStatus;
}

interface RequestedItemUI {
  model: string;
  quantity: number;
}

@Component({
  selector: 'app-almacen',
  templateUrl: './almacen.component.html',
  styleUrl: './almacen.component.scss'
})
export class AlmacenComponent implements OnInit {
  isInventoryUser = false;
  isSupportUser = false;

  activeTabIndex = 0;

  // Solo para resumen
  gpsResumen: MiniItem[] = [];
  simsResumen: MiniItem[] = [];
  accessoriesResumen: MiniItem[] = [];

  // Nuevas listas completas
  gpsFull: any[] = [];
  simsFull: any[] = [];
  accessoriesFull: any[] = [];

  constructor(private authService: AuthService, private apiService: ApiService, private toast: NgToastService) { }

  ngOnInit(): void {
    const role = this.authService.getUserRole();

    this.isInventoryUser = role === 'inventario';
    this.isSupportUser = role === 'soporte';

    // por seguridad/UX:
    if (!this.isSupportUser) {
      this.requestSidebarOpen = false;
      this.requestedItems = [];
    }

    this.loadResumen();
  }

  onTabChange(index: number) {
    this.activeTabIndex = index;
  }

  loadResumen(forceRefresh = false) {
    this.apiService.getDevicesCached({}, forceRefresh)
      .subscribe((res: any) => {

        const all = Array.isArray(res?.data) ? res.data : [];

        this.gpsFull = all.filter((d: { type: any; }) => d.type === 'gps').reverse();
        this.simsFull = all.filter((d: { type: any; }) => d.type === 'sim').reverse();
        this.accessoriesFull = all.filter((d: { type: any; }) => d.type === 'accessory').reverse();

        this.gpsResumen = this.gpsFull.map(d => ({
          modelo: d.model ?? '—',
          estatus: d.status ?? ''
        }));

        this.simsResumen = this.simsFull.map(d => ({
          modelo: d.model ?? '—',
          estatus: d.status ?? ''
        }));

        this.accessoriesResumen = this.accessoriesFull.map(d => ({
          modelo: d.model ?? '—',
          estatus: d.status ?? ''
        }));
      });
  }

  refreshDevices() {
    this.loadResumen(true);
  }

  // ===== Resumen helpers =====
  private isInStockStatus(status: string): boolean {
    const s = (status ?? '').toString().trim().toLowerCase();
    return s === 'en inventario' || s === 'en configuración';
  }

  private isInventoryStatus(status: string): boolean {
    return (status ?? '').toString().trim().toLowerCase() === 'en inventario';
  }

  private isConfigurationStatus(status: string): boolean {
    return (status ?? '').toString().trim().toLowerCase() === 'en configuración';
  }

  private normalizeModel(v: any): string {
    const s = (v ?? '').toString().trim();
    return s.length ? s : '—';
  }

  get gpsInStockCount(): number {
    return (this.gpsResumen ?? []).filter(x => this.isInStockStatus(x.estatus)).length;
  }

  get simsInStockCount(): number {
    return (this.simsResumen ?? []).filter(x => this.isInStockStatus(x.estatus)).length;
  }

  get accessoriesInStockCount(): number {
    return (this.accessoriesResumen ?? []).filter(x => this.isInStockStatus(x.estatus)).length;
  }

  get totalDevicesInStock(): number {
    return this.gpsInStockCount + this.simsInStockCount + this.accessoriesInStockCount;
  }

  // ===== GPS =====
  get gpsInventoryCount(): number {
    return (this.gpsResumen ?? []).filter(x => this.isInventoryStatus(x.estatus)).length;
  }

  get gpsConfigurationCount(): number {
    return (this.gpsResumen ?? []).filter(x => this.isConfigurationStatus(x.estatus)).length;
  }

  // ===== SIM =====
  get simsInventoryCount(): number {
    return (this.simsResumen ?? []).filter(x => this.isInventoryStatus(x.estatus)).length;
  }

  get simsConfigurationCount(): number {
    return (this.simsResumen ?? []).filter(x => this.isConfigurationStatus(x.estatus)).length;
  }

  // ===== Accesorios =====
  get accessoriesInventoryCount(): number {
    return (this.accessoriesResumen ?? []).filter(x => this.isInventoryStatus(x.estatus)).length;
  }

  get accessoriesConfigurationCount(): number {
    return (this.accessoriesResumen ?? []).filter(x => this.isConfigurationStatus(x.estatus)).length;
  }

  // ===== Totales generales =====
  get totalInventoryCount(): number {
    return this.gpsInventoryCount + this.simsInventoryCount + this.accessoriesInventoryCount;
  }

  get totalConfigurationCount(): number {
    return this.gpsConfigurationCount + this.simsConfigurationCount + this.accessoriesConfigurationCount;
  }

  private groupCountByModel(list: MiniItem[]) {
    const map = new Map<string, {
      modelo: string;
      inventario: number;
      configuracion: number;
      total: number;
    }>();

    for (const item of (list ?? [])) {
      const status = (item.estatus ?? '').toString().trim().toLowerCase();

      if (status !== 'en inventario' && status !== 'en configuración') continue;

      const key = this.normalizeModel(item.modelo);

      if (!map.has(key)) {
        map.set(key, {
          modelo: key,
          inventario: 0,
          configuracion: 0,
          total: 0
        });
      }

      const current = map.get(key)!;

      if (status === 'en inventario') current.inventario++;
      if (status === 'en configuración') current.configuracion++;

      current.total++;
    }

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total || a.modelo.localeCompare(b.modelo));
  }

  get gpsByModelInStock() { return this.groupCountByModel(this.gpsResumen); }
  get simsByModelInStock() { return this.groupCountByModel(this.simsResumen); }
  get accessoriesByModelInStock() { return this.groupCountByModel(this.accessoriesResumen); }

  stockBadgeText(qty: number): string {
    if (qty <= 0) return 'Sin existencia';
    if (qty < 5) return 'Últimos en existencia';
    return 'En existencia';
  }

  stockBadgeClass(qty: number): string {
    if (qty <= 0) return 'none';
    if (qty < 5) return 'low';
    return 'ok';
  }

  // ===== Sidebar Solicitud (push) =====
  requestSidebarOpen = false;
  creatingRequest = false;

  requestedItems: RequestedItemUI[] = [];

  toggleRequestSidebar() {
    if (!this.isSupportUser) return;
    this.requestSidebarOpen = !this.requestSidebarOpen;
  }

  openRequestSidebar() {
    if (!this.isSupportUser) return;
    this.requestSidebarOpen = true;
  }

  closeRequestSidebar() {
    this.requestSidebarOpen = false;
  }

  get requestedTotal(): number {
    return this.requestedItems.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
  }

  addRequestedModel(modelRaw: string) {
    if (!this.isSupportUser) return;
    const model = (modelRaw ?? '').toString().trim();
    if (!model) return;

    // Límite total 50 (igual que modal)
    const allowed = 50 - this.requestedTotal;
    if (allowed <= 0) {
      this.toast.warning({ detail: 'Aviso', summary: 'Límite alcanzado (50)', duration: 2500 });
      return;
    }

    const idx = this.requestedItems.findIndex(x => x.model.toLowerCase() === model.toLowerCase());
    if (idx >= 0) {
      this.requestedItems[idx] = { ...this.requestedItems[idx], quantity: this.requestedItems[idx].quantity + 1 };
    } else {
      this.requestedItems.push({ model, quantity: 1 });
    }

    this.requestedItems = [...this.requestedItems];
  }

  incRequested(i: number) {
    if (!this.isSupportUser) return;
    if (this.requestedTotal >= 50) return;
    this.requestedItems[i] = { ...this.requestedItems[i], quantity: this.requestedItems[i].quantity + 1 };
    this.requestedItems = [...this.requestedItems];
  }

  decRequested(i: number) {
    if (!this.isSupportUser) return;
    const q = this.requestedItems[i].quantity - 1;
    if (q < 1) return;
    this.requestedItems[i] = { ...this.requestedItems[i], quantity: q };
    this.requestedItems = [...this.requestedItems];
  }

  removeRequested(i: number) {
    if (!this.isSupportUser) return;
    this.requestedItems.splice(i, 1);
    this.requestedItems = [...this.requestedItems];
  }

  clearRequestedList() {
    if (!this.isSupportUser) return;
    this.requestedItems = [];
  }

  createRequestFromSidebar() {
    if (!this.isSupportUser) return;
    if (this.requestedItems.length === 0) return;

    const total = this.requestedTotal;
    if (total < 1 || total > 50) {
      this.toast.warning({ detail: 'Aviso', summary: 'La cantidad total debe estar entre 1 y 50', duration: 3000 });
      return;
    }

    Swal.fire({
      title: '¿Crear petición?',
      icon: 'question',
      html: `
        <div style="text-align:left">
          ${this.requestedItems
          .slice(0, 12)
          .map(x => `<div><b>${x.model}</b> — ${x.quantity}</div>`)
          .join('')}
          ${this.requestedItems.length > 12 ? `<div style="margin-top:.5rem;opacity:.8">…y ${this.requestedItems.length - 12} más</div>` : ''}
          <hr style="margin: .75rem 0;">
          <div>Total: <b>${total}</b>/50</div>
        </div>
      `,
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Crear',
      reverseButtons: true,
      confirmButtonColor: 'var(--color-primary)',
      cancelButtonColor: 'var(--color-primary)',
    }).then(result => {
      if (!result.isConfirmed) return;

      this.creatingRequest = true;

      const devicesRequested: RequestedDeviceItem[] = this.requestedItems.map(x => ({
        model: x.model,
        quantity: x.quantity
      }));

      const payload: CreateRequestPayload = {
        status: 'Pendiente',
        requestDate: new Date(),
        responseDate: null,
        devicesRequested,
        quantity: total,
        comments: null,
      };

      this.apiService.createRequest(payload).pipe(
        catchError(err => {
          const msg = err?.error?.error || err?.error?.message || 'No se pudo crear la petición';
          this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
          return of({ __error: true });
        })
      ).subscribe((resp: any) => {
        if (resp?.__error) {
          this.creatingRequest = false;
          return;
        }

        this.toast.success({ detail: 'Éxito', summary: 'Petición creada', duration: 3500 });
        this.creatingRequest = false;

        // limpia lista y (opcional) cierra sidebar
        this.clearRequestedList();
        this.closeRequestSidebar();
      });
    });
  }

}
