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
  eventComments: string;
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
  clients: ClienteUI[];
  includeSensors: boolean;
  includeLogin: boolean;
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
  configured?: boolean | null;
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

/* ====================== Tipos billingClients ====================== */
export interface PaymentContactPayload {
  name: string;
  email?: string;
  cel?: string;
  notes?: string;
}

export interface BillingClientDiscounts {
  monthly: number;
  devices: number;
  accessories: number;
}

export type BillingClientType = 'client' | 'subClient';

export interface BillingClientItem {
  _id: string;
  type: BillingClientType;
  userId?: number | null;
  billingClientFather?: string | null;
  subBillingClients?: string[];
  billingName: string;
  paymentContacts: PaymentContactPayload[];
  voucherType: 'Recibo' | 'Factura';
  cutoffDay: number;
  companyName: string;
  RFC: string;
  useInvoice: string;
  taxRegime: string;
  email: string;
  cp?: number | null;
  street: string;
  streetNumber: string;
  suburb: string;
  locality: string;
  state: string;
  country: string;
  discounts: BillingClientDiscounts;
  blacklist: boolean;
  createdAt?: string | Date;
}

export type CreateBillingClientPayload = Omit<BillingClientItem, '_id' | 'createdAt'> & {
  createdAt?: string | Date;
};

export type UpdateBillingClientPayload = Partial<CreateBillingClientPayload>;

export interface BillingClientsQuery {
  userId?: number | null;
  voucherType?: 'Recibo' | 'Factura' | '';
  q?: string;
}

/* ====================== Cuentas bancarias ====================== */
export interface BankAccountItem {
  _id: string;
  holder: string;
  bankName: string;
  accountNumber: string;
  CLABE: string;
}

export type CreateBankAccountPayload = Omit<BankAccountItem, '_id'>;
export type UpdateBankAccountPayload = Partial<CreateBankAccountPayload>;

/* ====================== Cotizaciones ====================== */
export interface QuoteProduct {
  name: string;
  concept: string;
  description?: string;
  type: QuoteProductType;
  price: number;
  priceIVA: number;
  discount: number;
  discountType: '%' | '$';
  amount: number;
  total: number;
}

export interface QuoteItem {
  _id: string;
  quoteNum: string;
  userName: string;

  clientName: string;
  companyName?: string;
  place?: string;

  validity: string | Date;

  products: QuoteProduct[];

  subtotal: number;
  discounts: number;
  IVA: number;
  total: number;

  units?: number;
  model?: string;

  paymentNextMonthly?: number;

  billable: boolean;
  bankName?: string;
  paymentMethodHolder?: string;
  accountNumber?: string;
  CLABE?: string;

  comments?: string;

  createdAt?: string | Date;
}

export type QuoteProductType = 'GPS' | 'Accesorio' | 'Servicio' | 'Plan';

export interface QuoteProductItem {
  _id: string;
  type: QuoteProductType;
  name: string;
  concept: string;
  description?: string;
  price: number;
  priceIVA: number;
  discount?: number;
  duration?: '1 mes' | '3 meses' | '6 meses' | '1 año';
  comments?: string;
  createdAt?: string | Date;
}

export type ForeignTechnicianType = 'Local' | 'Foráneo';

export interface ForeignTechnicianPaymentMethod {
  holder: string;
  bankName: string;
  accountNumber: string;
  CLABE: string;
  cardNumber: string;
}

export interface ForeignTechnicianItem {
  _id: string;
  type: ForeignTechnicianType;
  name: string;
  cel: string;
  bill: boolean;
  city: string;
  ownLocal: boolean;
  address: string;
  installationPrice: number;
  inspectionFee: number;
  withdrawalPrice: number;
  priceFalseReversal: number;
  travelExpensesPrice: number;
  transferPrice: number;
  paymentMethods: ForeignTechnicianPaymentMethod[];
  comments?: string;
}

export interface TravelExpenseBooth {
  name: string;
  cost: number;
}

export interface TravelExpenseItem {
  _id: string;
  place: string;
  km: number;
  booths: TravelExpenseBooth[];
  createdAt?: string | Date;
}

