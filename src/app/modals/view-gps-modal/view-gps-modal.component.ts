import { Component } from '@angular/core';
import { GpsItem } from '../../inventario/almacen/gps-tab/gps-tab.component';



@Component({
  selector: 'app-view-gps-modal',
  templateUrl: './view-gps-modal.component.html',
  styleUrl: './view-gps-modal.component.scss'
})
export class ViewGpsModalComponent {
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
  data: GpsItem | null = null;

  open(d: GpsItem) {
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
