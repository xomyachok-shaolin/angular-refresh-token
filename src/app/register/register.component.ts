import { Component } from '@angular/core';
import { AuthService } from '../_services/auth.service';
import { NgForm } from '@angular/forms';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.less']
})
export class RegisterComponent {
  form: any = {
    email: null,
    password: null
  };
  isSuccessful = false;
  isSignUpFailed = false;
  errorMessage = '';
  showErrorNotification = false;

  constructor(private authService: AuthService) { }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return;  // Прерываем выполнение, если форма невалидна
    }
  
    const { email, password } = this.form;
  
    this.authService.register(email, password).subscribe({
      next: data => {
        console.log(data);
        this.isSuccessful = true;
        this.isSignUpFailed = false;
        this.showErrorNotification = false;
      },
      error: err => {
        this.errorMessage = err.error.message;
        this.isSignUpFailed = true;
        this.showErrorNotification = true;
      }
    });
  }
  

  onCloseNotification(): void {
    this.showErrorNotification = false;
  }
}
