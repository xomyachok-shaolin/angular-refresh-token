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

  // Method to fetch paginated orders with additional filtering options
  getPaginatedUserOrders(
    uuid: string,
    page: number,
    sizePerPage: number,
    sortField: string,
    sortDirection: string,
    archive: boolean,
    executionStatuses?: string[],  
    serviceList?: string[],        
    startDate?: Date,              
    endDate?: Date    
  ): Observable<OrderResponse> {
    let params = new HttpParams()
      .set('uuid', uuid)
      .set('page', page)
      .set('sizePerPage', sizePerPage)
      .set('sortField', sortField)
      .set('sortDirection', sortDirection)
      .set('archive', archive.toString());

      if (executionStatuses?.length) {
        params = params.set('statuses', executionStatuses.join(','));
      }
      if (serviceList?.length) {
        params = params.set('serviceList', serviceList.join(','));
      }
      if (startDate) {
        params = params.set('startDate', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        params = params.set('endDate', endDate.toISOString().split('T')[0]);
      }

    return this.http.get<OrderResponse>('/api/order/pagination/client', {
      params,
      headers: this.getAuthHeaders(),
    });
  }

  // Method for fetching archived orders
  getPaginatedArchivedUserOrders(
    uuid: string,
    page: number,
    sizePerPage: number,
    sortField: string,
    sortDirection: string,
    archive: boolean
  ): Observable<any> {
    const url = `/api/order/pagination/client`;
    const params = new HttpParams()
      .set('uuid', uuid)
      .set('page', page.toString())
      .set('sizePerPage', sizePerPage.toString())
      .set('sortField', sortField)
      .set('sortDirection', sortDirection)
      .set('archive', archive.toString());

    return this.http.get<any>(url, { params });
  }
}
