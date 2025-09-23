import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:3003'; // 

  constructor(private http: HttpClient) { }


  getColoniasByCodigoPostalFromGoogle(codigoPostal: string): Observable<any> {
    const apiKey = 'AIzaSyBxD3oEeLRpU9kcilSl2dl1aNzbEe9afyg';
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${codigoPostal},Mexico&key=${apiKey}`;
    return this.http.get(url);
  }

  // Planes
  getPlanes(): Observable<any> {
    return this.http.get(`${this.baseUrl}/planes`);
  }

  getPlanById(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/planes/${id}`);
  }

  createPlan(plan: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/planes`, plan);
  }

  updatePlan(id: number, plan: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/planes/${id}`, plan);
  }

  deletePlan(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/planes/${id}`);
  }



  // Clientes
  getClientes(): Observable<any> {
    return this.http.get(`${this.baseUrl}/clientes`);
  }

  getClienteById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/clientes/${id}`);
  }

  // Verificar si el correo ya está registrado
  checkEmailExists(email: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/clientes/check-email`, {
      params: { email }, // Enviar como parámetro
    });
  }
  
  
  createCliente(cliente: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/clientes`, cliente);
  }

  updateCliente(id: number, cliente: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/clientes/${id}`, cliente);
  }

  deleteCliente(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/clientes/${id}`);
  }


  //Dispositivos
  getDispositivos(): Observable<any> {
    return this.http.get(`${this.baseUrl}/dispositivos`);
  }

  createDispositivo(dispositivo: any): Observable<any> {
    console.log("Datos enviados al API:", dispositivo); // Depuración
    return this.http.post(`${this.baseUrl}/dispositivos`, dispositivo);
  }


  updateDispositivo(id: number, dispositivo: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/dispositivos/${id}`, dispositivo);
  }


  deleteDispositivo(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/dispositivos/${id}`);
  }


  // Obtener todos los servicios
  getServicios(): Observable<any> {
    return this.http.get(`${this.baseUrl}/servicios`);
  }

  // Obtener un servicio por ID
  getServicioById(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/servicios/${id}`);
  }

  // Crear un nuevo servicio
  createServicio(servicio: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/servicios`, servicio);
  }

  // Actualizar un servicio por ID
  updateServicio(id: number, servicio: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/servicios/${id}`, servicio);
  }

  // Eliminar un servicio por ID
  deleteServicio(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/servicios/${id}`);
  }



  // método para registrar un usuario
  registerUser(user: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, user);
  }

  //  método para obtener usuarios
  getUsers(): Observable<any> {
    return this.http.get(`${this.baseUrl}/users`);
  }

  updateUser(id: number, user: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/${id}`, user);
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/users/${id}`);
  }

  // ---- SIMs (Device con type='sim') ----
  /** Lista SIMs (desde backend) */
  getSims(): Observable<any> {
    // tu backend debe aceptar ?type=sim en /dispositivos
    return this.http.get(`${this.baseUrl}/devices`, {
      params: { type: 'sim' }
    });
  }

  /** Crea un SIM en la colección devices */
  createSim(payload: { iccid: string; model: string; company: string }): Observable<any> {
    // el backend espera { type: 'sim', iccid, model, company }
    const body = { type: 'sim', ...payload };
    return this.http.post(`${this.baseUrl}/devices`, body);
  }

  /** Actualiza campos del SIM (no cambiar type) */
  updateSim(id: string, payload: Partial<{ iccid: string; model: string; company: string }>): Observable<any> {
    return this.http.put(`${this.baseUrl}/devices/${id}`, payload);
  }

  /** Elimina un SIM por id */
  deleteSim(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/devices/${id}`);
  }

}
