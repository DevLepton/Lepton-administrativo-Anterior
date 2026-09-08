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
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  clientes: Cliente[] = []; // Lista completa de clientes
  filteredClientes: Cliente[] = []; // Clientes filtrados por los criterios seleccionados
  selectedStatus: string = 'pendiente'; // Filtro de estatus seleccionado
  clientesPerPage = 25; // Clientes por página
  currentPage = 1; // Página actual
  showAll = true; // Indica si se muestran todos los clientes o se aplica paginación
  sortStates: { [key: string]: boolean } = {
    fechaCorte: true,
    dispositivos: true,
  }; // Estados de ordenamiento por columna
  selectedCliente: Cliente | null = null; // Cliente seleccionado para opciones adicionales

  constructor(private apiService: ApiService, private toast: NgToastService) { }

  ngOnInit(): void {
    this.loadClientes(); // Cargar clientes al inicializar el componente
  }

  /**
   * Cargar los clientes desde la API y aplicar filtros iniciales.
   */
  loadClientes(): void {
    this.apiService.getClientes().subscribe({
      next: (response: any) => {
        this.clientes = Array.isArray(response.data) ? response.data : [];
        this.applyFilters(); // Aplicar filtros iniciales
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

  /**
   * Filtrar clientes por el estatus seleccionado.
   */
  applyFilters(): void {
    this.filteredClientes = this.clientes.filter((cliente) => {
      return this.selectedStatus ? cliente.estatus === this.selectedStatus : true;
    });
    this.currentPage = 1; // Reiniciar la paginación
  }

  /**
   * Obtener los clientes a mostrar en la página actual.
   */
  get displayedClientes(): Cliente[] {
    if (this.showAll) return this.filteredClientes;
    const startIndex = (this.currentPage - 1) * this.clientesPerPage;
    return this.filteredClientes.slice(startIndex, startIndex + this.clientesPerPage);
  }

  /**
   * Calcular el número total de páginas basado en los clientes filtrados.
   */
  get totalPages(): number {
    return Math.ceil(this.filteredClientes.length / this.clientesPerPage);
  }

  /**
   * Cambiar la página actual para la paginación.
   * @param page Número de la página a la que se quiere cambiar.
   */
  setPage(page: number): void {
    this.currentPage = page;
  }

  /**
   * Alternar entre mostrar todos los clientes o aplicar paginación.
   */
  toggleShowAll(): void {
    this.showAll = !this.showAll;
    this.currentPage = 1; // Reiniciar a la primera página
  }

  /**
   * Ordenar los clientes filtrados por una columna específica.
   * @param column Nombre de la columna por la que se ordenarán los clientes.
   */
  toggleSort(column: string): void {
    this.sortStates[column] = !this.sortStates[column];
    this.filteredClientes.sort((a, b) => this.sortFunction(a, b, column, this.sortStates[column]));
  }

  /**
   * Función genérica de ordenamiento.
   * @param a Primer cliente a comparar.
   * @param b Segundo cliente a comparar.
   * @param column Nombre de la columna por la que se realiza la comparación.
   * @param ascending Indica si el orden es ascendente.
   */
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

  /**
   * Obtener la clase CSS para el estatus del cliente.
   * @param estatus Estatus del cliente (activo, inactivo, pendiente).
   */
  getStatusClass(estatus: string): string {
    if (estatus === 'activo') return 'status-activo';
    if (estatus === 'inactivo') return 'status-inactivo';
    return 'status-pendiente';
  }

  /**
   * Abrir el modal para realizar una acción con el cliente seleccionado.
   * @param cliente Cliente seleccionado.
   */
  openModal(cliente: Cliente): void {
    this.selectedCliente = cliente;
    this.toast.info({
      detail: 'Información',
      summary: `Cliente seleccionado: ${cliente.nombre}`,
      duration: 3000,
    });
  }

  /**
   * Cerrar el modal y limpiar el cliente seleccionado.
   */
  closeModal(): void {
    this.selectedCliente = null;
  }
}
