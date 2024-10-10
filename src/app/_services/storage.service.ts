import { Injectable } from '@angular/core';

const USER_KEY = 'auth-user';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  constructor() {}

  clean(): void {
    window.localStorage.removeItem(USER_KEY);
    window.sessionStorage.removeItem(USER_KEY);
  }

  public saveUser(user: any, isRemember: boolean): void {
    this.clean();
    const storage = isRemember ? window.localStorage : window.sessionStorage;
    storage.setItem(USER_KEY, JSON.stringify(user));
  }

  public getUser(): any {
    let user = window.localStorage.getItem(USER_KEY);
    if (!user) {
      user = window.sessionStorage.getItem(USER_KEY);
    }
    if (user) {
      return JSON.parse(user);
    }
    return null;
  }

  public isLoggedIn(): boolean {
    return !!this.getUser();
  }
}
