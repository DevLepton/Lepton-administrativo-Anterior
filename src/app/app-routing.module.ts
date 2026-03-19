import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ClientesComponent } from './clientes/clientes.component';
import { ServiciosComponent } from './servicios/servicios.component';
import { PlanesComponent } from './planes/planes.component';
import { DispositivosComponent } from './dispositivos/dispositivos.component';
import { PedidosComponent } from './pedidos/pedidos.component';

import { LoginComponent } from './login/login.component';
import { AuthGuard } from './auth/auth.guard';
import { NoAuthGuard } from './auth/no-auth.guard';
import { RoleGuard } from './auth/role.guard';
import { AccesoDenegadoComponent } from './acceso-denegado/acceso-denegado.component';
import { InicioRedireccionComponent } from './inicio-redireccion/inicio-redireccion.component';
import { UsersComponent } from './admin/users/users.component';
import { AlmacenComponent } from './inventario/almacen/almacen.component';
import { EventsComponent } from './admin/events/events.component';
import { PeticionesComponent } from './soporte/peticiones/peticiones.component';

const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [NoAuthGuard]
  },
  {
    path: '',
    canActivate: [AuthGuard],
    children: [
      {
        path: 'usuarios',
        component: UsersComponent,
        canActivate: [RoleGuard],
        data: { roles: ['admin'] }
      },
      {
        path: 'peticiones',
        component: PeticionesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['inventario', 'soporte'] }
      },
      {
        path: 'eventos',
        component: EventsComponent,
        canActivate: [RoleGuard],
        data: { roles: ['admin', 'inventario', 'soporte'] }
      },
      {
        path: 'almacen',
        component: AlmacenComponent,
        canActivate: [RoleGuard],
        data: { roles: ['inventario', 'soporte'] }
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [RoleGuard],
        data: { roles: ['finanzas'] }
      },
      {
        path: 'clientes',
        component: ClientesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['finanzas'] }
      },
      {
        path: 'servicios',
        component: ServiciosComponent,
        canActivate: [RoleGuard],
        data: { roles: ['finanzas'] }
      },
      {
        path: 'planes',
        component: PlanesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['finanzas'] }
      },
      {
        path: 'dispositivos',
        component: DispositivosComponent,
        canActivate: [RoleGuard],
        data: { roles: ['finanzas'] }
      },
      {
        path: 'pedidos',
        component: PedidosComponent,
        canActivate: [RoleGuard],
        data: { roles: ['finanzas'] }
      },
      { path: '', component: InicioRedireccionComponent }
    ]
  },
  {
    path: 'acceso-denegado',
    component: AccesoDenegadoComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];


@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