export interface TravelExpenseExtraItem {
  _id: string;
  kmRate: number;
  lodging: number;
  breakfast: number;
  lunch: number;
  dinner: number;
  createdAt?: string | Date;
}

export interface ClientListItem {
  userId: number;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

export type SuggestionAction = 'add' | 'remove';

export type SuggestionResponseAction = 'add' | 'remove' | string;

export interface SuggestionResponseItem {
  action: SuggestionResponseAction;
  productId: string;
}

export interface SuggestionItem {
  _id: string;
  description: string;
  productId: string;
  action: SuggestionAction;
  response: SuggestionResponseItem[];
  createdAt?: string | Date;
}

// export const apiUrl = 'http://localhost:3103';
export const apiUrl = 'https://leptoncore-api.lepton-seguridad.com';

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
    const apiKey = 'AIzaSyCAy6-DDrhVX6jstGgSN-ev0dxXXXEHtz8';
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

  clearUserScopedCaches(): void {
    this.devicesCache$ = null;
    this.eventsCache$ = null;
    this.requestsCache$ = null;
    this.billingClientsCache$ = null;
    this.clientConfigCache$ = null;
    this.activeClientsConfigCache$ = null;
    this.excludedAccountsConfigCache$ = null;
    this.clientsListCache$ = null;
    this.clientsCache.clear();
  }

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

