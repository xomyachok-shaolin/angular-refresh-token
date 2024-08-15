import {
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { OrderService } from '../../_services/order.service';
import { Order, Service } from '../order.model';
import { FormBuilder, FormGroup } from '@angular/forms';
import { TuiDriver, TuiOptionComponent } from '@taiga-ui/core';
import { Observable } from 'rxjs';
import { EMPTY_QUERY, TuiDay } from '@taiga-ui/cdk';
import { HttpClient, HttpParams } from '@angular/common/http';
import { StorageService } from '../../_services/storage.service';

@Component({
  selector: 'app-active',
  templateUrl: './active.component.html',
  styleUrls: ['./active.component.scss'],
})
export class ActiveComponent implements OnInit {
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
  statusOptions = [
    'Выполнено',
    'В обработке',
    'Отказано',
    'Ожидание подтверждения',
  ];
  serviceOptions = [
    'Все',
    'Создание единых 3D-стереомоделей',
    'Аэрофотосъемка',
    'Фотограмметрические работы',
    'Услуги по стереомоделям',
  ];

  readonly columns = [
    'Номер',
    'Тип',
    'Дата оформления',
    'Статус выполнения',
    'Стоимость, статус оплаты',
  ] as const;
  orders: Order[] = [];
  selectedItems: Set<string> = new Set();
  isAllSelected: boolean = false;
  totalPages: number = 0;
  currentPage: number = 0;
  hasOrders: boolean = true;

  constructor(
    private orderService: OrderService,
    private fb: FormBuilder,
    private storageService: StorageService // Добавление StorageService
  ) {
    this.form = this.fb.group({
      selectedStatus: [''],
      dateRange: [{ begin: new Date(), end: new Date() }],
    });
  }

  ngOnInit() {
    this.fetchOrders(this.currentPage);
  }

  get checked(): boolean | null {
    const every = this.orders.every(({ selected }) => selected);
    const some = this.orders.some(({ selected }) => selected);

    return every || (some && null);
  }

  onCheck(checked: boolean): void {
    this.orders.forEach((item) => {
      item.selected = checked;
    });
  }

  fetchOrders(index: number) {
    this.currentPage = index;
    const page = this.currentPage;
    const sizePerPage = 3;
    const sortField = 'COST';
    const sortDirection = 'DESC';

    // Get user UUID from StorageService
    const user = this.storageService.getUser();
    console.log(user); // For debugging
    const uuid = user ? user.uuid : null;

    if (uuid) {
      this.orderService
        .getPaginatedUserOrders(
          uuid,
          page,
          sizePerPage,
          sortField,
          sortDirection
        )
        .subscribe({
          next: (data: any) => {
            if (data && data.content && data.content.length > 0) {
              this.hasOrders = true;
              const newOrders: Order[] = data.content.map((order: any) => ({
                uuid: order.uuid,
                contractNumber: order.contractNumber,
                orderNumber: order.orderNumber,
                paymentStatus: order.paymentStatus ? 'Оплачено' : 'Не оплачено',
                executionStatus: this.mapStatus(order.executionStatus),
                execution: new Date(order.execution),
                paymentDate: new Date(order.paymentDate),
                linkToGeoData: order.linkToGeoData,
                passwordForLink: order.passwordForLink,
                comment: order.comment,
                cost: order.cost,
                client: order.client,
                archived: order.archived,
                service: order.service ?? [],
                selected: false,
              }));
              this.updateAllOrders(newOrders);
              this.orders = newOrders;
              this.totalPages = data.totalPages;
            } else {
              console.error('Ответ сервера не содержит данных заказов.');
              this.hasOrders = false;
              this.orders = []; // Ensure orders list is empty
              this.totalPages = 0;
            }
          },
          error: (error: any) => {
            console.error('Произошла ошибка при загрузке заказов!', error);
            this.hasOrders = false;
            this.orders = []; // Ensure orders list is empty
            this.totalPages = 0;
          },
        });
    } else {
      console.error('UUID пользователя не найден.');
      this.hasOrders = false;
    }
  }

  private updateAllOrders(newOrders: Order[]): void {
    newOrders.forEach((order) => {
      const match = this.orders.find((o) => o.uuid === order.uuid);
      if (match) {
        order.selected = match.selected;
      } else {
        this.orders.push(order);
      }
    });
  }

  private mapStatus(status: string): string {
    switch (status) {
      case 'Ready':
        return 'Выполнено';
      case 'inProcessing':
        return 'В обработке';
      case 'NotReady':
        return 'Отказано';
      default:
        return status;
    }
  }

  getServiceTitles(services: Service[]): string {
    if (!services || services.length === 0) {
      return 'No Services';
    }
    return services.map((service) => service.title).join(' ');
  }
}
