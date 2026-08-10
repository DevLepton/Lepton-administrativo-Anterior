import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { NgToastService } from 'ng-angular-popup';
import Swal from 'sweetalert2';
import { catchError, forkJoin, of } from 'rxjs';
import {
  ApiService,
  BillingClientItem,
  BillingClientType,
  ClientListItem,
  CreateBillingClientPayload,
  PaymentContactPayload,
  BillingClientDiscounts,
} from '../services/api.service';

interface ClientOption {
  userId: number;
  fullName: string;
  email: string;
}

type ModalMode = 'create' | 'edit';

interface BillingClientRow {
  item: BillingClientItem;
  level: number;
  isParent: boolean;
}

@Component({
  selector: 'app-sub-clientes',
  templateUrl: './sub-clientes.component.html',
  styleUrl: './sub-clientes.component.scss'
})
export class SubClientesComponent implements OnInit {
  billingClients: BillingClientItem[] = [];
  clients: ClientOption[] = [];
  clientByUserId = new Map<number, ClientOption>();
  activeClients: { [key: string]: string } = {};
  excludedAccounts: number[] = [];

  loading = false;
  clientsLoading = false;
  deletingId: string | null = null;

  search = '';
  typeFilter: '' | BillingClientType = '';
  voucherTypeFilter: '' | 'Recibo' | 'Factura' = '';
  userIdFilter: number | '' = '';
  currentPage = 1;
  perPage = 10;

  selectedIds = new Set<string>();
  sidePanelOpen = false;
  selectedForSidebar: BillingClientItem | null = null;

  modalOpen = false;
  modalMode: ModalMode = 'create';
  saving = false;
  editingId: string | null = null;
  form: FormGroup;
  colonias: string[] = [];
  loadingColonias = false;

