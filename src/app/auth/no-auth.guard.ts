import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class NoAuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) { }

  canActivate(): boolean {
    if (!this.authService.isLoggedIn()) {
      return true;
    }

    const role = this.authService.getUserRole();

    // 🔥 CLAVE: si aún no hay rol, NO navegues
    if (!role) {
      return false;
    }

    switch (role) {
      case 'admin':
        this.router.navigate(['/usuarios']);
        break;

      case 'soporte':
      case 'inventario':
        this.router.navigate(['/peticiones']);
        break;

      case 'finanzas':
      case 'cx':
        this.router.navigate(['/clientes']);
        break;

      default:
        this.authService.logout();
        this.router.navigate(['/login']);
    }

    return false; // Permite entrar si NO está logueado
  }
}
