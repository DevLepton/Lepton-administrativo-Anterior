// token.interceptor.ts
import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse, HttpClient
} from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  private router = inject(Router);
  private http = inject(HttpClient);

  // private apiBase = 'http://localhost:3003';
  private apiBase = 'https://leptoncore-api.lepton-seguridad.com';

  // control de refresh
  private refreshing = false;
  private refreshSubject = new BehaviorSubject<string | null>(null);

  private get tokenKey() { return 'token'; } // <-- usa el MISMO nombre que guardas en login
  private getToken(): string | null { return localStorage.getItem(this.tokenKey); }
  private setToken(t: string) { localStorage.setItem(this.tokenKey, t); }
  private clearToken() { localStorage.removeItem(this.tokenKey); }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isApiCall = req.url.startsWith(this.apiBase);

    // No adjuntes Authorization a servicios externos (Maps, etc.)
    let authReq = req;
    if (isApiCall) {
      const token = this.getToken();
      authReq = req.clone({
        setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        withCredentials: true // importante para que viaje la cookie refresh_token
      });
    }

    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        if (!isApiCall) {
          // Si no es tu API, no intentes refrescar
          return throwError(() => err);
        }

        const code = (err.error && err.error.code) || '';
        const status = err.status;

        // Access expirado → intenta refresh
        if (status === 401 && code === 'TOKEN_EXPIRED') {
          return this.handleRefresh(authReq, next);
        }

        // Sin token / inválido / no autorizado → limpia y al login
        if (status === 401 || status === 403) {
          this.clearToken();
          // opcional: muestra toast aquí
          this.router.navigate(['/login']);
        }

        return throwError(() => err);
      })
    );
  }

  private handleRefresh(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.refreshing) {
      this.refreshing = true;
      this.refreshSubject.next(null);

      return this.http.post<{ token: string }>(`${this.apiBase}/auth/refresh`, {}, { withCredentials: true })
        .pipe(
          switchMap(res => {
            const newAccess = res?.token;
            if (!newAccess) {
              throw new Error('No token in refresh response');
            }
            this.setToken(newAccess);
            this.refreshing = false;
            this.refreshSubject.next(newAccess);

            // Reintenta la petición original con el nuevo token
            const retried = req.clone({ setHeaders: { Authorization: `Bearer ${newAccess}` } });
            return next.handle(retried);
          }),
          catchError(err => {
            this.refreshing = false;
            this.refreshSubject.next(null);
            this.clearToken();
            this.router.navigate(['/login']);
            return throwError(() => err);
          })
        );
    } else {
      // Ya hay un refresh en curso → espera y reintenta al terminar
      return this.refreshSubject.pipe(
        filter(t => t !== null),
        take(1),
        switchMap(t => {
          const retried = req.clone({ setHeaders: { Authorization: `Bearer ${t as string}` } });
          return next.handle(retried);
        })
      );
    }
  }
}
