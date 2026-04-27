import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay, map, switchMap, timeout, retry, forkJoin } from 'rxjs';

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

export interface TrackerUI {
  id: number;

  nombre: string;
  imei: string;
  sim: string;
  plan: string;
  modelo: string;

  clon: boolean;
  suspendido: boolean;
  hidden: boolean;

  sdc1?: string;
  sdc2?: string;
  sdcAcumulado?: string;
  canbus?: string;

  ultimaConexionUTC: string;
  ultimaConexionLocal: string;

  tiempoOffline: string;
  statusSoporte: string;

  minutosOffline: number;
  online: boolean;
}

export interface ClienteUI {
  id: number;
  nombre: string;
  login: string;
  ciudad: string;

  total: number;
  online: number;
  offline: number;

  ultimoIngreso: string;
  hasHidden: boolean;

  trackers: TrackerUI[];
}

export interface FullClientsResponse {
  clientes: ClienteUI[];

  kpis: {
    totalClientes: number;
    totalTrackers: number;
    online: number;
    offline: number;
    porcentajeOnline: number;

    offline12h: number;
    offline1d: number;
    offline15d: number;
    offline1m: number;
    offline6m: number;
    offline1a: number;
  };
}

/* ====================== Tipos Devices ====================== */
export type DeviceStatus = 'En inventario' | 'En configuración' | 'Instalado' | 'Listo para usar';

export type UpdateSimPayload = Partial<{
  id: string;            // _id
  iccid: string;
  model: string;        // model
  company: string;      // company
  status: DeviceStatus;
  usage: string;
  purchaseDate: string | Date | null;
  entryDate: string | Date | null;
  installationDate?: string | Date | null;
  client: string;
  comments: string;
  netPrice: string | null;
  grossPrice: string | null;
  satCode: string | null;
}>;

/** Payload para crear/actualizar GPS */
export interface GpsPayload {
  type?: 'gps';
  imei: string;
  sn: string;
  supplier: string;
  name?: string | null;
  brand: string;
  model: string;
  status: DeviceStatus;
  purchaseDate: string | Date | null;
  entryDate: string | Date | null;
  phoneNumber: string | null;
  installationDate?: string | Date | null;
  client?: string | null;
  comments?: string | null;
}

export interface SimPayload {
  type?: 'sim';
  iccid: string;
  model: string;
  company: string;
  supplier: string;
  status: DeviceStatus;
  purchaseDate: string;
  entryDate: string;
  usage: string;
  installationDate?: string | null;
  client?: string | null;
  comments?: string | null;
}

export type UpdateGpsPayload = Partial<Omit<GpsPayload, 'type'>>;

/** Payload para crear Accesorio */
export interface AccessoryPayload {
  type?: 'accessory';
  id?: string | null; // _id (solo para update)
  idAccesorio?: string | null;                 // 👈 campo "id" del accesorio
  sn: string;
  supplier: string;
  name?: string;
  brand: string;
  model: string;
  status: DeviceStatus;
  purchaseDate: string | Date | null;       // 'YYYY-MM-DD'
  entryDate: string | Date | null;          // 'YYYY-MM-DD'
  installationDate?: string | Date | null; // (en masivo lo dejamos null)
  client?: string | null;           // (en masivo lo dejamos null)
  comments?: string | null;
}

export type UpdateAccessoryPayload = Partial<Omit<AccessoryPayload, 'type'>>;

/** Query de listado GPS (coincide con filtros del UI) */
export interface GpsQuery {
  brand?: string;
  model?: string;
  status?: DeviceStatus | '';
  q?: string;            // búsqueda por IMEI/SN
  from?: string;         // ISO
  to?: string;           // ISO
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/* ====================== Tipos Peticiones ====================== */
export type RequestStatus = 'Pendiente' | 'Rechazada' | 'Atendida' | 'Aceptada';

export interface RequestedDeviceItem {
  model: string;
  quantity: number;

  response?: {
    id: string;
    model: string;
  }[];
}

export interface CreateRequestPayload {
  status?: 'Pendiente' | 'Rechazada' | 'Atendida' | 'Aceptada';
  requestDate?: string | Date;
  responseDate?: string | Date | null;

