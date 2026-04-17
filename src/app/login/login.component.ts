import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service'; // Importa tu servicio de autenticación
import { Router } from '@angular/router';
import { NgToastService } from 'ng-angular-popup';
import { ErrorStateMatcher } from '@angular/material/core';


export class LoginErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(
      control &&
      (control.invalid || form?.hasError('invalidLogin')) &&
      (control.touched || form?.touched)
    );
  }
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  isVisible = true; // Controla la visibilidad del modal
  loginForm!: FormGroup; // Formulario reactivo
  hidePassword: boolean = true; // Control de visibilidad de la contraseña
  showForgotModal: boolean = false;

  isLoading = false;

  matcher = new LoginErrorStateMatcher();

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

    this.loginForm.valueChanges.subscribe(() => {
      if (this.loginForm.hasError('invalidLogin')) {
        this.loginForm.setErrors(null);

        this.loginForm.markAsPristine();
        this.loginForm.markAsUntouched();
      }
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

  isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /**
   * Enviar los datos del formulario al servicio de autenticación.
   */
  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;

      const input = this.loginForm.value.username;

      const credentials = {
        ...(this.isEmail(input)
          ? { email: input }
          : { userName: input }),
        password: this.loginForm.value.password,
      };

      // Llamada al servicio de autenticación
      this.authService.login(credentials).subscribe({
        next: (response) => {
          // console.log('Inicio de sesión exitoso:', response);

          const userRole = response.user.role;

          localStorage.setItem('token', response.token);
          localStorage.setItem('user_role', userRole);
          localStorage.setItem('user', JSON.stringify(response.user));

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
            this.router.navigate(['/clientes']);
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
          this.isLoading = false;

          // Marcar los campos como erróneos
          this.loginForm.setErrors({ invalidLogin: true });

          this.loginForm.markAllAsTouched();

          // console.error('Error al iniciar sesión:', error);
          this.toast.error({
            detail: 'Error',
            summary: 'Usuario o contraseña incorrectos',
            duration: 5000,
          });

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
    this.showForgotModal = true;
  }
}
