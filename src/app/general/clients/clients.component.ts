import { Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { ApiService, ClienteUI, TrackerUI } from '../../services/api.service';
import { Subscription } from 'rxjs';
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

  // KPIs
  totalClientes = 0;
  totalTrackers = 0;
  totalOnline = 0;
  totalOffline = 0;

  loading = false;

  search = '';
  expandedClient: number | null = null;
  selectedBucket: string | null = null;

  topOffline: ClienteUI[] = [];

  offlineBuckets = [
    { label: '+12H', value: 0 },
    { label: '+1D', value: 0 },
    { label: '+15D', value: 0 },
    { label: '+1M', value: 0 },
    { label: '+6M', value: 0 },
    { label: '+1A', value: 0 }
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
    'sdcAcumulado',
    'canbus',
    'ultimaConexionUTC',
    'ultimaConexionLocal',
    'tiempoOffline',
    'statusSoporte'
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
    'sdcAcumulado',
    'canbus',
    'ultimaConexionUTC',
    'ultimaConexionLocal',
    'tiempoOffline',
    'statusSoporte'
  ];

  filteredClientsList: ClienteUI[] = [];

  selectedColumns: string[] = [...this.availableColumns];

  renderedClients = new Set<number>();

  pendingScrollTo: number | null = null;

  onlyWithTrackers = false;

  trackerFilter: 'all' | 'with' | 'without' = 'all';

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

  isSupportUser = false;

  onlyActiveClients = false;
  excludeBlockedClients = false;

  lastUpdate: Date | null = null;

  expandAll = false;

  progress = 0;
  progressMessage = '';

  isColumnVisible(col: string): boolean {
    return this.selectedColumns.includes(col);
  }

  getStatusClass(status: string): string {
    if (!status || status === 'ok') return 'ok';

    if (status.includes('12H')) return 'status-warning';
    if (status.includes('1D')) return 'status-warning';

    return 'status-danger';
  }

  constructor(private api: ApiService, private confirm: ConfirmModalService,
    private cdr: ChangeDetectorRef, private toast: NgToastService) { }

  ngOnInit(): void {
    const role = (localStorage.getItem('user_role') || '').toLowerCase();

    this.isSupportUser = role === 'soporte';

    this.loadPreferences();
    this.loadClientConfig();
    this.loadData();
  }

  includeSensors = false;
  includeLogin = false;

  private sub?: Subscription;

  sidebarCollapsed = false;

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
        this.excludedAccounts = res.excludedAccounts || [];

        this.originalActiveClients = { ...this.activeClients };
        this.originalExcludedAccounts = [...this.excludedAccounts];

        this.updateFilteredClients();

        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error({
          detail: 'Error',
          summary: 'No se pudo cargar la configuración',
          duration: 3000
        });
      }
    });
  }

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
    this.newExcludedId = '';
    this.filteredExcludedOptions = [];
  }

  removeExcludedAccount(id: number) {
    this.excludedAccounts = this.excludedAccounts.filter(x => x !== id);
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

    this.excludedAccounts = this.excludedAccounts.map(id =>
      id === this.editingExcludedId ? newId : id
    );

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

        // 🔄 PROGRESO
        if (event.type === 'progress') {
          this.progress = event.progress;
          this.progressMessage = event.message;

          this.cdr.markForCheck();
          return;
        }

        // ✅ FINAL
        if (event.type === 'done') {

          this.lastUpdate = new Date();

          this.clientesFiltrados = [...event.data.clientes];

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

  //   this.sub?.unsubscribe();

  //   this.sub = this.api.getFullClientsData(
  //     this.includeSensors,
  //     this.includeLogin,
  //     forceRefresh
  //   ).subscribe({
  //     next: (res) => {

  //       this.lastUpdate = new Date();

  //       // SIEMPRE nuevas referencias (clave en OnPush)
  //       this.clientesFiltrados = [...res.clientes];

  //       this.updateFilteredClients();

  //       this.loading = false;

  //       // AVISAR a Angular
  //       this.cdr.markForCheck();
  //     },

  //     error: () => {
  //       this.loading = false;

  //       // 🔥 también aquí
  //       this.cdr.markForCheck();
  //     },
  //   });
  // }

  // loadData(forceRefresh = false) {
  //   this.loading = true;

  //   const res: any = datos;

  //   this.lastUpdate = new Date();

  //   this.clientesFiltrados = [...res.clientes];

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

    // 🔥 SI está en modo "todos", no colapsamos individualmente
    if (this.expandAll) {
      if (this.renderedClients.has(id)) {
        this.renderedClients.delete(id);
      } else {
        this.renderedClients.add(id);
      }

      this.cdr.markForCheck();
      return;
    }

    // 🔹 comportamiento normal (uno a la vez)
    if (this.expandedClient === id) {
      this.expandedClient = null;
      this.pendingScrollTo = null;
    } else {
      this.pendingScrollTo = id;
      this.expandedClient = id;
      this.renderedClients.add(id);
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

    // 🔥 SOLO destruir si NO estás en modo expandAll
    if (!this.expandAll && this.expandedClient !== id) {
      this.renderedClients.delete(id);
    }

    // 🔥 scroll solo en modo individual
    if (!this.expandAll && this.pendingScrollTo === id && this.expandedClient === id) {
      this.pendingScrollTo = null;

      requestAnimationFrame(() => {
        this.scrollToClient(id);
      });
    }

    this.cdr.markForCheck();
  }

  filterByBucket(label: string) {
    this.selectedBucket = this.selectedBucket === label ? null : label;
    this.updateFilteredClients();
    this.cdr.markForCheck();
  }

  updateFilteredClients() {
    const s = this.search.toLowerCase().trim();

    let totalTrackers = 0;
    let totalOnline = 0;

    const buckets = {
      '+12H': 0,
      '+1D': 0,
      '+15D': 0,
      '+1M': 0,
      '+6M': 0,
      '+1A': 0
    };

    const result: ClienteUI[] = [];

    for (const c of this.clientesFiltrados) {

      const idStr = String(c.id);

      // ✅ SOLO ACTIVOS
      if (this.onlyActiveClients && !this.activeClients[idStr]) {
        continue;
      }

      // 🚫 EXCLUIR BLOQUEADOS
      if (this.excludeBlockedClients && this.excludedAccounts.includes(c.id)) {
        continue;
      }

      // 🔎 filtros básicos
      const matchSearch = !s ||
        String(c.id).includes(s) ||
        c.nombre.toLowerCase().includes(s) ||
        c.login.toLowerCase().includes(s);

      const trackers = c.trackers || [];

      let matchTrackers = true;

      switch (this.trackerFilter) {
        case 'with':
          matchTrackers = trackers.length > 0;
          break;

        case 'without':
          matchTrackers = trackers.length === 0;
          break;

        case 'all':
        default:
          matchTrackers = true;
      }

      if (!matchSearch || !matchTrackers) continue;

      let online = 0;
      let offline = 0;

      let bucketMatch = !this.selectedBucket;

      for (const t of trackers) {
        const min = t.minutosOffline;
        const isOnline = min < 720;

        if (isOnline) {
          online++;
        } else {
          offline++;

          if (min > 720) buckets['+12H']++;
          if (min > 1440) buckets['+1D']++;
          if (min > 21600) buckets['+15D']++;
          if (min > 43200) buckets['+1M']++;
          if (min > 259200) buckets['+6M']++;
          if (min > 525600) buckets['+1A']++;

          if (this.selectedBucket) {
            if (this.matchBucket(t, this.selectedBucket)) {
              bucketMatch = true;
            }
          }
        }
      }

      if (!bucketMatch) continue;

      totalTrackers += trackers.length;

      result.push({
        ...c,
        total: trackers.length,
        online,
        offline
      });

      totalOnline += online;
    }

    // 🔥 asignar resultados
    this.filteredClientsList = result;

    this.totalClientes = result.length;
    this.totalTrackers = totalTrackers;
    this.totalOnline = totalOnline;
    this.totalOffline = totalTrackers - totalOnline;

    this.offlineBuckets = [
      { label: '+12H', value: buckets['+12H'] },
      { label: '+1D', value: buckets['+1D'] },
      { label: '+15D', value: buckets['+15D'] },
      { label: '+1M', value: buckets['+1M'] },
      { label: '+6M', value: buckets['+6M'] },
      { label: '+1A', value: buckets['+1A'] }
    ];

    this.topOffline = [...result]
      .sort((a, b) => b.offline - a.offline)
      .slice(0, 10);
  }

  trackByClient(index: number, item: ClienteUI) {
    return item.id;
  }

  matchBucket(t: TrackerUI, bucket: string): boolean {
    const min = t.minutosOffline;

    switch (bucket) {
      case '+12H': return min > 720;
      case '+1D': return min > 1440;
      case '+15D': return min > 21600;
      case '+1M': return min > 43200;
      case '+6M': return min > 259200;
      case '+1A': return min > 525600;
      default: return false;
    }
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
      default: return '#ccc';
    }
  }

  stop(e: Event) {
    e.stopPropagation();
  }

  recalculateStats() {
    const list = this.filteredClientsList;

    let totalTrackers = 0;
    let totalOnline = 0;

    const buckets = {
      '+12H': 0,
      '+1D': 0,
      '+15D': 0,
      '+1M': 0,
      '+6M': 0,
      '+1A': 0
    };

    list.forEach(c => {
      const trackers = c.trackers || [];

      totalTrackers += trackers.length;

      trackers.forEach(t => {
        const isOnline = t.minutosOffline < 720;

        if (isOnline) {
          totalOnline++;
        } else {
          const min = t.minutosOffline;

          if (min > 720) buckets['+12H']++;
          if (min > 1440) buckets['+1D']++;
          if (min > 21600) buckets['+15D']++;
          if (min > 43200) buckets['+1M']++;
          if (min > 259200) buckets['+6M']++;
          if (min > 525600) buckets['+1A']++;
        }
      });
    });

    this.totalClientes = list.length;
    this.totalTrackers = totalTrackers;
    this.totalOnline = totalOnline;
    this.totalOffline = totalTrackers - totalOnline;

    this.offlineBuckets = [
      { label: '+12H', value: buckets['+12H'] },
      { label: '+1D', value: buckets['+1D'] },
      { label: '+15D', value: buckets['+15D'] },
      { label: '+1M', value: buckets['+1M'] },
      { label: '+6M', value: buckets['+6M'] },
      { label: '+1A', value: buckets['+1A'] }
    ];

    this.topOffline = [...list]
      .map(c => {
        const trackers = c.trackers || [];

        const offlineCount = trackers.filter(t => t.minutosOffline >= 720).length;

        return {
          ...c,
          offline: offlineCount
        };
      })
      .sort((a, b) => b.offline - a.offline)
      .slice(0, 10);
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

    const ws = XLSX.utils.aoa_to_sheet([]);

    const now = new Date().toLocaleString();

    XLSX.utils.sheet_add_aoa(ws, [
      [`Fecha: ${now}`]
    ], { origin: { r: 0, c: 0 } });

    const kpis = [
      ['Clientes sin usar plataforma:', this.totalClientes],
      ['Número de Dispositivos:', this.totalTrackers],
      ['Dispositivos Online:', this.totalOnline],
      ['Dispositivos Offline:', this.totalOffline],
      ['Porcentaje Online:', `${Math.round((this.totalOnline / (this.totalTrackers || 1)) * 100)}%`],
      ['GPS Offline + 12H:', this.offlineBuckets.find(b => b.label === '+12H')?.value || 0],
      ['GPS Offline + 1D:', this.offlineBuckets.find(b => b.label === '+1D')?.value || 0],
      ['GPS Offline + 15D:', this.offlineBuckets.find(b => b.label === '+15D')?.value || 0],
      ['GPS Offline + 1M:', this.offlineBuckets.find(b => b.label === '+1M')?.value || 0],
      ['GPS Offline + 6M:', this.offlineBuckets.find(b => b.label === '+6M')?.value || 0],
      ['GPS Offline + 1A:', this.offlineBuckets.find(b => b.label === '+1A')?.value || 0]
    ];


    XLSX.utils.sheet_add_aoa(ws, kpis, { origin: { r: 2, c: 0 } });

    let currentRow = 0;
    const startCol = 3; // desplazamiento a la derecha

    selected.forEach(cliente => {

      const headers = [
        `${cliente.id}`,
        `${cliente.nombre}`,
        `${cliente.login}`,
        `${cliente.ciudad || '-'}`,
        `${cliente.trackers?.length || 0}`,
        'IMEI',
        'SIM',
        'Plan',
        'Modelo GPS',
        'Clon',
        'Suspendido',
        'Hidden',
        'SDC1',
        'SDC2',
        'SDC Acumulado',
        'CAN Bus',
        'Última Conexión UTC',
        'Última Conexión Tepic',
        'Tiempo Offline',
        'Status Soporte',
        'Último ingreso'
      ];

      const headerRow = currentRow; // guarda la fila

      XLSX.utils.sheet_add_aoa(ws, [headers], { origin: { r: headerRow, c: startCol } });

      headers.forEach((_, i) => {
        const ref = XLSX.utils.encode_cell({ r: headerRow, c: startCol + i });

        if (ws[ref]) {
          ws[ref].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "EAEAEA" } },
            alignment: { horizontal: "center" }
          };
        }
      });

      currentRow++;

      // 🔽 TRACKERS
      cliente.trackers?.forEach(t => {
        XLSX.utils.sheet_add_aoa(ws, [[
          '',
          '',
          '',
          '',
          '',
          t.imei,
          t.sim,
          t.plan,
          t.modelo,
          t.clon ? 'Sí' : 'No',
          t.suspendido ? 'Sí' : 'No',
          t.hidden ? 'Sí' : 'No',
          t.sdc1 || '',
          t.sdc2 || '',
          t.sdcAcumulado || '',
          t.canbus || '',
          t.ultimaConexionUTC,
          t.ultimaConexionLocal,
          t.tiempoOffline,
          t.statusSoporte,
          cliente.ultimoIngreso || ''
        ]], { origin: { r: currentRow, c: startCol } });

        currentRow++;
      });

      currentRow += 2;
    });

    const range = XLSX.utils.decode_range(ws['!ref'] || '');

    for (let R = 0; R <= range.e.r; ++R) {
      for (let C = 0; C <= range.e.c; ++C) {

        const ref = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[ref];

        if (!cell || !cell.v) continue;

        const value = String(cell.v);

        // KPI labels
        if (C === 0 && value.includes(':')) {
          ws[ref].s = { font: { bold: true } };
        }

        // Fecha
        if (value.includes('Fecha:')) {
          ws[ref].s = { font: { bold: true } };
        }
      }
    }

    const pxToWch = (px: number) => Math.round(px / 12);

    ws['!cols'] = [
      { wch: 30 }, // KPI label
      { wch: 10 }, // KPI value
      { wch: 10 },  // espacio
      { wch: pxToWch(135) },
      { wch: pxToWch(510) },
      { wch: pxToWch(270) },
      { wch: pxToWch(200) },
      { wch: pxToWch(150) },
      { wch: pxToWch(210) },
      { wch: pxToWch(180) },
      { wch: pxToWch(200) },
      { wch: pxToWch(205) },
      { wch: pxToWch(120) },
      { wch: pxToWch(175) },
      { wch: pxToWch(135) },
      { wch: pxToWch(160) },
      { wch: pxToWch(160) },
      { wch: pxToWch(160) },
      { wch: pxToWch(160) },
      { wch: pxToWch(235) },
      { wch: pxToWch(240) },
      { wch: pxToWch(485) },
      { wch: pxToWch(265) },
      { wch: pxToWch(990) }
    ];

    // ============================
    // 📦 EXPORT
    // ============================
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

    const buffer = XLSX.write(wb, {
      bookType: 'xlsx',
      type: 'array',
      cellStyles: true
    });

    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    saveAs(blob, 'Detalles Clientes.xlsx');
  }

}