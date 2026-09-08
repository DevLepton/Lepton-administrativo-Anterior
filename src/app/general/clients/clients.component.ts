import { Component, ElementRef, HostListener, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { ApiService, ClienteUI, TrackerUI } from '../../services/api.service';
import { Observable, Subscription } from 'rxjs';
// import datos from './datos.json';

import {
  trigger,
  state,
  style,
  transition,
  animate
} from '@angular/animations';

import { ChangeDetectionStrategy } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { NgToastService } from 'ng-angular-popup';
import { ConfirmModalService } from '../../services/confirm-modal/confirm-modal-service';

// import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx-js-style';
import { AuthService } from '../../services/auth.service';
import { ExportExcelService } from '../../services/export-excel.service';

type BucketKey = '+12H' | '+1D' | '+15D' | '+1M' | '+6M' | '+1A' | '+2A' | '+3A' | '+4A' | '+5A';

type BucketItem = {
  label: BucketKey;
  value: number;
};

type SortDirection = 'asc' | 'desc';

type TrackerSortField =
  'id' |
  'nombre' |
  'imei' |
  'sim' |
  'plan' |
  'modelo' |
  'clon' |
  'suspendido' |
  'hidden' |
  'sdc1' |
  'sdc2' |
  'sdc Acumulado' |
  'canbus' |
  'ultima Conexion UTC' |
  'ultima Conexion Local' |
  'tiempo Offline' |
  'status Soporte';

type TrackerSortState = {
  field: TrackerSortField | null;
  direction: SortDirection | null;
};

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('expandCollapse', [
      state('expanded', style({
        opacity: 1,
        transform: 'scaleY(1)'
      })),
      state('collapsed', style({
        opacity: 0,
        transform: 'scaleY(0.95)'
      })),
      transition('expanded <=> collapsed', [
        animate('140ms ease')
      ])
    ])
  ]
})
export class ClientsComponent implements OnInit {

  @ViewChild('clientsContainer') clientsContainer!: ElementRef;
  @ViewChildren('clientItem') clientItems!: QueryList<ElementRef>;
  @ViewChild('sortWrapper') sortWrapper!: ElementRef;

  private STORAGE_KEYS = {
    columns: 'clients_selected_columns',
    sensors: 'clients_include_sensors',
    login: 'clients_include_login',
    onlyTrackers: 'clients_only_with_trackers',
    trackerFilter: 'clients_tracker_filter',
    filtersActive: 'clients_only_active',
    filtersExcluded: 'clients_exclude_blocked'
  };

  clientesFiltrados: ClienteUI[] = [];

  private isUserAction = false;

  // KPIs
  totalClientes = 0;
  totalTrackers = 0;
  totalOnline = 0;
  totalOffline = 0;

  totalSuspended = 0;
  totalHidden = 0;

  loading = false;

  search = '';
  expandedClient: number | null = null;
  selectedBucket: BucketKey | null = null;

  topOffline: ClienteUI[] = [];

  offlineBuckets: BucketItem[] = [
    { label: '+12H', value: 0 },
    { label: '+1D', value: 0 },
    { label: '+15D', value: 0 },
    { label: '+1M', value: 0 },
    { label: '+6M', value: 0 },
    { label: '+1A', value: 0 },
    { label: '+2A', value: 0 },
    { label: '+3A', value: 0 },
    { label: '+4A', value: 0 },
    { label: '+5A', value: 0 }
  ];

  availableColumns = [
    'nombre',
    'imei',
    'sim',
    'plan',
    'modelo'
  ];

  extraColumns = [
    'id',
    'clon',
    'suspendido',
    'hidden',
    'sdc1',
    'sdc2',
    'sdc Acumulado',
    'canbus',
    'ultima Conexion UTC',
    'ultima Conexion Local',
    'tiempo Offline',
    'status Soporte'
  ];

  displayedColumns: string[] = [
    'id',
    'nombre',
    'imei',
    'sim',
    'plan',
    'modelo',
    'clon',
    'suspendido',
    'hidden',
    'sdc1',
    'sdc2',
    'sdc Acumulado',
    'canbus',
    'ultima Conexion UTC',
    'ultima Conexion Local',
    'tiempo Offline',
    'status Soporte'
  ];

  isSensorColumn(col: string): boolean {
    return [
      'sdc1',
      'sdc2',
      'sdc Acumulado',
      'canbus'
    ].includes(col);
  }

  filteredClientsList: ClienteUI[] = [];

  selectedColumns: string[] = [...this.availableColumns];

  renderedClients = new Set<number>();

  pendingScrollTo: number | null = null;

  onlyWithTrackers = false;

  trackerFilter: 'all' | 'with' | 'without' | 'suspended' | 'hidden' | 'offline' | 'no-use-month' = 'all';

