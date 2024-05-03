import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(private http: HttpClient) {}

  getOrders(page: number): Observable<any> {
    // Replace with your actual API call
    return this.http.get(`/api/orders?page=${page}`);
  }
}
