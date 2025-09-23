import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service'; // Importar el servicio de la API
import { NgToastService } from 'ng-angular-popup';

interface Cliente {
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
  estatus: 'activo' | 'inactivo' | 'pendiente';
}
@Component({
  selector: 'app-pedidos',
  templateUrl: './pedidos.component.html',
  styleUrl: './pedidos.component.scss'
})
export class PedidosComponent {
  clientes: Cliente[] = []; // Lista de clientes desde la API
  clientesPendientes: Cliente[] = []; // Clientes pendientes


  // Propiedades para la tabla de Pendientes
  filteredClientesPendientes: Cliente[] = [];
  clientesPerPagePendientes = 10;
  currentPagePendientes = 1;
  showAllPendientes = true;

  // Estados para ordenamiento
  sortStates: { [key: string]: boolean } = {
    fechaCorte: true,
    dispositivos: true,
  };
  sortStatesPendientes: { [key: string]: boolean } = {
    fechaCorte: true,
    dispositivos: true,
  };

  selectedCliente: Cliente | null = null; // Cliente seleccionado para modal

  constructor(private apiService: ApiService, private toast: NgToastService) { }

  ngOnInit(): void {
    this.loadClientes();
  }

  // Cargar clientes desde la API
  loadClientes(): void {
    this.apiService.getClientes().subscribe({
      next: (response: any) => {
        this.clientes = Array.isArray(response.data) ? response.data : [];
        this.clientesPendientes = this.clientes.filter((c) => c.estatus === 'pendiente');

        // Inicializar las tablas filtradas
        this.filteredClientesPendientes = [...this.clientesPendientes];
      },
      error: (error) => {
        console.error('Error al cargar clientes:', error);
        this.toast.error({
          detail: 'Error',
          summary: 'Error al cargar clientes',
          duration: 5000,
        });
      }
    });
  }


  // Obtener clientes pendientes para la página actual
  get displayedClientesPendientes(): Cliente[] {
    if (this.showAllPendientes) return this.filteredClientesPendientes;
    const startIndex = (this.currentPagePendientes - 1) * this.clientesPerPagePendientes;
    return this.filteredClientesPendientes.slice(startIndex, startIndex + this.clientesPerPagePendientes);
  }


  // Paginación y filtros para Clientes Pendientes
  get totalPagesPendientes(): number {
    return Math.ceil(this.filteredClientesPendientes.length / this.clientesPerPagePendientes);
  }

  setPagePendientes(page: number): void {
    this.currentPagePendientes = page;
  }

  toggleShowAllPendientes(): void {
    this.showAllPendientes = !this.showAllPendientes;
    this.currentPagePendientes = 1;
  }


  // Ordenamiento para Clientes Pendientes
  toggleSortPendientes(column: string): void {
    this.sortStatesPendientes[column] = !this.sortStatesPendientes[column];
    this.filteredClientesPendientes.sort((a, b) =>
      this.sortFunction(a, b, column, this.sortStatesPendientes[column])
    );
  }

  // Función común de ordenamiento
  sortFunction(a: Cliente, b: Cliente, column: string, ascending: boolean): number {
    if (column === 'fechaCorte') {
      return ascending
        ? new Date(a.datosComerciales.fechaCorte).getTime() - new Date(b.datosComerciales.fechaCorte).getTime()
        : new Date(b.datosComerciales.fechaCorte).getTime() - new Date(a.datosComerciales.fechaCorte).getTime();
    }
    if (column === 'dispositivos') {
      return ascending ? a.dispositivos - b.dispositivos : b.dispositivos - a.dispositivos;
    }
    return 0;
  }

  // Clase para el estado del cliente
  getStatusClass(estatus: string): string {
    if (estatus === 'activo') return 'status-activo';
    if (estatus === 'inactivo') return 'status-inactivo';
    return 'status-pendiente';
  }

  // Modal: abrir y cerrar
  openModal(cliente: Cliente): void {
    this.selectedCliente = cliente;
  }

  closeModal(): void {
    this.selectedCliente = null;
  }
}