  activeTab: 'clients' | 'config' = 'clients';

  activeClients: { [key: string]: string } = {};
  excludedAccounts: number[] = [];

  newActiveId = '';
  newActiveHash = '';
  newExcludedId = '';

  filteredActiveOptions: ClienteUI[] = [];
  filteredExcludedOptions: ClienteUI[] = [];

  originalActiveClients: { [key: string]: string } = {};
  originalExcludedAccounts: number[] = [];

  editingActiveId: string | null = null;
  editingActiveHash = '';

  editingExcludedId: number | null = null;
  editingExcludedTemp = '';

  userRole$!: Observable<string | null>;

  isAdminUser = false;
  isSupportUser = false;
  isCXUser = false;

  onlyActiveClients = false;
  excludeBlockedClients = false;

  lastUpdate: Date | null = null;

  expandAll = false;

  progress = 0;
  progressMessage = '';

  sortField: 'id' | 'nombre' | 'email' | 'login' | 'ciudad' | 'total' | 'online' | 'offline' | null = 'id';
  sortDirection: 'asc' | 'desc' = 'asc';

  trackerSortStates: Record<number, TrackerSortState> = {};

  showSortControls = false;

  includeSensors = false;
  includeLogin = false;

  requestIncludeSensors = false;
  requestIncludeLogin = false;

  private sub?: Subscription;

  sidebarCollapsed = false;

  missingActiveClients: ClienteUI[] = [];
  showMissingAlert = false;

  constructor(
    private authService: AuthService,
    private elRef: ElementRef,
    private api: ApiService,
    private confirm: ConfirmModalService,
    private cdr: ChangeDetectorRef,
    private toast: NgToastService,
    private exportExcel: ExportExcelService
  ) { }

  ngOnInit(): void {
    const role = this.authService.getUserRole();

    this.isSupportUser = role === 'soporte';
    this.isAdminUser = role === 'admin';
    this.isCXUser = role === 'cx';

    this.loadPreferences();
    this.loadClientConfig();
    this.loadData();
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
  }

  savePreferences() {

    localStorage.setItem(this.STORAGE_KEYS.filtersActive, JSON.stringify(this.onlyActiveClients));
    localStorage.setItem(this.STORAGE_KEYS.filtersExcluded, JSON.stringify(this.excludeBlockedClients));

    localStorage.setItem(
      this.STORAGE_KEYS.columns,
      JSON.stringify(this.selectedColumns)
    );

    localStorage.setItem(
      this.STORAGE_KEYS.sensors,
      JSON.stringify(this.includeSensors)
    );

    localStorage.setItem(
      this.STORAGE_KEYS.login,
      JSON.stringify(this.includeLogin)
    );

    localStorage.setItem(
      this.STORAGE_KEYS.onlyTrackers,
      JSON.stringify(this.onlyWithTrackers)
    );

    localStorage.setItem(
      this.STORAGE_KEYS.trackerFilter,
      this.trackerFilter
    );
  }

  loadPreferences() {
    const onlyActive = localStorage.getItem(this.STORAGE_KEYS.filtersActive);
    const excludeBlocked = localStorage.getItem(this.STORAGE_KEYS.filtersExcluded);
    const cols = localStorage.getItem(this.STORAGE_KEYS.columns);
    const onlyTrackers = localStorage.getItem(this.STORAGE_KEYS.onlyTrackers);
    const trackerFilter = localStorage.getItem(this.STORAGE_KEYS.trackerFilter);
    const sensors = localStorage.getItem(this.STORAGE_KEYS.sensors);
    const login = localStorage.getItem(this.STORAGE_KEYS.login);

    if (onlyActive !== null) this.onlyActiveClients = JSON.parse(onlyActive);
    if (excludeBlocked !== null) this.excludeBlockedClients = JSON.parse(excludeBlocked);

    if (cols) {
      try {
        this.selectedColumns = JSON.parse(cols);
      } catch {
        this.selectedColumns = [...this.availableColumns];
      }
      this.visibleColumnsSet = new Set(this.selectedColumns);
    }

    if (onlyTrackers !== null) {
      this.onlyWithTrackers = JSON.parse(onlyTrackers);
    }

    if (trackerFilter) {
      this.trackerFilter = trackerFilter as any;
    }

    if (sensors !== null) {
      this.includeSensors = JSON.parse(sensors);
    }

    if (login !== null) {
      this.includeLogin = JSON.parse(login);
    }
  }

  isColumnVisible(col: string): boolean {
    return this.selectedColumns.includes(col);
  }

  getStatusClass(status: string): string {
    if (!status || status === 'ok') return 'ok';

    if (status.includes('12H')) return 'status-warning';
    if (status.includes('1D')) return 'status-warning';

    return 'status-danger';
  }

  onSettingsChange() {
    this.savePreferences();
  }

