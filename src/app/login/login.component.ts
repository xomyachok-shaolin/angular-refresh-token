import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { AuthService } from '../_services/auth.service';
import { StorageService } from '../_services/storage.service';
import { Router } from '@angular/router';
import { EventBusService } from '../_shared/event-bus.service';
import { NgForm } from '@angular/forms';
import {
  TuiAlertService,
} from '@taiga-ui/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.less'],
})
export class LoginComponent implements OnInit {
  form: any = {
    email: null,
    password: null,
    isRemember: true,
  };
  isLoggedIn = false;
  isLoginFailed = false;
  errorMessage = '';
  roles: string[] = [];
  showErrorNotification = false;

  @Input() isDialog: boolean = false;
  @Output() loginSuccess = new EventEmitter<void>();
  @Output() registrationRequested = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  constructor(
    private authService: AuthService,
    private storageService: StorageService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private eventBusService: EventBusService,
    private alertService: TuiAlertService
  ) {}

  ngOnInit(): void {
    if (this.storageService.isLoggedIn()) {
      this.isLoggedIn = true;
      this.roles = this.storageService.getUser().roles;
    }
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return; // Прерываем выполнение, если форма невалидна
    }

    const { email, password, isRemember } = this.form;

    this.authService.login(email, password).subscribe({
      next: (data) => {
        this.storageService.saveUser(data, isRemember);
        this.isLoginFailed = false;
        this.isLoggedIn = true;
        this.roles = this.storageService.getUser().roles;

        // Notify application about login
        this.eventBusService.emit({
          name: 'login',
          value: { user: this.storageService.getUser() },
        });

        if (this.isDialog) {
          // When opened from ServicesComponent, emit success event
          this.loginSuccess.emit();
        } else {
          // Not opened as a dialog, proceed as normal
          this.router.navigate(['/personal-cabinet']);
        }
      },
      error: (err) => {
        this.errorMessage = err.error || 'Ошибка при входе';
        this.alertService
          .open(this.errorMessage, { status: 'error' })
          .subscribe();
      },
    });
  }

  navigateToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }

  onRegistrationRequest(): void {
    if (this.isDialog)
      this.registrationRequested.emit();
    else 

    this.router.navigate(['/register']);
  }

  onCloseNotification(): void {
    this.showErrorNotification = false;
  }

  onClose(): void {
    this.close.emit();
  }
}
