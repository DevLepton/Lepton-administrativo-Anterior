import { Component, OnInit } from '@angular/core';

import { ViewChild } from '@angular/core';
import { EditUserModalComponent } from '../../modals/edit-user-modal/edit-user-modal.component';
import { RegisterUserModalComponent } from '../../modals/register-user-modal/register-user-modal.component';
import { ApiService } from '../../services/api.service';
import { ConfirmDeleteUserModalComponent } from '../../modals/confirm-delete-user-modal/confirm-delete-user-modal.component';
import { NgToastService } from 'ng-angular-popup';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {
  @ViewChild(EditUserModalComponent) editUserModal!: EditUserModalComponent;
  @ViewChild(RegisterUserModalComponent) registerUserModal!: RegisterUserModalComponent;
  @ViewChild(ConfirmDeleteUserModalComponent) confirmDeleteUserModal!: ConfirmDeleteUserModalComponent;

  openRegisterModal(): void {
    this.registerUserModal.open();
  }

  users: any[] = [];
  displayedUsers: any[] = [];

  currentPage = 1;
  pageSize = 6;
  totalPages = 1;
  showAll = false;

  constructor(private apiService: ApiService, private toast: NgToastService) { }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.apiService.getUsers().subscribe({
      next: (response) => {
        this.users = response.data;
        this.totalPages = Math.ceil(this.users.length / this.pageSize);
        this.updateDisplayedUsers();
      },
      error: (error) => {
        console.error('Error al cargar usuarios:', error);
      }
    });
  }
  
  updateDisplayedUsers(): void {
    if (this.showAll) {
      this.displayedUsers = this.users;
    } else {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      this.displayedUsers = this.users.slice(start, end);
    }
  }
  
  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updateDisplayedUsers();
  }
  
  toggleShowAll(): void {
    this.showAll = !this.showAll;
    this.updateDisplayedUsers();
  }

  editUser(user: any): void {
    this.editUserModal.open(user);
  }

  onUserUpdated(): void {
    this.loadUsers();
  }

  deleteUser(user: any): void {
    this.confirmDeleteUserModal.open(user.userName, () => {
      this.apiService.deleteUser(user._id).subscribe({
        next: () => {
          this.toast.success({
            detail: 'Éxito',
            summary: 'Usuario eliminado correctamente.',
            duration: 3000,
          });
          this.loadUsers();
        },
        error: (err) => {
          this.toast.error({
            detail: 'Error',
            summary: 'Error al eliminar el usuario. Intenta de nuevo',
            duration: 3500,
          });
          console.error('Error al eliminar usuario:', err);
        }
      });
    });
  }

}
