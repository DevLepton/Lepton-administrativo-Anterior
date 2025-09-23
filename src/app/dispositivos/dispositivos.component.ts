import { Component, ViewChild, OnInit } from '@angular/core';
import { RegisterDispositivosModalComponent } from './actions/register-dispositivos-modal/register-dispositivos-modal.component';
import { EditDispositivosModalComponent } from './actions/edit-dispositivos-modal/edit-dispositivos-modal.component'; // Importa el componente de edición
import { ApiService } from '../services/api.service';
import Swal from 'sweetalert2'
import { NgToastService } from 'ng-angular-popup';
interface Dispositivo {
  idDis: number;
  codigoDis: string;
  nombre: string;
  precio: number;
  precioConIVA: number;
  tipoDis: string;
  marca: string;
  modelo: string;
  tipoImp: string;
  codigoSat: string;
  unidad: string;
  claveUnidad: string;
}

@Component({
  selector: 'app-dispositivos',
  templateUrl: './dispositivos.component.html',
  styleUrls: ['./dispositivos.component.scss']
})
export class DispositivosComponent implements OnInit {
  @ViewChild(RegisterDispositivosModalComponent) registerDispositivosModal!: RegisterDispositivosModalComponent;
  @ViewChild(EditDispositivosModalComponent) editDispositivosModal!: EditDispositivosModalComponent; // Modal de edición

  dispositivos: Dispositivo[] = [];
  filteredDispositivos: Dispositivo[] = [];
  filterBy: string = 'todos';
  filterValue: string = '';
  filterOptions: string[] = [];

  // Variables de paginación
  dispositivosPerPage = 10; // Cantidad de productos por página
  currentPage = 1; // Página actual
  showAll = true; // Controla si se muestran todos los productos o se paginan

  constructor(private apiService: ApiService, private toast: NgToastService) { }

  ngOnInit(): void {
    this.loadDispositivos(); // Cargar dispositivos desde la API
  }

  // Cargar dispositivos desde la API
  loadDispositivos(): void {
    this.apiService.getDispositivos().subscribe({
      next: (response: any) => {
        this.dispositivos = Array.isArray(response.data) ? response.data : [];
        this.filteredDispositivos = [...this.dispositivos];
        this.applyFilters(); // Aplicar filtros después de cargar los datos
      },
      error: (error) => {
        console.error('Error al cargar dispositivos:', error);
        this.dispositivos = []; // Inicializar como arreglo vacío en caso de error
      }
    });
  }

  // Obtener dispositivos para la página actual
  get displayedDispositivos(): Dispositivo[] {
    if (this.showAll) {
      return this.filteredDispositivos;
    }
    const startIndex = (this.currentPage - 1) * this.dispositivosPerPage;
    return this.filteredDispositivos.slice(startIndex, startIndex + this.dispositivosPerPage);
  }

  // Calcular total de páginas
  get totalPages(): number {
    return Math.ceil(this.filteredDispositivos.length / this.dispositivosPerPage);
  }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
    this.currentPage = 1; // Reiniciar a la primera página
  }

  setPage(page: number): void {
    this.currentPage = page;
  }

  onFilterByChange(): void {
    this.filterValue = '';
    if (this.filterBy === 'tipo') {
      this.filterOptions = [...new Set(this.dispositivos.map(p => p.tipoDis))];
    } else if (this.filterBy === 'marca') {
      this.filterOptions = [...new Set(this.dispositivos.map(p => p.marca))];
    } else {
      this.filterOptions = [];
    }
    this.applyFilters();
  }

  applyFilters(): void {
    if (!Array.isArray(this.dispositivos)) {
      console.error('dispositivos no es un arreglo:', this.dispositivos);
      return;
    }

    this.filteredDispositivos = this.dispositivos.filter(dispositivo => {
      if (this.filterBy === 'tipo' && this.filterValue) {
        return dispositivo.tipoDis === this.filterValue;
      } else if (this.filterBy === 'marca' && this.filterValue) {
        return dispositivo.marca === this.filterValue;
      }
      return true;
    });
    this.currentPage = 1; // Reiniciar a la primera página después de filtrar
  }

  editarDispositivo(dispositivo: Dispositivo): void {
    this.editDispositivosModal.open(dispositivo); // Abrir el modal de edición con los datos del dispositivo
  }

  actualizarDispositivo(dispositivoActualizado: any): void {
    this.apiService.updateDispositivo(dispositivoActualizado.idDis, dispositivoActualizado).subscribe({
      next: () => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Dispositivo actualizado con éxito.',
          duration: 5000,
        });
        this.loadDispositivos(); // Recarga la lista de dispositivos
      },
      error: (error) => {
        console.error('Error al actualizar el dispositivo:', error);
        this.toast.error({
          detail: 'Error',
          summary: 'Error al actualizar el dispositivo.',
          duration: 5000,
        });
      }
    });
  }


  eliminarDispositivo(dispositivo: Dispositivo): void {
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
        this.apiService.deleteDispositivo(dispositivo.idDis).subscribe({
          next: () => {
            this.toast.success({
              detail: 'Éxito',
              summary: 'Dispositivo eliminado con éxito.',
              duration: 5000,
            });
            this.loadDispositivos();
          },
          error: (error) => {
            this.toast.error({
              detail: 'Error',
              summary: 'Error al eliminar el dispositivo.',
              duration: 5000,
            });

          }
        });
      }
    });

  }

  openModal(): void {
    this.registerDispositivosModal.open();
  }

  addNewDispositivo(newDispositivo: any): void {
    console.log("Nuevo dispositivo recibido en el componente principal:", newDispositivo); // Depuración
    this.apiService.createDispositivo(newDispositivo).subscribe({
      next: () => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Dispositivo registrado con éxito.',
          duration: 5000,
        });
        this.loadDispositivos();
      },
      error: (error) => {
        console.error("Error al registrar el dispositivo:", error); // Depuración
        this.toast.error({
          detail: 'Error',
          summary: 'Error al registrar el dispositivo.',
          duration: 5000,
        });
      }
    });
  }

}
