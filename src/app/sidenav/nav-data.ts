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
    RouteLink: 'almacen',
    icon: 'fal fa-dolly',
    label: 'Inventario',
    roles: ['inventario']
  },

  {
    RouteLink: 'dashboard',
    icon: 'fal fa-home',
    label: 'Dashboard',
    roles: ['finanzas']
  },
  {
    RouteLink: 'clientes',
    icon: 'fal fa-address-card',
    label: 'Clientes',
    roles: ['finanzas']
  },
  {
    RouteLink: 'pedidos',
    icon: 'fal fa-tags',
    label: 'Pedidos',
    roles: ['finanzas']
  },
  {
    RouteLink: 'servicios',
    icon: 'fal fa-truck',
    label: 'Servicios',
    roles: ['finanzas']
  },
  {
    RouteLink: 'planes',
    icon: 'fal fa-receipt',
    label: 'Planes',
    roles: ['finanzas']
  },
  {
    RouteLink: 'dispositivos',
    icon: 'fal fa-desktop',
    label: 'Dispositivos',
    roles: ['finanzas']
  },
];
