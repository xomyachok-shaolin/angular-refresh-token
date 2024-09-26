import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AuthService } from '../_services/auth.service';
import { StorageService } from '../_services/storage.service';
import { Router } from '@angular/router'; // Добавляем Router
import { EventBusService } from '../_shared/event-bus.service';
import { NgForm } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.less'],
})
export class LoginComponent implements OnInit {
  form: any = {
    username: null,
    password: null,
    isRemember: true,
  };
  isLoggedIn = false;
  isLoginFailed = false;
  errorMessage = '';
  roles: string[] = [];
  showErrorNotification = false;

  constructor(
    private authService: AuthService,
    private storageService: StorageService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private eventBusService: EventBusService
  ) {}

  ngOnInit(): void {
    if (this.storageService.isLoggedIn()) {
      this.isLoggedIn = true;
      this.roles = this.storageService.getUser().roles;
    }
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return;  // Прерываем выполнение, если форма невалидна
    }
  
    const { username, password } = this.form;
  
    this.authService.login(username, password).subscribe({
      next: (data) => {
        this.storageService.saveUser(data);
        this.isLoginFailed = false;
        this.isLoggedIn = true;
        this.roles = this.storageService.getUser().roles;
        
        // Уведомляем приложение о входе
        this.eventBusService.emit({ name: 'login', value: { user: this.storageService.getUser() } });
  
        // Перенаправление в личный кабинет
        this.router.navigate(['/personal-cabinet'], { replaceUrl: true }).then(() => {
          window.location.reload();
          this.cdr.detectChanges(); // Обновление после перехода на другую страницу
          });
      },
      error: (err) => {
        this.errorMessage = err.error.message || 'Ошибка при входе';
        this.isLoginFailed = true;
        this.showErrorNotification = true;
      },
    });
  }
  

  onCloseNotification(): void {
    this.showErrorNotification = false;
  }
}
