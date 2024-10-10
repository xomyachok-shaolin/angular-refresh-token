import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

const AUTH_API = '/api/auth/';

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
  // withCredential: true
};

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post(
      AUTH_API + 'signin',
      {
        email,
        password,
      },
      httpOptions
    );
  }

  register(email: string, password: string): Observable<any> {
    return this.http.post(
      AUTH_API + 'signup',
      {
        email,
        password,
      },
      httpOptions
    );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(AUTH_API + 'forgot-password', { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(AUTH_API + 'reset-password', { token, password });
  }

  logout(): Observable<any> {
    return this.http.post(AUTH_API + 'signout', { }, httpOptions);
  }

  refreshToken() {
    return this.http.post(AUTH_API + 'refreshtoken', { }, httpOptions);
  }
}
