import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EventDetailsData, EventDetailsModalComponent } from '../../modals/event-details-modal/event-details-modal.component';
import { ApiService, EventItem, EventsListResponse } from '../../services/api.service';
import { EventHistoryModalComponent } from '../../modals/event-history-modal/event-history-modal.component';
import Swal from 'sweetalert2';
import { PageEvent } from '@angular/material/paginator';
import { NgToastService } from 'ng-angular-popup';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss']
})
export class EventsComponent implements OnInit {

  @ViewChild(EventDetailsModalComponent) eventDetailsModal!: EventDetailsModalComponent;
  @ViewChild(EventHistoryModalComponent) eventHistoryModal!: EventHistoryModalComponent;

  /** listado + estado */
  events: EventItem[] = [];
  eventsLoading = false;
  errorMsg = '';

  /** paginación en UI (cliente) */
  perPage = 10;
  currentPage = 1;

  /** búsqueda (cliente) */
  search = '';

  isAdmin = false;

  constructor(private authService: AuthService, private api: ApiService, private toast: NgToastService) {
    const role = this.authService.getUserRole();
    this.isAdmin = role === 'admin';
  }

  ngOnInit(): void {
    this.fetchEvents();
  }

  onPage(e: PageEvent) {
    this.perPage = e.pageSize;
    this.currentPage = e.pageIndex + 1;
  }


  /** Llama a la API: GET /events (usa tu ApiService) */
  fetchEvents(forceRefresh = false): void {
    this.eventsLoading = true;
    this.errorMsg = '';

    this.api.getEventsCached(
      { sort: 'createdAt', order: 'desc', limit: 1000 },
      forceRefresh
    )
      .subscribe({
        next: (res: EventsListResponse) => {
          const items = res?.data ?? [];

          this.events = [...items].sort((a, b) => {
            const ams = new Date(a.createdAt as any).getTime() || 0;
            const bms = new Date(b.createdAt as any).getTime() || 0;
            return bms - ams;
          });

          this.currentPage = 1;
        },
        error: (err) => {
          // console.error(err);
          this.toast.error({
              detail: 'Error',
              summary: 'No se pudieron cargar los eventos. Intente más tarde.',
              duration: 5000,
            });
          this.errorMsg = 'No se pudieron cargar los eventos.';
        },
        complete: () => {
          this.eventsLoading = false;
        }
      });
  }

  refreshEvents() {
    this.fetchEvents(true); // 🔥 fuerza nueva petición
  }

  /** Helpers de vista */
  private s(v: any) { return (v ?? '').toString().trim().toLowerCase(); }

  selectedDate: Date | null = null;

  onDateChange(d: Date | null) {
    this.selectedDate = d;
    this.currentPage = 1;
  }
  clearDate() {
    this.onDateChange(null);
  }

