import { Component, OnInit, ViewChild } from '@angular/core';
import { NgToastService } from 'ng-angular-popup';
import { PageEvent } from '@angular/material/paginator';
import { ApiService, UpdateRequestPayload } from '../../services/api.service';
import Swal from 'sweetalert2';
import { catchError, firstValueFrom, forkJoin, Observable, of } from 'rxjs';
import { NewRequestModalComponent } from '../../modals/new-request-modal/new-request-modal.component';
import { EditRequestModalComponent } from '../../modals/edit-request-modal/edit-request-modal.component';

interface RequestedDeviceItem {
  model: string;
  quantity: number;

  response?: {
    id: string;
    model: string;
    identifier: string | null;
  }[];
}

interface PeticionItem {
  id: string;
  estatus: string;
  fechaSolicitud: string | Date | null;
  fechaRespuesta: string | Date | null;
  hasResponse?: boolean;

  // ✅ ahora guardamos la lista real
  dispositivosSolicitados: RequestedDeviceItem[];

  // texto resumido para la tabla
  dispositivoSolicitadoResumen: string;

  cantidad: number | null; // total
  comments: string;
}


@Component({
  selector: 'app-peticiones',
  templateUrl: './peticiones.component.html',
  styleUrl: './peticiones.component.scss'
})
export class PeticionesComponent implements OnInit {

  @ViewChild(NewRequestModalComponent) newRequestModal!: NewRequestModalComponent;
  @ViewChild(EditRequestModalComponent) editRequestModal!: EditRequestModalComponent;

  constructor(private apiService: ApiService, private toast: NgToastService) { }

  isInventoryUser = false;
  isSupportUser = false;

  // data
  requests: PeticionItem[] = [];
  requestsLoading = false;
  requestsDeletingId: string | null = null; // '__bulk__' para borrado masivo

  // paginado
  requestsPerPage = 10;
  requestsCurrentPage = 1;

  // ===== filtros =====
  requestSearch = '';
  requestFilterStatus = '';
  requestDateFilter: Date | null = null;     // fechaSolicitud
  responseDateFilter: Date | null = null;    // fechaRespuesta

  // selección
  selectedRequestIds = new Set<string>();

  responseComments: string = '';

  editandoRespuesta = false;

  estadoInicialRespuesta: string = '';

  modoValidacion = false;
  peticionAValidar: PeticionItem | null = null;

  nuevoModelo = '';

  deviceModelOptions: string[] = [];
  filteredDeviceModels$!: Observable<string[]>;

  ngOnInit(): void {
    const role = (localStorage.getItem('user_role') || '').toLowerCase();

    this.isInventoryUser = role === 'inventario';
    this.isSupportUser = role === 'soporte';

    this.filteredDeviceModels$ = of(this.deviceModelOptions);

    this.loadRequests();
  }

  private objectIdEpoch(id: string): number {
    return parseInt(id.substring(0, 8), 16);
  }

