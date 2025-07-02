import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, concatMap, delay, from, last, map } from 'rxjs';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class BasketService {
  private basketDataSubject = new BehaviorSubject<any[]>([]);
  private basketItemCountSubject = new BehaviorSubject<number>(0);

  basketData$ = this.basketDataSubject.asObservable();
  basketItemCount$ = this.basketItemCountSubject.asObservable();

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

  getBasketItemCount(): void {
    this.getBasket().subscribe((data: any) => {
      const count = data?.services?.length || 0;
      this.basketItemCountSubject.next(count);
      this.basketDataSubject.next(data?.services || []);
    });
  }

  getReceiptPdf(orderUuid: string): Observable<Blob> {
    const headers = this.getAuthHeaders();
    return this.http.get(`/api/basket/receipts?order_uuid=${orderUuid}`, {
      headers,
      responseType: 'blob',
    });
  }
  

  createOrder(orderData: any): Observable<any> {
    return this.http.post('/api/basket/create_order', orderData, {
      headers: this.getAuthHeaders(),
      responseType: 'text',
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

  deleteServices(uuids: string[], allSelected: boolean): Observable<any> {
    const headers = this.getAuthHeaders();

    // Если выбраны все услуги, делаем один запрос на очистку всей корзины
    if (allSelected) {
      return this.http.delete(`/api/basket/clear_basket`, {
        headers,
        responseType: 'text',
      });
    } else {
      // Иначе удаляем каждую услугу отдельно с небольшой задержкой
      const delayBetweenRequestsMs = 300; // подберите комфортное значение задержки
      return from(uuids).pipe(
        concatMap(uuid =>
          this.http.delete(`/api/basket/remove_service`, {
            headers,
            params: new HttpParams().set('serviceUuid', uuid),
            responseType: 'text',
          })
          // Добавляем задержку после каждого запроса
          .pipe(delay(delayBetweenRequestsMs))
        ),
        // last() позволяет дождаться, когда все удалятся,
        // и завершить стрим одним событием next()
        last()
      );
    }
  }
}
