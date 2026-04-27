import { APP_INITIALIZER, LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BodyComponent } from './body/body.component';
import { SidenavComponent } from './sidenav/sidenav.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ClientesComponent } from './clientes/clientes.component';
import { PlanesComponent } from './planes/planes.component';
import { DispositivosComponent } from './dispositivos/dispositivos.component';
import { ServiciosComponent } from './servicios/servicios.component';
import { LoginComponent } from './login/login.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { HeaderComponent } from './header/header.component';
import { OverlayModule } from '@angular/cdk/overlay';
import { CdkMenuModule } from '@angular/cdk/menu';
import { FormsModule } from '@angular/forms';
import { provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { NgToastModule } from 'ng-angular-popup';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { RegisterPlanModalComponent } from './planes/actions/register-plan-modal/register-plan-modal.component';
import { RegisterServiciosModalComponent } from './servicios/actions/register-servicios-modal/register-servicios-modal.component';
import { RegisterDispositivosModalComponent } from './dispositivos/actions/register-dispositivos-modal/register-dispositivos-modal.component';
import { RegisterClientesModalComponent } from './clientes/actions/register-clientes-modal/register-clientes-modal.component';
import { RegisterPedidosModalComponent } from './dashboard/actions/register-pedidos-modal/register-pedidos-modal.component';
import { EditDispositivosModalComponent } from './dispositivos/actions/edit-dispositivos-modal/edit-dispositivos-modal.component';
import { EditServiciosModalComponent } from './servicios/actions/edit-servicios-modal/edit-servicios-modal.component';
import { EditClientesModalComponent } from './clientes/actions/edit-clientes-modal/edit-clientes-modal.component';
import { EditPlanModalComponent } from './planes/actions/edit-plan-modal/edit-plan-modal.component';
import { PedidosComponent } from './pedidos/pedidos.component';
import { AsignarPedidosModalComponent } from './dashboard/actions/asignar-pedidos-modal/asignar-pedidos-modal.component';
import { AddDispositivosModalComponent } from './dashboard/actions/asignar-pedidos-modal/add-dispositivos-modal/add-dispositivos-modal.component';
import { TokenInterceptor } from './auth/token.interceptor';
import { AccesoDenegadoComponent } from './acceso-denegado/acceso-denegado.component';
import { InicioRedireccionComponent } from './inicio-redireccion/inicio-redireccion.component';
import { RegisterUserModalComponent } from './modals/register-user-modal/register-user-modal.component';
import { EditUserModalComponent } from './modals/edit-user-modal/edit-user-modal.component';
import { MatDivider } from "@angular/material/divider";
import { MatProgressBar } from "@angular/material/progress-bar";
import { AlmacenComponent } from './inventario/almacen/almacen.component';
import { UsersComponent } from './admin/users/users.component';
import { ConfirmDeleteUserModalComponent } from './modals/confirm-delete-user-modal/confirm-delete-user-modal.component';
import { NewSimModalComponent } from './modals/new-sim-modal/new-sim-modal.component';
import { ViewSimModalComponent } from './modals/view-sim-modal/view-sim-modal.component';
import { registerLocaleData } from '@angular/common';
import es from '@angular/common/locales/es';
import { EditSimModalComponent } from './modals/edit-sim-modal/edit-sim-modal.component';
import { EventsComponent } from './admin/events/events.component';
import { EventDetailsModalComponent } from './modals/event-details-modal/event-details-modal.component';
import { EventHistoryModalComponent } from './modals/event-history-modal/event-history-modal.component';
import { NewGpsModalComponent } from './modals/new-gps-modal/new-gps-modal.component';
import { ViewGpsModalComponent } from './modals/view-gps-modal/view-gps-modal.component';
import { EditGpsModalComponent } from './modals/edit-gps-modal/edit-gps-modal.component';
import { NewAccessoryModalComponent } from './modals/new-accessory-modal/new-accessory-modal.component';
import { ViewAccessoryModalComponent } from './modals/view-accessory-modal/view-accessory-modal.component';
import { EditAccessoryModalComponent } from './modals/edit-accessory-modal/edit-accessory-modal.component';
import { GpsTabComponent } from './inventario/almacen/gps-tab/gps-tab.component';
import { SimsTabComponent } from './inventario/almacen/sims-tab/sims-tab.component';
import { AccessoriesTabComponent } from './inventario/almacen/accessories-tab/accessories-tab.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { getSpanishPaginatorIntl } from './utils/mat-paginator-es';
import { PeticionesComponent } from './soporte/peticiones/peticiones.component';
import { NewRequestModalComponent } from './modals/new-request-modal/new-request-modal.component';
import { EditRequestModalComponent } from './modals/edit-request-modal/edit-request-modal.component';
import { ClientsComponent } from './general/clients/clients.component';
import { MatTableModule } from '@angular/material/table';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ConfirmModalComponent } from './services/confirm-modal/confirm-modal.component';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserProfileComponent } from './general/user-profile/user-profile.component';
import { A11yModule } from "@angular/cdk/a11y";
import { AuthService } from './services/auth.service';

