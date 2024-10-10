import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../_services/auth.service';
import { NgForm } from '@angular/forms';
import { TuiAlertService } from '@taiga-ui/core';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.less'],
})
export class ResetPasswordComponent implements OnInit {
  form: any = {
    password: null,
    confirmPassword: null,
  };
  token: string = '';
  passwordsMatch: boolean = true;
  isSuccessful: boolean = false;
  errorMessage: string = '';
  showErrorNotification: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private alertService: TuiAlertService
  ) {}

  ngOnInit(): void {
    // Получаем токен из параметров запроса
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }

  onSubmit(form: NgForm): void {
    if (form.invalid || !this.checkPasswordsMatch()) {
      return; // Прерываем выполнение, если форма невалидна или пароли не совпадают
    }

    const { password } = this.form;

    this.authService.resetPassword(this.token, password).subscribe({
      next: (response: any) => {
        this.isSuccessful = true;
        this.alertService
          .open('Пароль успешно сброшен!', { status: 'success' })
          .subscribe();
        this.router.navigate(['/login']);
      },
      error: (error: any) => {
        this.errorMessage = error.error || 'Ошибка при сбросе пароля';
        this.showErrorNotification = true;
        this.alertService
          .open(this.errorMessage, { status: 'error' })
          .subscribe();
      },
    });
  }

  checkPasswordsMatch(): boolean {
    this.passwordsMatch = this.form.password === this.form.confirmPassword;
    return this.passwordsMatch;
  }

  onCloseNotification(): void {
    this.showErrorNotification = false;
  }
}
