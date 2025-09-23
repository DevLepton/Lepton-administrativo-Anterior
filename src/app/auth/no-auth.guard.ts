import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class NoAuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) { }

  canActivate(): boolean {
    if (this.authService.isLoggedIn()) {
      const role = this.authService.getUserRole();

      if (role === 'admin') {
        this.router.navigate(['/usuarios']);
      } else if (role === 'inventario') {
        this.router.navigate(['/almacen']);
      } else if (role === 'finanzas') {
        this.router.navigate(['/dashboard']);
      } else {
        this.router.navigate(['/login']);
      }

      return false;
    }

    return true; // Permite entrar si NO está logueado
  }
}
