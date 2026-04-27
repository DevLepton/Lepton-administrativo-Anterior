import { Component, ViewEncapsulation } from '@angular/core';
import { SimItem } from '../../inventario/almacen/sims-tab/sims-tab.component';

@Component({
  selector: 'app-view-sim-modal',
  templateUrl: './view-sim-modal.component.html',
  styleUrls: ['./view-sim-modal.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ViewSimModalComponent {
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
  data: SimItem | null = null;

  open(d: SimItem) {
    this.data = d;
    this.show = true;
    this.lockBodyScroll();
  }
  close() { this.show = false; this.unlockBodyScroll();}

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
