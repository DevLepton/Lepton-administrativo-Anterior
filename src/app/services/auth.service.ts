import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authenticated = new BehaviorSubject<boolean>(this.checkAuthentication()); // Estado inicial
  isAuthenticated$ = this.authenticated.asObservable();

  // private apiUrl = 'http://localhost:3003/users'; // URL de la API para autenticación
  private apiUrl = 'https://leptoncore-api.lepton-seguridad.com/users'; // URL de la API para autenticación

  constructor(private http: HttpClient) { }

  private checkAuthentication(): boolean {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('isAuthenticated') === 'true';
    }
    return false;
  }

  login(credentials: { userName: string; password: string }): Observable<any> {
    // Envía una solicitud POST al backend con las credenciales
    return this.http.post(`${this.apiUrl}/login`, credentials);
  }

  setAuthenticationState(isAuthenticated: boolean): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('isAuthenticated', isAuthenticated.toString());
    }
    this.authenticated.next(isAuthenticated);
  }

  logout(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('isAuthenticated', 'false');
      localStorage.removeItem('token');
    }
    this.authenticated.next(false);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  getUserRole(): string | null {
    return localStorage.getItem('user_role');
  }


}