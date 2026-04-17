import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { AbstractControl, AbstractControlOptions, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ConfirmModalService } from '../../services/confirm-modal/confirm-modal-service';
import { Router } from '@angular/router';

import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { NgToastService } from 'ng-angular-popup';

export class PasswordMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const invalidCtrl = !!(control && control.invalid && control.touched);
    const invalidParent = !!(
      control &&
      control.parent &&
      control.parent.hasError('passwordMismatch') &&
      control.touched
    );

    return invalidCtrl || invalidParent;
  }
}

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss'
})
export class UserProfileComponent implements OnInit {

  @Output() close = new EventEmitter<void>();

  user: any;

  editMode = false;

  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  showPasswordForm = false;

  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;

  matcher = new PasswordMatcher();

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private fb: FormBuilder,
    private confirmModal: ConfirmModalService,
    private router: Router,
    private toast: NgToastService
  ) { }

  ngOnInit(): void {
    this.user = this.authService.getUser();

    this.profileForm = this.fb.group({
      userName: [this.user?.userName, Validators.required],
      email: [this.user?.email, [Validators.required, Validators.email]]
    });

    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required]
      },
      {
        validators: this.passwordMatchValidator
      } as AbstractControlOptions
    );

  }

  // ACTIVAR EDICIÓN
  toggleEdit() {
    this.editMode = !this.editMode;

    if (this.editMode) {
      this.profileForm.patchValue({
        userName: this.user?.userName,
        email: this.user?.email
      });
    } else {
      this.profileForm.reset({
        userName: this.user?.userName,
        email: this.user?.email
      });
    }
  }

  togglePasswordForm() {
    this.showPasswordForm = !this.showPasswordForm;

    if (!this.showPasswordForm) {
      this.passwordForm.reset();
      this.passwordForm.markAsPristine();
      this.passwordForm.markAsUntouched();
      this.passwordForm.setErrors(null);


      this.passwordForm.updateValueAndValidity();

      // Reset visual flags
      this.hideCurrentPassword = true;
      this.hideNewPassword = true;
      this.hideConfirmPassword = true;
    }
  }

  // GUARDAR PERFIL
  saveProfile() {
    if (this.profileForm.invalid) return;

    const updatedData = this.profileForm.value;
    const userId = this.user._id;

    this.apiService.updateUser(userId, updatedData).subscribe({
      next: (res: any) => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Usuario actualizado correctamente.',
          duration: 3000,
        });

        this.user = res.user;
        this.authService.setUser(this.user);
        this.editMode = false;
      },
      error: (err) => {
        this.toast.error({
          detail: 'Error',
          summary: 'Error al actualizar usuario. Intenta de nuevo.',
          duration: 3500,
        });
      }
    });

  }

  // CAMBIAR CONTRASEÑA
  changePassword() {
    if (this.passwordForm.invalid) return;

    const userId = this.user._id;

    const payload = {
      currentPassword: this.passwordForm.value.currentPassword,
      password: this.passwordForm.value.newPassword
    };

    this.apiService.updateUser(userId, payload).subscribe({
      next: () => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Contraseña actualizada correctamente.',
          duration: 3000,
        });

        this.passwordForm.reset();
        this.passwordForm.markAsPristine();
        this.passwordForm.markAsUntouched();
        this.showPasswordForm = false;
      },
      error: (err) => {
        this.toast.error({
          detail: 'Error',
          summary: 'Error al actualizar la contraseña. Intenta de nuevo.',
          duration: 3500,
        });
      }
    });
  }

  async closeProfile() {

    // Si no hay cambios, cerrar directo
    if (!this.editMode && !this.showPasswordForm) {
      this.router.navigate(['/'], { replaceUrl: true });
      return;
    }

    const confirmed = await this.confirmModal.open({
      title: '¿Salir sin guardar?',
      message: 'Tienes cambios sin guardar. Se perderán si sales.',
      confirmText: 'Aceptar',
      cancelText: 'Cancelar'
    });

    if (confirmed) {
      this.router.navigate(['/'], { replaceUrl: true });
    }
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('newPassword')?.value;
    const confirm = control.get('confirmPassword')?.value;

    if (!password || !confirm) return null;

    return password === confirm ? null : { passwordMismatch: true };
  }

  hasProfileChanges(): boolean {
    const formValue = this.profileForm.value;

    return (
      formValue.userName !== this.user?.userName ||
      formValue.email !== this.user?.email
    );
  }
}