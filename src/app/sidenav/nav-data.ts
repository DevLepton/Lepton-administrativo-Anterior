export interface NavItem {
  RouteLink: string;
  icon: string;
  label: string;
  roles: string[];
}

export const navbarData: NavItem[] = [
  {
    RouteLink: 'usuarios',
    icon: 'fal fa-users-cog',
    label: 'Usuarios',
    roles: ['admin']
  },
  {
    RouteLink: 'peticiones',
    icon: 'fal fa-bell',
    label: 'Peticiones',
    roles: ['admin', 'inventario', 'soporte']
  },
  {
    RouteLink: 'clientes',
    icon: 'fal fa-users',
    label: 'Clientes',
    roles: ['admin', 'inventario', 'soporte', 'finanzas']
  },
  {
    RouteLink: 'almacen',
    icon: 'fal fa-dolly',
    label: 'Inventario',
    roles: ['admin', 'inventario', 'soporte']
  },
  // {
  //   RouteLink: 'dashboard',
  //   icon: 'fal fa-home',
  //   label: 'Dashboard',
  //   roles: ['finanzas']
  // },
  // {
  //   RouteLink: 'clientes-finanzas',
  //   icon: 'fal fa-address-card',
  //   label: 'Clientes',
  //   roles: ['finanzas']
  // },
  // {
  //   RouteLink: 'pedidos',
  //   icon: 'fal fa-tags',
  //   label: 'Pedidos',
  //   roles: ['finanzas']
  // },
  // {
  //   RouteLink: 'servicios',
  //   icon: 'fal fa-truck',
  //   label: 'Servicios',
  //   roles: ['finanzas']
  // },
  // {
  //   RouteLink: 'planes',
  //   icon: 'fal fa-receipt',
  //   label: 'Planes',
  //   roles: ['finanzas']
  // },
  // {
  //   RouteLink: 'dispositivos',
  //   icon: 'fal fa-desktop',
  //   label: 'Dispositivos',
  //   roles: ['finanzas']
  // },
  {
    RouteLink: 'eventos',
    icon: 'fal fa-clipboard-list',
    label: 'Eventos',
    roles: ['admin', 'soporte']
  },
];
