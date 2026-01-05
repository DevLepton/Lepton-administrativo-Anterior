import { Component, OnInit, ViewChild } from '@angular/core';
import { ApiService, CreateGpsPayload } from '../../services/api.service';
import { NgToastService } from 'ng-angular-popup';
import Swal from 'sweetalert2';
import { NewSimModalComponent } from '../../modals/new-sim-modal/new-sim-modal.component';
import { ViewSimModalComponent } from '../../modals/view-sim-modal/view-sim-modal.component';
import { EditSimModalComponent } from '../../modals/edit-sim-modal/edit-sim-modal.component';
import { catchError, forkJoin, of } from 'rxjs';
import { NewGpsModalComponent } from '../../modals/new-gps-modal/new-gps-modal.component';
import { ViewGpsModalComponent } from '../../modals/view-gps-modal/view-gps-modal.component';
import { EditGpsModalComponent } from '../../modals/edit-gps-modal/edit-gps-modal.component';

// === Interface SIM ===
interface SimItem {
  id: string;            // <- _id de Mongo (string)
  iccid: string;
  modelo: string;
  compania: string;
  estatus: 'En inventario' | 'En configuración' | 'Instalado' | string;
  fechaCompra: string | Date | null;
  fechaIngresoLepton: string | Date | null;
  cliente?: string;
  comments?: string;
}

interface GpsItem {
  id: string;                         // _id de Mongo
  imei: string;                       // requerido y único
  sn: string;                         // requerido y único (para no-sim)
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

type InvStatus = 'EN_EXISTENCIA' | 'SIN_EXISTENCIA' | 'SOLICITAR' | 'ULTIMOS' | 'NO_USAR';

interface InventarioItem {
  modelo: string;
  cantidad: number;
  status?: InvStatus;   // opcional: forzar estatus manualmente
}

interface InventarioGrupo {
  nombre: string;
  color?: string;       // color para la etiqueta del grupo (opcional)
  items: InventarioItem[];
}


@Component({
  selector: 'app-almacen',
  templateUrl: './almacen.component.html',
  styleUrl: './almacen.component.scss'
})
export class AlmacenComponent implements OnInit {

  @ViewChild(NewSimModalComponent) newSimModal!: NewSimModalComponent;
  @ViewChild(ViewSimModalComponent) viewSimModal!: ViewSimModalComponent;
  @ViewChild(EditSimModalComponent) editSimModal!: EditSimModalComponent;

  @ViewChild(NewGpsModalComponent) newGpsModal!: NewGpsModalComponent;
  @ViewChild(ViewGpsModalComponent) viewGpsModal!: ViewGpsModalComponent;
  @ViewChild(EditGpsModalComponent) editGpsModal!: EditGpsModalComponent;

  sims: SimItem[] = [];
  simsLoading = false;
  simsDeletingId: string | null = null;

  private mapDeviceToSimItem(d: any): SimItem {
    return {
      id: String(d._id),
      iccid: d.iccid,
      modelo: d.model,                // model -> modelo
      compania: d.company,            // company -> compania
      estatus: d.status ?? 'stock',   // status -> estatus (para tu UI)
      fechaCompra: d.purchaseDate ?? null,        // purchaseDate -> fechaCompra
      fechaIngresoLepton: d.entryDate ?? null,    // entryDate -> fechaIngresoLepton
      cliente: d.client ?? '',
      comments: d.comments ?? ''
    };
  }

