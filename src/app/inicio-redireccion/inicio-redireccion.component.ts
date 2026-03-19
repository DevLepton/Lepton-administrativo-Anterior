import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-inicio-redireccion',
  template: ''
})
export class InicioRedireccionComponent implements OnInit {

  constructor(private router: Router, private authService: AuthService) { }

  ngOnInit(): void {
    const role = this.authService.getUserRole();

    if (role === 'admin') {
      this.router.navigate(['/usuarios']);
    } else if (role === 'soporte') {
      this.router.navigate(['/peticiones']);
    } else if (role === 'inventario') {
      this.router.navigate(['/peticiones']);
    } else if (role === 'finanzas') {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}
