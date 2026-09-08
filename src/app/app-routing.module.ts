import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { AuthGuard } from './auth/auth.guard';
import { NoAuthGuard } from './auth/no-auth.guard';
import { RoleGuard } from './auth/role.guard';
import { AccesoDenegadoComponent } from './acceso-denegado/acceso-denegado.component';
import { InicioRedireccionComponent } from './inicio-redireccion/inicio-redireccion.component';
import { navbarData } from './sidenav/nav-data';
import { UserProfileComponent } from './general/user-profile/user-profile.component';
import { SystemSettingsComponent } from './general/system-settings/system-settings.component';

const dynamicRoutes = navbarData.flatMap(item => [item, ...(item.children ?? [])]).map(item => ({
  path: item.RouteLink,
  component: item.component,
  canActivate: [RoleGuard],
  data: { roles: item.roles }
}));

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
        path: 'perfil',
        component: UserProfileComponent,
        canActivate: [RoleGuard],
        data: { roles: ['admin', 'inventario', 'soporte', 'finanzas', 'cx'] }
      },
      {
        path: 'configuracion',
        component: SystemSettingsComponent,
        canActivate: [RoleGuard],
        data: { roles: ['admin', 'inventario', 'soporte', 'finanzas', 'cx'] }
      },

      ...dynamicRoutes,
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