  // ✅ nuevo
  devicesRequested: RequestedDeviceItem[];

  // ✅ total (opcional enviarlo; backend lo recalcula)
  quantity?: number;

  comments?: string | null;
}

/** Payload para actualizar Petición */
export type UpdateRequestPayload = Partial<CreateRequestPayload>;

/** Query de listado Peticiones (opcional) */
export interface RequestsQuery {
  status?: RequestStatus;
  q?: string;        // si luego agregas búsqueda en backend
  from?: string;     // ISO (requestDate desde)
  to?: string;       // ISO (requestDate hasta)
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const apiUrl = 'http://localhost:3103';
// export const apiUrl = 'https://leptoncore-api.lepton-seguridad.com';

// Mostrar sin uso y ordenar for fecha ultima conexion, Sincronizar con listo para usar, Qrs
// Que Admin también pueda hacer peticiones
// Crear otro campo para accesorios para identificar cuáles ya están configurados
// Contadores en las pestañas de los dispositivos
// En el excel incluír el contador de los suspendidos y hidden
// Nombre del excel "Detalles Clientes 2026 04 25"
// Dejar un último login por usuario en el excel
// Agregar una alerta a la sección de clientes para mostrar si hay clientes que no estén registrados en la lista de clientes activos (de clientes con dispositivos, comparalos con la lista de clientes activos, si hay alguno que no esté registrado, mostrar una alerta indicando cuáles son esos clientes para que se agreguen a la lista)
// Si no hay datos de sensores, que se muestre ese mensaje en laas celdas de la tabla

@Injectable({ providedIn: 'root' })
export class ApiService {

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

