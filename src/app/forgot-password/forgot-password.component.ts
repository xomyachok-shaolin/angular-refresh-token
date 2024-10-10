import { Component } from '@angular/core';
import { AuthService } from '../_services/auth.service';
import { NgForm } from '@angular/forms';
import { TuiAlertService } from '@taiga-ui/core';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.less'],
})
export class ForgotPasswordComponent {
  form: any = {
    email: null,
  };
  showSuccessNotification = false;
  showErrorNotification = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private alertService: TuiAlertService
  ) {}

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return; // Прерываем выполнение, если форма невалидна
    }

    const { email } = this.form;

    this.authService.forgotPassword(email).subscribe({
      next: (response) => {
        this.showSuccessNotification = true;
        this.showErrorNotification = false;
      },
      error: (error) => {
        this.errorMessage = error.error || 'Ошибка при отправке письма для сброса пароля';
        this.showErrorNotification = true;
        this.showSuccessNotification = false;
      },
    });
  }

  onCloseNotification(): void {
    this.showSuccessNotification = false;
    this.showErrorNotification = false;
  }
}