  inventarioGrupos: InventarioGrupo[] = [
    {
      nombre: 'TARJETAS SIMS',
      color: '#1f8eeb',
      items: [
        { modelo: '2 3 ff', cantidad: 130 },
        { modelo: '4ff', cantidad: 49 },
      ],
    },
    {
      nombre: 'TELTONIKA',
      color: '#1f8eeb',
      items: [
        { modelo: 'FMB920 (2G)', cantidad: 0 },
        { modelo: 'FMU130 (3G)', cantidad: 0 },
        { modelo: 'FMC130 (4G, 2G, 3G)', cantidad: 25 },
        { modelo: 'FMC230 (4G, 2G)', cantidad: 9 },
        { modelo: 'FMC920 (4G,2G)', cantidad: 0 },
        { modelo: 'FMM130 (3G, 2G)', cantidad: 0 },
      ],
    },
    {
      nombre: 'QUECLINK - OUTLETS',
      color: '#1f8eeb',
      items: [
        { modelo: 'GV55W (3G)', cantidad: 0 },
        { modelo: 'GV75W (3G)', cantidad: 0 },
        { modelo: 'GV300 (2G)', cantidad: 0 },
        { modelo: 'GV300N (3G)', cantidad: 1 }, // en hoja se sugiere “SOLICITAR”
        { modelo: 'GV300W (3G)', cantidad: 1 }, // idem
        { modelo: 'GV350MA (4G)', cantidad: 4 },// “SOLICITAR”
        { modelo: 'FMM130 (3G, 2G)', cantidad: 2 }, // “SOLICITAR”
      ],
    },
    {
      nombre: 'SUNTECH - CanBus',
      color: '#1f8eeb',
      items: [
        { modelo: 'ST20', cantidad: 1 },             // “SOLICITAR”
        { modelo: 'ST 340LC (2G)', cantidad: 0 },    // “SIN EXISTENCIA”
        { modelo: 'ST 840LC (2G)', cantidad: 0 },
        { modelo: 'ST 94LC (2G)', cantidad: 0, status: 'NO_USAR' }, // “YA NO SE VA A UTILIZAR”
      ],
    },
    {
      nombre: 'MEITRACK',
      color: '#1f8eeb',
      items: [
        { modelo: 'T366G (3G)', cantidad: 1 }, // “SOLICITAR”
        { modelo: 'MV380 (2G)', cantidad: 0 },
        { modelo: 'MVT380 (2G)', cantidad: 0, status: 'NO_USAR' },
        { modelo: 'MVT600 (2G)', cantidad: 0, status: 'NO_USAR' },
      ],
    },
    {
      nombre: 'OTROS GPS - CanBus',
      color: '#7a3cff',
      items: [
        { modelo: 'TOPFLY TLW1', cantidad: 0 },
        { modelo: 'TOPFLY TPL2-SFB', cantidad: 1 }, // “SOLICITAR”
        { modelo: 'Ruptela FM-Pro4', cantidad: 1 }, // “SOLICITAR”
        { modelo: 'WeTrack2 (2G)', cantidad: 0 },
        { modelo: 'CAN100_STD', cantidad: 2 },      // “SOLICITAR”
        { modelo: 'LV-CAN200', cantidad: 2 },       // “SOLICITAR”
      ],
    },
  ];

  // Regla de estatus por cantidad (puedes ajustarla)
  computeStatus(item: InventarioItem): InvStatus {
    if (item.status) return item.status;     // prioridad a override
    const n = item.cantidad ?? 0;
    if (n <= 0) return 'SIN_EXISTENCIA';
    if (n <= 2) return 'SOLICITAR';
    if (n <= 5) return 'ULTIMOS';
    return 'EN_EXISTENCIA';
  }

  // Texto visible
  statusText(s: InvStatus): string {
    switch (s) {
      case 'EN_EXISTENCIA': return 'EN EXISTENCIA';
      case 'SIN_EXISTENCIA': return 'SIN EXISTENCIA';
      case 'SOLICITAR': return 'SOLICITAR';
      case 'ULTIMOS': return 'ÚLTIMOS EN EXISTENCIA';
      case 'NO_USAR': return 'YA NO SE VA A UTILIZAR';
    }
  }

  // Pestañas
  activeTabIndex = 0; // 0: Resumen, 1: SIM's, 2: GPS's, 3: Accesorios

  constructor(private apiService: ApiService, private toast: NgToastService) { }

  ngOnInit(): void {
    this.loadSims();
    this.loadGps();
  }

  onTabChange(index: number) {
    this.activeTabIndex = index;
    if (index === 1 && this.sims.length === 0 && !this.simsLoading) {
      this.loadSims();           // ← opcional: carga perezosa al abrir pestaña SIM's
    }
  }

  private objectIdEpoch(id: string): number {
    // primeros 8 hex del ObjectId = segundos UNIX
    return parseInt(id.substring(0, 8), 16);
  }

