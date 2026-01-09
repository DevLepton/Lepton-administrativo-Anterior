import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

/* ====================== Tipos comunes ====================== */
export type EventOperation = 'Creación' | 'Actualización' | 'Eliminación';

export interface EventUserSnapshot {
  _id?: string;
  email?: string;
  userName?: string;
  role?: string;
}

export interface EventRequestMeta {
  method?: string;
  path?: string;
  ip?: string;
}

export interface EventItem {
  _id: string;
  identifier: string;
  collectionName: string;
  operation: EventOperation;
  finalValues: any;
  user?: EventUserSnapshot;
  request?: EventRequestMeta;
  createdAt: string; // ISO
}

export interface EventsQuery {
  identifier?: string;
  collectionName?: string;
  operation?: EventOperation;
  userId?: string;
  q?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  page?: number;
  limit?: number;
  sort?: string;           // default: 'createdAt'
  order?: 'asc' | 'desc';  // default: 'desc'
}

export interface EventsListResponse {
  message: string;
  data: EventItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/* ====================== Tipos Devices ====================== */
export type DeviceStatus = 'En inventario' | 'En configuración' | 'Instalado';

// 👇 añade este tipo arriba (junto a los demás)
export type UpdateSimPayload = Partial<{
  iccid: string;
  model: string;
  company: string;
  status: DeviceStatus;
  purchaseDate: string | Date;
  entryDate: string | Date;
  installationDate: string | Date | null;
  client: string | null;
  comments: string | null;
}>;

/** Payload para crear/actualizar GPS */
export interface CreateGpsPayload {
  type: 'gps';
  imei: string;
  sn: string;
  name: string;
  brand: string;
  model: string;
  status: DeviceStatus;
  purchaseDate: string | Date;
  entryDate: string | Date;
  installationDate?: string | Date | null;
  client?: string | null;
  comments?: string | null;
}
export type UpdateGpsPayload = Partial<Omit<CreateGpsPayload, 'type'>>;

/** Payload para crear Accesorio */
export interface CreateAccessoryPayload {
  type: 'accessory';
  id: string;              // 👈 campo "id" del accesorio (schema)
  sn: string;
  name: string;
  brand: string;
  model: string;
  status: DeviceStatus;
  purchaseDate: string | Date;
  entryDate: string | Date;
  installationDate?: string | Date | null;
  client?: string | null;
  comments?: string | null;
}
export type UpdateAccessoryPayload = Partial<Omit<CreateAccessoryPayload, 'type'>>;

/** Query de listado GPS (coincide con filtros del UI) */
export interface GpsQuery {
  // filtros de tu UI
  brand?: string;
  model?: string;
  status?: DeviceStatus | '';
  q?: string;            // búsqueda por IMEI/SN
  from?: string;         // ISO (fecha compra/ingreso si tu backend lo soporta)
  to?: string;           // ISO
  page?: number;
  limit?: number;
  sort?: string;         // ej. 'createdAt' | 'purchaseDate' | ...
  order?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'http://localhost:3003';

  constructor(private http: HttpClient) { }

