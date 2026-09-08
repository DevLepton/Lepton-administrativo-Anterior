import { Component, ViewChild, OnInit } from '@angular/core';
import { RegisterServiciosModalComponent } from './actions/register-servicios-modal/register-servicios-modal.component';
import { EditServiciosModalComponent } from './actions/edit-servicios-modal/edit-servicios-modal.component'; // Importa el modal de edición
import { ApiService } from '../services/api.service';
import Swal from 'sweetalert2';
import { NgToastService } from 'ng-angular-popup';
interface Servicio {
  idServ: number;
  descripcion: string;
  precio: number;
  precioConIVA: number;
  codigo: string;
}

@Component({
  selector: 'app-servicios',
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.scss']
})
export class ServiciosComponent implements OnInit {
  @ViewChild(RegisterServiciosModalComponent) registerServiciosModal!: RegisterServiciosModalComponent;
  @ViewChild(EditServiciosModalComponent) editServiciosModal!: EditServiciosModalComponent; // Modal de edición

  servicios: Servicio[] = [];
  serviciosPerPage = 25; // Cantidad de servicios por página
  currentPage = 1; // Página actual
  showAll = true; // Controla si se muestran todos los servicios o se paginan

  constructor(private apiService: ApiService, private toast: NgToastService) { }

  ngOnInit(): void {
    this.loadServicios(); // Cargar servicios desde la API
  }

  // Cargar servicios desde la API
  loadServicios(): void {
    this.apiService.getServicios().subscribe({
      next: (response: any) => {
        this.servicios = Array.isArray(response.data) ? response.data : [];
      },
      error: (error) => {
        console.error('Error al cargar servicios:', error);
        this.servicios = []; // Inicializar como arreglo vacío en caso de error
      }
    });
  }

  // Obtener servicios para la página actual
  get displayedServicios(): Servicio[] {
    if (this.showAll) {
      return this.servicios;
    }
    const startIndex = (this.currentPage - 1) * this.serviciosPerPage;
    return this.servicios.slice(startIndex, startIndex + this.serviciosPerPage);
  }

  // Calcular total de páginas
  get totalPages(): number {
    return Math.ceil(this.servicios.length / this.serviciosPerPage);
  }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
    this.currentPage = 1; // Reiniciar a la primera página
  }

  setPage(page: number): void {
    this.currentPage = page;
  }

  // Abrir el modal de edición y cargar los datos del servicio seleccionado
  editarServicio(servicio: Servicio): void {
    this.editServiciosModal.open(servicio); // Llamar al método `open` del modal de edición
  }

  // Actualizar el servicio después de editar
  actualizarServicio(servicioActualizado: any): void {
    this.apiService.updateServicio(servicioActualizado.idServ, servicioActualizado).subscribe({
      next: () => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Servicio actualizado con éxito.',
          duration: 5000,
        });
        this.loadServicios(); // Recargar los datos
      },
      error: (error) => {
        this.toast.error({
          detail: 'Error',
          summary: 'Error al actualizar el servicio.',
          duration: 5000,
        });
      }
    });
  }


  eliminarServicio(servicio: Servicio): void {
    Swal.fire({
      title: "¿Estás seguro de eliminar?",
      text: "No podrás revertir esta acción.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Si, eliminar",
    }).then((result) => {
      if (result.isConfirmed) {
        this.apiService.deleteServicio(servicio.idServ).subscribe({
          next: () => {
            this.toast.success({
              detail: 'Éxito',
              summary: 'Servicio eliminado con éxito.',
              duration: 5000,
            });

            this.loadServicios(); // Recargar la lista de servicios
          },
          error: (error) => {
            this.toast.error({
              detail: 'Error',
              summary: 'Error al eliminar el servicio.',
              duration: 5000,
            });

          }
        });
      }
    });


  }

  // Abrir el modal de registro
  openModal(): void {
    this.registerServiciosModal.open();
  }

  // Agregar un nuevo servicio
  addNewServicio(newServicio: Servicio): void {
    this.apiService.createServicio(newServicio).subscribe({
      next: () => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Servicio registrado con éxito.',
          duration: 5000,
        });

        this.loadServicios(); // Recargar la lista de servicios
      },
      error: (error) => {
        this.toast.error({
          detail: 'Error',
          summary: 'Error al registrar el servicio.',
          duration: 5000,
        });

      }
    });
  }
}
