import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApiService, apiUrl } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private userRole = new BehaviorSubject<string | null>(null);
  userRole$ = this.userRole.asObservable();

  private authenticated = new BehaviorSubject<boolean>(false); // Estado inicial
  isAuthenticated$ = this.authenticated.asObservable();

  constructor(private http: HttpClient, private apiService: ApiService) { }

  login(credentials: { userName: string; password: string } | { email: string; password: string }): Observable<any> {
    // Envía una solicitud POST al backend con las credenciales
    return this.http.post(`${apiUrl}/users/login`, credentials);
  }

  setAuthenticationState(isAuthenticated: boolean): void {
    this.authenticated.next(isAuthenticated);
  }

  logout(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    this.authenticated.next(false);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  setUserRole(role: string) {
    this.userRole.next(role);
  }

  private roleLoaded = new BehaviorSubject<boolean>(false);
  roleLoaded$ = this.roleLoaded.asObservable();

  loadUserRole(): Promise<void> {
    return new Promise((resolve) => {
      this.apiService.getProfile().subscribe({
        next: (res: any) => {
          const role = res?.user?.role?.toLowerCase() || null;

          this.userRole.next(role);
          this.roleLoaded.next(true);
          resolve();
        },
        error: () => {
          this.userRole.next(null);
          this.roleLoaded.next(true);
          this.logout();
          resolve();
        }
      });
    });
  }

  getUserRole(): string | null {
    return this.userRole ? this.userRole.value : null;
  }

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  setUser(user: any) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  clearUser() {
    localStorage.removeItem('user');
  }

}