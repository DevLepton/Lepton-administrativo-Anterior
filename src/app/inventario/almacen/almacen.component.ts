import { Component, OnInit, ViewChild } from '@angular/core';
import { RegisterClientesModalComponent } from '../../clientes/actions/register-clientes-modal/register-clientes-modal.component';
import { EditClientesModalComponent } from '../../clientes/actions/edit-clientes-modal/edit-clientes-modal.component';
import { ApiService } from '../../services/api.service';
import { NgToastService } from 'ng-angular-popup';
import Swal from 'sweetalert2';
import { NewSimModalComponent } from '../../modals/new-sim-modal/new-sim-modal.component';
import { ViewSimModalComponent } from '../../modals/view-sim-modal/view-sim-modal.component';
import { EditSimModalComponent } from '../../modals/edit-sim-modal/edit-sim-modal.component';

interface Cliente {
  idCliente: number;
  tipoCliente: string;
  nombre: string;
  aPaterno: string;
  aMaterno: string;
  domicilio: {
    codigoPostal: string;
    colonia: string;
    estado: string;
    municipio: string;
    calle: string;
    numeroExterior: string;
    numeroInterior?: string;
  };
  contacto: {
    correo: string;
    telefono: string;
  };
  datosComerciales: {
    comprobante: 'recibo' | 'factura' | string;
    emisorComprobante: string;
    diaCorte: number;
    fechaCorte: Date;
    fechaPago: Date;
  };
  estatus: 'activo' | 'inactivo' | 'pendiente' | string;
}

// === Interface SIM ===
interface SimItem {
  id: string;            // <- _id de Mongo (string)
  iccid: string;
  modelo: string;
  compania: string;
  estatus: 'activa' | 'inactiva' | 'asignada' | 'stock' | string;
  fechaCompra: string | Date | null;
  fechaIngresoLepton: string | Date | null;
  cliente?: string;
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
  @ViewChild(RegisterClientesModalComponent) registerClientesModal!: RegisterClientesModalComponent;
  @ViewChild(EditClientesModalComponent) editClientesModal!: EditClientesModalComponent;
  @ViewChild(NewSimModalComponent) newSimModal!: NewSimModalComponent;
  @ViewChild(ViewSimModalComponent) viewSimModal!: ViewSimModalComponent;
  @ViewChild(EditSimModalComponent) editSimModal!: EditSimModalComponent;

  // Data
  clientes: Cliente[] = [];
  filteredClientes: Cliente[] = [];

