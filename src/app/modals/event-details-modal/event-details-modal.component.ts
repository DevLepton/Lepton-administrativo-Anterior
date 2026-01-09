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

@Component({
  selector: 'app-event-details-modal',
  templateUrl: './event-details-modal.component.html',
  styleUrls: ['./event-details-modal.component.scss']
})
export class EventDetailsModalComponent {
  private lockBodyScroll() {
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll() {
    document.body.style.overflow = '';
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
  }

  visible = false;
  data!: EventDetailsData;

  @ViewChild('backdrop') backdropRef!: ElementRef<HTMLDivElement>;

  open(data: EventDetailsData) {
    this.data = data;
    this.visible = true;
    this.lockBodyScroll();
  }
  close() { this.visible = false; this.unlockBodyScroll(); }
  stop(e: Event) { e.stopPropagation(); }

  /** Mapea claves a etiquetas en español */
  mapKeyToLabel(key: string): string {
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
      // agrega más si lo necesitas
    };
    return dict[key] ?? key;
  }

  /** Claves que son fechas (se muestran sin hora) */
  isDateKey(key: string): boolean {
    return key === 'purchaseDate' || key === 'entryDate' || key === 'installationDate';
  }

  /** Entradas (clave/valor) de finalValues sin _id */
  get finalValuesRows(): Array<{ key: string; value: any }> {
    const fv = this.data?.finalValues ?? {};
    return Object.entries(fv)
      .filter(([k]) => k !== '_id')
      .map(([key, value]) => ({ key, value }));
  }

  /** ¿Es objeto/array? para decidir si usar <pre> */
  isObject(v: any): boolean {
    return v !== null && typeof v === 'object';
  }

  /** Render amigable de valores que NO son fecha */
  displayValue(v: any): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }
}