  bulkUpdateDevices(ids: string[], payload: any): Observable<any> {
    return this.http.put(`${apiUrl}/devices/bulk`, {
      ids,
      payload
    });
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

  bulkUpdateSims(ids: string[], payload: UpdateSimPayload): Observable<any> {
    const body: any = {
      ids,
      payload: { ...payload }
    };

    if ('purchaseDate' in body.payload) {
      body.payload.purchaseDate = this.toIsoDate(body.payload.purchaseDate);
    }

    if ('entryDate' in body.payload) {
      body.payload.entryDate = this.toIsoDate(body.payload.entryDate);
    }

    if ('installationDate' in body.payload) {
      body.payload.installationDate = this.toIsoDate(body.payload.installationDate);
    }

    return this.http.put(`${apiUrl}/devices/bulk`, body);
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

  bulkUpdateGps(
    ids: string[],
    payload: UpdateGpsPayload
  ): Observable<any> {

    const body: any = {
      ids,
      payload: { ...payload }
    };

    if ('purchaseDate' in body.payload) {
      body.payload.purchaseDate = this.toIsoDate(body.payload.purchaseDate);
    }

    if ('entryDate' in body.payload) {
      body.payload.entryDate = this.toIsoDate(body.payload.entryDate);
    }

    if ('installationDate' in body.payload) {
      body.payload.installationDate = this.toIsoDate(body.payload.installationDate);
    }

    return this.http.put(`${apiUrl}/devices/bulk`, body);
  }

  /* ====================== Events ====================== */
  getEvents(query?: EventsQuery): Observable<EventsListResponse> {
    const params = this.buildHttpParams(query as any);
    return this.http.get<EventsListResponse>(`${apiUrl}/events`, { params });
  }

  private eventsCache$: Observable<EventsListResponse> | null = null;

  clearEventsCache(): void {
    this.clearUserScopedCaches();
  }

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

  bulkUpdateAccessories(ids: string[], payload: UpdateAccessoryPayload): Observable<any> {
    const body: any = {
      ids,
      payload: { ...payload }
    };

    if ('purchaseDate' in body.payload) {
      body.payload.purchaseDate = this.toIsoDate(body.payload.purchaseDate);
    }

    if ('entryDate' in body.payload) {
      body.payload.entryDate = this.toIsoDate(body.payload.entryDate);
    }

    if ('installationDate' in body.payload) {
      body.payload.installationDate = this.toIsoDate(body.payload.installationDate);
    }

    return this.http.put(`${apiUrl}/devices/bulk`, body);
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

  /* ====================== CLIENTES DE COBRANZA ====================== */

  getBillingClients(query?: BillingClientsQuery): Observable<any> {
    const params = this.buildHttpParams(query as any);
    return this.http.get(`${apiUrl}/billingClients`, { params });
  }

  private billingClientsCache$: Observable<any> | null = null;

  getBillingClientsCached(forceRefresh = false): Observable<any> {
    if (!this.billingClientsCache$ || forceRefresh) {
      this.billingClientsCache$ = this.http.get(`${apiUrl}/billingClients`).pipe(
        shareReplay(1)
      );
    }

    return this.billingClientsCache$;
  }

  getBillingClientById(id: string): Observable<any> {
    return this.http.get(`${apiUrl}/billingClients/${id}`);
  }

  createBillingClient(payload: CreateBillingClientPayload): Observable<any> {
    const body: any = {
      ...payload,
      userId: payload.userId ?? null,
      cp: payload.cp ?? null,
      discounts: payload.discounts ?? { monthly: 0, devices: 0, accessories: 0 },
      paymentContacts: payload.paymentContacts ?? []
    };

    return this.http.post(`${apiUrl}/billingClients`, body);
  }

  updateBillingClient(id: string, payload: UpdateBillingClientPayload): Observable<any> {
    return this.http.put(`${apiUrl}/billingClients/${id}`, payload);
  }

  deleteBillingClient(id: string, newParentId?: string, deleteChildren = false): Observable<any> {
    return this.http.request('delete', `${apiUrl}/billingClients/${id}`, { body: { newParentId, deleteChildren } });
  }

  private clientsListCache$: Observable<any> | null = null;

  getClientsListCached(forceRefresh = false): Observable<any> {
    if (!this.clientsListCache$ || forceRefresh) {
      this.clientsListCache$ = this.http.get(`${apiUrl}/clients/list`).pipe(
        shareReplay(1)
      );
    }
    return this.clientsListCache$;
  }

  /* ====================== CUENTAS BANCARIAS ====================== */

  getBankAccounts(): Observable<any> {
    return this.http.get(`${apiUrl}/bankAccounts`);
  }

  getBankAccountById(id: string): Observable<any> {
    return this.http.get(`${apiUrl}/bankAccounts/${id}`);
  }

  createBankAccount(payload: CreateBankAccountPayload): Observable<any> {
    return this.http.post(`${apiUrl}/bankAccounts`, payload);
  }

  updateBankAccount(id: string, payload: UpdateBankAccountPayload): Observable<any> {
    return this.http.put(`${apiUrl}/bankAccounts/${id}`, payload);
  }

  deleteBankAccount(id: string): Observable<any> {
    return this.http.delete(`${apiUrl}/bankAccounts/${id}`);
  }

  /* ====================== COTIZACIONES ====================== */

  getQuotes(params?: { q?: string; clientName?: string; quoteNum?: string; userId?: string; }): Observable<any> {
    return this.http.get(`${apiUrl}/quotes`, { params: params as any });
  }

  getQuote(id: string): Observable<any> {
    return this.http.get(`${apiUrl}/quotes/${id}`);
  }

  createQuote(payload: Omit<QuoteItem, 'userName' | '_id' | 'quoteNum' | 'createdAt'>): Observable<any> {
    return this.http.post(`${apiUrl}/quotes`, payload);
  }

  updateQuote(id: string, payload: Partial<Omit<QuoteItem, 'userName' | '_id' | 'quoteNum' | 'createdAt'>>): Observable<any> {
    return this.http.put(`${apiUrl}/quotes/${id}`, payload);
  }

  deleteQuote(id: string): Observable<any> {
    return this.http.delete(`${apiUrl}/quotes/${id}`);
  }

  deleteQuotes(ids: string[]): Observable<any> {
    return this.http.delete(`${apiUrl}/quotes`, { body: { ids } });
  }

  getQuoteProducts(): Observable<any> {
    return this.http.get(`${apiUrl}/products`);
  }

  createQuoteProduct(payload: Omit<QuoteProductItem, '_id' | 'createdAt'>): Observable<any> {
    return this.http.post(`${apiUrl}/products`, payload);
  }

  updateQuoteProduct(id: string, payload: Partial<Omit<QuoteProductItem, '_id' | 'createdAt'>>): Observable<any> {
    return this.http.put(`${apiUrl}/products/${id}`, payload);
  }

  deleteQuoteProduct(id: string): Observable<any> {
    return this.http.delete(`${apiUrl}/products/${id}`);
  }

  deleteQuoteProducts(ids: string[]): Observable<any> {
    return this.http.delete(`${apiUrl}/products`, { body: { ids } });
  }

  getForeignTechnicians(): Observable<any> {
    return this.http.get(`${apiUrl}/foreignTechnicians`);
  }

  createForeignTechnician(payload: Omit<ForeignTechnicianItem, '_id'>): Observable<any> {
    return this.http.post(`${apiUrl}/foreignTechnicians`, payload);
  }

  updateForeignTechnician(id: string, payload: Partial<Omit<ForeignTechnicianItem, '_id'>>): Observable<any> {
    return this.http.put(`${apiUrl}/foreignTechnicians/${id}`, payload);
  }

  deleteForeignTechnician(id: string): Observable<any> {
    return this.http.delete(`${apiUrl}/foreignTechnicians/${id}`);
  }

  getTravelExpenses(): Observable<any> {
    return this.http.get(`${apiUrl}/travelExpenses`);
  }

  createTravelExpense(payload: Omit<TravelExpenseItem, '_id' | 'createdAt'>): Observable<any> {
    return this.http.post(`${apiUrl}/travelExpenses`, payload);
  }

  updateTravelExpense(id: string, payload: Partial<Omit<TravelExpenseItem, '_id' | 'createdAt'>>): Observable<any> {
    return this.http.put(`${apiUrl}/travelExpenses/${id}`, payload);
  }

  deleteTravelExpense(id: string): Observable<any> {
    return this.http.delete(`${apiUrl}/travelExpenses/${id}`);
  }

  getTravelExpenseExtras(): Observable<any> {
    return this.http.get(`${apiUrl}/travelExpensesExtras`);
  }

  createTravelExpenseExtra(payload: Omit<TravelExpenseExtraItem, '_id' | 'createdAt'>): Observable<any> {
    return this.http.post(`${apiUrl}/travelExpensesExtras`, payload);
  }

  updateTravelExpenseExtra(id: string, payload: Partial<Omit<TravelExpenseExtraItem, '_id' | 'createdAt'>>): Observable<any> {
    return this.http.put(`${apiUrl}/travelExpensesExtras/${id}`, payload);
  }

  deleteTravelExpenseExtra(id: string): Observable<any> {
    return this.http.delete(`${apiUrl}/travelExpensesExtras/${id}`);
  }

  /* ====================== SUGERENCIAS ====================== */

  getSuggestions(): Observable<any> {
    return this.http.get(`${apiUrl}/suggestions`);
  }

  createSuggestion(payload: Omit<SuggestionItem, '_id' | 'createdAt'>): Observable<any> {
    return this.http.post(`${apiUrl}/suggestions`, payload);
  }

  updateSuggestion(
    id: string,
    payload: Partial<Omit<SuggestionItem, '_id' | 'createdAt'>>
  ): Observable<any> {
    return this.http.put(`${apiUrl}/suggestions/${id}`, payload);
  }

  deleteSuggestion(id: string): Observable<any> {
    return this.http.delete(`${apiUrl}/suggestions/${id}`);
  }

  // ====================== CLIENT CONFIG ======================

  private clientConfigCache$: Observable<any> | null = null;
  private activeClientsConfigCache$: Observable<any> | null = null;
  private excludedAccountsConfigCache$: Observable<any> | null = null;

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

  getActiveClientsConfigCached(forceRefresh = false): Observable<any> {
    if (!this.activeClientsConfigCache$ || forceRefresh) {
      this.activeClientsConfigCache$ = this.http.get(`${apiUrl}/clients/config/active`).pipe(
        shareReplay(1)
      );
    }
    return this.activeClientsConfigCache$;
  }

  getExcludedAccountsConfigCached(forceRefresh = false): Observable<any> {
    if (!this.excludedAccountsConfigCache$ || forceRefresh) {
      this.excludedAccountsConfigCache$ = this.http.get(`${apiUrl}/clients/config/excluded`).pipe(
        shareReplay(1)
      );
    }
    return this.excludedAccountsConfigCache$;
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

  syncGpsWithNavixy(userId: number): Observable<any> {
    return this.http.get(`${apiUrl}/clients/navixy-trackers/${userId}`);
  }

}

