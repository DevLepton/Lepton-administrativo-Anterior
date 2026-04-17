import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authenticated = new BehaviorSubject<boolean>(this.checkAuthentication()); // Estado inicial
  isAuthenticated$ = this.authenticated.asObservable();

  constructor(private http: HttpClient) { }

  private checkAuthentication(): boolean {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('isAuthenticated') === 'true';
    }
    return false;
  }

  login(credentials: { userName: string; password: string } | { email: string; password: string }): Observable<any> {
    // Envía una solicitud POST al backend con las credenciales
    return this.http.post(`${apiUrl}/users/login`, credentials);
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
      localStorage.removeItem('user'); 
    }
    this.authenticated.next(false);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  getUserRole(): string | null {
    return localStorage.getItem('user_role');
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