  private s(v: any): string {
    return (v ?? '').toString().trim().toLowerCase();
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

  private mapToPeticionItem(d: any): PeticionItem {
    const arr: RequestedDeviceItem[] = Array.isArray(d.devicesRequested)
      ? d.devicesRequested
      : (Array.isArray(d.dispositivosSolicitados) ? d.dispositivosSolicitados : []);

    const clean = arr
      .map(x => ({
        model: String(x?.model ?? '').trim(),
        quantity: Number(x?.quantity ?? 0),
        response: Array.isArray(x?.response) ? x.response : []
      }))
      .filter(x => x.model && Number.isFinite(x.quantity) && x.quantity > 0);

    const resumen = clean.length === 0
      ? ''
      : (clean.length === 1
        ? `${clean[0].model} (${clean[0].quantity})`
        : `${clean.length} modelos`);

    const hasResponse = clean.some(x => x.response && x.response.length > 0);

    return {
      id: String(d._id),
      estatus: d.status ?? d.estatus ?? 'Pendiente',
      fechaSolicitud: d.requestDate ?? d.fechaSolicitud ?? d.createdAt ?? null,
      fechaRespuesta: d.responseDate ?? d.fechaRespuesta ?? d.answeredAt ?? null,

      dispositivosSolicitados: clean,
      dispositivoSolicitadoResumen: resumen,

      cantidad: (d.quantity ?? d.cantidad ?? null),
      comments: d.comments ?? d.comentarios ?? '',
      hasResponse
    };
  }

  loadRequests(): void {
    this.requestsLoading = true;

    this.apiService.getRequests().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

        this.requests = list
          .map((d: any) => this.mapToPeticionItem(d))
          .sort((a: PeticionItem, b: PeticionItem) => this.objectIdEpoch(b.id) - this.objectIdEpoch(a.id));

        this.requestsCurrentPage = 1;
        this.clearRequestSelection();
      },
      error: (err) => {
        console.error('Error al cargar Peticiones:', err);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar las Peticiones', duration: 5000 });
      },
      complete: () => (this.requestsLoading = false),
    });
  }

  loadDeviceModels() {
    this.apiService.getDevices().subscribe((res: any) => {
      const list = (res.data || []) as any[];

      this.deviceModelOptions = Array.from(
        new Set(
          list
            .map((d: any): string => d.model)
            .filter((m: string) => !!m)
        )
      ).sort();

      this.filteredDeviceModels$ = of(this.deviceModelOptions);
    });
  }

  // ===== pagination =====
  onRequestsPageChange(e: PageEvent) {
    this.requestsPerPage = e.pageSize;
    this.requestsCurrentPage = e.pageIndex + 1;
  }

  get displayedRequests(): PeticionItem[] {
    const src = this.requestsFiltered;
    const start = (this.requestsCurrentPage - 1) * this.requestsPerPage;
    return src.slice(start, start + this.requestsPerPage);
  }

  devicesSidebarOpen = false;
  selectedRequestForSidebar: PeticionItem | null = null;

  get totalFromSidebar(): number {
    const arr = this.selectedRequestForSidebar?.dispositivosSolicitados ?? [];
    return arr.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
  }

  openDevicesSidebar(r: PeticionItem) {
    // 👉 si ya está abierto y es el mismo registro → cerrar
    if (this.devicesSidebarOpen && this.selectedRequestForSidebar?.id === r.id) {
      this.closeDevicesSidebar();
      return;
    }

    // 👉 si es otro registro (o estaba cerrado) → abrir / cambiar contenido
    this.selectedRequestForSidebar = r;
    this.devicesSidebarOpen = true;
  }

  closeDevicesSidebar() {
    this.devicesSidebarOpen = false;
    this.selectedRequestForSidebar = null;
  }


  // ===== filtros =====
  updateRequestSearch(v: string) {
    this.requestSearch = (v ?? '').trim();
    this.requestsCurrentPage = 1;
  }
  onRequestFilterChange() {
    this.requestsCurrentPage = 1;
  }
  onRequestDateChange(d: Date | null) {
    this.requestDateFilter = d;
    this.requestsCurrentPage = 1;
  }
  clearRequestDate() {
    this.onRequestDateChange(null);
  }
  onResponseDateChange(d: Date | null) {
    this.responseDateFilter = d;
    this.requestsCurrentPage = 1;
  }
  clearResponseDate() {
    this.onResponseDateChange(null);
  }

  get requestsFiltered(): PeticionItem[] {
    const q = this.s(this.requestSearch);
    const fStatus = this.s(this.requestFilterStatus);

    const requestKey = this.dayKeyFromPickerLocal(this.requestDateFilter);
    const responseKey = this.dayKeyFromPickerLocal(this.responseDateFilter);

    return (this.requests ?? []).filter(r => {
      const okSearch =
        !q ||
        this.s(r.dispositivoSolicitadoResumen).includes(q) ||
        this.s(r.dispositivosSolicitados.map(x => x.model).join(' ')).includes(q) ||
        this.s(r.comments).includes(q);


      const okStatus = !fStatus || this.s(r.estatus) === fStatus;

      const rKey = this.dayKeyUTC(r.fechaSolicitud);
      const aKey = this.dayKeyUTC(r.fechaRespuesta);

      const okRequestDate = !requestKey || (rKey !== null && rKey === requestKey);
      const okResponseDate = !responseKey || (aKey !== null && aKey === responseKey);

      return okSearch && okStatus && okRequestDate && okResponseDate;
    });
  }

  private devicesToText(r: PeticionItem): string {
    const arr = r.dispositivosSolicitados ?? [];
    if (arr.length === 0) return '—';
    if (arr.length === 1) return `${arr[0].model} (${arr[0].quantity})`;
    return arr.map(x => `${x.model} (${x.quantity})`).join(', ');
  }

  // ===== uniques (para mat-select) =====
  get uniqueRequestStatuses(): string[] {
    return Array.from(new Set((this.requests ?? []).map(r => r.estatus).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }

  // ===== selección =====
  private clearRequestSelection() {
    this.selectedRequestIds.clear();
  }

  isRequestSelected(id: string): boolean {
    return this.selectedRequestIds.has(id);
  }

  toggleRequestRowSelection(r: PeticionItem, checked: boolean) {
    if (checked) this.selectedRequestIds.add(r.id);
    else this.selectedRequestIds.delete(r.id);
  }

  toggleRequestRowByClick(r: PeticionItem) {
    this.toggleRequestRowSelection(r, !this.isRequestSelected(r.id));
  }

  toggleSelectAllRequestsVisible(checked: boolean) {
    const visible = this.displayedRequests;
    if (checked) visible.forEach(x => this.selectedRequestIds.add(x.id));
    else visible.forEach(x => this.selectedRequestIds.delete(x.id));
  }

  get isAllRequestsVisibleSelected(): boolean {
    const visible = this.displayedRequests;
    return visible.length > 0 && visible.every(x => this.selectedRequestIds.has(x.id));
  }

  get isSomeRequestsVisibleSelected(): boolean {
    const visible = this.displayedRequests;
    return visible.some(x => this.selectedRequestIds.has(x.id)) && !this.isAllRequestsVisibleSelected;
  }

  get requestsSelectedCount(): number {
    return this.selectedRequestIds.size;
  }

  get canViewOrEditRequest(): boolean {
    return this.requestsSelectedCount === 1;
  }

  get selectedRequestsItems(): PeticionItem[] {
    const map = new Map(this.requests.map(x => [x.id, x] as const));
    return Array.from(this.selectedRequestIds)
      .map(id => map.get(id))
      .filter(Boolean) as PeticionItem[];
  }

  // ===== acciones (botones) =====
  nuevaPeticion() {
    this.newRequestModal.open();
  }

  onRequestCreated(_: any) {
    this.loadRequests(); // refresca tabla
  }

  viewSelectedRequest() {
    if (!this.canViewOrEditRequest) return;
    const r = this.selectedRequestsItems[0];

    this.openDevicesSidebar(r);
  }

  async editSelectedRequest() {
    if (!this.canViewOrEditRequest) return;

    const r = this.selectedRequestsItems[0];

    // 👉 validar estatus antes de abrir modal
    if (r.estatus === 'Aceptada' || r.estatus === 'Rechazada') {

      const result = await Swal.fire({
        title: `Petición ${r.estatus}`,
        html: `
        Esta petición ya fue <b>${r.estatus}</b>.<br><br>
        ¿Deseas reabrirla y cambiar su estatus a <b>Pendiente</b>?
      `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Aceptar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--color-success)',
        cancelButtonColor: 'var(--color-danger)',
        reverseButtons: true
      });

      if (!result.isConfirmed) return;

      try {
        await firstValueFrom(
          this.apiService.updateRequest(r.id, {
            status: 'Pendiente'
          })
        );

        this.toast.success({
          detail: 'Petición reabierta',
          summary: 'El estatus cambió a Pendiente',
          duration: 4000
        });

        r.estatus = 'Pendiente';

      } catch (error) {
        console.error(error);

        this.toast.error({
          detail: 'Error',
          summary: 'No se pudo reabrir la petición',
          duration: 5000
        });

        return;
      }
    } else {
      this.editRequestModal.open(r);
    }

  }

  onRequestUpdated(_: any) {
    this.loadRequests();
  }

  onRequestDeleted(id: string) {
    // opcional: actualiza sin recargar
    this.requests = this.requests.filter(x => x.id !== id);
    this.selectedRequestIds.delete(id);

    const totalPages = Math.max(1, Math.ceil(this.requestsFiltered.length / this.requestsPerPage));
    if (this.requestsCurrentPage > totalPages) this.requestsCurrentPage = totalPages;
  }

  getEstadoActual(): string {

    if (this.modoValidacion) {
      return JSON.stringify({
        dispositivos: this.dispositivosValidacion.map(d => ({
          requestedModel: d.requestedModel,
          assignedModel: d.assignedModel,
          id: d.id,
          identifier: d.identifier
        })),
        comments: this.responseComments || ''
      });
    }

    const dispositivos = this.listaExpandida.map(x => ({
      id: x.id,
      model: x.assignedModel,
      identifier: x.identifier
    }));

    return JSON.stringify({
      dispositivos,
      comments: this.responseComments || ''
    });
  }

  deleteSelectedRequests() {
    if (this.requestsSelectedCount === 0) return;

    const selected = this.selectedRequestsItems;

    const htmlList = selected.slice(0, 8).map(r => `<div><b>${r.dispositivoSolicitadoResumen || '—'}</b> — Total: ${r.cantidad ?? '—'} — ${r.estatus || '—'}</div>`).join('');


    Swal.fire({
      title: `¿Eliminar ${selected.length} petición(es)?`,
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
        this.apiService.deleteRequest(item.id).pipe(catchError(err => of({ __error: err, id: item.id })))
      );

      this.requestsDeletingId = '__bulk__';

      forkJoin(reqs).subscribe({
        next: (res: any[]) => {
          const okIds: string[] = [];
          res.forEach((r, i) => { if (!r?.__error) okIds.push(selected[i].id); });

          const failures = res.length - okIds.length;

          if (okIds.length) {
            const okSet = new Set(okIds);

            this.requests = this.requests.filter(x => !okSet.has(x.id));
            okIds.forEach(id => this.selectedRequestIds.delete(id));

            const totalPages = Math.max(1, Math.ceil(this.requestsFiltered.length / this.requestsPerPage));
            if (this.requestsCurrentPage > totalPages) this.requestsCurrentPage = totalPages;

            this.toast.success({ detail: 'Éxito', summary: `Se eliminaron ${okIds.length} petición(es).`, duration: 5000 });
          }

          if (failures) {
            this.toast.error({ detail: 'Error', summary: `No se pudieron eliminar ${failures} petición(es).`, duration: 6000 });
          }
        },
        error: () => {
          this.toast.error({ detail: 'Error', summary: 'Falló la eliminación masiva.', duration: 6000 });
        },
        complete: () => {
          this.requestsDeletingId = null;
        }
      });
    });
  }

  seleccionIndex = 0;
  responding = false;
  peticionAResponder: PeticionItem | null = null;

  listaExpandida: {
    id: string | null;
    identifier: string | null;
    requestedModel: string;
    assignedModel: string | null;
  }[] = [];

  dispositivosValidacion: {
    id: string | null;
    identifier: string | null;
    requestedModel: string,
    assignedModel: string | null,
  }[] = [];

  devicesEnInventario: any[] = [];
  devicesFiltrados: any[] = [];
  tipoSeleccionado = 'gps'; // default

  filtrarPorTipo() {
    if (!this.devicesEnInventario) {
      this.devicesFiltrados = [];
      return;
    }

    const map: { [key: string]: string } = {
      gps: "gps",
      sim: "sim",
      accesorio: "accessory"
    };

    this.devicesFiltrados = (this.devicesEnInventario || []).filter(
      d => d.type === map[this.tipoSeleccionado]
    );
  }

  getDeviceIdentifier(device: any): string {
    if (device.type === 'gps') return device.imei;
    if (device.type === 'sim') return device.iccid;
    if (device.type === 'accessory') return device.id;
    return device._id;
  }

  cambiarTipo(index: number) {
    const tipos = ['gps', 'sim', 'accesorio'];

    this.tipoSeleccionado = tipos[index];
    this.filtrarPorTipo();
  }

  devolverDispositivo(index: number) {

    if (this.modoValidacion) {
      this.dispositivosValidacion[index].id = null;
      this.dispositivosValidacion[index].assignedModel = null;
      this.dispositivosValidacion[index].identifier = null;

      this.syncListaExpandidaDesdeValidacion();

    } else {
      this.listaExpandida[index].id = null;
      this.listaExpandida[index].assignedModel = null;
      this.listaExpandida[index].identifier = null;
    }
  }

  deviceAlreadyUsed(id: string, currentIndex?: number): boolean {
    return this.listaExpandida.some((x, i) =>
      x.id === id && i !== currentIndex
    );
  }

  agregarARespuesta(index: number, device: any) {
    const yaUsado = this.listaExpandida.some(x => x.id === device._id);

    if (yaUsado) {
      this.toast.warning({
        detail: 'Dispositivo ya asignado',
        summary: 'Este dispositivo ya fue agregado.',
        duration: 4000
      });
      return;
    }

    this.listaExpandida[index].id = device._id;
    this.listaExpandida[index].assignedModel = device.model;
    this.listaExpandida[index].identifier = this.getDeviceIdentifier(device);
  }

  async verificarReapertura(r: PeticionItem): Promise<boolean> {

    if (r.estatus !== 'Aceptada' && r.estatus !== 'Rechazada') {
      return true; // todo normal
    }

    const result = await Swal.fire({
      title: `Petición ya ${r.estatus}`,
      html: `
      Esta petición ya fue <b>${r.estatus}</b>.<br><br>
      ¿Deseas reabrirla y cambiar su estatus a <b>Pendiente</b>?
    `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, reabrir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--color-primary)',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return false;

    // 👉 actualizar estatus en backend
    try {
      await this.apiService.updateRequest(r.id, {
        status: 'Pendiente'
      }).toPromise();

      this.toast.success({
        detail: 'Petición reabierta',
        summary: 'El estatus cambió a Pendiente',
        duration: 4000
      });

      r.estatus = 'Pendiente';

      return true;

    } catch (error) {
      console.error(error);

      this.toast.error({
        detail: 'Error',
        summary: 'No se pudo reabrir la petición',
        duration: 5000
      });

      return false;
    }
  }

  responderPeticion(r: PeticionItem) {
    this.peticionAResponder = r;
    this.responding = true;

    this.responseComments = r.comments || '';

    this.tipoSeleccionado = 'gps';

    // Expandir lista
    this.listaExpandida = [];
    r.dispositivosSolicitados.forEach(dev => {
      for (let i = 0; i < dev.quantity; i++) {
        this.listaExpandida.push({
          id: null,
          requestedModel: dev.model,
          assignedModel: null,
          identifier: null
        });
      }
    });

    this.apiService.getDevices({
      status: 'En inventario'
    }).subscribe((res: any) => {
      this.devicesEnInventario = res.data || [];
      this.filtrarPorTipo();
    });

    setTimeout(() => {
      this.estadoInicialRespuesta = this.getEstadoActual();
    });
  }

  enviarRespuesta() {
    const base = this.modoValidacion
      ? this.peticionAValidar
      : this.peticionAResponder;

    if (!base) return;

    const sinAsignar = this.listaExpandida.some(x => !x.id);

    const continuarEnvio = () => {
      let devicesRequested: any[] = [];

      if (this.modoValidacion) {

        const map = new Map<string, any>();

        this.dispositivosValidacion.forEach(d => {

          if (!map.has(d.requestedModel)) {
            map.set(d.requestedModel, {
              model: d.requestedModel,
              quantity: 0,
              response: []
            });
          }

          const entry = map.get(d.requestedModel);

          entry.quantity++;

          if (d.id && d.assignedModel) {
            entry.response.push({
              id: d.id,
              model: d.assignedModel,
              identifier: d.identifier
            });
          }

        });

        devicesRequested = Array.from(map.values());

      } else {

        devicesRequested = base.dispositivosSolicitados.map(req => {

          const responses = this.listaExpandida
            .filter(x => x.requestedModel === req.model && x.id)
            .map(x => ({
              id: x.id,
              model: x.assignedModel,
              identifier: x.identifier
            }));

          return {
            model: req.model,
            quantity: req.quantity,
            response: responses
          };
        });

      }

      const payload: any = {
        comments: this.responseComments,
        devicesRequested
      };

      if (this.modoValidacion) {

        if (!this.hayCambios()) {
          // ✅ SOLO ACEPTAR
          payload.status = 'Aceptada';
        } else {
          // 🔁 DEVOLVER CON CAMBIOS
          payload.status = 'Pendiente';
        }

      } else {
        // flujo normal inventario
        payload.status = 'Atendida';
        payload.responseDate = new Date();
      }

      let mensaje = '';

      if (this.modoValidacion) {
        mensaje = this.hayCambios()
          ? 'La petición fue devuelta con cambios.'
          : 'La petición fue aceptada correctamente.';
      } else {
        mensaje = this.editandoRespuesta
          ? 'La respuesta fue actualizada correctamente.'
          : 'La petición fue atendida correctamente.';
      }

      this.apiService.updateRequest(base.id, payload)
        .subscribe({

          next: () => {
            this.toast.success({
              detail: 'Respuesta enviada',
              summary: mensaje,
              duration: 4000
            });

            this.responding = false;
            this.editandoRespuesta = false;

            this.modoValidacion = false;
            this.peticionAValidar = null;

            this.loadRequests();
          },

          error: (err) => {
            console.error(err);

            this.toast.error({
              detail: 'Error',
              summary: 'No se pudo guardar la respuesta.',
              duration: 5000
            });

          }
        });
    };

    if (sinAsignar) {
      Swal.fire({
        title: 'Dispositivos sin asignar',
        html: `
        Hay dispositivos solicitados que no tienen un dispositivo del inventario asignado.
        <br><br>
        ¿Deseas enviar la respuesta de todas formas?
      `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Aceptar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--color-success)',
        cancelButtonColor: 'var(--color-danger)',
        reverseButtons: true
      }).then(result => {

        if (result.isConfirmed) {
          continuarEnvio();
        }

      });
    } else {
      continuarEnvio();
    }
  }

  editarRespuesta(r: PeticionItem) {
    this.peticionAResponder = r;
    this.responding = true;
    this.editandoRespuesta = true;

    this.responseComments = r.comments || '';

    this.listaExpandida = [];

    r.dispositivosSolicitados.forEach(dev => {
      const responses = dev.response || [];

      for (let i = 0; i < dev.quantity; i++) {
        const assigned = responses[i];

        this.listaExpandida.push({
          id: assigned ? assigned.id : null,
          identifier: assigned ? assigned.identifier : null,
          requestedModel: dev.model,
          assignedModel: assigned ? assigned.model : null
        });
      }
    });

    // 🔥 ahora sí listaExpandida ya tiene datos
    const assignedIds = this.listaExpandida
      .map(x => x.id)
      .filter((id): id is string => id !== null);

    this.apiService.getDevices({
      status: 'En inventario',
      includeIds: assignedIds
    }).subscribe((res: any) => {
      this.devicesEnInventario = res.data || [];
      this.filtrarPorTipo();
    });

    setTimeout(() => {
      this.estadoInicialRespuesta = this.getEstadoActual();
    });
  }

  hayCambios(): boolean {
    return this.getEstadoActual() !== this.estadoInicialRespuesta;
  }

  validarPeticion(r: PeticionItem) {
    this.dispositivosValidacion = [];

    this.peticionAValidar = r;
    this.responding = true;
    this.modoValidacion = true;
    this.editandoRespuesta = false;

    this.responseComments = r.comments || '';

    this.listaExpandida = [];

    this.loadDeviceModels();

    r.dispositivosSolicitados.forEach(dev => {
      const responses = dev.response || [];

      for (let i = 0; i < dev.quantity; i++) {
        const assigned = responses[i];

        this.dispositivosValidacion.push({
          requestedModel: dev.model,
          assignedModel: assigned ? assigned.model : null,
          id: assigned ? assigned.id : null,
          identifier: assigned ? assigned.identifier : null
        });
      }
    });

    this.syncListaExpandidaDesdeValidacion();

    setTimeout(() => {
      this.estadoInicialRespuesta = this.getEstadoActual();
    });
  }

  agregarDispositivoUnitario() {
    const model = this.nuevoModelo.trim();
    if (!model) return;

    this.dispositivosValidacion.push({
      id: null,
      identifier: null,
      requestedModel: model,
      assignedModel: null
    });

    this.nuevoModelo = '';

    this.syncListaExpandidaDesdeValidacion();
  }

  private eliminarYSync(index: number) {
    this.dispositivosValidacion.splice(index, 1);
    this.syncListaExpandidaDesdeValidacion();
  }

  eliminarDispositivoUnitario(index: number) {

    const item = this.dispositivosValidacion[index];

    // 👉 si ya tiene dispositivo asignado
    if (item.id) {

      Swal.fire({
        title: 'Dispositivo ya asignado',
        html: `
        Este dispositivo ya tiene un equipo del inventario asociado.
        <br><br>
        Si lo eliminas, perderás esa asignación.
        <br><br>
        ¿Deseas continuar?
      `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--color-success)',
        cancelButtonColor: 'var(--color-danger)',
        reverseButtons: true
      }).then(result => {

        if (result.isConfirmed) {
          this.eliminarYSync(index);
        }

      });

      return;
    }

    // 👉 si NO tiene asignación → eliminar directo
    this.eliminarYSync(index);
  }

  syncListaExpandidaDesdeValidacion() {
    this.listaExpandida = this.dispositivosValidacion.map(d => ({
      id: d.id,
      identifier: d.identifier,
      requestedModel: d.requestedModel,
      assignedModel: d.assignedModel
    }));
  }

}