registerLocaleData(es);

export function initAuth(authService: AuthService) {
  return () => {
    if (authService.isLoggedIn()) {
      return authService.loadUserRole();
    }
    return Promise.resolve();
  };
}

@NgModule({
  declarations: [
    AppComponent,
    BodyComponent,
    SidenavComponent,
    DashboardComponent,
    ClientesComponent,
    LoginComponent,
    PlanesComponent,
    DispositivosComponent,
    ServiciosComponent,
    HeaderComponent,
    RegisterPlanModalComponent,
    RegisterServiciosModalComponent,
    RegisterDispositivosModalComponent,
    RegisterClientesModalComponent,
    RegisterPedidosModalComponent,

    EditDispositivosModalComponent,
    EditServiciosModalComponent,
    EditClientesModalComponent,
    EditPlanModalComponent,
    PedidosComponent,
    AsignarPedidosModalComponent,
    AddDispositivosModalComponent,
    UsersComponent,
    AccesoDenegadoComponent,
    InicioRedireccionComponent,
    RegisterUserModalComponent,
    EditUserModalComponent,
    AlmacenComponent,
    ConfirmDeleteUserModalComponent,
    NewSimModalComponent,
    ViewSimModalComponent,
    EditSimModalComponent,
    EventsComponent,
    EventDetailsModalComponent,
    EventHistoryModalComponent,
    NewGpsModalComponent,
    ViewGpsModalComponent,
    EditGpsModalComponent,
    NewAccessoryModalComponent,
    ViewAccessoryModalComponent,
    EditAccessoryModalComponent,
    GpsTabComponent,
    SimsTabComponent,
    AccessoriesTabComponent,
    PeticionesComponent,
    NewRequestModalComponent,
    EditRequestModalComponent,
    ClientsComponent,
    ConfirmModalComponent,
    UserProfileComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    ReactiveFormsModule,
    OverlayModule,
    CdkMenuModule,
    FormsModule,
    NgToastModule,
    MatSliderModule,
    MatInputModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatStepperModule,
    MatTabsModule,
    MatAutocompleteModule,
    MatMenuModule,
    MatDivider,
    MatProgressBar,
    MatTooltipModule,
    MatSlideToggleModule,
    MatPaginatorModule,
    MatTableModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    A11yModule
  ],
  providers: [
    provideClientHydration(),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
    { provide: LOCALE_ID, useValue: 'es' },          // 👈 DatePipe y pipes en español
    { provide: MAT_DATE_LOCALE, useValue: 'es-MX' },
    { provide: MatPaginatorIntl, useFactory: getSpanishPaginatorIntl },
    { provide: APP_INITIALIZER, useFactory: initAuth, deps: [AuthService], multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