  loadSims(): void {
    this.simsLoading = true;
    this.apiService.getSims().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        this.sims = list
          .map((d: any) => this.mapDeviceToSimItem(d))
          .sort((a: any, b: any) => this.objectIdEpoch(b.id) - this.objectIdEpoch(a.id));
        this.simsInitial = [...this.sims];
        this.simsCurrentPage = 1;
        this.sortKey = 'no';
        this.sortDir = 'desc';
      },
      error: (err) => {
        console.error('Error al cargar SIMs:', err);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los SIMs', duration: 5000 });
      },
      complete: () => this.simsLoading = false
    });
  }

  getStatusClass(estatus: string): string {
    if (estatus === 'activo') return 'status-activo';
    if (estatus === 'inactivo') return 'status-inactivo';
    return 'status-pendiente';
  }

  simsPerPage = 10;
  simsCurrentPage = 1;
  simsShowAll = true;

  get displayedSims(): SimItem[] {
    const src = this.simsFiltered;
    if (this.simsShowAll) return src;
    const start = (this.simsCurrentPage - 1) * this.simsPerPage;
    return src.slice(start, start + this.simsPerPage);
  }

  get simsTotalPages(): number {
    const total = Math.ceil(this.simsFiltered.length / this.simsPerPage);
    return Math.max(1, total);
  }

  onSimFilterChange() {
    this.simsCurrentPage = 1;
  }

  setSimsPage(p: number) {
    // acotar siempre al rango válido
    const total = this.simsTotalPages;
    this.simsCurrentPage = Math.min(Math.max(1, p), total);
  }

  toggleSimsShowAll() {
    this.simsShowAll = !this.simsShowAll;
    // al cambiar modo, resetea y acota
    this.simsCurrentPage = 1;
  }

  // === Acciones SIM ===
  nuevoSim() {
    this.newSimModal.open();
  }

  onSimCreated(evt: {
    type: 'sim';
    iccid: string;
    model: string;
    company: string;
    status: 'En inventario' | 'En configuración' | 'Instalado';
    purchaseDate: string;         // 'YYYY-MM-DD'
    entryDate: string;            // 'YYYY-MM-DD'
    installationDate?: string | null;
    client?: string | null;
    comments?: string | null;
  }) {
    this.apiService.createSim(evt).subscribe({
      next: () => {
        this.toast.success({ detail: 'Éxito', summary: 'SIM registrado con éxito', duration: 4000 });
        this.loadSims(); // recarga la tabla desde la API
      },
      error: (err) => {
        const msg = err?.error?.error || 'Error al registrar SIM';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      }
    });
  }

  onSimsBulkCreated(list: Array<{
    type: 'sim';
    iccid: string;
    model: string;
    company: string;
    status: 'En inventario' | 'En configuración' | 'Instalado';
    purchaseDate: string;   // 'YYYY-MM-DD'
    entryDate: string;      // 'YYYY-MM-DD'
    installationDate?: string | null;
    client?: string | null;
    comments?: string | null;
  }>) {
    // Validación básica
    if (!Array.isArray(list) || list.length === 0) {
      this.toast.warning({ detail: 'Aviso', summary: 'No hay SIMs para registrar.', duration: 3000 });
      return;
    }

    // Normaliza payloads (ej. iccid sin espacios)
    const payloads = list.map(item => ({
      ...item,
      iccid: String(item.iccid || '').trim(),
    }));

    // Construye requests con manejo de error por item
    const requests = payloads.map(p =>
      this.apiService.createSim(p).pipe(
        // No detenemos todo el batch si uno falla
        catchError(err => of({ __error: err }))
      )
    );

    // Ejecuta todas las llamadas y resume resultados
    forkJoin(requests).subscribe({
      next: (results: any[]) => {
        const successes = results.filter(r => !r?.__error).length;
        const failures = results.length - successes;

        if (successes > 0) {
          this.toast.success({
            detail: 'Éxito',
            summary: `Se registraron ${successes} SIM(s) correctamente.`,
            duration: 5000
          });
        }
        if (failures > 0) {
          this.toast.error({
            detail: 'Error',
            summary: `No se pudieron registrar ${failures} SIM(s).`,
            duration: 6000
          });
        }

        // Refresca la tabla una sola vez al terminar
        this.loadSims();
      },
      error: () => {
        // forkJoin solo entra aquí si falla el stream completo (muy raro por el catchError)
        this.toast.error({
          detail: 'Error',
          summary: 'Fallo el registro masivo.',
          duration: 6000
        });
        this.loadSims();
      }
    });
  }



  editarSim(sim: SimItem) {
    const found = this.sims.find(s => s.id === sim.id);
    if (!found) {
      this.toast.error({ detail: 'Error', summary: 'SIM no encontrado', duration: 4000 });
      return;
    }

    this.editSimModal.open({
      id: found.id,
      iccid: found.iccid,
      model: found.modelo,             // ojo: en UI usas `modelo`, en backend `model`
      company: found.compania,
      status: (found.estatus as any) || 'En inventario',
      purchaseDate: found.fechaCompra ?? null,
      entryDate: found.fechaIngresoLepton ?? null,
      installationDate: null,          // completa si lo traes en la lista
      client: found.cliente ?? '',
      comments: found.comments ?? ''                    // completa si lo traes en la lista
    });
  }

  onSimUpdated(evt: { id: string; payload: any }) {
    this.apiService.updateSim(evt.id, evt.payload).subscribe({
      next: () => {
        this.toast.success({ detail: 'Éxito', summary: 'SIM actualizado con éxito', duration: 4000 });
        this.loadSims();
      },
      error: (err) => {
        const msg = err?.error?.error || 'Error al actualizar SIM';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      }
    });
  }

  eliminarSim(sim: SimItem) {
    Swal.fire({
      title: '¿Estás seguro de eliminar este SIM?',
      html: `
        <div style="text-align:left">
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
          // Quitar de la lista local para una UX más ágil
          this.sims = this.sims.filter(s => s.id !== sim.id);
          this.simsInitial = this.simsInitial.filter(s => s.id !== sim.id);

          // Si estás en modo paginado y borras el último de la página, ajusta página
          if (!this.simsShowAll) {
            const totalPages = Math.max(1, Math.ceil(this.sims.length / this.simsPerPage));
            if (this.simsCurrentPage > totalPages) this.simsCurrentPage = totalPages;
          }

          this.toast.success({ detail: 'Éxito', summary: 'SIM eliminado correctamente', duration: 4000 });
        },
        error: (err) => {
          const msg = err?.error?.error || 'No se pudo eliminar el SIM';
          this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
        },
        complete: () => {
          this.simsDeletingId = null;
        }
      });
    });
  }

  verSim(sim: SimItem) {
    // Busca el SIM en la lista actual para garantizar que mostramos lo que hay en UI
    const found = this.sims.find(s => s.id === sim.id);
    if (!found) {
      this.toast.error({ detail: 'Error', summary: 'SIM no encontrado en la lista', duration: 4000 });
      return;
    }

    this.viewSimModal.open({
      id: found.id,
      iccid: found.iccid,
      modelo: found.modelo,
      compania: found.compania,
      estatus: found.estatus,
      fechaCompra: found.fechaCompra ?? null,
      fechaIngresoLepton: found.fechaIngresoLepton ?? null,
      cliente: found.cliente ?? '',
      comentarios: found.comments ?? '' // coloca aquí si manejas comments en la UI
    });
  }

  asignarSim(sim: SimItem) {
    // TODO: abrir modal para asignar a cliente/equipo
    console.log('Asignar SIM', sim);
  }

  get uniqueSimModels(): string[] {
    // toma los modelos existentes en `this.sims`, quita vacíos, únicos y ordena
    const set = new Set(
      (this.sims ?? []).map(s => s.modelo).filter(Boolean) as string[]
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  get uniqueSimCompanies(): string[] {
    const set = new Set((this.sims ?? []).map(s => s.compania).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  get uniqueSimStatuses(): string[] {
    const set = new Set((this.sims ?? []).map(s => s.estatus).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  // === Ordenación SIMs ===
  private simsInitial: SimItem[] = [];

  sortKey: keyof SimItem | 'no' = 'no';  // 'no' = numeración; no cambia el array
  sortDir: 'asc' | 'desc' = 'desc';      // por defecto desc (coincide con tu carga inicial)

  // Normaliza string
  private s(v: any): string {
    return (v ?? '').toString().trim().toLowerCase();
  }

  // Normaliza fecha a medianoche UTC (evita “un día menos”)
  private ymdUtcMs(v: any): number {
    if (!v) return 0;
    const d = new Date(v);
    if (isNaN(d.getTime())) return 0;
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  resetSort() {
    this.sims = [...this.simsInitial];
    this.sortKey = 'no';     // sin columna activa
    this.sortDir = 'desc';   // coincide con tu orden inicial
    this.simsCurrentPage = 1;
  }

  sortBy(key: keyof SimItem | 'no') {
    // ciclo: asc -> desc -> inicial (si se repite el mismo header)
    if (this.sortKey === key) {
      if (this.sortDir === 'asc') {
        this.sortDir = 'desc';
      } else {
        // tercera pulsación sobre el mismo encabezado => volver al inicial
        this.resetSort();
        return;
      }
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }

    if (key === 'no') return; // “No.” no reordena

    const dir = this.sortDir === 'asc' ? 1 : -1;

    this.sims = [...this.sims].sort((a, b) => {
      let av: any = (a as any)[key];
      let bv: any = (b as any)[key];

      if (key === 'fechaCompra' || key === 'fechaIngresoLepton') {
        const ams = this.ymdUtcMs(av);
        const bms = this.ymdUtcMs(bv);
        return (ams - bms) * dir;
      }

      if (key === 'iccid' || key === 'modelo' || key === 'compania' || key === 'estatus' || key === 'cliente') {
        const as = this.s(av);
        const bs = this.s(bv);
        if (as < bs) return -1 * dir;
        if (as > bs) return 1 * dir;
        return 0;
      }

      const as = this.s(av);
      const bs = this.s(bv);
      if (as < bs) return -1 * dir;
      if (as > bs) return 1 * dir;
      return 0;
    });

    this.simsCurrentPage = 1;
  }

  // Helper para mostrar la flecha en el header activo
  arrowFor(key: keyof SimItem | 'no'): string {
    if (this.sortKey !== key) return '';
    return this.sortDir === 'asc' ? '▲' : '▼';
  }

  simsSearch = '';
  simsFilterCompany = '';
  simsFilterStatus = '';

  updateSimSearch(v: string) {
    this.simsSearch = (v ?? '').trim();
    this.simsCurrentPage = 1;
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

  // ---- Filtros de fecha (sin cambios visuales) ----
  purchaseDateFilter: Date | null = null;
  entryDateFilter: Date | null = null;

  onPurchaseDateChange(d: Date | null) { this.purchaseDateFilter = d; this.simsCurrentPage = 1; }
  clearPurchaseDate() { this.onPurchaseDateChange(null); }
  onEntryDateChange(d: Date | null) { this.entryDateFilter = d; this.simsCurrentPage = 1; }
  clearEntryDate() { this.onEntryDateChange(null); }


  // Lista filtrada con base en this.sims + el texto de bÃºsqueda
  get simsFiltered(): SimItem[] {
    const q = this.s(this.simsSearch);
    const fc = this.s(this.simsFilterCompany);
    const fs = this.s(this.simsFilterStatus);

    // Precalcula claves de día para los filtros de datepicker (UTC)
    const purchaseKey = this.dayKeyFromPickerLocal(this.purchaseDateFilter);
    const entryKey = this.dayKeyFromPickerLocal(this.entryDateFilter);

    return (this.sims ?? []).filter(sim => {
      const okSearch = !q || this.s(sim.iccid).includes(q);
      const okCompany = !fc || this.s(sim.compania) === fc;
      const okStatus = !fs || this.s(sim.estatus) === fs;

      // Claves UTC para las fechas del SIM (vengan como string o Date)
      const simPurchaseKey = this.dayKeyUTC(sim.fechaCompra);
      const simEntryKey = this.dayKeyUTC(sim.fechaIngresoLepton);

      const okPurchase = !purchaseKey || (simPurchaseKey !== null && simPurchaseKey === purchaseKey);
      const okEntry = !entryKey || (simEntryKey !== null && simEntryKey === entryKey);

      return okSearch && okCompany && okStatus && okPurchase && okEntry;
    });
  }

  // ==== Estado GPS ====
  gps: GpsItem[] = [];
  gpsLoading = false;
  gpsDeletingId: string | null = null;

  // paginado/filtros
  gpsPerPage = 10;
  gpsCurrentPage = 1;
  gpsShowAll = true;

  gpsSearch = '';                 // por IMEI/Serie
  gpsFilterBrand = '';
  gpsFilterStatus = '';
  gpsFilterModel = '';
  gpsPurchaseDateFilter: Date | null = null;
  gpsEntryDateFilter: Date | null = null;

  // ordenación
  private gpsInitial: GpsItem[] = [];
  gpsSortKey: keyof GpsItem | 'no' = 'no';
  gpsSortDir: 'asc' | 'desc' = 'desc';

  // ==== Mapeo desde API -> UI ====
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

  private byIdDesc = (a: GpsItem, b: GpsItem) =>
    this.objectIdEpoch(b.id) - this.objectIdEpoch(a.id);

  // ==== Carga ====
  loadGps(): void {
    this.gpsLoading = true;

    this.apiService.getGps().subscribe({
      next: (res: { data?: any[] } | any[]) => {
        // tipa list para que no se propague 'any'
        const list: any[] = Array.isArray((res as any)?.data)
          ? (res as any).data
          : (Array.isArray(res) ? (res as any[]) : []);

        this.gps = list
          .map((d: any) => this.mapDeviceToGpsItem(d))      // GpsItem[]
          .sort((a: GpsItem, b: GpsItem) => this.byIdDesc(a, b)); // 👈 tipado

        this.gpsInitial = [...this.gps];
        this.gpsCurrentPage = 1;
        this.gpsSortKey = 'no';
        this.gpsSortDir = 'desc';
      },
      error: (err) => {
        console.error('Error al cargar GPS:', err);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los GPS', duration: 5000 });
      },
      complete: () => (this.gpsLoading = false),
    });
  }

  // ==== Filtros / búsqueda / paginado (GPS) ====
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

  // lista filtrada
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

  // ==== Ordenación (GPS) ====
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
    } else { this.gpsSortKey = key; this.gpsSortDir = 'asc'; }

    if (key === 'no') return;
    const dir = this.gpsSortDir === 'asc' ? 1 : -1;

    this.gps = [...this.gps].sort((a, b) => {
      let av: any = (a as any)[key];
      let bv: any = (b as any)[key];

      if (key === 'fechaCompra' || key === 'fechaIngresoLepton') {
        const ams = this.ymdUtcMs(av), bms = this.ymdUtcMs(bv);
        return (ams - bms) * dir;
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

  // ==== Listas únicas para filtros (GPS) ====
  get uniqueGpsBrands(): string[] {
    const set = new Set((this.gps ?? []).map(g => g.marca).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }
  get uniqueGpsModels(): string[] {
    const set = new Set((this.gps ?? []).map(g => g.modelo).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }
  get uniqueGpsStatuses(): string[] {
    const set = new Set((this.gps ?? []).map(g => g.estatus).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  // ==== CRUD GPS ====
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
    this.apiService.createGps(evt).subscribe({
      next: () => { this.toast.success({ detail: 'Éxito', summary: 'GPS registrado', duration: 4000 }); this.loadGps(); },
      error: (err) => {
        const msg = err?.error?.error || 'Error al registrar GPS';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
      }
    });
  }

  onGpsBulkCreated(list: Array<{
    type: 'gps';
    imei: string;
    sn: string;
    name: string;
    brand: string;
    model: string;
    status: 'En inventario' | 'En configuración' | 'Instalado';
    purchaseDate: string;       // 'YYYY-MM-DD'
    entryDate: string;          // 'YYYY-MM-DD'
    installationDate?: string | null;
    client?: string | null;
    comments?: string | null;
  }>) {
    if (!Array.isArray(list) || list.length === 0) {
      this.toast.warning({ detail: 'Aviso', summary: 'No hay GPS para registrar.', duration: 3000 });
      return;
    }
    const payloads = list.map(x => ({
      ...x,
      imei: String(x.imei || '').trim(),
      sn: String(x.sn || '').trim(),
    }));
    const reqs = payloads.map(p => this.apiService.createGps(p).pipe(catchError(err => of({ __error: err }))));

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
    if (!found) { this.toast.error({ detail: 'Error', summary: 'GPS no encontrado', duration: 4000 }); return; }
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

  onGpsUpdated(evt: {
    id: string;
    payload: Partial<Omit<CreateGpsPayload, 'type'>>;
  }) {
    this.apiService.updateGps(evt.id, evt.payload).subscribe({
      next: () => {
        this.toast.success({ detail: 'Éxito', summary: 'GPS actualizado', duration: 4000 });
        this.loadGps();
      },
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
      <div style="text-align:left">
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
    if (!found) { this.toast.error({ detail: 'Error', summary: 'GPS no encontrado', duration: 4000 }); return; }
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

  // ==== Unique options a exponer a modales GPS ====
  get gpsModelOptions(): string[] { return this.uniqueGpsModels; }
  get gpsBrandOptions(): string[] { return this.uniqueGpsBrands; }

}
