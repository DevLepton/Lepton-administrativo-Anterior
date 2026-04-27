import { Component } from '@angular/core';
import { AccessoryItem } from '../../inventario/almacen/accessories-tab/accessories-tab.component';

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
  data: AccessoryItem | null = null;

  open(d: AccessoryItem) {
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
