import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { NavigationEnd, Router } from '@angular/router';
import { NgToastService } from 'ng-angular-popup';

interface SideNavToggle {
  screenWidth: number;
  collapsed: boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'sistema-administrativo-Lepton';

  isSideNavCollapsed = false;
  screenWidth = 0;
  isAuthenticated = false; // Estado de autenticación, inicialmente false
  isLoginRoute = false;
  isRoleLoaded = false;

  constructor(private authService: AuthService, private router: Router, private toast: NgToastService) { }

  ngOnInit(): void {
    // ✅ Verificar si hay token guardado
    const token = localStorage.getItem('token');
    if (token) {
      this.authService.setAuthenticationState(true);
      // this.authService.loadUserRole();
    }

    // Suscribirse al estado de autenticación
    this.authService.isAuthenticated$.subscribe((isAuth) => {
      this.isAuthenticated = isAuth;
    });

    // Verificar la ruta actual
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        // this.isAuthenticated = this.authService.isLoggedIn();
        this.isLoginRoute = this.router.url.includes('/login');
      }
    });

    this.authService.roleLoaded$.subscribe(loaded => {
      this.isRoleLoaded = loaded;
    });
  }

  onToggLeSidenav(data: SideNavToggle): void {
    this.screenWidth = data.screenWidth;
    this.isSideNavCollapsed = data.collapsed;
  }
}
