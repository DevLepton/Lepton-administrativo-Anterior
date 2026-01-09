import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { forkJoin } from 'rxjs';

type DeviceStatus = 'En inventario' | 'En configuración' | 'Instalado' | string;

interface MiniItem {
  modelo: string;
  estatus: DeviceStatus;
}

@Component({
  selector: 'app-almacen',
  templateUrl: './almacen.component.html',
  styleUrl: './almacen.component.scss'
})
export class AlmacenComponent implements OnInit {
  activeTabIndex = 0;

  // Solo para resumen
  gpsResumen: MiniItem[] = [];
  simsResumen: MiniItem[] = [];
  accessoriesResumen: MiniItem[] = [];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadResumen();
  }

  onTabChange(index: number) {
    this.activeTabIndex = index;
  }

  private loadResumen() {
    forkJoin({
      gps: this.apiService.getGps(),
      sims: this.apiService.getSims(),
      accessories: this.apiService.getAccessories()
    }).subscribe(({ gps, sims, accessories }: any) => {
      const gpsList = Array.isArray(gps?.data) ? gps.data : (Array.isArray(gps) ? gps : []);
      const simsList = Array.isArray(sims?.data) ? sims.data : (Array.isArray(sims) ? sims : []);
      const accList = Array.isArray(accessories?.data) ? accessories.data : (Array.isArray(accessories) ? accessories : []);

      this.gpsResumen = gpsList.map((d: any) => ({ modelo: d.model ?? '—', estatus: d.status ?? '' }));
      this.simsResumen = simsList.map((d: any) => ({ modelo: d.model ?? '—', estatus: d.status ?? '' }));
      this.accessoriesResumen = accList.map((d: any) => ({ modelo: d.model ?? '—', estatus: d.status ?? '' }));
    });
  }

  // ===== Resumen helpers =====
  private isInStockStatus(status: string): boolean {
    const s = (status ?? '').toString().trim().toLowerCase();
    return s === 'en inventario' || s === 'en configuración';
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

  private groupCountByModel(list: MiniItem[]) {
    const map = new Map<string, number>();
    for (const item of (list ?? [])) {
      if (!this.isInStockStatus(item.estatus)) continue;
      const key = this.normalizeModel(item.modelo);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([modelo, cantidad]) => ({ modelo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad || a.modelo.localeCompare(b.modelo));
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
}
