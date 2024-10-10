import { ChangeDetectorRef, Component } from '@angular/core';
import { Subscription, filter } from 'rxjs';
import { StorageService } from './_services/storage.service';
import { AuthService } from './_services/auth.service';
import { EventBusService } from './_shared/event-bus.service';
import { FormControl, FormGroup } from '@angular/forms';
import { NavigationEnd, Router, Event } from '@angular/router';
import { TuiAlertService } from '@taiga-ui/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
})
export class AppComponent {
  isServicesRoute: boolean = false;

  private roles: string[] = [];

  readonly searchForm = new FormGroup({
    searchValue: new FormControl(null),
  });

  index1 = -1;
  index2 = 0;
  isLoggedIn = false;
  showAdminBoard = false;
  showModeratorBoard = false;
  email?: string;

  eventBusSub?: Subscription;
  dropdownOpen = false;

  constructor(
    private readonly storageService: StorageService,
    private readonly authService: AuthService,
    private readonly eventBusService: EventBusService,
    private readonly router: Router,
    private readonly alertService: TuiAlertService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.router.events
      .pipe(filter((event: Event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.isServicesRoute = event.urlAfterRedirects.includes('/services');

        if (event.urlAfterRedirects.includes('/cart')) {
          this.index2 = 0; // Shopping Cart Icon
        } else if (event.urlAfterRedirects.includes('/personal-cabinet/notifications')) {
          this.index2 = 1; // Bell Icon
        } else if (
          event.urlAfterRedirects.includes('/personal-cabinet') ||
          event.urlAfterRedirects.includes('/orders')
        ) {
          this.index2 = 2; // User Icon
        } else {
          this.index2 = -1; // No active tab
        }

        this.dropdownOpen = false;
        this.cdr.detectChanges();
      });
  }

  ngOnInit(): void {
    this.checkLoginState();

    this.eventBusSub = this.eventBusService.on('logout', () => {
      this.logout();
    });

    this.eventBusService.on('login', () => {
      this.checkLoginState();
      this.cdr.detectChanges();
    });
  }

  toggleDropdown(open: boolean): void {
    this.dropdownOpen = open;
    this.cdr.detectChanges();
  }

  checkLoginState(): void {
    this.isLoggedIn = this.storageService.isLoggedIn();
    if (this.isLoggedIn) {
      const user = this.storageService.getUser();
      this.roles = user.roles;
      this.showAdminBoard = this.roles.includes('ROLE_ADMIN');
      this.showModeratorBoard = this.roles.includes('ROLE_MODERATOR');
      this.email = user.email;
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: (res) => {
        this.storageService.clean();
        this.isLoggedIn = false;
        this.router.navigate(['/login'])
          this.alertService.open('Вы успешно вышли из системы.', { status: 'success' }).subscribe();
        
      },
      error: (err) => {
        console.error(err);
      },
    });
  }
}
