import { Component, ElementRef, ViewChild } from '@angular/core';

export interface EventDetailsData {
  _id: string;
  identifier: string;
  collectionName: string;
  operation: 'Creación' | 'Actualización' | 'Eliminación';
  finalValues: any;
  user?: { _id?: string; email?: string; userName?: string; role?: string };
  request?: { method?: string; path?: string; ip?: string };
  createdAt: string | Date;
}

type RowEvent = EventDetailsData; // alias semántico para filas

@Component({
  selector: 'app-event-history-modal',
  templateUrl: './event-history-modal.component.html',
  styleUrl: './event-history-modal.component.scss'
})
export class EventHistoryModalComponent {
  visible = false;

  /** Evento “base” que disparó la apertura del historial (opcional, solo para encabezado) */
  data!: EventDetailsData;

  /** Todos los eventos relacionados (mismo documento) que mostraremos en la tabla */
  relatedEvents: RowEvent[] = [];

  /** Columnas dinámicas (claves de finalValues unificadas y mapeadas a español) */
  dynamicKeys: string[] = [];   // claves originales (p.ej. "purchaseDate")
  dynamicLabels: string[] = []; // etiquetas en español (p.ej. "Fecha de compra")

  @ViewChild('backdrop') backdropRef!: ElementRef<HTMLDivElement>;

  /**
   * Abre el modal con el evento base y la lista de relacionados.
   * Puedes llamar: open({ data: evSeleccionado, events: arrayDeRelacionados })
   */
  open(payload: { data: EventDetailsData; events: RowEvent[] }) {
    this.data = payload.data;
    // Ordenar más recientes primero, por si te llega mezclado
    this.relatedEvents = [...(payload.events || [])].sort((a, b) => {
      const ams = new Date(a.createdAt as any).getTime() || 0;
      const bms = new Date(b.createdAt as any).getTime() || 0;
      return bms - ams;
    });

    this.computeDynamicColumns();
    this.visible = true;
  }

  close() { this.visible = false; }
  stop(e: Event) { e.stopPropagation(); }

  /** Construye el conjunto de claves dinámicas de finalValues (unión de todas), en orden estable */
  private computeDynamicColumns() {
    const set = new Set<string>();
    for (const ev of this.relatedEvents) {
      const fv = (ev?.finalValues ?? {}) as Record<string, any>;
      for (const k of Object.keys(fv)) {
        if (k === '_id') continue; // excluir _id
        set.add(k);
      }
    }
    this.dynamicKeys = Array.from(set);
    this.dynamicLabels = this.dynamicKeys.map(k => this.mapKeyToLabel(k));
  }

  /** Etiquetas en español para claves comunes */
  private mapKeyToLabel(key: string): string {
    const dict: Record<string, string> = {
      type: 'Tipo',
      name: 'Nombre',
      brand: 'Marca',
      model: 'Modelo',
      imei: 'IMEI',
      sn: 'Número de serie',
      id: 'Identificador',
      iccid: 'ICCID',
      company: 'Compañía',
      status: 'Estatus',
      purchaseDate: 'Fecha de compra',
      entryDate: 'Fecha de ingreso',
      installationDate: 'Fecha de instalación',
      client: 'Cliente',
      comments: 'Comentarios',
    };
    return dict[key] ?? key;
  }

  /** Claves que deben mostrarse como fecha sin hora */
  private isDateKey(key: string): boolean {
    return key === 'purchaseDate' || key === 'entryDate' || key === 'installationDate';
  }

  /** Valor (ya normalizado) de finalValues para una fila y una clave dinámica */
  getCellValue(ev: RowEvent, key: string): any {
    const fv = (ev?.finalValues ?? {}) as Record<string, any>;
    return fv[key];
  }

  /** ¿Es objeto/array? (para mostrar pretty JSON) */
  isObject(v: any): boolean {
    return v !== null && typeof v === 'object';
  }

  /** Render amigable para valores no-fecha */
  displayValue(v: any): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }

  /** Usuario mostrado en tabla */
  displayUser(ev: RowEvent): string {
    return ev?.user?.userName || ev?.user?.email || ev?.user?._id || '—';
  }

  /** True si la clave debe renderizarse como fecha sin hora */
  asDateOnly(key: string): boolean {
    return this.isDateKey(key);
  }
}