  /** Normaliza {año,mes,día} en local */
  private ymdLocal(d: Date) {
    return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate() };
  }

  /** createdAt puede venir en ISO/UTC => conviértelo a Date y compara solo Y/M/D en local */
  private matchesDay(ev: EventItem, day: Date | null): boolean {
    if (!day) return true; // sin filtro
    const created = new Date(ev.createdAt as any);
    if (isNaN(created.getTime())) return false;
    const a = this.ymdLocal(created);
    const b = this.ymdLocal(day);
    return a.y === b.y && a.m === b.m && a.day === b.day;
  }

  get filtered(): EventItem[] {
    const q = this.s(this.search);

    return this.events.filter(ev => {
      // búsqueda por identificador/usuario
      const who = this.displayUser(ev).toLowerCase();
      const fields = [ev.identifier, who].map(this.s);
      const matchesSearch = !q || fields.some(f => f.includes(q));

      // filtro por operación
      const matchesOp = this.selectedOps.length === 0 || this.selectedOps.includes(ev.operation as any);

      // filtro por colección
      const colEs = this.mapCollectionToEs(ev.collectionName);
      const matchesCol = this.selectedCols.length === 0 || this.selectedCols.includes(colEs);

      // filtro por fecha (día)
      const matchesDate = this.matchesDay(ev, this.selectedDate);

      return matchesSearch && matchesOp && matchesCol && matchesDate;
    });
  }

  get displayed(): EventItem[] {
    const src = this.filtered;
    const start = (this.currentPage - 1) * this.perPage;
    return src.slice(start, start + this.perPage);
  }

  get totalPages(): number {
    const total = Math.ceil(this.filtered.length / this.perPage);
    return Math.max(1, total);
  }

  onPageChange(e: PageEvent) {
    this.perPage = e.pageSize;
    this.currentPage = e.pageIndex + 1;
  }

  setPage(p: number) {
    const total = this.totalPages;
    this.currentPage = Math.min(Math.max(1, p), total);
  }

  onSearchChange(v: string) {
    this.search = (v ?? '').trim();
    this.currentPage = 1;
  }

  displayUser(ev: EventItem): string {
    // Si EventItem exportado desde ApiService no incluye user opcionalmente,
    // puedes definir aquí­ el tipo local o ajustar ApiService.EventItem
    // @ts-ignore
    return ev?.user?.userName || ev?.user?.email || (ev as any)?.user?._id || '—';
  }

  /** Abre el modal con el evento completo */
  openDetails(ev: EventItem) {
    const payload: EventDetailsData = {
      _id: ev._id,
      identifier: ev.identifier,
      collectionName: ev.collectionName,
      operation: ev.operation as any,
      finalValues: (ev as any).finalValues,
      user: (ev as any).user,
      request: (ev as any).request,
      createdAt: ev.createdAt
    };
    this.eventDetailsModal.open(payload);
  }

  openHistory(ev: EventItem) {
    const docId = (ev as any)?.finalValues?._id || (ev as any)?.documentId;
    if (!docId) {
      this.errorMsg = 'No se encontró el _id del documento en este evento.';
      this.toast.error({
              detail: 'Error',
              summary: 'No se encontró el _id del documento en este evento.',
              duration: 5000,
            });
      return;
    }

    const listParams: any = {
      sort: 'createdAt',
      order: 'desc',
      limit: 10000,
      collectionName: (ev as any).collectionName
    };

    this.api.getEvents(listParams).subscribe({
      next: (res: EventsListResponse) => {
        const all = res?.data ?? [];
        const related = all.filter(e =>
          ((e as any)?.finalValues?._id === docId) || ((e as any)?.documentId === docId)
        );

        // Construye el "data" (evento base) que el modal mostrará en el encabezado
        const data = {
          _id: ev._id,
          identifier: (ev as any).identifier,
          collectionName: (ev as any).collectionName,
          operation: ev.operation as any,
          finalValues: (ev as any).finalValues,
          user: (ev as any).user,
          request: (ev as any).request,
          createdAt: ev.createdAt
        };

        // 🎯 Abre el modal con el contrato definido: { data, events }
        this.eventHistoryModal.open({ data, events: related });
      },
      error: (err) => {
        // console.error(err);
        this.toast.error({
              detail: 'Error',
              summary: 'No se pudo cargar el historial.',
              duration: 5000,
            });
        this.errorMsg = 'No se pudo cargar el historial.';
      }
    });
  }

  deletingId: string | null = null;

  deleteEvent(ev: EventItem): void {
    Swal.fire({
      title: '¿Estás seguro de eliminar este evento?',
      text: 'No podrás revertir esta acción.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (!result.isConfirmed) return;

      this.deletingId = ev._id;
      this.api.deleteEventById(ev._id).subscribe({
        next: (res) => {
          // Quita el evento de la lista en memoria
          this.deletingId = null;
          this.refreshEvents();

          Swal.fire({
            title: 'Eliminado',
            text: res?.message || 'El evento fue eliminado correctamente.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: (err) => {
          this.deletingId = null;
          Swal.fire({
            title: 'Error',
            text: err?.error?.message || err?.error?.error || 'No se pudo eliminar el evento.',
            icon: 'error'
          });
        }
      });
    });
  }

  /** Filtros */
  opsOptions = ['Creación', 'Actualización', 'Eliminación'];
  colOptions = ['Dispositivos', 'Usuarios', 'Servicios'];

  selectedOps: string[] = [];
  selectedCols: string[] = [];

  // Normaliza nombre interno de colección a etiqueta en español para filtrar/mostrar
  private mapCollectionToEs(name?: string): string {
    const n = (name || '').toLowerCase();
    if (n === 'devices' || n === 'dispositivos' || n === 'device') return 'Dispositivos';
    if (n === 'users' || n === 'usuarios' || n === 'user') return 'Usuarios';
    if (n === 'services' || n === 'servicios' || n === 'service') return 'Servicios';
    return name || ''; // fallback
  }

  onFiltersChange() {
    this.currentPage = 1;
  }


}
