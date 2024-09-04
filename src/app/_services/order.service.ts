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
    executionStatuses?: string[],  // Optional statuses filter
    serviceList?: string[],        // Optional service list filter
    startDate?: Date,              // Optional start date filter
    endDate?: Date                 // Optional end date filter
  ): Observable<OrderResponse> {
    let params = new HttpParams()
      .set('uuid', uuid)
      .set('page', page)
      .set('sizePerPage', sizePerPage)
      .set('sortField', sortField)
      .set('sortDirection', sortDirection)
      .set('archive', archive.toString());

    // Add filters if provided
    if (executionStatuses && executionStatuses.length > 0) {
      executionStatuses.forEach((status, index) => {
        params = params.append(`executionStatuses[${index}]`, status);
      });
    }
    
    if (serviceList && serviceList.length > 0) {
      serviceList.forEach((service, index) => {
        params = params.append(`serviceList[${index}]`, service);
      });
    }

    if (startDate) {
      params = params.set('startDate', startDate.toISOString().split('T')[0]); // Format date as yyyy-MM-dd
    }

    if (endDate) {
      params = params.set('endDate', endDate.toISOString().split('T')[0]); // Format date as yyyy-MM-dd
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
