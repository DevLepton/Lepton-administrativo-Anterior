import { Type } from "@angular/core";
import { EventsComponent } from "../admin/events/events.component";
import { UsersComponent } from "../admin/users/users.component";
import { ClientesComponent } from "../clientes/clientes.component";
import { CotizacionesComponent } from "../cotizaciones/cotizaciones.component";
import { CotizacionesForaneosComponent } from "../cotizaciones/cotizaciones-foraneos.component";
import { CotizacionesProductosComponent } from "../cotizaciones/cotizaciones-productos.component";
import { CotizacionesSugerenciasComponent } from "../cotizaciones/cotizaciones-sugerencias.component";
import { DashboardComponent } from "../dashboard/dashboard.component";
import { DispositivosComponent } from "../dispositivos/dispositivos.component";
import { ClientsComponent } from "../general/clients/clients.component";
import { AlmacenComponent } from "../inventario/almacen/almacen.component";
import { PedidosComponent } from "../pedidos/pedidos.component";
import { PlanesComponent } from "../planes/planes.component";
import { ServiciosComponent } from "../servicios/servicios.component";
import { PeticionesComponent } from "../soporte/peticiones/peticiones.component";
import { SubClientesComponent } from "../sub-clientes/sub-clientes.component";

export interface NavItem {
  RouteLink: string;
  icon: string;
  label: string;
  roles: string[];
  children?: NavItem[];
  component: Type<any>; // 🔥 clave
}

export const navbarData: NavItem[] = [
  {
    RouteLink: 'usuarios',
    icon: 'fal fa-users-cog',
    label: 'Usuarios',
    roles: ['admin'],
    component: UsersComponent
  },
  {
    RouteLink: 'peticiones',
    icon: 'fal fa-bell',
    label: 'Peticiones',
    roles: ['admin', 'inventario', 'soporte'],
    component: PeticionesComponent
  },
  {
    RouteLink: 'clientes',
    icon: 'fal fa-users',
    label: 'Clientes',
    roles: ['admin', 'inventario', 'soporte', 'finanzas', 'cx'],
    component: ClientsComponent
  },
  {
    RouteLink: 'almacen',
    icon: 'fal fa-dolly',
    label: 'Inventario',
    roles: ['admin', 'inventario', 'soporte'],
    component: AlmacenComponent,
  },
  // {
  //   RouteLink: 'dashboard',
  //   icon: 'fal fa-home',
  //   label: 'Dashboard',
  //   roles: ['finanzas'],
  //   component: DashboardComponent,
  // },
  // {
  //   RouteLink: 'clientes-finanzas',
  //   icon: 'fal fa-address-card',
  //   label: 'Clientes',
  //   roles: ['admin', 'finanzas'],
  // component: ClientesComponent,
  // },
  {
    RouteLink: 'clientes-cobranza',
    icon: 'fal fa-user-friends',
    label: 'Clientes cobranza',
    roles: ['admin', 'finanzas'],
    component: SubClientesComponent,
  },
  {
    RouteLink: 'cotizaciones',
    icon: 'fal fa-file-invoice-dollar',
    label: 'Cotizaciones',
    roles: ['admin', 'finanzas'],
    component: CotizacionesComponent,
    children: [
      {
        RouteLink: 'cotizaciones/productos',
        icon: 'fal fa-box-open',
        label: 'Productos',
        roles: ['admin', 'finanzas'],
        component: CotizacionesProductosComponent,
      },
      {
        RouteLink: 'cotizaciones/foraneos',
        icon: 'fal fa-user-hard-hat',
        label: 'Foráneos',
        roles: ['admin', 'finanzas'],
        component: CotizacionesForaneosComponent,
      },
      {
        RouteLink: 'cotizaciones/sugerencias',
        icon: 'fal fa-lightbulb',
        label: 'Sugerencias',
        roles: ['admin', 'finanzas'],
        component: CotizacionesSugerenciasComponent,
      },
    ]
  },
  // {
  //   RouteLink: 'pedidos',
  //   icon: 'fal fa-tags',
  //   label: 'Pedidos',
  //   roles: ['finanzas'],
  // component: PedidosComponent,
  // },
  // {
  //   RouteLink: 'servicios',
  //   icon: 'fal fa-truck',
  //   label: 'Servicios',
  //   roles: ['finanzas'],
  // component: ServiciosComponent,
  // },
  // {
  //   RouteLink: 'planes',
  //   icon: 'fal fa-receipt',
  //   label: 'Planes',
  //   roles: ['admin'],
  // component: PlanesComponent,
  // },
  // {
  //   RouteLink: 'dispositivos',
  //   icon: 'fal fa-desktop',
  //   label: 'Dispositivos',
  //   roles: ['admin'],
  // component: DispositivosComponent,
  // },
  {
    RouteLink: 'eventos',
    icon: 'fal fa-clipboard-list',
    label: 'Eventos',
    roles: ['admin', 'soporte', 'inventario'],
    component: EventsComponent,
  },
];