  taxRegimes = [
    { codigo: '601', descripcion: 'General de Ley Personas Morales' },
    { codigo: '603', descripcion: 'Personas Morales con Fines no Lucrativos' },
    { codigo: '605', descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
    { codigo: '606', descripcion: 'Arrendamiento' },
    { codigo: '607', descripcion: 'Régimen de Enajenación o Adquisición de Bienes' },
    { codigo: '608', descripcion: 'Demás Ingresos' },
    { codigo: '609', descripcion: 'Consolidación' },
    { codigo: '610', descripcion: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
    { codigo: '611', descripcion: 'Ingresos por Dividendos (Socios y Accionistas)' },
    { codigo: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
    { codigo: '614', descripcion: 'Ingresos por Intereses' },
    { codigo: '615', descripcion: 'Régimen de los Ingresos por Obtención de Premios' },
    { codigo: '616', descripcion: 'Sin Obligaciones Fiscales' },
    { codigo: '620', descripcion: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
    { codigo: '621', descripcion: 'Incorporación Fiscal' },
    { codigo: '622', descripcion: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
    { codigo: '623', descripcion: 'Opcional para Grupos de Sociedades' },
    { codigo: '624', descripcion: 'Coordinados' },
    { codigo: '625', descripcion: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
    { codigo: '626', descripcion: 'Régimen Simplificado de Confianza' },
  ];

  invoceUses = [
    { codigo: 'CP01', descripcion: 'Pagos' },
    { codigo: 'G01', descripcion: 'Adquisición de mercancías' },
    { codigo: 'G02', descripcion: 'Devoluciones, descuentos o bonificaciones' },
    { codigo: 'G03', descripcion: 'Gastos en general' },
    { codigo: 'I01', descripcion: 'Construcciones' },
    { codigo: 'I02', descripcion: 'Mobiliario y equipo de oficina por inversiones' },
    { codigo: 'I03', descripcion: 'Equipo de transporte' },
    { codigo: 'I04', descripcion: 'Equipo de cómputo y accesorios' },
    { codigo: 'I05', descripcion: 'Dados, troqueles, moldes, matrices y herramental' },
    { codigo: 'I06', descripcion: 'Comunicaciones telefónicas' },
    { codigo: 'I07', descripcion: 'Comunicaciones satelitales' },
    { codigo: 'I08', descripcion: 'Otra maquinaria y equipo' },
    { codigo: 'S01', descripcion: 'Sin efectos fiscales' },
  ];

  constructor(
    private api: ApiService,
    private fb: FormBuilder,
    private toast: NgToastService
  ) {
    this.form = this.fb.group({
      type: ['client', Validators.required],
      userId: [null],
      billingClientFather: [null],
      subBillingClients: [[]],
      billingName: ['', [Validators.required, Validators.maxLength(160)]],
      voucherType: ['Recibo', Validators.required],
      cutoffDay: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
      companyName: ['', Validators.required],
      RFC: ['', [Validators.required, Validators.maxLength(13)]],
      useInvoice: ['', Validators.required],
      taxRegime: ['', Validators.required],
      email: ['', [Validators.email, Validators.required]],
      cp: ['', [Validators.pattern(/^[0-9]{5}$/), Validators.required]],
      street: [''],
      streetNumber: [''],
      suburb: [''],
      locality: [''],
      state: [''],
      country: ['México'],
      discounts: this.fb.group({
        monthly: [0, [Validators.min(0)]],
        devices: [0, [Validators.min(0)]],
        accessories: [0, [Validators.min(0)]]
      }),
      blacklist: [false],
      paymentContacts: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.onCodigoPostalChange();
    this.onBillingClientTypeChange();
  }

  selectInput(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    input.select();
  }

  get paymentContacts(): FormArray {
    return this.form.get('paymentContacts') as FormArray;
  }

  get title(): string {
    const type = this.form.get('type')?.value as BillingClientType;
    const name = type === 'subClient' ? 'subcliente' : 'cliente de cobranza';
    return this.modalMode === 'create' ? `Nuevo ${name}` : `Editar ${name}`;
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get canViewOrEdit(): boolean {
    return this.selectedCount === 1;
  }

  get selectedItems(): BillingClientItem[] {
    const map = new Map(this.billingClients.map(item => [item._id, item] as const));
    return Array.from(this.selectedIds)
      .map(id => map.get(id))
      .filter((item): item is BillingClientItem => !!item);
  }

  uniqueLinkedClients: ClientOption[] = [];

  // private updateUniqueLinkedClients(): void {
  //   const ids = new Set(
  //     this.billingClients
  //       .filter(item => item.type === 'client')
  //       .map(item => item.userId)
  //       .filter((id): id is number => typeof id === 'number')
  //   );

  //   this.uniqueLinkedClients = Array.from(ids)
  //     .map(id =>
  //       this.clientByUserId.get(id) ?? {
  //         userId: id,
  //         fullName: 'Sin nombre',
  //         email: ''
  //       }
  //     )
  //     .sort((a, b) => a.userId - b.userId);
  // }

  get linkedClientOptions(): ClientOption[] {
    const currentUserId = this.form.get('userId')?.value;
    const usedByOtherBillingClient = new Set(
      this.billingClients
        .filter(item => item._id !== this.editingId)
        .filter(item => item.type === 'client')
        .map(item => item.userId)
        .filter((id): id is number => typeof id === 'number')
    );

    return this.clients.filter(client => {
      const id = Number(client.userId);
      const isCurrentValue = currentUserId !== null && currentUserId !== undefined && Number(currentUserId) === id;
      const isActive = !!this.activeClients[String(id)];
      const isExcluded = this.excludedAccounts.includes(id);
      const isUsedByOtherBillingClient = usedByOtherBillingClient.has(id);

      return isActive && !isExcluded && (!isUsedByOtherBillingClient || isCurrentValue);
    });
  }

  get parentBillingClientOptions(): BillingClientItem[] {
    return this.billingClients
      .filter(item => item.type === 'client' && item._id !== this.editingId)
      .sort((a, b) => a.billingName.localeCompare(b.billingName));
  }

  get subBillingClientOptions(): BillingClientItem[] {
    const currentChildren = new Set((this.form.get('subBillingClients')?.value ?? []) as string[]);

    return this.billingClients
      .filter(item => item.type === 'subClient' && item._id !== this.editingId)
      .filter(item => !item.billingClientFather || item.billingClientFather === this.editingId || currentChildren.has(item._id))
      .sort((a, b) => a.billingName.localeCompare(b.billingName));
  }

  get filteredBillingClients(): BillingClientItem[] {
    const q = this.normalize(this.search);

    return this.billingClients.filter(item => {
      const linkedClient = this.getClientName(item.userId ?? null);
      const father = this.getBillingClientName(item.billingClientFather);
      const contacts = (item.paymentContacts ?? [])
        .map(contact => `${contact.name} ${contact.email} ${contact.cel}`)
        .join(' ');

      const matchesSearch = !q ||
        this.normalize(item.billingName).includes(q) ||
        this.normalize(item.companyName).includes(q) ||
        this.normalize(item.RFC).includes(q) ||
        this.normalize(item.email).includes(q) ||
        this.normalize(linkedClient).includes(q) ||
        this.normalize(father).includes(q) ||
        this.normalize(contacts).includes(q) ||
        String(item.userId ?? '').includes(q);

      const matchesType = !this.typeFilter || item.type === this.typeFilter;
      const matchesVoucher = !this.voucherTypeFilter || item.voucherType === this.voucherTypeFilter;
      const matchesUser = this.userIdFilter === '' || item.userId === Number(this.userIdFilter);

      return matchesSearch && matchesType && matchesVoucher && matchesUser;
    });
  }

  get displayedBillingClients(): BillingClientRow[] {
    const filtered = this.filteredBillingClients;

    const parents = filtered.filter(x => x.type === 'client');

    const rows: BillingClientRow[] = [];

    for (const parent of parents) {

      rows.push({
        item: parent,
        level: 0,
        isParent: true
      });

      if (!this.isExpanded(parent._id)) {
        continue;
      }

      const children = filtered
        .filter(x =>
          x.type === 'subClient' &&
          x.billingClientFather === parent._id
        )
        .sort((a, b) => a.billingName.localeCompare(b.billingName));

      for (const child of children) {
        rows.push({
          item: child,
          level: 1,
          isParent: false
        });
      }
    }

    return rows;
  }

  trackByRow(index: number, row: BillingClientRow) {
    return row.item._id;
  }

  get allVisibleSelected(): boolean {
    const visible = this.displayedBillingClients;
    return visible.length > 0 && visible.every(item => this.selectedIds.has(item.item._id));
  }

  get someVisibleSelected(): boolean {
    const visible = this.displayedBillingClients;
    return visible.some(item => this.selectedIds.has(item.item._id)) && !this.allVisibleSelected;
  }

  loadInitialData(forceRefresh = false): void {
    this.loading = true;
    this.clientsLoading = true;

    // Cargar subclientes independientemente
    this.api.getBillingClientsCached(forceRefresh)
      .pipe(catchError(error => of({ __error: error })))
      .subscribe({
        next: (billingClients: any) => {
          if (billingClients?.__error) {
            console.error('Error al cargar clientes de cobranza:', billingClients.__error);
            this.toast.error({
              detail: 'Error',
              summary: 'No se pudieron cargar los clientes de cobranza',
              duration: 5000
            });
          } else {
            const list = Array.isArray(billingClients?.data)
              ? billingClients.data
              : (Array.isArray(billingClients) ? billingClients : []);

            this.billingClients = list
              .map((item: any) => this.mapBillingClient(item))
              .sort((a: BillingClientItem, b: BillingClientItem) => this.getCreatedTime(b) - this.getCreatedTime(a));

            // this.updateUniqueLinkedClients();

            this.currentPage = 1;
            this.clearSelection();
          }
        },
        complete: () => {
          this.loading = false;
        }
      });

    // Las demás peticiones pueden seguir juntas
    forkJoin({
      clients: this.api.getClientsList().pipe(catchError(error => of({ __error: error }))),
      activeConfig: this.api.getActiveClientsConfig().pipe(catchError(error => of({ __error: error }))),
      excludedConfig: this.api.getExcludedAccountsConfig().pipe(catchError(error => of({ __error: error })))
    }).subscribe({
      next: ({ clients, activeConfig, excludedConfig }) => {
        if (clients?.__error) {
          console.error('Error al cargar clientes:', clients.__error);
          this.toast.error({
            detail: 'Error',
            summary: 'No se pudo cargar la lista de clientes',
            duration: 5000
          });
        } else {
          this.setClients(clients);
          // this.updateUniqueLinkedClients();
        }

        if (activeConfig?.__error) {
          console.error('Error al cargar clientes activos:', activeConfig.__error);
          this.activeClients = {};
        } else {
          this.activeClients = activeConfig?.activeClients || {};
        }

        if (excludedConfig?.__error) {
          console.error('Error al cargar clientes excluidos:', excludedConfig.__error);
          this.excludedAccounts = [];
        } else {
          this.excludedAccounts = Array.isArray(excludedConfig?.excludedAccounts)
            ? excludedConfig.excludedAccounts
              .map((id: unknown) => Number(id))
              .filter((id: number) => Number.isFinite(id))
            : [];
        }
      },
      complete: () => {
        this.clientsLoading = false;
      }
    });
  }

  loadSubClients(forceRefresh = false): void {
    this.loading = true;

    this.api.getBillingClientsCached(forceRefresh).subscribe({
      next: (response) => {
        const list = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);

        this.billingClients = list
          .map((item: any) => this.mapBillingClient(item))
          .sort((a: BillingClientItem, b: BillingClientItem) => this.getCreatedTime(b) - this.getCreatedTime(a));

        // this.updateUniqueLinkedClients();

        this.currentPage = 1;
        this.clearSelection();
      },
      complete: () => this.loading = false
    });
  }

  refresh(): void {
    this.closeSidebar();
    this.loadSubClients(true);
  }

  //   trackByUserId(_index: number, item: ClientOption): number {
  //   return item.userId;
  // }

  expandedClients = new Set<string>();

  toggleExpanded(clientId: string): void {
    if (this.expandedClients.has(clientId)) {
      this.expandedClients.delete(clientId);
    } else {
      this.expandedClients.add(clientId);
    }
  }

  isExpanded(clientId: string): boolean {
    return this.expandedClients.has(clientId);
  }

  updateSearch(value: string): void {
    this.search = (value ?? '').trim();
    this.currentPage = 1;
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }

  getBillingClientName(id?: string | null): string {
    if (!id) return 'Sin cliente padre';
    return this.billingClients.find(item => item._id === id)?.billingName ?? 'Cliente padre no encontrado';
  }

  getBillingClientTypeLabel(type: BillingClientType): string {
    return type === 'subClient' ? 'Subcliente' : 'Cliente';
  }

  onPageChange(event: PageEvent): void {
    this.perPage = event.pageSize;
    this.currentPage = event.pageIndex + 1;
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleRowSelection(item: BillingClientItem, checked: boolean): void {
    if (checked) this.selectedIds.add(item._id);
    else this.selectedIds.delete(item._id);
  }

  toggleRowByClick(item: BillingClientItem): void {
    this.toggleRowSelection(item, !this.isSelected(item._id));
  }

  toggleSelectAllVisible(checked: boolean): void {
    if (checked) this.displayedBillingClients.forEach(item => this.selectedIds.add(item.item._id));
    else this.displayedBillingClients.forEach(item => this.selectedIds.delete(item.item._id));
  }

  openCreateModal(): void {
    this.modalMode = 'create';
    this.editingId = null;
    this.resetForm();
    this.modalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  openEditSelected(): void {
    if (!this.canViewOrEdit) return;
    this.openEditModal(this.selectedItems[0]);
  }

  openEditModal(item: BillingClientItem): void {
    this.modalMode = 'edit';
    this.editingId = item._id;
    this.resetForm(item);
    this.modalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.modalOpen = false;
    this.saving = false;
    this.editingId = null;
    document.body.style.overflow = '';
  }

  viewSelected(): void {
    if (!this.canViewOrEdit) return;
    this.openSidebar(this.selectedItems[0]);
  }

  openSidebar(item: BillingClientItem): void {
    if (this.sidePanelOpen && this.selectedForSidebar?._id === item._id) {
      this.closeSidebar();
      return;
    }

    this.selectedForSidebar = item;
    this.sidePanelOpen = true;
  }

  closeSidebar(): void {
    this.sidePanelOpen = false;
    this.selectedForSidebar = null;
  }

  onCpInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(0, 5);
    input.value = value;
    this.form.get('cp')?.setValue(value, { emitEvent: true });
  }

  onTypeSelect(): void {
    this.applyTypeRules(this.form.get('type')?.value as BillingClientType);
  }

  invoiceUseMap = new Map(
    this.invoceUses.map(item => [
      item.codigo,
      `${item.codigo} - ${item.descripcion}`
    ])
  );

  taxRegimeMap = new Map(
    this.taxRegimes.map(item => [
      item.codigo,
      `${item.codigo} - ${item.descripcion}`
    ])
  );

  onCodigoPostalChange(): void {
    const cpControl = this.form.get('cp');

    cpControl?.valueChanges.subscribe((codigoPostal) => {
      const cp = String(codigoPostal ?? '').trim();

      if (cp && /^[0-9]{5}$/.test(cp)) {
        this.loadingColonias = true;

        this.api.getColoniasByCodigoPostalFromGoogle(cp).subscribe({
          next: (response) => {
            let coloniasEncontradas = (response?.results ?? []).flatMap((result: any) =>
              result.postcode_localities ||
              result.address_components
                .filter((component: any) =>
                  component.types.includes('neighborhood') || component.types.includes('sublocality')
                )
                .map((component: any) => component.long_name)
            );

            coloniasEncontradas = Array.from(new Set(
              coloniasEncontradas
                .map((colonia: unknown) => String(colonia ?? '').trim())
                .filter(Boolean)
            ));

            this.colonias = coloniasEncontradas as string[];

            if (this.colonias.length === 0) {
              this.toast.warning({
                detail: 'Advertencia',
                summary: 'No se encontraron colonias para este código postal.',
                duration: 5000
              });
            }

            const components = response?.results?.[0]?.address_components ?? [];

            const estadoComponent = components.find((component: any) =>
              component.types.includes('administrative_area_level_1')
            );

            const municipioComponent = components.find((component: any) =>
              component.types.includes('locality') ||
              component.types.includes('administrative_area_level_2')
            );

            const currentSuburb = String(this.form.get('suburb')?.value ?? '').trim();
            const shouldKeepSuburb = currentSuburb && this.colonias.includes(currentSuburb);

            this.form.patchValue({
              state: estadoComponent?.long_name || '',
              locality: municipioComponent?.long_name || '',
              suburb: shouldKeepSuburb ? currentSuburb : ''
            }, { emitEvent: false });
          },
          error: (error) => {
            console.error('Error al obtener colonias:', error);
            this.colonias = [];
            this.form.patchValue({
              state: '',
              locality: '',
              suburb: ''
            }, { emitEvent: false });
            this.toast.error({
              detail: 'Error',
              summary: 'No se pudieron cargar las colonias. Intente más tarde.',
              duration: 5000
            });
          },
          complete: () => {
            this.loadingColonias = false;
          }
        });
      } else {
        this.loadingColonias = false;
        this.colonias = [];
        this.form.patchValue({
          state: '',
          locality: '',
          suburb: ''
        }, { emitEvent: false });
      }
    });
  }

  addPaymentContact(contact?: PaymentContactPayload): void {
    this.paymentContacts.push(this.fb.group({
      name: [contact?.name ?? '', Validators.required],
      email: [contact?.email ?? '', Validators.email],
      cel: [contact?.cel ?? ''],
      notes: [contact?.notes ?? '']
    }));
  }

  removePaymentContact(index: number): void {
    this.paymentContacts.removeAt(index);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning({ detail: 'Campos incompletos', summary: 'Revisa la información requerida', duration: 3500 });
      return;
    }

    const payload = this.buildPayload();
    this.saving = true;

    const request$ = this.modalMode === 'create'
      ? this.api.createBillingClient(payload)
      : this.api.updateBillingClient(this.editingId!, payload);

    request$.subscribe({
      next: () => {
        this.toast.success({
          detail: 'Éxito',
          summary: this.modalMode === 'create' ? 'Cliente de cobranza creado' : 'Cliente de cobranza actualizado',
          duration: 3500
        });
        this.closeModal();
        this.refresh();
      },
      error: (err) => {
        console.error(err);
        const msg = err?.error?.error || err?.error?.message || 'No se pudo guardar el cliente de cobranza';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
        this.saving = false;
      }
    });
  }

  async deleteSelected(): Promise<void> {
    if (this.selectedCount === 0) return;

    const selected = this.selectedItems;

    if (selected.length > 1) {
      const withChildren = selected.find(x => x.type === 'client' && (x.subBillingClients?.length ?? 0) > 0);
      if (withChildren) {
        await Swal.fire({
          icon: 'warning',
          title: 'No es posible eliminar',
          text: 'No puedes eliminar varios clientes cuando alguno tiene subclientes asociados. Selecciona únicamente ese cliente.',
          confirmButtonColor: 'var(--color-primary)'
        });
        return;
      }
    }

    const item = selected[0];
    let newParentId: string | undefined;
    let deleteChildren = false;

    if (selected.length === 1 && item.type === 'client' && (item.subBillingClients?.length ?? 0) > 0) {

      const action = await Swal.fire({
        icon: 'warning',
        title: 'Este cliente tiene subclientes asociados',
        html: `
        <div style="margin-bottom:1rem">
          Este cliente tiene <b>${item.subBillingClients!.length}</b> subcliente(s) asociado(s).
        </div>
        <div>¿Qué deseas hacer?</div>
      `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Seleccionar nuevo cliente',
        denyButtonText: 'Eliminar todo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--color-primary)',
        denyButtonColor: 'var(--color-danger)',
        reverseButtons: true
      });

      if (action.isDismissed) return;

      if (action.isDenied) {
        deleteChildren = true;
      } else {
        const children = this.billingClients.filter(x => item.subBillingClients?.includes(x._id));

        const inputOptions = children.reduce((acc, child) => {
          acc[child._id] = child.billingName;
          return acc;
        }, {} as Record<string, string>);

        const selectResult = await Swal.fire({
          icon: 'question',
          title: 'Selecciona el nuevo cliente',
          input: 'radio',
          inputOptions,
          inputValidator: value => !value ? 'Debes seleccionar un subcliente.' : null,
          showCancelButton: true,
          cancelButtonText: 'Cancelar',
          confirmButtonText: 'Continuar',
          reverseButtons: true,
          confirmButtonColor: 'var(--color-primary)',
          cancelButtonColor: 'var(--color-danger)'
        });

        if (!selectResult.isConfirmed) return;

        newParentId = selectResult.value;
      }
    }

    const html = selected.slice(0, 8).map(item => `<div><b>${item.billingName || '-'}</b> - ${item.companyName || 'Sin empresa'}</div>`).join('');

    const result = await Swal.fire({
      title: deleteChildren
        ? `¿Eliminar ${selected.length} cliente(s) y todos sus subclientes?`
        : `¿Eliminar ${selected.length} cliente(s) de cobranza?`,
      html: `
      <div style="text-align:center">
        ${html}
        ${selected.length > 8 ? `<div style="margin-top:.5rem;opacity:.8">...y ${selected.length - 8} más</div>` : ''}
      </div>
      <br>${deleteChildren ? '<b>También se eliminarán todos los subclientes asociados.</b><br><br>' : ''}Esta acción no se puede deshacer.
    `,
      icon: 'warning',
      showCancelButton: true,
      cancelButtonColor: 'var(--color-primary)',
      confirmButtonColor: 'var(--color-danger)',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, eliminar',
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    this.deletingId = '__bulk__';

    const requests = selected.map(item =>
      this.api.deleteBillingClient(
        item._id,
        item._id === selected[0]._id ? newParentId : undefined,
        item._id === selected[0]._id ? deleteChildren : false
      ).pipe(catchError(error => of({ __error: error, _id: item._id })))
    );

    forkJoin(requests).subscribe({
      next: (res: any[]) => {
        const failures = res.filter(x => x?.__error).length;
        const success = res.length - failures;

        if (success) {
          this.toast.success({
            detail: 'Éxito',
            summary: deleteChildren
              ? `Se eliminaron ${success} cliente(s) y sus subclientes`
              : `Se eliminaron ${success} cliente(s) de cobranza`,
            duration: 4000
          });
          this.refresh();
        }

        if (failures) {
          this.toast.error({
            detail: 'Error',
            summary: `No se pudieron eliminar ${failures} cliente(s) de cobranza`,
            duration: 6000
          });
        }
      },
      error: () => {
        this.toast.error({
          detail: 'Error',
          summary: 'Falló la eliminación de clientes de cobranza',
          duration: 6000
        });
      },
      complete: () => {
        this.deletingId = null;
      }
    });
  }

  getClientName(userId: number | null): string {
    if (userId === null || userId === undefined) return 'Sin cliente vinculado';
    const client = this.clientByUserId.get(Number(userId));
    return client ? client.fullName : 'Cliente no encontrado';
  }

  getClientLabel(userId: number | null): string {
    if (userId === null || userId === undefined) return 'Sin cliente vinculado';
    return `#${userId} - ${this.getClientName(userId)}`;
  }

  displayClientOption = (value: number | null): string => {
    if (value === null || value === undefined) return '';
    return this.getClientLabel(value);
  };

  trackById(_index: number, item: BillingClientItem): string {
    return item._id;
  }

  private clearSelection(): void {
    this.selectedIds.clear();
  }

  private resetForm(item?: BillingClientItem): void {
    this.paymentContacts.clear();

    this.form.reset({
      type: item?.type ?? 'client',
      userId: item?.type === 'client' ? item?.userId ?? null : null,
      billingClientFather: item?.type === 'subClient' ? item?.billingClientFather ?? null : null,
      subBillingClients: item?.type === 'client' ? item?.subBillingClients ?? [] : [],
      billingName: item?.billingName ?? '',
      voucherType: item?.voucherType ?? 'Recibo',
      cutoffDay: item?.cutoffDay ?? 1,
      companyName: item?.companyName ?? '',
      RFC: item?.RFC ?? '',
      useInvoice: item?.useInvoice ?? '',
      taxRegime: item?.taxRegime ?? '',
      email: item?.email ?? '',
      cp: item?.cp ? String(item.cp) : '',
      street: item?.street ?? '',
      streetNumber: item?.streetNumber ?? '',
      suburb: item?.suburb ?? '',
      locality: item?.locality ?? '',
      state: item?.state ?? '',
      country: item?.country ?? 'México',
      discounts: {
        monthly: item?.discounts?.monthly ?? 0,
        devices: item?.discounts?.devices ?? 0,
        accessories: item?.discounts?.accessories ?? 0
      },
      blacklist: item?.blacklist ?? false
    }, { emitEvent: false });

    this.applyTypeRules(item?.type ?? 'client');
    this.colonias = item?.suburb ? [item.suburb] : [];

    if (item?.cp && /^[0-9]{5}$/.test(String(item.cp))) {
      this.form.get('cp')?.setValue(String(item.cp), { emitEvent: true });
    }

    const contacts = item?.paymentContacts?.length ? item.paymentContacts : [{ name: '', email: '', cel: '', notes: '' }];
    contacts.forEach(contact => this.addPaymentContact(contact));
  }

  private buildPayload(): CreateBillingClientPayload {
    const value = this.form.value as any;
    const discounts = value.discounts as BillingClientDiscounts;
    const type = value.type as BillingClientType;
    const subBillingClients = Array.isArray(value.subBillingClients)
      ? value.subBillingClients.map((id: unknown) => String(id)).filter(Boolean)
      : [];

    const payload: CreateBillingClientPayload = {
      type,
      userId: type === 'client' && value.userId !== null && value.userId !== '' ? Number(value.userId) : null,
      billingClientFather: type === 'subClient' ? String(value.billingClientFather ?? '') || null : null,
      subBillingClients: type === 'client' ? subBillingClients : [],
      billingName: String(value.billingName ?? '').trim(),
      paymentContacts: (value.paymentContacts ?? [])
        .map((contact: PaymentContactPayload) => ({
          name: String(contact.name ?? '').trim(),
          email: String(contact.email ?? '').trim(),
          cel: String(contact.cel ?? '').trim(),
          notes: String(contact.notes ?? '').trim()
        }))
        .filter((contact: PaymentContactPayload) => contact.name),
      voucherType: value.voucherType,
      cutoffDay: Number(value.cutoffDay ?? 1),
      companyName: String(value.companyName ?? '').trim(),
      RFC: String(value.RFC ?? '').trim(),
      useInvoice: String(value.useInvoice ?? '').trim(),
      taxRegime: String(value.taxRegime ?? '').trim(),
      email: String(value.email ?? '').trim(),
      cp: value.cp === null || value.cp === '' ? null : Number(value.cp),
      street: String(value.street ?? '').trim(),
      streetNumber: String(value.streetNumber ?? '').trim(),
      suburb: String(value.suburb ?? '').trim(),
      locality: String(value.locality ?? '').trim(),
      state: String(value.state ?? '').trim(),
      country: String(value.country ?? 'México').trim(),
      discounts: {
        monthly: Number(discounts?.monthly ?? 0),
        devices: Number(discounts?.devices ?? 0),
        accessories: Number(discounts?.accessories ?? 0)
      },
      blacklist: !!value.blacklist
    };

    return payload;
  }

  private setClients(response: any): void {
    const raw = Array.isArray(response?.data)
      ? response.data
      : (Array.isArray(response?.clients) ? response.clients : (Array.isArray(response) ? response : []));

    this.clients = raw
      .map((item: ClientListItem) => this.mapClient(item))
      .filter((item: ClientOption | null): item is ClientOption => !!item)
      .sort((a: ClientOption, b: ClientOption) => a.userId - b.userId);

    this.clientByUserId = new Map(this.clients.map(client => [client.userId, client] as const));
  }

  private mapClient(item: ClientListItem): ClientOption | null {
    const userId = Number(item.userId ?? item['id'] ?? item['user_id']);
    if (!Number.isFinite(userId)) return null;

    const parts = [
      item.first_name ?? item['firstName'] ?? item['nombre'],
      item.middle_name ?? item['middleName'] ?? item['aPaterno'],
      item.last_name ?? item['lastName'] ?? item['aMaterno']
    ]
      .map(part => String(part ?? '').trim())
      .filter(Boolean);

    return {
      userId,
      fullName: parts.length ? parts.join(' ') : 'Sin nombre',
      email: String(item.email ?? item['login'] ?? item['correo'] ?? '').trim()
    };
  }

  private mapBillingClient(item: any): BillingClientItem {
    const type: BillingClientType = item?.type === 'subClient' ? 'subClient' : 'client';

    return {
      _id: String(item?._id ?? ''),
      type,
      userId: item?.userId === null || item?.userId === undefined ? null : Number(item.userId),
      billingClientFather: this.normalizeObjectId(item?.billingClientFather),
      subBillingClients: Array.isArray(item?.subBillingClients)
        ? item.subBillingClients.map((id: unknown) => this.normalizeObjectId(id)).filter((id: string | null): id is string => !!id)
        : [],
      billingName: String(item?.billingName ?? ''),
      paymentContacts: Array.isArray(item?.paymentContacts) ? item.paymentContacts : [],
      voucherType: item?.voucherType === 'Factura' ? 'Factura' : 'Recibo',
      cutoffDay: Number(item?.cutoffDay ?? 1),
      companyName: String(item?.companyName ?? ''),
      RFC: String(item?.RFC ?? ''),
      useInvoice: String(item?.useInvoice ?? '').trim(),
      taxRegime: String(item?.taxRegime ?? ''),
      email: String(item?.email ?? ''),
      cp: item?.cp === undefined ? null : item.cp,
      street: String(item?.street ?? ''),
      streetNumber: String(item?.streetNumber ?? ''),
      suburb: String(item?.suburb ?? ''),
      locality: String(item?.locality ?? ''),
      state: String(item?.state ?? ''),
      country: String(item?.country ?? 'México'),
      discounts: {
        monthly: Number(item?.discounts?.monthly ?? 0),
        devices: Number(item?.discounts?.devices ?? 0),
        accessories: Number(item?.discounts?.accessories ?? 0)
      },
      blacklist: !!item?.blacklist,
      createdAt: item?.createdAt ?? undefined
    };
  }

  private onBillingClientTypeChange(): void {
    this.form.get('type')?.valueChanges.subscribe((type: BillingClientType) => {
      this.applyTypeRules(type);
    });
  }

  private applyTypeRules(type: BillingClientType): void {
    const userId = this.form.get('userId');
    const billingClientFather = this.form.get('billingClientFather');
    const subBillingClients = this.form.get('subBillingClients');

    if (type === 'client') {
      userId?.setValidators([Validators.required]);
      billingClientFather?.clearValidators();
      billingClientFather?.setValue(null, { emitEvent: false });
      subBillingClients?.enable({ emitEvent: false });
    } else {
      userId?.clearValidators();
      userId?.setValue(null, { emitEvent: false });
      billingClientFather?.setValidators([Validators.required]);
      subBillingClients?.setValue([], { emitEvent: false });
      subBillingClients?.disable({ emitEvent: false });
    }

    userId?.updateValueAndValidity({ emitEvent: false });
    billingClientFather?.updateValueAndValidity({ emitEvent: false });
    subBillingClients?.updateValueAndValidity({ emitEvent: false });
  }

  private normalizeObjectId(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      const item = value as { _id?: unknown; };
      return item._id ? String(item._id) : null;
    }
    return String(value);
  }

  private getCreatedTime(item: BillingClientItem): number {
    const d = item.createdAt ? new Date(item.createdAt) : null;
    return d && !isNaN(d.getTime()) ? d.getTime() : 0;
  }

  private normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }
}