  private toIsoDate(v: string | Date | null | undefined): string | null {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return v.toISOString();

    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  /* ====================== Google Geocode ====================== */
  getColoniasByCodigoPostalFromGoogle(codigoPostal: string): Observable<any> {
    const apiKey = 'AIzaSyBxD3oEeLRpU9kcilSl2dl1aNzbEe9afyg';
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${codigoPostal},Mexico&key=${apiKey}`;
    return this.http.get(url);
  }

  /* ====================== Planes / Clientes / Servicios / Users (sin cambios) ====================== */
  getPlanes(): Observable<any> { return this.http.get(`${apiUrl}/planes`); }
  getPlanById(id: number): Observable<any> { return this.http.get(`${apiUrl}/planes/${id}`); }
  createPlan(plan: any): Observable<any> { return this.http.post(`${apiUrl}/planes`, plan); }
  updatePlan(id: number, plan: any): Observable<any> { return this.http.put(`${apiUrl}/planes/${id}`, plan); }
  deletePlan(id: number): Observable<any> { return this.http.delete(`${apiUrl}/planes/${id}`); }

  getClientes(): Observable<any> { return this.http.get(`${apiUrl}/clientes`); }
  getClienteById(id: string): Observable<any> { return this.http.get(`${apiUrl}/clientes/${id}`); }
  checkEmailExists(email: string): Observable<any> {
    return this.http.get(`${apiUrl}/clientes/check-email`, { params: { email } });
  }
  createCliente(cliente: any): Observable<any> { return this.http.post(`${apiUrl}/clientes`, cliente); }
  updateCliente(id: number, cliente: any): Observable<any> { return this.http.put(`${apiUrl}/clientes/${id}`, cliente); }
  deleteCliente(id: number): Observable<any> { return this.http.delete(`${apiUrl}/clientes/${id}`); }

  // (Legacy) Dispositivos - si aún los usas en otra vista
  getDispositivos(): Observable<any> { return this.http.get(`${apiUrl}/dispositivos`); }
  createDispositivo(dispositivo: any): Observable<any> { return this.http.post(`${apiUrl}/dispositivos`, dispositivo); }
  updateDispositivo(id: number, dispositivo: any): Observable<any> { return this.http.put(`${apiUrl}/dispositivos/${id}`, dispositivo); }
  deleteDispositivo(id: number): Observable<any> { return this.http.delete(`${apiUrl}/dispositivos/${id}`); }

  getServicios(): Observable<any> { return this.http.get(`${apiUrl}/servicios`); }
  getServicioById(id: number): Observable<any> { return this.http.get(`${apiUrl}/servicios/${id}`); }
  createServicio(servicio: any): Observable<any> { return this.http.post(`${apiUrl}/servicios`, servicio); }
  updateServicio(id: number, servicio: any): Observable<any> { return this.http.put(`${apiUrl}/servicios/${id}`, servicio); }
  deleteServicio(id: number): Observable<any> { return this.http.delete(`${apiUrl}/servicios/${id}`); }

  registerUser(user: any): Observable<any> { return this.http.post(`${apiUrl}/users`, user); }
  getUsers(): Observable<any> { return this.http.get(`${apiUrl}/users`); }

  getProfile(): Observable<any> {
    return this.http.get(`${apiUrl}/users/profile`);
  }
  
  updateUser(id: number, user: any): Observable<any> { return this.http.put(`${apiUrl}/users/${id}`, user); }
  //   updateUser(id: string, data: any) {
  //   return this.http.put(`${apiUrl}/users/${id}`, data);
  // }
  deleteUser(id: number): Observable<any> { return this.http.delete(`${apiUrl}/users/${id}`); }

  /* ====================== DEVICES (todos) ====================== */
  getDevices(query?: {
    type?: string;
    status?: string;
    includeIds?: string[];
  }): Observable<any> {
    const params = this.buildHttpParams(query);
    return this.http.get(`${apiUrl}/devices`, { params });
  }

  private devicesCache$: Observable<any> | null = null;

  getDevicesCached(
    query?: {
      type?: string;
      status?: string;
      includeIds?: string[];
    },
    forceRefresh = false
  ): Observable<any> {

    if (!this.devicesCache$ || forceRefresh) {
      const params = this.buildHttpParams(query);

      this.devicesCache$ = this.http.get(`${apiUrl}/devices`, { params }).pipe(
        shareReplay(1)
      );
    }

    return this.devicesCache$;
  }

  /* ====================== SIMs (devices?type=sim) ====================== */
  getSims(): Observable<any> {
    return this.http.get(`${apiUrl}/devices`, { params: { type: 'sim' } });
  }


  createSim(payload: {
    iccid: string;
    model: string;
    company: string;
    supplier: string;
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
    return this.http.post(`${apiUrl}/devices`, body);
  }
  updateSim(id: string, payload: UpdateSimPayload): Observable<any> {
    const body: any = { ...payload };

    if (body.purchaseDate !== undefined) body.purchaseDate = this.toIsoDate(body.purchaseDate);
    if (body.entryDate !== undefined) body.entryDate = this.toIsoDate(body.entryDate);
    if (body.installationDate !== undefined) body.installationDate = this.toIsoDate(body.installationDate);

    return this.http.put(`${apiUrl}/devices/${id}`, body);
  }
  deleteSim(id: string): Observable<any> {
    return this.http.delete(`${apiUrl}/devices/${id}`);
  }

  /* ====================== GPS (devices?type=gps) ====================== */
  getGps(query?: GpsQuery): Observable<any> {
    const params = this.buildHttpParams({ type: 'gps', ...query });
    return this.http.get(`${apiUrl}/devices`, { params });
  }
  getGpsById(id: string): Observable<any> {
    return this.http.get(`${apiUrl}/devices/${id}`);
  }
  createGps(payload: Omit<GpsPayload, 'type'>): Observable<any> {
    const body: GpsPayload = {
      type: 'gps',
      ...payload,
      purchaseDate: this.toIsoDate(payload.purchaseDate),
      entryDate: this.toIsoDate(payload.entryDate)!,
      installationDate: this.toIsoDate(payload.installationDate ?? null),
    };
    return this.http.post(`${apiUrl}/devices`, body);
  }
  updateGps(id: string, payload: Partial<Omit<GpsPayload, 'type'>>): Observable<any> {
    const body: any = { ...payload };
    const toIso = (v: any) => (v == null ? null : new Date(v).toISOString());
    if ('purchaseDate' in body) body.purchaseDate = toIso(body.purchaseDate);
    if ('entryDate' in body) body.entryDate = toIso(body.entryDate);
    if ('installationDate' in body) body.installationDate = toIso(body.installationDate);
    return this.http.put(`${apiUrl}/devices/${id}`, body);
  }
  deleteGps(id: string): Observable<any> {
    return this.http.delete(`${apiUrl}/devices/${id}`);
  }

  /* ====================== Events ====================== */
  getEvents(query?: EventsQuery): Observable<EventsListResponse> {
    const params = this.buildHttpParams(query as any);
    return this.http.get<EventsListResponse>(`${apiUrl}/events`, { params });
  }

  private eventsCache$: Observable<EventsListResponse> | null = null;

  getEventsCached(
    query?: any,
    forceRefresh = false
  ): Observable<EventsListResponse> {

    if (!this.eventsCache$ || forceRefresh) {
      const params = this.buildHttpParams(query);

      this.eventsCache$ = this.http
        .get<EventsListResponse>(`${apiUrl}/events`, { params })
        .pipe(
          shareReplay(1)
        );
    }

    return this.eventsCache$;
  }

  getEventById(id: string): Observable<{ message: string; data: EventItem }> {
    return this.http.get<{ message: string; data: EventItem }>(`${apiUrl}/events/${id}`);
  }
  deleteEventById(id: string): Observable<{ message: string; data: EventItem }> {
    return this.http.delete<{ message: string; data: EventItem }>(`${apiUrl}/events/${id}`);
  }
  bulkDeleteEvents(
    filters?: Pick<EventsQuery, 'identifier' | 'collectionName' | 'operation' | 'userId' | 'q' | 'from' | 'to'>
  ): Observable<{ message: string; deletedCount: number }> {
    const params = this.buildHttpParams(filters as any);
    return this.http.delete<{ message: string; deletedCount: number }>(`${apiUrl}/events`, { params });
  }

  /* ====================== ACCESORIOS (devices?type=accessory) ====================== */
  getAccessories(): Observable<any> {
    return this.http.get(`${apiUrl}/devices`, { params: { type: 'accessory' } });
  }
  getAccessoryById(id: string): Observable<any> {
    return this.http.get(`${apiUrl}/devices/${id}`);
  }
  createAccessory(payload: Omit<AccessoryPayload, 'type'>): Observable<any> {
    const body: AccessoryPayload = {
      type: 'accessory',
      ...payload,
      purchaseDate: this.toIsoDate(payload.purchaseDate)!,
      entryDate: this.toIsoDate(payload.entryDate)!,
      installationDate: this.toIsoDate(payload.installationDate ?? null),
    };
    return this.http.post(`${apiUrl}/devices`, body);
  }
  updateAccessory(id: string, payload: UpdateAccessoryPayload): Observable<any> {
    const body: any = { ...payload };
    if ('purchaseDate' in body) body.purchaseDate = this.toIsoDate(body.purchaseDate);
    if ('entryDate' in body) body.entryDate = this.toIsoDate(body.entryDate);
    if ('installationDate' in body) body.installationDate = this.toIsoDate(body.installationDate);
    return this.http.put(`${apiUrl}/devices/${id}`, body);
  }
  deleteAccessory(id: string): Observable<any> {
    return this.http.delete(`${apiUrl}/devices/${id}`);
  }

  /* ====================== PETICIONES (requests) ====================== */

  /** Lista peticiones (si tu backend solo filtra por status, manda { status } ) */
  getRequests(query?: RequestsQuery): Observable<any> {
    const params = this.buildHttpParams(query as any);
    return this.http.get(`${apiUrl}/requests`, { params });
  }

  private requestsCache$: Observable<any> | null = null;

  getRequestsCached(forceRefresh = false): Observable<any> {
    if (!this.requestsCache$ || forceRefresh) {
      this.requestsCache$ = this.http.get(`${apiUrl}/requests`).pipe(
        shareReplay(1)
      );
    }

    return this.requestsCache$;
  }

  /** Obtiene una petición por id */
  getRequestById(id: string): Observable<any> {
    return this.http.get(`${apiUrl}/requests/${id}`);
  }

  /** Crea una petición */
  createRequest(payload: CreateRequestPayload): Observable<any> {
    const body: any = {
      ...payload,
      requestDate: this.toIsoDate(payload.requestDate),
      responseDate: this.toIsoDate(payload.responseDate ?? null),
    };
    return this.http.post(`${apiUrl}/requests`, body);
  }

  /** Actualiza una petición */
  updateRequest(id: string, payload: UpdateRequestPayload): Observable<any> {
    const body: any = { ...payload };

    if (body.requestDate !== undefined) body.requestDate = this.toIsoDate(body.requestDate);
    if (body.responseDate !== undefined) body.responseDate = this.toIsoDate(body.responseDate);

    return this.http.put(`${apiUrl}/requests/${id}`, body);
  }

  /** Elimina una petición */
  deleteRequest(id: string): Observable<any> {
    return this.http.delete(`${apiUrl}/requests/${id}`);
  }

  // ====================== CLIENT CONFIG ======================

  private clientConfigCache$: Observable<any> | null = null;

  getClientConfigCached(forceRefresh = false): Observable<any> {

    if (!this.clientConfigCache$ || forceRefresh) {

      this.clientConfigCache$ = this.http
        .get(`${apiUrl}/clients/config`)
        .pipe(
          shareReplay(1)
        );
    }

    return this.clientConfigCache$;
  }

  updateActiveClients(activeClients: any): Observable<any> {
    return this.http.put(`${apiUrl}/clients/config/active`, { activeClients });
  }

  updateExcludedAccounts(excludedAccounts: number[]): Observable<any> {
    return this.http.put(`${apiUrl}/clients/config/excluded`, { excludedAccounts });
  }

  private clientsCache = new Map<string, Observable<FullClientsResponse>>();

  // getFullClientsData(
  //   includeSensors: boolean,
  //   includeLogin: boolean,
  //   forceRefresh = false
  // ): Observable<FullClientsResponse> {

  //   const key = `full-data-${includeSensors}-${includeLogin}`;

  //   if (!this.clientsCache.has(key) || forceRefresh) {

  //     const params = this.buildHttpParams({
  //       includeSensors,
  //       includeLogin
  //     });

  //     const request$ = this.http
  //       .get<FullClientsResponse>(`${apiUrl}/clients/full-data`, { params })
  //       .pipe(
  //         retry(2),
  //         shareReplay(1)
  //       );

  //     this.clientsCache.set(key, request$);
  //   }

  //   return this.clientsCache.get(key)!;
  // }

  getFullClientsDataStream(
    includeSensors: boolean,
    includeLogin: boolean,
    forceRefresh = false
  ): Observable<
    | { type: 'progress'; progress: number; message: string }
    | { type: 'done'; data: FullClientsResponse }
  > {

    const key = `full-data-${includeSensors}-${includeLogin}`;

    // 🔥 SI YA HAY CACHE Y NO FORZAMOS → devolver directo
    if (this.clientsCache.has(key) && !forceRefresh) {
      return this.clientsCache.get(key)!.pipe(
        map(data => ({
          type: 'done' as const,
          data
        }))
      );
    }

    const token = localStorage.getItem('token');

    const params = new URLSearchParams({
      includeSensors: String(includeSensors),
      includeLogin: String(includeLogin),
      token: token || ''
    });

    const url = `${apiUrl}/clients/full-data?${params.toString()}`;

    return new Observable(observer => {

      const eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // 🔄 PROGRESO
        if (!data.done && !data.error) {
          observer.next({
            type: 'progress',
            progress: data.progress,
            message: data.message
          });
        }

        // ✅ TERMINADO
        if (data.done) {

          // 🔥 GUARDAR EN CACHE
          const finalData$ = new Observable<FullClientsResponse>(obs => {
            obs.next(data.data);
            obs.complete();
          }).pipe(shareReplay(1));

          this.clientsCache.set(key, finalData$);

          observer.next({
            type: 'done',
            data: data.data
          });

          observer.complete();
          eventSource.close();
        }

        // ❌ ERROR BACKEND
        if (data.error) {
          observer.error(data.message || 'Error en stream');
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        observer.error('Error de conexión SSE');
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    });
  }

}