  /* ====================== Helpers ====================== */
  private buildHttpParams(query?: Record<string, any>): HttpParams {
    let params = new HttpParams();
    if (!query) return params;
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      params = params.set(k, String(v));
    });
    return params;
  }
  private toIsoDate(v: string | Date | null | undefined): string | undefined {
    if (v === null || v === undefined || v === '') return undefined;
    if (v instanceof Date) return v.toISOString();
    // asume 'YYYY-MM-DD' -> ISO a medianoche local
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  /* ====================== Google Geocode (tal cual) ====================== */
  getColoniasByCodigoPostalFromGoogle(codigoPostal: string): Observable<any> {
    const apiKey = 'AIzaSyBxD3oEeLRpU9kcilSl2dl1aNzbEe9afyg';
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${codigoPostal},Mexico&key=${apiKey}`;
    return this.http.get(url);
  }

  /* ====================== Planes / Clientes / Servicios / Users (sin cambios) ====================== */
  getPlanes(): Observable<any> { return this.http.get(`${this.baseUrl}/planes`); }
  getPlanById(id: number): Observable<any> { return this.http.get(`${this.baseUrl}/planes/${id}`); }
  createPlan(plan: any): Observable<any> { return this.http.post(`${this.baseUrl}/planes`, plan); }
  updatePlan(id: number, plan: any): Observable<any> { return this.http.put(`${this.baseUrl}/planes/${id}`, plan); }
  deletePlan(id: number): Observable<any> { return this.http.delete(`${this.baseUrl}/planes/${id}`); }

  getClientes(): Observable<any> { return this.http.get(`${this.baseUrl}/clientes`); }
  getClienteById(id: string): Observable<any> { return this.http.get(`${this.baseUrl}/clientes/${id}`); }
  checkEmailExists(email: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/clientes/check-email`, { params: { email } });
  }
  createCliente(cliente: any): Observable<any> { return this.http.post(`${this.baseUrl}/clientes`, cliente); }
  updateCliente(id: number, cliente: any): Observable<any> { return this.http.put(`${this.baseUrl}/clientes/${id}`, cliente); }
  deleteCliente(id: number): Observable<any> { return this.http.delete(`${this.baseUrl}/clientes/${id}`); }

  // (Legacy) Dispositivos - si aún los usas en otra vista
  getDispositivos(): Observable<any> { return this.http.get(`${this.baseUrl}/dispositivos`); }
  createDispositivo(dispositivo: any): Observable<any> { return this.http.post(`${this.baseUrl}/dispositivos`, dispositivo); }
  updateDispositivo(id: number, dispositivo: any): Observable<any> { return this.http.put(`${this.baseUrl}/dispositivos/${id}`, dispositivo); }
  deleteDispositivo(id: number): Observable<any> { return this.http.delete(`${this.baseUrl}/dispositivos/${id}`); }

  getServicios(): Observable<any> { return this.http.get(`${this.baseUrl}/servicios`); }
  getServicioById(id: number): Observable<any> { return this.http.get(`${this.baseUrl}/servicios/${id}`); }
  createServicio(servicio: any): Observable<any> { return this.http.post(`${this.baseUrl}/servicios`, servicio); }
  updateServicio(id: number, servicio: any): Observable<any> { return this.http.put(`${this.baseUrl}/servicios/${id}`, servicio); }
  deleteServicio(id: number): Observable<any> { return this.http.delete(`${this.baseUrl}/servicios/${id}`); }

  registerUser(user: any): Observable<any> { return this.http.post(`${this.baseUrl}/users`, user); }
  getUsers(): Observable<any> { return this.http.get(`${this.baseUrl}/users`); }
  updateUser(id: number, user: any): Observable<any> { return this.http.put(`${this.baseUrl}/users/${id}`, user); }
  deleteUser(id: number): Observable<any> { return this.http.delete(`${this.baseUrl}/users/${id}`); }

  /* ====================== SIMs (devices?type=sim) ====================== */
  getSims(): Observable<any> {
    return this.http.get(`${this.baseUrl}/devices`, { params: { type: 'sim' } });
  }
  createSim(payload: {
    iccid: string;
    model: string;
    company: string;
    status?: DeviceStatus;
    purchaseDate?: string | Date;
    entryDate?: string | Date;
    installationDate?: string | Date | null;
    client?: string | null;
    comments?: string | null;
  }): Observable<any> {
    const body = {
      type: 'sim',
      ...payload,
      purchaseDate: this.toIsoDate(payload.purchaseDate),
      entryDate: this.toIsoDate(payload.entryDate),
      installationDate: this.toIsoDate(payload.installationDate ?? null),
    };
    return this.http.post(`${this.baseUrl}/devices`, body);
  }
  updateSim(id: string, payload: UpdateSimPayload): Observable<any> {
    const body: any = { ...payload };

    if (body.purchaseDate !== undefined) {
      body.purchaseDate = this.toIsoDate(body.purchaseDate);
    }
    if (body.entryDate !== undefined) {
      body.entryDate = this.toIsoDate(body.entryDate);
    }
    if (body.installationDate !== undefined) {
      body.installationDate = this.toIsoDate(body.installationDate);
    }

    return this.http.put(`${this.baseUrl}/devices/${id}`, body);
  }

  deleteSim(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/devices/${id}`);
  }

  /* ====================== GPS (devices?type=gps) ====================== */
  /** Lista de GPS con filtros (marca, modelo, estatus, búsqueda por IMEI/SN, fechas, etc.) */
  getGps(query?: GpsQuery): Observable<any> {
    const params = this.buildHttpParams({ type: 'gps', ...query });
    return this.http.get(`${this.baseUrl}/devices`, { params });
  }

  /** Obtiene un GPS por id */
  getGpsById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/devices/${id}`);
  }

  /** Crea un GPS (alineado al schema: name, brand, model, imei, sn, …) */
  createGps(payload: Omit<CreateGpsPayload, 'type'>): Observable<any> {
    const body: CreateGpsPayload = {
      type: 'gps',
      ...payload,
      purchaseDate: this.toIsoDate(payload.purchaseDate)!,
      entryDate: this.toIsoDate(payload.entryDate)!,
      installationDate: this.toIsoDate(payload.installationDate ?? null),
    };
    return this.http.post(`${this.baseUrl}/devices`, body);
  }

  /** Actualiza un GPS por id (no cambia 'type') */
  updateGps(
    id: string,
    payload: Partial<Omit<CreateGpsPayload, 'type'>>
  ): Observable<any> {
    const body: any = { ...payload };
    const toIso = (v: any) => v == null ? null : new Date(v).toISOString();
    if ('purchaseDate' in body) body.purchaseDate = toIso(body.purchaseDate);
    if ('entryDate' in body) body.entryDate = toIso(body.entryDate);
    if ('installationDate' in body) body.installationDate = toIso(body.installationDate);
    return this.http.put(`${this.baseUrl}/devices/${id}`, body);
  }


  /** Elimina un GPS por id */
  deleteGps(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/devices/${id}`);
  }

  /* ====================== Events ====================== */
  getEvents(query?: EventsQuery): Observable<EventsListResponse> {
    const params = this.buildHttpParams(query as any);
    return this.http.get<EventsListResponse>(`${this.baseUrl}/events`, { params });
  }
  getEventById(id: string): Observable<{ message: string; data: EventItem }> {
    return this.http.get<{ message: string; data: EventItem }>(`${this.baseUrl}/events/${id}`);
  }
  deleteEventById(id: string): Observable<{ message: string; data: EventItem }> {
    return this.http.delete<{ message: string; data: EventItem }>(`${this.baseUrl}/events/${id}`);
  }
  bulkDeleteEvents(filters?: Pick<EventsQuery, 'identifier' | 'collectionName' | 'operation' | 'userId' | 'q' | 'from' | 'to'>):
    Observable<{ message: string; deletedCount: number }> {
    const params = this.buildHttpParams(filters as any);
    return this.http.delete<{ message: string; deletedCount: number }>(`${this.baseUrl}/events`, { params });
  }

  /* ====================== ACCESORIOS (devices?type=accessory) ====================== */
  getAccessories(): Observable<any> {
    return this.http.get(`${this.baseUrl}/devices`, { params: { type: 'accessory' } });
  }

  getAccessoryById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/devices/${id}`);
  }

  createAccessory(payload: Omit<CreateAccessoryPayload, 'type'>): Observable<any> {
    const body: CreateAccessoryPayload = {
      type: 'accessory',
      ...payload,
      purchaseDate: this.toIsoDate(payload.purchaseDate)!,
      entryDate: this.toIsoDate(payload.entryDate)!,
      installationDate: this.toIsoDate(payload.installationDate ?? null),
    };
    return this.http.post(`${this.baseUrl}/devices`, body);
  }

  updateAccessory(id: string, payload: UpdateAccessoryPayload): Observable<any> {
    const body: any = { ...payload };

    if ('purchaseDate' in body) body.purchaseDate = this.toIsoDate(body.purchaseDate);
    if ('entryDate' in body) body.entryDate = this.toIsoDate(body.entryDate);
    if ('installationDate' in body) body.installationDate = this.toIsoDate(body.installationDate);

    return this.http.put(`${this.baseUrl}/devices/${id}`, body);
  }

  deleteAccessory(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/devices/${id}`);
  }

}
