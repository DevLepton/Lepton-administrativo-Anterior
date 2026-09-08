import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { navbarData, NavItem } from '../../sidenav/nav-data';

interface SectionVersion {
  name: string;
  route: string;
  version: string;
  type: 'Sistema' | 'Sección' | 'Subsección';
}

const SYSTEM_VERSION = '2.0.2';

@Component({
  selector: 'app-system-settings',
  templateUrl: './system-settings.component.html',
  styleUrl: './system-settings.component.scss'
})
export class SystemSettingsComponent {
  readonly systemVersion = SYSTEM_VERSION;
  readonly sectionVersionMap: Record<string, string> = {
    '/configuracion': '1.0.0',
    '/perfil': '1.0.0',
    '/usuarios': '1.0.0',
    '/peticiones': '1.3.2',
    '/clientes': '9.3.1',
    '/inventario': '1.5.0',
    '/clientes-cobranza': '1.0.0',
    '/cotizaciones': '1.0.1',
    '/cotizaciones/productos': '1.1.1',
    '/cotizaciones/foraneos': '1.0.0',
    '/cotizaciones/sugerencias': '1.0.0',
    '/eventos': '1.0.1'
  };

  readonly sectionVersions: SectionVersion[] = [
    {
      name: 'Configuración',
      route: '/configuracion',
      version: this.getSectionVersion('/configuracion'),
      type: 'Sistema'
    },
    {
      name: 'Perfil',
      route: '/perfil',
      version: this.getSectionVersion('/perfil'),
      type: 'Sistema'
    },
    ...this.getNavbarSections(navbarData)
  ];

  constructor(private router: Router) { }

  closeSettings(): void {
    this.router.navigate(['/'], { replaceUrl: true });
  }

  private getNavbarSections(items: NavItem[], parentName?: string): SectionVersion[] {
    return items.flatMap((item) => {
      const route = `/${item.RouteLink}`;
      const currentSection: SectionVersion = {
        name: parentName ? `${parentName} / ${item.label}` : item.label,
        route,
        version: this.getSectionVersion(route),
        type: parentName ? 'Subsección' : 'Sección'
      };

      return [
        currentSection,
        ...this.getNavbarSections(item.children ?? [], item.label)
      ];
    });
  }

  private getSectionVersion(route: string): string {
    return this.sectionVersionMap[route] ?? SYSTEM_VERSION;
  }
}
