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
    endDate?: Date,
    searchQuery?: string
  ): Observable<OrderResponse> {
    let params = new HttpParams()
      .set('uuid', uuid)
      .set('page', page)
      .set('sizePerPage', sizePerPage)
      .set('sortField', sortField)
      .set('sortDirection', sortDirection)
      .set('archive', archive.toString());

    if (executionStatuses?.length) {
      params = params.set('executionStatus', executionStatuses.join(','));
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
    if (searchQuery) {
      params = params.set('searchQuery', searchQuery)
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
    archive: boolean,
    executionStatuses?: string[],
    serviceList?: string[],
    startDate?: Date,
    endDate?: Date,
    searchQuery?: string
  ): Observable<any> {
    let params = new HttpParams()
      .set('uuid', uuid)
      .set('page', page.toString())
      .set('sizePerPage', sizePerPage.toString())
      .set('sortField', sortField)
      .set('sortDirection', sortDirection)
      .set('archive', archive.toString());

    if (executionStatuses?.length) {
      params = params.set('executionStatus', executionStatuses.join(','));
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
    if (searchQuery) {
      params = params.set('searchQuery', searchQuery)
    }

    return this.http.get<OrderResponse>('/api/order/pagination/client', {
      params,
      headers: this.getAuthHeaders(),
    });
  }

  archiveOrder(uuid: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.patch(`/api/order/archive`, null, {
      headers,
      params: new HttpParams().set('uuid', uuid),
      responseType: 'text',
    });
  }

  unarchiveOrder(uuid: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.patch(`/api/order/unarchive`, null, {
      headers,
      params: new HttpParams().set('uuid', uuid),
      responseType: 'text',
    });
  }
  
  getServiceTitles(): Observable<{ uuid: string; title: string }[]> {
    return this.http.options<{ uuid: string; title: string }[]>(
      '/api/service/all/titles'
    );
  }
  
  getOrderDetails(uuid: string): Observable<Order> {
    return this.http.get<Order>('/api/order/', {
      params: new HttpParams().set('uuid', uuid),
      headers: this.getAuthHeaders(),
    });
  }

  getReceipt(orderUuid: string): Observable<Blob> {
    const headers = this.getAuthHeaders();
    return this.http.get(`/api/basket/receipts?order_uuid=${orderUuid}`, {
      headers,
      responseType: 'blob',
    });
  }
}
