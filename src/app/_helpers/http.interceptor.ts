import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HTTP_INTERCEPTORS, HttpErrorResponse } from '@angular/common/http';

import { StorageService } from '../_services/storage.service';
import { AuthService } from '../_services/auth.service';

import { Observable, throwError } from 'rxjs';
import { catchError, switchMap, timeout } from 'rxjs/operators';

import { EventData } from '../_shared/event.class';
import { EventBusService } from '../_shared/event-bus.service';
import { Router } from '@angular/router';
import { TuiAlertService } from '@taiga-ui/core';

@Injectable()
export class HttpRequestInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private readonly TIMEOUT = 0; 

  constructor(
    private storageService: StorageService,
    private authService: AuthService,
    private eventBusService: EventBusService,
    private router: Router,
    private alertService: TuiAlertService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    req = req.clone({
      // withCredentials: true,
    });


    return next.handle(req).pipe(
      timeout(this.TIMEOUT),
      catchError((error) => {
        if (
          error instanceof HttpErrorResponse &&
          !req.url.includes('auth/signin') &&
          error.status === 401
        ) {
          return this.handle401Error(req, next);
        }

        if (error.name === 'TimeoutError') {
          // Handle timeout errors
          console.error('Request timed out.');
          this.alertService.open('Истекло время запроса. Пожалуйста, повторите попытку позже.', { status: 'error' }).subscribe();
        }

        return throwError(() => error);
      })
    );
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
    if (!this.isRefreshing) {
      this.isRefreshing = true;

      if (this.storageService.isLoggedIn()) {
        return this.authService.refreshToken().pipe(
          switchMap(() => {
            this.isRefreshing = false;
            return next.handle(request);
          }),
          catchError((error) => {
            this.isRefreshing = false;

            if (error.status == 403  || error.status === 401 || error.status === 400) {
              this.eventBusService.emit(new EventData('logout', null));
              this.redirectToLogin()
            }

            return throwError(() => error);
          })
        );
      } else {
        this.redirectToLogin();
      }
    }

    return next.handle(request);
  }

  private redirectToLogin(): void {
    this.storageService.clean(); 
    this.router.navigate(['/login'], { replaceUrl: true }).then(() => {
      window.location.reload();
    });
  }
}

export const httpInterceptorProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: HttpRequestInterceptor, multi: true },
];