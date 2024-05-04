import { Component, OnInit } from '@angular/core';
import { OrderService } from '../order.service'; // Убедитесь, что сервис правильно импортирован
import { Order } from '../order.model';
import { FormControl } from '@angular/forms';

@Component({
  selector: 'app-active',
  templateUrl: './active.component.html',
  styleUrls: ['./active.component.scss']
})
export class ActiveComponent {
  readonly columns = ['Номер', 'Тип', 'Дата оформления', 'Статус выполнения', 'Стоимость, статус оплаты'] as const;
  orders: Order[] = []; 
  totalPages: number = 10;
  currentPage: number = 1;
  testValue = new FormControl(false);

  constructor(private orderService: OrderService) {}

  ngOnInit() {
    this.fetchOrders();
  }

  fetchOrders() {
    // Здесь ваш код для получения данных заказов, например:
    this.orderService.getOrders(this.currentPage).subscribe({
      next: (data) => {
        this.orders = data.orders;
        this.totalPages = data.totalPages;
      },
      error: (error) => console.error('There was an error!', error)
    });
  }
}
