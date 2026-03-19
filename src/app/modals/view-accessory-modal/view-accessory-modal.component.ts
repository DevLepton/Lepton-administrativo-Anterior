import { Component } from '@angular/core';

export interface ViewAccessoryData {
  idMongo: string;                    // _id de Mongo (para referencia si lo quieres)
  id: string;                         // id del accesorio (schema)
  sn: string;                         // requerido (no-sim)
  nombre: string;                     // name
  marca: string;                      // brand
  modelo: string;                     // model
  estatus: string;                    // status
  fechaCompra: string | Date | null;  // purchaseDate
  fechaIngresoLepton: string | Date | null; // entryDate
  cliente?: string | null;
  comentarios?: string | null;
}

@Component({
  selector: 'app-view-accessory-modal',
  templateUrl: './view-accessory-modal.component.html',
  styleUrl: './view-accessory-modal.component.scss'
})
export class ViewAccessoryModalComponent {
  private lockBodyScroll() {
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll() {
    document.body.style.overflow = '';
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
  }

  show = false;
  data: ViewAccessoryData | null = null;

  open(d: ViewAccessoryData) {
    this.data = d;
    this.show = true;
    this.lockBodyScroll();
  }
  close() { this.show = false; this.unlockBodyScroll(); }

  fmtDate(v: string | Date | null | undefined): string {
    // 👇 caso especial: externo
    if (v === null) return 'Externo a Leptón';

    // sin valor (undefined, vacío)
    if (!v) return '—';

    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return '—';

    const fmt = new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    });

    return fmt.format(d).replace(/\./g, '');
  }
}
