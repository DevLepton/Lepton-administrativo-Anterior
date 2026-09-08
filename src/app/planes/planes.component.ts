import { Component, ViewChild, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';
import Swal from 'sweetalert2';
import { NgToastService } from 'ng-angular-popup';
import { RegisterPlanModalComponent } from './actions/register-plan-modal/register-plan-modal.component';
import { EditPlanModalComponent } from './actions/edit-plan-modal/edit-plan-modal.component';

interface Plan {
  idPlan: number;
  noIdentificacion: string;
  nombrePlan: string;
  precio: number;
  precioConIVA: number;
  duracion: string;
  codigoSAT: string;
  claveUnidad: string;
  color: string;
  servicios: number;
}

@Component({
  selector: 'app-planes',
  templateUrl: './planes.component.html',
  styleUrls: ['./planes.component.scss'],
})
export class PlanesComponent implements OnInit {
  @ViewChild(RegisterPlanModalComponent) registerPlanModal!: RegisterPlanModalComponent;
  @ViewChild(EditPlanModalComponent) editPlanModal!: EditPlanModalComponent;


  planes: Plan[] = [];
  showAll = true;
  currentPage = 1;
  plansPerPage = 25;

  constructor(private apiService: ApiService, private toast: NgToastService) { }

  ngOnInit(): void {
    this.loadPlanes();
  }

  // Cargar planes desde la API
  loadPlanes(): void {
    this.apiService.getPlanes().subscribe({
      next: (response: any) => {
        this.planes = Array.isArray(response.data) ? response.data : [];
      },
      error: (error) => {
        console.error('Error al cargar planes:', error);
      }
    });
  }

  // Obtener los planes para la página actual
  get displayedPlanes(): Plan[] {
    if (this.showAll) {
      return this.planes;
    }
    const startIndex = (this.currentPage - 1) * this.plansPerPage;
    return this.planes.slice(startIndex, startIndex + this.plansPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.planes.length / this.plansPerPage);
  }

  setPage(page: number): void {
    this.currentPage = page;
  }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
    this.currentPage = 1;
  }

  // Abrir el modal de registro
  openModal(): void {
    this.registerPlanModal.open();
  }

  editarPlan(plan: Plan): void {
    this.editPlanModal.open(plan);
  }

  updatePlan(planActualizado: Plan): void {
    this.apiService.updatePlan(planActualizado.idPlan, planActualizado).subscribe({
      next: () => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Plan actualizado con éxito.',
          duration: 5000,
        });
        this.loadPlanes(); // Recargar la lista de planes
      },
      error: (error) => {
        console.error('Error al actualizar el plan:', error);
        this.toast.error({
          detail: 'Error',
          summary: 'Error al actualizar el plan.',
          duration: 5000,
        });
      }
    });
  }

  // Añadir un nuevo plan
  addNewPlan(newPlan: Plan): void {
    this.apiService.createPlan(newPlan).subscribe({
      next: (response) => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Plan registrado con éxito.',
          duration: 5000,
        });
        this.loadPlanes();
      },
      error: (error) => {
        console.error('Error al registrar el plan:', error);
        this.toast.error({
          detail: 'Error',
          summary: 'Error al registrar el plan.',
          duration: 5000,
        });
      }
    });
  }

  // Eliminar un plan
  deletePlan(plan: Plan): void {
    Swal.fire({
      title: '¿Estás seguro de eliminar?',
      text: 'No podrás revertir esta acción.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.apiService.deletePlan(plan.idPlan).subscribe({
          next: () => {
            this.toast.success({
              detail: 'Éxito',
              summary: 'Plan eliminado con éxito.',
              duration: 5000,
            });
            this.loadPlanes();
          },
          error: (error) => {
            console.error('Error al eliminar el plan:', error);
            this.toast.error({
              detail: 'Error',
              summary: 'Error al eliminar el plan.',
              duration: 5000,
            });
          }
        });
      }
    });
  }
}
