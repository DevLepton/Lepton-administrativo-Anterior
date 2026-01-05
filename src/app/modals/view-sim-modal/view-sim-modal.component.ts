import { Component, ViewEncapsulation } from '@angular/core';

export interface ViewSimData {
  id: string;
  iccid: string;
  modelo: string;
  compania: string;
  estatus: string;
  fechaCompra: string | Date | null;
  fechaIngresoLepton: string | Date | null;
  cliente?: string | null;
  comentarios?: string | null; // si lo manejas en UI
}

@Component({
  selector: 'app-view-sim-modal',
  templateUrl: './view-sim-modal.component.html',
  styleUrls: ['./view-sim-modal.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ViewSimModalComponent {
  show = false;
  data: ViewSimData | null = null;

  open(d: ViewSimData) {
    this.data = d;
    this.show = true;
  }
  close() { this.show = false; }

  fmtDate(v: any): string {
    if (!v) return '—';
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return '—';

    // mes abreviado en español (ej. "13 sept 2025"), fijo en UTC
    const fmt = new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',   // usa 'long' si quieres el mes completo
      year: 'numeric',
      timeZone: 'UTC'
    });

    // En algunos entornos "sept." trae punto final; lo quitamos.
    return fmt.format(d).replace(/\./g, '');
  }

}
