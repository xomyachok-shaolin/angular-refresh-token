import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order } from '../orders/order.model';
import { StorageService } from './storage.service';

interface OrderResponse {
  content: Order[];
  totalPages: number;
}

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private API_URL = 'http://localhost:8081/api/order';

  constructor(private http: HttpClient, private storageService: StorageService) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.storageService.getUser();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  getPaginatedUserOrders(uuid: string, page: number, sizePerPage: number, sortField: string, sortDirection: string): Observable<OrderResponse> {
    const params = new HttpParams()
    .set('uuid', uuid)
      .set('page', page)
      .set('sizePerPage', sizePerPage)
      .set('sortField', sortField)
      .set('sortDirection', sortDirection);

    return this.http.get<OrderResponse>(`${this.API_URL}/pagination/client`, {
      params,
      headers: this.getAuthHeaders()
    });
  }
}