  onTrackerFilterChange() {
    this.savePreferences();
    this.updateFilteredClients();
    this.cdr.markForCheck();
  }

  restoreConfigState() {
    this.activeClients = { ...this.originalActiveClients };
    this.excludedAccounts = [...this.originalExcludedAccounts];

    this.cdr.markForCheck();
  }

  async setActiveTab(tab: 'clients' | 'config') {

    if (this.activeTab === 'config') {

      const hasChanges =
        this.hasActiveChanges() || this.hasExcludedChanges();

      if (hasChanges) {

        const confirmed = await this.confirm.open({
          title: 'Cambios sin guardar',
          message: 'Tienes cambios sin guardar. ¿Deseas descartarlos?',
          confirmText: 'Aceptar',
          cancelText: 'Cancelar'
        });

        if (!confirmed) return;

        this.restoreConfigState();
      }
    }

    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  loadClientConfig(forceRefresh = false) {
    this.api.getClientConfigCached(forceRefresh).subscribe({
      next: (res: any) => {
        this.activeClients = res.activeClients || {};
        this.excludedAccounts = (res.excludedAccounts || []).sort((a: number, b: number) => a - b);

        this.checkMissingActiveClients();

        this.originalActiveClients = { ...this.activeClients };
        this.originalExcludedAccounts = [...this.excludedAccounts];

        this.updateFilteredClients();

        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error({
          detail: 'Error',
          summary: 'No se pudo cargar la información de los clientes',
          duration: 3000
        });
      }
    });
  }

  sortKeysDesc = (a: any, b: any): number => {
    return Number(a.key) - Number(b.key);
  };

  // ===== ACTIVE =====
  addActiveClient() {
    if (!this.newActiveId || !this.newActiveHash) {
      this.toast.warning({
        detail: 'Campos incompletos',
        summary: 'ID y HASH son obligatorios',
        duration: 3000
      });
      return;
    }

    if (this.activeClients[this.newActiveId]) {
      this.toast.info({
        detail: 'Duplicado',
        summary: 'Ese cliente ya existe',
        duration: 3000
      });
      return;
    }

    this.activeClients[this.newActiveId] = this.newActiveHash;

    this.newActiveId = '';
    this.newActiveHash = '';
    this.filteredActiveOptions = [];
  }

  removeActiveClient(id: string) {
    delete this.activeClients[id];
  }

  saveActiveClients() {
    this.api.updateActiveClients(this.activeClients).subscribe({
      next: () => {
        this.originalActiveClients = { ...this.activeClients };

        this.toast.success({
          detail: 'Guardado',
          summary: 'Clientes activos actualizados',
          duration: 3000
        });

        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error({
          detail: 'Error',
          summary: 'No se pudieron guardar los clientes activos',
          duration: 3000
        });
      }
    });
  }

  hasActiveChanges(): boolean {
    return JSON.stringify(this.activeClients) !== JSON.stringify(this.originalActiveClients);
  }

  startEditActive(id: string, hash: string) {
    this.editingActiveId = id;
    this.editingActiveHash = hash;
  }

  saveEditActive() {
    if (!this.editingActiveId) return;

    this.activeClients[this.editingActiveId] = this.editingActiveHash;

    this.editingActiveId = null;
    this.editingActiveHash = '';
  }

  cancelEditActive() {
    this.editingActiveId = null;
    this.editingActiveHash = '';
  }

  // ===== EXCLUDED =====
  addExcludedAccount() {
    if (!this.newExcludedId) {
      this.toast.warning({
        detail: 'Campo vacío',
        summary: 'Ingresa un ID',
        duration: 3000
      });
      return;
    }

    const id = Number(this.newExcludedId);

    if (isNaN(id)) {
      this.toast.warning({
        detail: 'ID inválido',
        summary: 'Selecciona un cliente válido',
        duration: 3000
      });
      return;
    }

    if (this.excludedAccounts.includes(id)) {
      this.toast.info({
        detail: 'Duplicado',
        summary: 'Ese ID ya está excluido',
        duration: 3000
      });
      return;
    }

    this.excludedAccounts.push(id);
    this.excludedAccounts.sort((a, b) => a - b);
    this.newExcludedId = '';
    this.filteredExcludedOptions = [];
  }

  removeExcludedAccount(id: number) {
    this.excludedAccounts = this.excludedAccounts.filter(x => x !== id);
    this.excludedAccounts.sort((a, b) => a - b);
  }

  saveExcludedAccounts() {
    this.api.updateExcludedAccounts(this.excludedAccounts).subscribe({
      next: () => {
        this.originalExcludedAccounts = [...this.excludedAccounts];

        this.toast.success({
          detail: 'Guardado',
          summary: 'Cuentas excluidas actualizadas',
          duration: 3000
        });

        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error({
          detail: 'Error',
          summary: 'No se pudieron guardar las cuentas excluidas',
          duration: 3000
        });
      }
    });
  }

  hasExcludedChanges(): boolean {
    return JSON.stringify(this.excludedAccounts) !== JSON.stringify(this.originalExcludedAccounts);
  }

  startEditExcluded(id: number) {
    this.editingExcludedId = id;
    this.editingExcludedTemp = String(id);
  }

  saveEditExcluded() {
    const newId = Number(this.editingExcludedTemp);

    if (isNaN(newId)) return;

    this.excludedAccounts = this.excludedAccounts
      .map(id => id === this.editingExcludedId ? newId : id)
      .sort((a, b) => a - b);

    this.editingExcludedId = null;
  }

  cancelEditExcluded() {
    this.editingExcludedId = null;
  }

  filterClients(value: string | number): ClienteUI[] {
    const v = String(value).toLowerCase();

    return this.clientesFiltrados.filter(c =>
      String(c.id).includes(v) ||
      c.nombre.toLowerCase().includes(v)
    );
  }

  onActiveIdInput(value: string) {
    if (!this.clientesFiltrados.length) return;
    this.filteredActiveOptions = this.filterClients(value);
  }

  selectActiveClient(option: ClienteUI) {
    this.newActiveId = String(option.id);
  }

  displayClientFn(client: any): string {
    if (!client) return '';

    if (typeof client === 'string') return client;

    return client.id ? String(client.id) : '';
  }

  onExcludedIdInput(value: string) {
    if (!this.clientesFiltrados.length) return;
    this.filteredExcludedOptions = this.filterClients(value);
  }

  selectExcludedClient(option: ClienteUI) {
    this.newExcludedId = String(option.id);
  }

  loadData(forceRefresh = false) {
    this.loading = true;

    this.progress = 0;
    this.progressMessage = 'Iniciando...';

    this.sub?.unsubscribe();

    this.sub = this.api.getFullClientsDataStream(
      this.includeSensors,
      this.includeLogin,
      forceRefresh
    ).subscribe({

      next: (event) => {

        // PROGRESO
        if (event.type === 'progress') {
          this.progress = event.progress;
          this.progressMessage = event.message;

          this.cdr.markForCheck();
          return;
        }

        // FINAL
        if (event.type === 'done') {

          this.requestIncludeSensors = event.data.includeSensors || false;
          this.requestIncludeLogin = event.data.includeLogin || false;

          this.lastUpdate = new Date();

          this.clientesFiltrados = [...event.data.clients];

          this.checkMissingActiveClients();

          this.updateFilteredClients();

          this.loading = false;
          this.progress = 100;
          this.progressMessage = 'Completado';

          this.cdr.markForCheck();
        }
      },

      error: (err) => {
        console.error(err);

        this.loading = false;
        this.progressMessage = 'Error al cargar datos';

        this.cdr.markForCheck();
      }
    });
  }

  // loadData(forceRefresh = false) {
  //   this.loading = true;

  //   const res: any = datos;

  //   this.requestIncludeSensors = res.includeSensors || false;
  //   this.requestIncludeLogin = res.includeLogin || false;

  //   this.lastUpdate = new Date();

  //   this.clientesFiltrados = [...res.clients];

  //   this.checkMissingActiveClients();

  //   this.updateFilteredClients();

  //   this.loading = false;

  //   // 🔥 CLAVE
  //   this.cdr.markForCheck();
  // }

  refreshClients() {
    this.loadData(true);
  }

  trackByTracker(index: number, item: any) {
    return item.id;
  }

  visibleColumnsSet = new Set(this.selectedColumns);

  updateVisibleColumns() {
    this.visibleColumnsSet = new Set(this.selectedColumns);

    this.savePreferences();
    this.cdr.markForCheck();
  }

  onToggleChange() {
    this.loadData(true);
  }

  scrollToClient(id: number) {
    const index = this.filteredClientsList.findIndex(c => c.id === id);
    const el = this.clientItems.get(index)?.nativeElement;
    const container = this.clientsContainer.nativeElement;

    if (el && container) {
      const offsetTop = el.offsetTop;

      container.scrollTo({
        top: offsetTop - 10, // pequeño margen
        behavior: 'smooth'
      });
    }
  }

  toggleClient(id: number) {
    this.isUserAction = true;

    if (this.expandAll) {
      if (this.renderedClients.has(id)) {
        this.renderedClients.delete(id);
      } else {
        this.renderedClients.add(id);
      }

      this.cdr.markForCheck();
      return;
    }

    if (this.expandedClient === id) {
      this.expandedClient = null;
      this.pendingScrollTo = null;

      if (this.renderedClients.has(id)) {
        this.renderedClients.delete(id);
      }
    } else {
      if (!this.expandAll) {
        this.renderedClients.clear();
      }
      this.expandedClient = id;
      this.renderedClients.add(id);

      this.cdr.detectChanges();

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.scrollToClient(id);
        });
      });
    }

    this.cdr.markForCheck();
  }

  toggleExpandMode() {
    this.expandAll = !this.expandAll;

    if (this.expandAll) {
      // 🔥 abrir todos
      this.filteredClientsList.forEach(c => {
        this.renderedClients.add(c.id);
      });

      this.expandedClient = null;
    } else {
      // 🔥 cerrar todos
      this.renderedClients.clear();
    }

    this.cdr.markForCheck();
  }

  onAnimationDone(id: number) {

    // IGNORAR si no viene de interacción del usuario
    if (!this.isUserAction) return;

    // SOLO destruir si NO estás en modo expandAll
    if (!this.expandAll && this.expandedClient !== id) {
      this.renderedClients.delete(id);
    }

    // scroll al abrir
    if (!this.expandAll && this.pendingScrollTo === id && this.expandedClient === id) {
      this.pendingScrollTo = null;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.scrollToClient(id);
        });
      });
    }

    // this.cdr.markForCheck();
  }

  filterByBucket(label: BucketKey) {
    this.selectedBucket = this.selectedBucket === label ? null : label;
    this.updateFilteredClients();
    this.cdr.markForCheck();
  }

  isValidTracker(t: TrackerUI): boolean {
    return (
      !t.clon
    );
  }

  openLogin(c: ClienteUI) {
    const hash = this.activeClients[String(c.id)];
    const url = `https://pro.lepton-seguridad.com/pro/demo/?session_key=${hash}`;
    window.open(url, '_blank');
  }

  clearSearch() {
    this.search = '';
    this.updateFilteredClients();
  }

  updateFilteredClients() {
    const s = this.search.toLowerCase().trim();

    let totalTrackers = 0;
    let totalOnline = 0;
    let totalOffline = 0;

    let totalSuspended = 0;
    let totalHidden = 0;

    const buckets: Record<BucketKey, number> = {
      '+12H': 0,
      '+1D': 0,
      '+15D': 0,
      '+1M': 0,
      '+6M': 0,
      '+1A': 0,
      '+2A': 0,
      '+3A': 0,
      '+4A': 0,
      '+5A': 0
    };

    const result: ClienteUI[] = [];

    for (const c of this.clientesFiltrados) {

      const idStr = String(c.id);

      // SOLO ACTIVOS
      if (this.onlyActiveClients && !this.activeClients[idStr]) {
        continue;
      }

      // EXCLUIR BLOQUEADOS
      if (this.excludeBlockedClients && this.excludedAccounts.includes(c.id)) {
        continue;
      }

      // 🔎 filtros básicos
      const matchSearch = !s ||
        String(c.id).includes(s) ||
        c.nombre.toLowerCase().includes(s) ||
        c.login.toLowerCase().includes(s) ||
        (c.trackers || []).some(t =>
          String(t.imei || '').toLowerCase().includes(s) ||
          String(t.sim || '').toLowerCase().includes(s)
        );

      let trackers = c.trackers || [];

      let matchTrackers = true;

      // 🔥 FILTRAR TRACKERS SEGÚN EL SELECTOR
      switch (this.trackerFilter) {

        case 'with':
          matchTrackers = trackers.length > 0;
          break;

        case 'without':
          matchTrackers = trackers.length === 0;
          break;

        case 'suspended':
          matchTrackers = trackers.some(t => t.suspendido);
          trackers = trackers.filter(t => t.suspendido);
          break;

        case 'hidden':
          matchTrackers = trackers.some(t => t.hidden);
          trackers = trackers.filter(t => t.hidden);
          break;

        case 'offline':
          matchTrackers = trackers.some(t => t.minutosOffline >= 720);
          trackers = trackers.filter(t => t.minutosOffline >= 720);
          break;

        case 'no-use-month':
          matchTrackers = trackers.length > 0 && c.ultimoIngreso === 'Sin uso en el último mes';
          break;

        case 'all':
        default:
          matchTrackers = true;
      }

      if (!matchSearch || !matchTrackers) continue;

      let online = 0;
      let offline = 0;
      let onlinekpi = 0;
      let offlinekpi = 0;

      let suspendedkpi = 0;
      let hiddenkpi = 0;

      let bucketMatch = !this.selectedBucket;

      for (const t of trackers) {

        const min = t.minutosOffline;
        const isOnline = min < 720;

        if (t.suspendido && this.isValidTracker(t)) {
          suspendedkpi++;
        }

        if (t.hidden && this.isValidTracker(t)) {
          hiddenkpi++;
        }

        if (isOnline) {
          online++;
          if (this.isValidTracker(t)) {
            onlinekpi++;
          }
        } else {
          offline++;
          if (this.isValidTracker(t)) {
            offlinekpi++;
          }
          let bucket: BucketKey | null = null;

          const YEAR = 525600;

          if (min >= YEAR * 5) bucket = '+5A';
          else if (min >= YEAR * 4) bucket = '+4A';
          else if (min >= YEAR * 3) bucket = '+3A';
          else if (min >= YEAR * 2) bucket = '+2A';
          else if (min >= YEAR) bucket = '+1A';

          else if (min >= 259200) bucket = '+6M';
          else if (min >= 43200) bucket = '+1M';
          else if (min >= 21600) bucket = '+15D';
          else if (min >= 1440) bucket = '+1D';
          else if (min >= 720) bucket = '+12H';

          if (bucket) {
            buckets[bucket]++;
          }

          if (this.selectedBucket) {
            if (this.matchBucket(t, this.selectedBucket)) {
              bucketMatch = true;
            }
          }
        }
      }

      if (!bucketMatch) continue;

      const trackersValidos = trackers.filter(t => this.isValidTracker(t));

      totalTrackers += trackersValidos.length;

      result.push({
        ...c,
        trackers: this.getSortedTrackersForClient(c.id, trackers),
        total: trackers.length,
        online,
        offline
      });

      totalOnline += onlinekpi;
      totalOffline += offlinekpi;

      totalSuspended += suspendedkpi;
      totalHidden += hiddenkpi;
    }

    // 🔥 asignar resultados
    this.filteredClientsList = result;
    this.totalClientes = result.length;
    this.totalTrackers = totalTrackers;
    this.totalOnline = totalOnline;
    // this.totalOffline = totalTrackers - totalOnline;
    this.totalOffline = totalOffline;

    this.totalSuspended = totalSuspended;
    this.totalHidden = totalHidden;

    this.offlineBuckets = [
      { label: '+12H', value: buckets['+12H'] },
      { label: '+1D', value: buckets['+1D'] },
      { label: '+15D', value: buckets['+15D'] },
      { label: '+1M', value: buckets['+1M'] },
      { label: '+6M', value: buckets['+6M'] },
      { label: '+1A', value: buckets['+1A'] },
      { label: '+2A', value: buckets['+2A'] },
      { label: '+3A', value: buckets['+3A'] },
      { label: '+4A', value: buckets['+4A'] },
      { label: '+5A', value: buckets['+5A'] }
    ];

    this.topOffline = [...result]
      .map(c => {
        const trackers = c.trackers || [];

        const offlineCount = trackers.filter(t =>
          this.isValidTracker(t) && t.minutosOffline >= 720
        ).length;

        return {
          ...c,
          offline: offlineCount
        };
      })
      .sort((a, b) => b.offline - a.offline)
      .slice(0, 10);

    if (this.sortField) {
      this.sortClients(this.sortField);
    }
  }

  trackByClient(index: number, item: ClienteUI) {
    return item.id;
  }

  matchBucket(t: TrackerUI, bucket: BucketKey): boolean {
    const min = t.minutosOffline;

    const YEAR = 525600;

    if (min >= YEAR * 5) return bucket === '+5A';
    if (min >= YEAR * 4) return bucket === '+4A';
    if (min >= YEAR * 3) return bucket === '+3A';
    if (min >= YEAR * 2) return bucket === '+2A';
    if (min >= YEAR) return bucket === '+1A';
    if (min >= 259200) return bucket === '+6M';
    if (min >= 43200) return bucket === '+1M';
    if (min >= 21600) return bucket === '+15D';
    if (min >= 1440) return bucket === '+1D';
    if (min >= 720) return bucket === '+12H';

    return false;
  }

  getPercent(value: number): number {
    if (!this.totalTrackers) return 0;
    return (value * 100) / this.totalTrackers;
  }

  getBucketColor(label: string): string {
    switch (label) {
      case '+12H': return '#ff9500';
      case '+1D': return '#ff7a00';
      case '+15D': return '#ff5e00';
      case '+1M': return '#ff3b30';
      case '+6M': return '#d63031';
      case '+1A': return '#a71d2a';
      case '+2A': return '#8e1c25';
      case '+3A': return '#7a1720';
      case '+4A': return '#66121a';
      case '+5A': return '#4d0d14';
      default: return '#ccc';
    }
  }

  stop(e: Event) {
    e.stopPropagation();
  }

  selectedClients = new Set<number>();
  allSelected = false;

  // Seleccionar uno
  toggleClientSelection(id: number) {
    if (this.selectedClients.has(id)) {
      this.selectedClients.delete(id);
    } else {
      this.selectedClients.add(id);
    }

    this.syncSelectAllState();
    this.cdr.markForCheck();
  }

  // Seleccionar todos (solo los filtrados)
  toggleSelectAll() {
    if (this.allSelected) {
      this.selectedClients.clear();
    } else {
      this.filteredClientsList.forEach(c => {
        this.selectedClients.add(c.id);
      });
    }

    this.allSelected = !this.allSelected;
    this.cdr.markForCheck();
  }

  // Sincroniza checkbox general
  syncSelectAllState() {
    this.allSelected =
      this.filteredClientsList.length > 0 &&
      this.filteredClientsList.every(c => this.selectedClients.has(c.id));
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.sortWrapper?.nativeElement.contains(event.target)) {
      this.showSortControls = false;
      this.cdr.markForCheck();
    }
  }

  toggleSortControls() {
    this.showSortControls = !this.showSortControls;
    this.cdr.markForCheck();
  }

  private parseUltimoIngreso(value: string): number {
    if (!value) return 0;

    // casos especiales
    if (value.includes('Sin uso')) return 0;

    const fechaTexto = value.split(' - ')[0]?.trim();

    const match = fechaTexto.match(
      /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/
    );

    if (!match) return 0;

    const [, dd, mm, yyyy, hh, mi, ss] = match;

    const fecha = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );

    return fecha.getTime();
  }

  sortClients(field: typeof this.sortField, chanceDirection = false) {

    if (this.sortField === field && chanceDirection) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      if (chanceDirection) {
        this.sortDirection = 'asc';
      }
    }

    const dir = this.sortDirection === 'asc' ? 1 : -1;

    this.filteredClientsList.sort((a: any, b: any) => {

      let valA: any;
      let valB: any;

      switch (field) {
        case 'id':
          valA = a.id;
          valB = b.id;
          break;

        case 'nombre':
          valA = a.nombre || '';
          valB = b.nombre || '';
          break;

        case 'email':
          valA = a.login || '';
          valB = b.login || '';
          break;

        case 'login':
          valA = this.parseUltimoIngreso(a.ultimoIngreso);
          valB = this.parseUltimoIngreso(b.ultimoIngreso);
          break;

        case 'ciudad':
          valA = a.ciudad || '';
          valB = b.ciudad || '';
          break;

        case 'total':
          valA = a.total || 0;
          valB = b.total || 0;
          break;

        case 'online':
          valA = a.online || 0;
          valB = b.online || 0;
          break;

        case 'offline':
          valA = a.offline || 0;
          valB = b.offline || 0;
          break;

        default:
          return 0;
      }

      // 🔥 SI ES NÚMERO
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * dir;
      }

      // 🔥 SI ES TEXTO
      return String(valA).localeCompare(String(valB), 'es', {
        sensitivity: 'base'
      }) * dir;
    });

    this.cdr.markForCheck();
  }

  sortClientTrackers(client: ClienteUI, field: TrackerSortField) {
    const current = this.trackerSortStates[client.id];

    if (!current || current.field !== field) {
      this.trackerSortStates[client.id] = {
        field,
        direction: 'asc'
      };
    } else if (current.direction === 'asc') {
      this.trackerSortStates[client.id] = {
        field,
        direction: 'desc'
      };
    } else {
      delete this.trackerSortStates[client.id];
    }

    client.trackers = this.getSortedTrackersForClient(client.id, client.trackers);
    this.cdr.markForCheck();
  }

  getTrackerSortIcon(clientId: number, field: TrackerSortField): string {
    const state = this.trackerSortStates[clientId];

    if (!state || state.field !== field) {
      return 'unfold_more';
    }

    return state.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  private getSortedTrackersForClient(clientId: number, fallbackTrackers: TrackerUI[]): TrackerUI[] {
    const state = this.trackerSortStates[clientId];
    const trackers = this.getBaseTrackersForClient(clientId, fallbackTrackers);

    if (!state?.field || !state.direction) {
      return trackers;
    }

    const dir = state.direction === 'asc' ? 1 : -1;

    return [...trackers].sort((a, b) => {
      const valA = this.getTrackerSortValue(a, state.field!);
      const valB = this.getTrackerSortValue(b, state.field!);

      return this.compareTrackerValues(valA, valB, dir);
    });
  }

  private getBaseTrackersForClient(clientId: number, fallbackTrackers: TrackerUI[]): TrackerUI[] {
    const source = this.clientesFiltrados.find(c => c.id === clientId);
    let trackers = source?.trackers ? [...source.trackers] : [...fallbackTrackers];

    switch (this.trackerFilter) {
      case 'suspended':
        trackers = trackers.filter(t => t.suspendido);
        break;

      case 'hidden':
        trackers = trackers.filter(t => t.hidden);
        break;

      case 'offline':
        trackers = trackers.filter(t => t.minutosOffline >= 720);
        break;
    }

    return trackers;
  }

  private getTrackerSortValue(t: TrackerUI, field: TrackerSortField): string | number | boolean {
    switch (field) {
      case 'id':
        return t.id || 0;

      case 'nombre':
        return t.nombre || '';

      case 'imei':
        return t.imei || '';

      case 'sim':
        return t.sim || '';

      case 'plan':
        return t.plan || '';

      case 'modelo':
        return t.modelo || '';

      case 'clon':
        return t.clon;

      case 'suspendido':
        return t.suspendido;

      case 'hidden':
        return t.hidden;

      case 'sdc1':
        return t.sdc1 || '';

      case 'sdc2':
        return t.sdc2 || '';

      case 'sdc Acumulado':
        return t.sdcAcumulado || '';

      case 'canbus':
        return t.canbus || '';

      case 'ultima Conexion UTC':
        return this.parseTrackerDate(t.ultimaConexionUTC);

      case 'ultima Conexion Local':
        return this.parseTrackerDate(t.ultimaConexionLocal) || this.parseTrackerDate(t.ultimaConexionUTC);

      case 'tiempo Offline':
        return t.minutosOffline || 0;

      case 'status Soporte':
        return t.statusSoporte || '';
    }
  }

  private compareTrackerValues(
    valA: string | number | boolean,
    valB: string | number | boolean,
    dir: number
  ): number {
    const emptyA = valA === null || valA === undefined || valA === '';
    const emptyB = valB === null || valB === undefined || valB === '';

    if (emptyA && emptyB) return 0;
    if (emptyA) return 1;
    if (emptyB) return -1;

    if (typeof valA === 'number' && typeof valB === 'number') {
      return (valA - valB) * dir;
    }

    if (typeof valA === 'boolean' && typeof valB === 'boolean') {
      return (Number(valA) - Number(valB)) * dir;
    }

    return String(valA).localeCompare(String(valB), 'es', {
      numeric: true,
      sensitivity: 'base'
    }) * dir;
  }

  private parseTrackerDate(value: string): number {
    if (!value) return 0;

    const utcMatch = value.match(
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
    );

    if (utcMatch) {
      const [, yyyy, mm, dd, hh, mi, ss] = utcMatch;
      return new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(mi),
        Number(ss)
      ).getTime();
    }

    const localMatch = value.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*([ap])\.?\s*m\.?$/i
    );

    if (!localMatch) return 0;

    const [, dd, mm, yyyy, hour, mi, ss, meridiem] = localMatch;
    let hh = Number(hour);

    if (meridiem.toLowerCase() === 'p' && hh < 12) hh += 12;
    if (meridiem.toLowerCase() === 'a' && hh === 12) hh = 0;

    return new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      hh,
      Number(mi),
      Number(ss)
    ).getTime();
  }

  checkMissingActiveClients() {
    const missing = this.clientesFiltrados.filter(c => {
      const trackers = c.trackers || [];
      const hasTrackers = trackers.length > 0;
      const hasClone = trackers.some(t => t.clon);
      const exists = !!this.activeClients[String(c.id)];
      const excluded = this.excludedAccounts.includes(c.id);

      return hasTrackers && !hasClone && !exists && !excluded;
    });

    this.missingActiveClients = missing;
    this.showMissingAlert = missing.length > 0;
  }

  get missingActiveTooltip(): string {
    const max = 10;

    const header =
      `Hay ${this.missingActiveCount} ` +
      `${this.missingActiveCount === 1 ? 'cliente' : 'clientes'} ` +
      `sin registrar en la lista de activos`;

    const visible = this.missingActiveClients.slice(0, max);

    let list = visible
      .map(c => `#${c.id} ${c.nombre}`)
      .join('\n');

    if (this.missingActiveClients.length > max) {
      list += `\n... y ${this.missingActiveClients.length - max} más`;
    }

    return `${header}\n\n${list}`;
  }

  get missingActiveCount(): number {
    return this.missingActiveClients.length;
  }

  exportToExcel() {

    const selected = this.filteredClientsList.filter(c =>
      this.selectedClients.has(c.id)
    );

    if (!selected.length) {
      this.toast.warning({
        detail: 'Sin selección',
        summary: 'Selecciona al menos un cliente',
        duration: 3000
      });
      return;
    }

    this.exportExcel.exportClients({
      allClients: this.clientesFiltrados,
      activeClients: this.activeClients,
      excludedAccounts: this.excludedAccounts,
      selected,
      totalClientes: this.totalClientes,
      filteredClientsList: this.filteredClientsList,
      totalTrackers: this.totalTrackers,
      totalOnline: this.totalOnline,
      totalOffline: this.totalOffline,
      totalSuspended: this.totalSuspended,
      totalHidden: this.totalHidden,
      offlineBuckets: this.offlineBuckets
    });

  }

}
