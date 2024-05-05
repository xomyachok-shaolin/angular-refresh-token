import { Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { OrderService } from '../order.service'; // Убедитесь, что сервис правильно импортирован
import { Order } from '../order.model';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { TuiDriver, TuiOptionComponent } from '@taiga-ui/core';
import { Observable } from 'rxjs';
import { EMPTY_QUERY, TuiDay } from '@taiga-ui/cdk';

@Component({
  selector: 'app-active',
  templateUrl: './active.component.html',
  styleUrls: ['./active.component.scss']
})
export class ActiveComponent {
  @ViewChild(TuiDriver)
  readonly driver?: Observable<boolean>;

  @ViewChildren(TuiOptionComponent, { read: ElementRef })
  private readonly options: QueryList<ElementRef<HTMLElement>> = EMPTY_QUERY;

  onArrow(event: Event, which: 'first' | 'last'): void {
    const item = this.options[which];

    if (!item) {
      return;
    }

    event.preventDefault();
    item.nativeElement.focus();
  }

  open = false;
  onClick(): void {
    this.open = !this.open;
  }

  readonly min = new TuiDay(2000, 2, 20);

  readonly max = new TuiDay(2040, 2, 20);

  form: FormGroup;
  statusOptions = ['Выполнено', 'В обработке', 'Отказано', 'Ожидание подтверждения'];
  serviceOptions = [
    'Все', 
    'Создание единых 3D-стереомоделей', 
    'Аэрофотосъемка', 
    'Фотограмметрические работы', 
    'Услуги по стереомоделям'
  ];

  readonly columns = ['Номер', 'Тип', 'Дата оформления', 'Статус выполнения', 'Стоимость, статус оплаты'] as const;
  orders: Order[] = [
    {
      id: 1,
      number: "Заказ №1",
      types: ["АФС"],
      date: new Date('2010-06-22'),
      status: "Выполнено",
      cost: 10800.56,
      paymentStatus: "Оплачено"
    },
    {
      id: 2,
      number: "Заказ №2",
      types: ["АФС", "Создание единых 3D-стереомоделей"],
      date: new Date('2012-10-12'),
      status: "В обработке",
      cost: 25360.00,
      paymentStatus: "Не оплачено"
    },
    {
      id: 3,
      number: "Заказ №3",
      types: ["Услуги по стереомоделям", "Создание единых 3D-стереомоделей"],
      date: new Date('2018-05-08'),
      status: "Отказано",
      cost: 30500.40,
      paymentStatus: "Отменено"
    }
  ];
  totalPages: number = 10;
  currentPage: number = 1;
  testValue = new FormControl(false);

  constructor(private orderService: OrderService, private fb: FormBuilder) {
    this.form = this.fb.group({
      selectedServices: [[]], // for multi-select
      selectedStatus: [''],
      dateRange: [{begin: new Date(), end: new Date()}]
    });
  }

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
