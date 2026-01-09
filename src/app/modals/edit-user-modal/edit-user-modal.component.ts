import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { NgToastService } from 'ng-angular-popup';

@Component({
  selector: 'app-edit-user-modal',
  templateUrl: './edit-user-modal.component.html',
  styleUrls: ['./edit-user-modal.component.scss']
})
export class EditUserModalComponent {
  private lockBodyScroll() {
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll() {
    document.body.style.overflow = '';
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
  }

  @Input() user: any;
  @Output() userUpdated = new EventEmitter<any>();

  showModal = false;
  form!: FormGroup;
  loading = false;
  hide = true;


  private originalData: any;

  constructor(
    private apiService: ApiService,
    private fb: FormBuilder,
    private toast: NgToastService
  ) {
    this.form = this.fb.group({
      userName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['', Validators.required],
      password: ['']
    });
  }

  open(user: any) {
    this.user = { ...user }; // Guarda el objeto completo con _id

    this.originalData = {
      userName: user.userName,
      email: user.email,
      role: user.role,
      password: ''
    };

    this.form.patchValue(this.originalData);
    this.showModal = true;
    this.lockBodyScroll();
  }


  hasChanges(): boolean {
    return JSON.stringify(this.form.value) !== JSON.stringify(this.originalData);
  }


  close() {
    this.showModal = false;
    this.unlockBodyScroll();
    this.form.reset();
    this.loading = false;
  }

  onBackdropClick(event: MouseEvent): void {
    this.close();
  }

  submit() {
    if (this.form.invalid || this.loading || !this.user) return;

    const formValue = this.form.value;

    // Elimina la contraseña si no se modificó (queda vacía)
    if (!formValue.password) {
      delete formValue.password;
    }

    this.loading = true;

    this.apiService.updateUser(this.user._id, formValue).subscribe({
      next: (updated) => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Usuario actualizado correctamente.',
          duration: 3000,
        });
        this.userUpdated.emit(updated);
        this.close();
      },
      error: (err) => {
        console.error(err);
        this.toast.error({
          detail: 'Error',
          summary: 'Error al actualizar usuario. Intenta de nuevo.',
          duration: 3500,
        });
        this.loading = false;
      }
    });
  }

}
