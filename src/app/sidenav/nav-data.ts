import { Type } from "@angular/core";
import { EventsComponent } from "../admin/events/events.component";
import { UsersComponent } from "../admin/users/users.component";
import { ClientesComponent } from "../clientes/clientes.component";
import { DashboardComponent } from "../dashboard/dashboard.component";
import { DispositivosComponent } from "../dispositivos/dispositivos.component";
import { ClientsComponent } from "../general/clients/clients.component";
import { AlmacenComponent } from "../inventario/almacen/almacen.component";
import { PedidosComponent } from "../pedidos/pedidos.component";
import { PlanesComponent } from "../planes/planes.component";
import { ServiciosComponent } from "../servicios/servicios.component";
import { PeticionesComponent } from "../soporte/peticiones/peticiones.component";

export interface NavItem {
  RouteLink: string;
  icon: string;
  label: string;
  roles: string[];
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
    roles: ['admin', 'inventario', 'soporte', 'finanzas'],
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
  //   roles: ['finanzas'],
  // component: ClientesComponent,
  // },
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
  //   roles: ['finanzas'],
  // component: PlanesComponent,
  // },
  // {
  //   RouteLink: 'dispositivos',
  //   icon: 'fal fa-desktop',
  //   label: 'Dispositivos',
  //   roles: ['finanzas'],
  // component: DispositivosComponent,
  // },
  {
    RouteLink: 'eventos',
    icon: 'fal fa-clipboard-list',
    label: 'Eventos',
    roles: ['admin', 'soporte'],
    component: EventsComponent,
  },
];
