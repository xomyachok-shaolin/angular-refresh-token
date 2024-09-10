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
  username?: string;

  eventBusSub?: Subscription;

  open = false;

  onClick(): void {
    setTimeout(() => {
      this.open = !this.open;
    }, 200);
  }

  openPersonalCabinet(): void {
    this.index2 = 2;
    this.open = true;
  }

  constructor(
    private storageService: StorageService,
    private authService: AuthService,
    private eventBusService: EventBusService,
    private router: Router,
    private alertService: TuiAlertService,
    private cdr: ChangeDetectorRef // Добавляем ChangeDetectorRef
  ) {
    this.router.events
      .pipe(
        filter(
          (event: Event): event is NavigationEnd =>
            event instanceof NavigationEnd
        )
      )
      .subscribe((event: NavigationEnd) => {
        this.isServicesRoute = event.urlAfterRedirects.includes('/services');

        if (event.urlAfterRedirects.includes('/personal-cabinet')) {
          this.index2 = 2;
          this.open = false;
        }

        this.open = false;
        this.cdr.detectChanges(); // Обновляем состояние после маршрутизации
      });
  }

  ngOnInit(): void {
    this.checkLoginState(); // Обновляем состояние при запуске приложения

    this.eventBusSub = this.eventBusService.on('logout', () => {
      this.logout();
    });

    // Подписываемся на событие входа, чтобы обновить состояние после логина
    this.eventBusService.on('login', () => {
      this.checkLoginState();
      this.cdr.detectChanges();
    });
  }

  // Метод для обновления состояния вкладок
  checkLoginState(): void {
    this.isLoggedIn = this.storageService.isLoggedIn();
    if (this.isLoggedIn) {
      const user = this.storageService.getUser();
      this.roles = user.roles;

      this.showAdminBoard = this.roles.includes('ROLE_ADMIN');
      this.showModeratorBoard = this.roles.includes('ROLE_MODERATOR');

      this.username = user.username;
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: (res) => {
        console.log(res);
  
        // Очищаем данные сессии
        this.storageService.clean();
        this.isLoggedIn = false;  // Явно устанавливаем флаг авторизации
  
        // Редирект на страницу авторизации после выхода
        this.router.navigate(['/login']).then(() => {
          this.alertService
            .open('Вы успешно вышли из системы.', { status: 'success' })
            .subscribe();
        });
      },
      error: (err) => {
        console.log(err);
      },
    });
  }  
}
