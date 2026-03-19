import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service'; // Importa tu servicio de autenticación
import { Router } from '@angular/router';
import { NgToastService } from 'ng-angular-popup';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  isVisible = true; // Controla la visibilidad del modal
  loginForm!: FormGroup; // Formulario reactivo
  hidePassword: boolean = true; // Control de visibilidad de la contraseña

  @Output() loginSuccess = new EventEmitter<void>(); // Evento para emitir al realizar login con éxito

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toast: NgToastService
  ) { }

  ngOnInit(): void {
    // Inicializa el formulario
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]], // Campo de usuario obligatorio
      password: ['', [Validators.required, Validators.minLength(6)]], // Contraseña obligatoria con mínimo 6 caracteres
    });
  }

  /**
   * Función para alternar la visibilidad de la contraseña.
   */
  togglePassword(): void {
    this.hidePassword = !this.hidePassword;
  }

  /**
   * Función para cerrar el modal de login.
   */
  close(): void {
    this.isVisible = false;
    this.resetForm();
  }

  /**
   * Función para resetear el formulario.
   */
  resetForm(): void {
    this.loginForm.reset({
      username: '',
      password: '',
    });
  }

  /**
   * Enviar los datos del formulario al servicio de autenticación.
   */
  onSubmit(): void {
    if (this.loginForm.valid) {
      const credentials = {
        userName: this.loginForm.value.username,
        password: this.loginForm.value.password,
      };

      // Llamada al servicio de autenticación
      this.authService.login(credentials).subscribe({
        next: (response) => {
          // console.log('Inicio de sesión exitoso:', response);

          const userRole = response.user.role;

          localStorage.setItem('token', response.token);
          localStorage.setItem('user_role', userRole);

          this.authService.setAuthenticationState(true);

          this.toast.success({
            detail: 'Éxito',
            summary: 'Inicio de sesión exitoso',
            duration: 3000,
          });

          this.loginSuccess.emit();
          if (userRole === 'admin') {
            this.router.navigate(['/usuarios']);
          } else if (userRole === 'soporte') {
            this.router.navigate(['/peticiones']);
          } else if (userRole === 'inventario') {
            this.router.navigate(['/peticiones']);
          } else if (userRole === 'finanzas') {
            this.router.navigate(['/dashboard']);
          } else {
            // Rol desconocido, cerrar sesión o redirigir a login
            this.toast.error({
              detail: 'Error',
              summary: 'Rol no autorizado',
              duration: 5000,
            });
            localStorage.clear();
            this.router.navigate(['/login']);
          }
        },
        error: (error) => {
          console.error('Error al iniciar sesión:', error);
          this.toast.error({
            detail: 'Error',
            summary: 'Usuario o contraseña incorrectos',
            duration: 5000,
          });
          // Marcar los campos como erróneos
          this.loginForm.controls['username'].setErrors({ invalid: true });
          this.loginForm.controls['password'].setErrors({ invalid: true });
        }
      });
    } else {
      this.loginForm.markAllAsTouched(); // Marcar todos los campos como tocados
    }
  }

  /**
   * Función para redirigir al registro.
   */
  onRegister(): void {
    console.log('Redirigiendo al registro...');
    // Lógica de navegación o visualización de modal de registro
  }
}