  // Filtros / paginado (para la pestaña GPS's)
  selectedStatus: string = '';
  selectedComprobante: string = '';
  clientesPerPage = 10;
  currentPage = 1;
  showAll = true;

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
      cliente: d.client ?? ''
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
    this.loadClientes();
    this.loadSims();
  }

  onTabChange(index: number) {
    this.activeTabIndex = index;
    if (index === 1 && this.sims.length === 0 && !this.simsLoading) {
      this.loadSims();           // ← opcional: carga perezosa al abrir pestaña SIM's
    }
  }

  // Cargar clientes
  loadClientes(): void {
    this.apiService.getClientes().subscribe({
      next: (response: any) => {
        this.clientes = Array.isArray(response.data) ? response.data : [];
        this.filteredClientes = [...this.clientes];
        this.applyFilters(); // mantiene coherencia con la pestaña de la tabla
      },
      error: (error) => {
        console.error('Error al cargar clientes:', error);
        this.toast.error({ detail: 'Error', summary: 'Error al cargar clientes', duration: 5000 });
      },
    });
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
        this.simsInitial = [...this.sims];   // NEW: snapshot del orden inicial
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


  // --- KPIs (Resumen) ---
  get totalClientes(): number {
    return this.clientes.length;
  }

  get totalActivos(): number {
    return this.clientes.filter(c => c.estatus === 'activo').length;
  }

  get totalInactivos(): number {
    return this.clientes.filter(c => c.estatus === 'inactivo').length;
  }

  get totalPendientes(): number {
    return this.clientes.filter(c => c.estatus === 'pendiente').length;
  }

  get totalRecibos(): number {
    return this.clientes.filter(c => c.datosComerciales?.comprobante === 'recibo').length;
  }

  get totalFacturas(): number {
    return this.clientes.filter(c => c.datosComerciales?.comprobante === 'factura').length;
  }

  // % helpers
  pct(n: number): number {
    return this.totalClientes ? Math.round((n / this.totalClientes) * 100) : 0;
  }

  // --- Tabla (GPS's) ---
  get displayedClientes(): Cliente[] {
    if (this.showAll) return this.filteredClientes;
    const startIndex = (this.currentPage - 1) * this.clientesPerPage;
    return this.filteredClientes.slice(startIndex, startIndex + this.clientesPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredClientes.length / this.clientesPerPage);
  }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
    this.currentPage = 1;
  }

  setPage(page: number): void {
    this.currentPage = page;
  }

  getStatusClass(estatus: string): string {
    if (estatus === 'activo') return 'status-activo';
    if (estatus === 'inactivo') return 'status-inactivo';
    return 'status-pendiente';
  }

  applyFilters(): void {
    this.filteredClientes = this.clientes.filter((cliente) => {
      const matchesStatus = this.selectedStatus ? cliente.estatus === this.selectedStatus : true;
      const matchesComprobante = this.selectedComprobante
        ? cliente.datosComerciales?.comprobante === this.selectedComprobante
        : true;
      return matchesStatus && matchesComprobante;
    });
    this.currentPage = 1;
  }

  // CRUD
  editarCliente(cliente: Cliente): void {
    this.editClientesModal.open(cliente);
  }

  actualizarCliente(clienteActualizado: Cliente): void {
    this.apiService.updateCliente(clienteActualizado.idCliente, clienteActualizado).subscribe({
      next: () => {
        this.toast.success({ detail: 'Éxito', summary: 'Cliente actualizado con éxito.', duration: 5000 });
        this.loadClientes();
      },
      error: () => {
        this.toast.error({ detail: 'Error', summary: 'Error al actualizar el cliente.', duration: 5000 });
      }
    });
  }

  eliminarCliente(cliente: Cliente): void {
    Swal.fire({
      title: '¿Estás seguro de eliminar?',
      text: 'No podrás revertir esta acción',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.apiService.deleteCliente(cliente.idCliente).subscribe({
          next: () => {
            this.toast.success({ detail: 'Éxito', summary: 'Cliente eliminado con éxito', duration: 5000 });
            this.loadClientes();
          },
          error: () => {
            this.toast.error({ detail: 'Error', summary: 'Error al eliminar cliente', duration: 5000 });
          }
        });
      }
    });
  }

  openModal(): void {
    this.registerClientesModal.open();
  }

  addNewCliente(newCliente: Cliente): void {
    this.apiService.createCliente(newCliente).subscribe({
      next: () => {
        this.toast.success({ detail: 'Éxito', summary: 'Cliente registrado con éxito', duration: 5000 });
        this.loadClientes();
      },
      error: () => {
        this.toast.error({ detail: 'Error', summary: 'Error al registrar cliente', duration: 5000 });
      }
    });
  }

  simsPerPage = 10;
  simsCurrentPage = 1;
  simsShowAll = true;

  get displayedSims(): SimItem[] {
    if (this.simsShowAll) return this.sims;
    const start = (this.simsCurrentPage - 1) * this.simsPerPage;
    return this.sims.slice(start, start + this.simsPerPage);
  }

  get simsTotalPages(): number {
    const total = Math.ceil(this.sims.length / this.simsPerPage);
    return Math.max(1, total); // nunca 0 para que los botones se comporten
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
      comments: null                   // completa si lo traes en la lista
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
      comentarios: '' // coloca aquí si manejas comments en la UI
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


}
