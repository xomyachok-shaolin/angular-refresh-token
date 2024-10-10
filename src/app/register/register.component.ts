import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { AuthService } from '../_services/auth.service';
import { NgForm, NgModel } from '@angular/forms';
import { TuiAlertService } from '@taiga-ui/core';
import { Router } from '@angular/router';

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

  @ViewChild('password') passwordControl!: NgModel;
  @ViewChild('confirmPassword') confirmPasswordControl!: NgModel;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private alertService: TuiAlertService
  ) {}

  checkPasswordsMatch(): boolean {
    this.passwordsMatch =
      this.form.password === this.form.confirmPassword;
    return this.passwordsMatch;
  }

  onSubmit(form: NgForm): void {
    if (form.invalid || !this.checkPasswordsMatch()) {
      return; // Прерываем выполнение, если форма невалидна
    }

    const { email, password } = this.form;

    this.authService.register(email, password).subscribe({
      next: (data) => {
        console.log(data);
        this.alertService
          .open('Вы успешно зарегистрировались!', { status: 'success' })
          .subscribe();
          this.router.navigate(['/login']);
        // this.isSuccessful = true;
        // this.isSignUpFailed = false;
        // this.showErrorNotification = false;
      },
      error: (err) => {
        this.errorMessage = err.error;
        this.alertService
          .open(this.errorMessage, { status: 'error' })
          .subscribe();
        // this.isSignUpFailed = true;
        // this.showErrorNotification = true;
      },
    });
  }

  onCloseNotification(): void {
    this.showErrorNotification = false;
  }
}
