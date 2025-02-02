import { ChangeDetectorRef, Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { AuthService } from '../_services/auth.service';
import { NgForm, NgModel } from '@angular/forms';
import { TuiAlertService } from '@taiga-ui/core';
import { Router } from '@angular/router';
import { StorageService } from '../_services/storage.service';
import { EventBusService } from '../_shared/event-bus.service';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.less'],
})
export class RegisterComponent {
  form: any = {
    email: null,
    password: null,
    confirmPassword: null,
  };
  isSuccessful = false;
  isSignUpFailed = false;
  errorMessage = '';
  showErrorNotification = false;
  passwordsMatch = true;
  isLoggedIn = false; 
  roles: string[] = []; 

  @ViewChild('password') passwordControl!: NgModel;
  @ViewChild('confirmPassword') confirmPasswordControl!: NgModel;

  @Input() isDialog: boolean = false;
  @Output() loginSuccess = new EventEmitter<void>(); // Оповещение родителя о успешном входе
  @Output() close = new EventEmitter<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private alertService: TuiAlertService,
    private storageService: StorageService, 
    private eventBusService: EventBusService 
  ) {}

  checkPasswordsMatch(): boolean {
    this.passwordsMatch =
      this.form.password === this.form.confirmPassword;
    return this.passwordsMatch;
  }

  onSubmit(form: NgForm): void {
    if (form.invalid || !this.checkPasswordsMatch()) {
      return; 
    }

    const { email, password } = this.form;

    this.authService
      .register(email, password)
      .pipe(
        switchMap(() => this.authService.login(email, password)) // После регистрации выполняем вход
      )
      .subscribe({
        next: (data) => {
          this.storageService.saveUser(data, true); // Сохраняем данные пользователя
          this.isLoggedIn = true;
          this.roles = this.storageService.getUser().roles;

          // Уведомляем приложение о входе
          this.eventBusService.emit({
            name: 'login',
            value: { user: this.storageService.getUser() },
          });

          this.alertService
            .open('Вы успешно зарегистрировались и вошли в систему!', { status: 'success' })
            .subscribe();

            if (this.isDialog) {
              // When opened from ServicesComponent, emit success event
              this.loginSuccess.emit();
            } else {
              // Not opened as a dialog, proceed as normal
              this.router.navigate(['/personal-cabinet']);
            }
        },
        error: (err) => {
          this.errorMessage = err.error || 'Ошибка при регистрации или входе';
          this.alertService
            .open(this.errorMessage, { status: 'error' })
            .subscribe();
        },
      });
  }

  onCloseNotification(): void {
    this.showErrorNotification = false;
  }

  onClose(): void {
    this.close.emit();
  }
}
