import { Component, OnInit, ViewChild } from '@angular/core';
import { RegisterClientesModalComponent } from './actions/register-clientes-modal/register-clientes-modal.component';
import { EditClientesModalComponent } from './actions/edit-clientes-modal/edit-clientes-modal.component';
import { ApiService } from '../services/api.service';
import Swal from 'sweetalert2';
import { NgToastService } from 'ng-angular-popup';

interface Cliente {
  idCliente: number;
  tipoCliente: string;
  nombre: string;
  aPaterno: string;
  aMaterno: string;
  domicilio: {
    codigoPostal: string;
    colonia: string;
    estado: string;
    municipio: string;
    calle: string;
    numeroExterior: string;
    numeroInterior?: string;
  };
  contacto: {
    correo: string;
    telefono: string;
  };
  datosComerciales: {
    comprobante: string;
    emisorComprobante: string;
    diaCorte: number;
    fechaCorte: Date;
    fechaPago: Date;
  };
  estatus: 'activo' | 'inactivo' | 'pendiente';

}

@Component({
  selector: 'app-clientes',
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss'],
})
export class ClientesComponent implements OnInit {
  @ViewChild(RegisterClientesModalComponent) registerClientesModal!: RegisterClientesModalComponent;
  @ViewChild(EditClientesModalComponent) editClientesModal!: EditClientesModalComponent;
  clientes: Cliente[] = [];
  filteredClientes: Cliente[] = [];
  selectedStatus: string = '';
  selectedComprobante: string = '';
  clientesPerPage = 25; // Cantidad de clientes por página
  currentPage = 1; // Página actual
  showAll = true; // Mostrar todos o paginar

  constructor(private apiService: ApiService, private toast: NgToastService) { }

  ngOnInit(): void {
    this.loadClientes(); // Cargar clientes desde la API
  }

  // Cargar clientes desde la API
  loadClientes(): void {
    this.apiService.getClientes().subscribe({
      next:
        (response: any) => {
          this.clientes = Array.isArray(response.data) ? response.data : [];
          this.filteredClientes = [...this.clientes];
          this.applyFilters();
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

  // Obtener clientes para la página actual
  get displayedClientes(): Cliente[] {
    if (this.showAll) {
      return this.filteredClientes;
    }
    const startIndex = (this.currentPage - 1) * this.clientesPerPage;
    return this.filteredClientes.slice(startIndex, startIndex + this.clientesPerPage);
  }

  // Calcular total de páginas
  get totalPages(): number {
    return Math.ceil(this.filteredClientes.length / this.clientesPerPage);
  }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
    this.currentPage = 1;
  }

  setPage(page: number): void {
    this.currentPage = page;
  }

  getStatusClass(estatus: string): string {
    if (estatus === 'activo') return 'status-activo';
    if (estatus === 'inactivo') return 'status-inactivo';
    return 'status-pendiente'; // Clase para el estatus "pendiente"
  }

  applyFilters(): void {
    this.filteredClientes = this.clientes.filter((cliente) => {
      const matchesStatus = this.selectedStatus ? cliente.estatus === this.selectedStatus : true;
      const matchesComprobante = this.selectedComprobante
        ? cliente.datosComerciales.comprobante === this.selectedComprobante
        : true;
      return matchesStatus && matchesComprobante;
    });
    this.currentPage = 1;
  }


  editarCliente(cliente: Cliente): void {
    this.editClientesModal.open(cliente); // Abrir modal con los datos del cliente seleccionado
  }

  actualizarCliente(clienteActualizado: Cliente): void {
    this.apiService.updateCliente(clienteActualizado.idCliente, clienteActualizado).subscribe({
      next: () => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Cliente actualizado con éxito.',
          duration: 5000,
        });
        this.loadClientes(); // Recargar la lista de clientes
      },
      error: (error) => {
        this.toast.error({
          detail: 'Error',
          summary: 'Error al actualizar el cliente.',
          duration: 5000,
        });
      }
    }
    );
  }

  eliminarCliente(cliente: Cliente): void {
    Swal.fire({
      title: '¿Estás seguro de eliminar?',
      text: 'No podrás revertir esta acción',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.apiService.deleteCliente(cliente.idCliente).subscribe({
          next: () => {
            this.toast.success({
              detail: 'Éxito',
              summary: 'Cliente eliminado con éxito',
              duration: 5000,
            });
            this.loadClientes();
          },
          error: (error) => {
            this.toast.error({
              detail: 'Error',
              summary: 'Error al eliminar cliente',
              duration: 5000,
            });
          }
        });
      }
    });
  }

  openModal(): void {
    this.registerClientesModal.open();
  }

  addNewCliente(newCliente: Cliente): void {
    this.apiService.createCliente(newCliente).subscribe({
      next: () => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Cliente registrado con éxito',
          duration: 5000,
        });
        this.loadClientes();
      },
      error: (error) => {
        this.toast.error({
          detail: 'Error',
          summary: 'Error al registrar cliente',
          duration: 5000,
        });
      }
    });
  }
}
