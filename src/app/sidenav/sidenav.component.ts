import { Component, Output, EventEmitter, OnInit, HostListener } from '@angular/core';
import { navbarData, NavItem } from './nav-data';
import { transition, trigger, animate, style, keyframes } from '@angular/animations';
import { AuthService } from '../services/auth.service';
interface SideNavToggle {
  screenWidth: number;
  collapsed: boolean;
}

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.scss',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('350ms',
          style({ opacity: 1 })
        )
      ]),
      transition(':leave', [
        style({ opacity: 1 }),
        animate('350ms',
          style({ opacity: 0 })
        )
      ]),

    ]),
    trigger('rotate', [
      transition(':enter', [
        animate('1000ms',
          keyframes([
            style({ transform: 'rotate(0deg)', offset: '0' }),
            style({ transform: 'rotate(2turn)', offset: '1' })
          ])
        )
      ])
    ])

  ]

})
export class SidenavComponent implements OnInit {

  @Output() onToggleSidenav: EventEmitter<SideNavToggle> = new EventEmitter();
  collapsed = false;
  screenWidth = 0;
  navData: NavItem[] = [];

  constructor(private authService: AuthService) { }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.screenWidth = window.innerWidth;
    if (this.screenWidth <= 768) {
      this.collapsed = false;
      this.onToggleSidenav.emit({ collapsed: this.collapsed, screenWidth: this.screenWidth });
    }
  }
  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.screenWidth = window.innerWidth;
    }
    
    this.collapsed = true;
    this.onToggleSidenav.emit({ collapsed: true, screenWidth: this.screenWidth });

    const role = this.authService.getUserRole();
    this.navData = role
      ? navbarData
        .filter(item => item.roles.includes(role))
        .map(item => ({
          ...item,
          children: item.children?.filter(child => child.roles.includes(role))
        }))
      : [];

  }

  hasActiveChild(item: NavItem): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(item.children?.length && window.location.pathname.includes(item.RouteLink));
  }

  hasChildren(item: NavItem): boolean {
    return Boolean(item.children?.length);
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.onToggleSidenav.emit({ collapsed: this.collapsed, screenWidth: this.screenWidth });
  }
  closeSidenav(): void {
    this.collapsed = false;
    this.onToggleSidenav.emit({ collapsed: this.collapsed, screenWidth: this.screenWidth });
  }
}
