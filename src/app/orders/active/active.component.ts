import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { OrderService } from '../../_services/order.service';
import { Order, Service } from '../order.model';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { TuiDriver, TuiOptionComponent } from '@taiga-ui/core';
import { Observable } from 'rxjs';
import {
  EMPTY_QUERY,
  TUI_DEFAULT_MATCHER,
  TuiBooleanHandler,
  TuiContextWithImplicit,
  TuiDay,
} from '@taiga-ui/cdk';
import { StorageService } from '../../_services/storage.service';
import { tuiItemsHandlersProvider } from '@taiga-ui/kit';

@Component({
  selector: 'app-active',
  templateUrl: './active.component.html',
  styleUrls: ['./active.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    tuiItemsHandlersProvider<{ label: string; value: string }>({
      // Define how to compare two items
      identityMatcher: (item1, item2) => item1.value === item2.value,
      // Define how to stringify items for display and search
      stringify: (
        item:
          | { label: string; value: string }
          | TuiContextWithImplicit<{ label: string; value: string }>
      ) => {
        return 'label' in item ? item.label : item.$implicit.label;
      },
    }),
  ],
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

  form: FormGroup;
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
    private storageService: StorageService,
    private cdRef: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      selectedServices: [[]],
      selectedStatuses: [[]],
      dateRange: new FormControl(null),
      searchAll: new FormControl(''),
    });
  }

  public availableServices: Array<{ label: string; value: string }> = [
    {
      label: 'Определение координат ЛЭП',
      value: 'Определение_Координат_ЛЭП',
    },
    {
      label: 'Определение координат характерых точек ЗУ',
      value: 'Определение_Координат_Характерых_Точек_ЗУ',
    },
    {
      label: 'Создание матрицы рельефа',
      value: 'Создание_Матрицы_Рельефа',
    },
  ];

  public availableStatuses: Array<{ label: string; value: string }> = [
    { label: 'Выполнено', value: 'Ready' },
    { label: 'В обработке', value: 'inProcessing' },
    { label: 'Отказано', value: 'NotReady' },
    { label: 'Не оплачено', value: 'inBasket' },
  ];

  public serviceSearch: string = '';
  public statusSearch: string = '';

  public tagValidator: TuiBooleanHandler<{ label: string; value: string }> = (
    tag
  ) => {
    return !!tag && tag.label.length > 0;
  };

  protected filterServices(
    search: string | null
  ): Array<{ label: string; value: string }> {
    return this.availableServices.filter((service) =>
      TUI_DEFAULT_MATCHER(service.label, search || '')
    );
  }

  protected filterStatuses(
    search: string | null
  ): Array<{ label: string; value: string }> {
    return this.availableStatuses.filter((status) =>
      TUI_DEFAULT_MATCHER(status.label, search || '')
    );
  }

  ngOnInit() {
    // Trigger the initial fetch of orders
    this.fetchOrders(this.currentPage);

    // Subscribe to changes in the form filters
    this.form.valueChanges.subscribe(() => {
      this.fetchOrders(this.currentPage);
    });
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
    const archive = false;

    // Get user UUID from StorageService
    const user = this.storageService.getUser();
    const uuid = user ? user.uuid : null;

    if (uuid) {
      const selectedServices = this.form.value.selectedServices;
      const selectedServiceValues = selectedServices
        ? selectedServices.map((s: any) => s.value)
        : [];

      const selectedStatuses = this.form.value.selectedStatuses;
      const selectedStatusValues = selectedStatuses
        ? selectedStatuses.map((s: any) => s.value)
        : [];

      const dateRange = this.form.value.dateRange;
      console.log(dateRange);
      const startDate =
        dateRange?.from instanceof TuiDay
          ? dateRange.from.toLocalNativeDate()
          : null;
      const endDate =
        dateRange?.to instanceof TuiDay
          ? dateRange.to.toLocalNativeDate()
          : null;

      this.orderService
        .getPaginatedUserOrders(
          uuid,
          page,
          sizePerPage,
          sortField,
          sortDirection,
          archive,
          selectedStatusValues,
          selectedServiceValues,
          startDate,
          endDate
        )
        .subscribe({
          next: (data: any) => {
            if (!data || !data.content || data.content.length === 0) {
              console.log('No orders found.');
              this.hasOrders = false;
              this.orders = [];
              this.totalPages = 0;
            } else {
              this.hasOrders = true;
              this.orders = data.content.map((order: any) => ({
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
              this.totalPages = data.totalPages;
            }
            this.cdRef.markForCheck(); // Trigger UI refresh
          },
          error: (error: any) => {
            console.error('Error while fetching orders:', error);
            this.hasOrders = false;
            this.orders = [];
            this.totalPages = 0;
            this.cdRef.markForCheck(); // Trigger UI refresh
          },
        });
    } else {
      console.error('UUID пользоваnеля не найден.');
      this.hasOrders = false;
    }
  }

  private mapStatus(status: string): string {
    switch (status) {
      case 'Ready':
        return 'Выполнено';
      case 'inProcessing':
        return 'В обработке';
      case 'NotReady':
        return 'Отказано';
      case 'inBasket':
        return 'Не оплачено';
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
