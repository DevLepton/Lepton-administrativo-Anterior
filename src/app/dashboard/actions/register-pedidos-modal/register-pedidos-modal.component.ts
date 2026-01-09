import { Component, Input, Output, EventEmitter, AfterViewInit, ViewChild } from '@angular/core';
import { AsignarPedidosModalComponent } from '../asignar-pedidos-modal/asignar-pedidos-modal.component';

export interface Cliente {
  idCliente: number;
  tipoCliente: string;
  nombre: string;
  aPaterno: string;
  aMaterno: string;
  contacto: {
    correo: string;
    telefono: string;
  };
  datosComerciales: {
    comprobante: string;
    fechaCorte: Date | string;
    fechaPago: Date | string;
  };
  dispositivos: number;
  saldo: number;
  estatus: string;
}

@Component({
  selector: 'app-register-pedidos-modal',
  templateUrl: './register-pedidos-modal.component.html',
  styleUrls: ['./register-pedidos-modal.component.scss'],
})
export class RegisterPedidosModalComponent {
  private lockBodyScroll() {
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll() {
    document.body.style.overflow = '';
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
  }

  @Input() cliente!: Cliente | null; // Recibe los datos desde el componente padre
  @Output() closeModal = new EventEmitter<void>(); // Emitir evento para cerrar el modal

    // Controla la visibilidad del modal secundario
    isAsignarPedidosVisible = false;


  close(): void {
    this.unlockBodyScroll();
    this.closeModal.emit(); // Emitir evento de cierre
  }

  openModalPedidos(): void {
    this.isAsignarPedidosVisible = true;
    this.lockBodyScroll();
  }

  closeAsignarPedidosModal(): void {
    this.isAsignarPedidosVisible = false;
  }

  getStatusClass(status: string): string {
    return status === 'activo' ? 'status-activo' : 'status-inactivo';
  }
}
