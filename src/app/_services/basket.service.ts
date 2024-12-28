import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class BasketService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.storageService.getUser();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  getBasket(): Observable<any> {  
    return this.http.get(`/api/basket/my_basket`, {
      headers: this.getAuthHeaders(),
    });
  }

  deleteService(uuid: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.delete(`/api/basket/remove_service`, {
      headers,
      params: new HttpParams().set('serviceUuid', uuid),
      responseType: 'text',
    });
  }
}
