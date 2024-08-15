import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order } from '../orders/order.model';
import { StorageService } from './storage.service';

interface OrderResponse {
  content: Order[];
  totalPages: number;
}

const API_URL = 'http://192.168.70.220:8888/api/order';

@Injectable({
  providedIn: 'root',
})
export class OrderService {

  constructor(private http: HttpClient, private storageService: StorageService) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.storageService.getUser();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    });
  }

  getPaginatedUserOrders(uuid: string, page: number, sizePerPage: number, sortField: string, sortDirection: string): Observable<OrderResponse> {
    const params = new HttpParams()
    .set('uuid', uuid)
      .set('page', page)
      .set('sizePerPage', sizePerPage)
      .set('sortField', sortField)
      .set('sortDirection', sortDirection);

    return this.http.get<OrderResponse>('/api/api/order/pagination/client', {
      params,
      headers: this.getAuthHeaders(),
      // withCredentials: true,
    });
  }

  getPaginatedArchivedUserOrders(
    uuid: string,
    page: number,
    sizePerPage: number,
    sortField: string,
    sortDirection: string
  ): Observable<any> {
    const url = `/api/api/order/pagination/archive/client`;
    const params = new HttpParams()
      .set('uuid', uuid)
      .set('page', page.toString())
      .set('sizePerPage', sizePerPage.toString())
      .set('sortField', sortField)
      .set('sortDirection', sortDirection);
  
    return this.http.get<any>(url, { params });
  }  
}
