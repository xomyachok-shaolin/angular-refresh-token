import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { OrderService } from '../../_services/order.service';
import { Order, Service } from '../order.model';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import {
  TuiAlertService,
  TuiDialogService,
  TuiDriver,
  TuiOptionComponent,
} from '@taiga-ui/core';
import {
  Observable,
  Subscription,
  debounceTime,
  forkJoin,
  fromEvent,
  switchMap,
  take,
} from 'rxjs';
import {
  EMPTY_QUERY,
  TUI_DEFAULT_MATCHER,
  TuiBooleanHandler,
  TuiContextWithImplicit,
  TuiDay,
} from '@taiga-ui/cdk';
import { StorageService } from '../../_services/storage.service';
import {
  TUI_PROMPT,
  TuiPromptData,
  tuiItemsHandlersProvider,
} from '@taiga-ui/kit';

@Component({
  selector: 'app-archived',
  templateUrl: './archived.component.html',
  styleUrls: ['./archived.component.scss'],
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
export class ArchivedComponent implements OnInit {
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
  totalPages: number = 0;
  currentPage: number = 0;
  hasOrders: boolean = true;

  sizePerPage: number = 5; // Начальное значение
  private resizeSubscription!: Subscription;

  @ViewChild('tableContainer') tableContainer!: ElementRef;

  constructor(
    private orderService: OrderService,
    private fb: FormBuilder,
    private storageService: StorageService,
    private cdRef: ChangeDetectorRef,
    private ngZone: NgZone,
    private dialogService: TuiDialogService,
    private alertService: TuiAlertService
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
    this.fetchOrders(this.currentPage);

    this.form.valueChanges.subscribe(() => {
      this.fetchOrders(this.currentPage);
    });
  }

  ngAfterViewInit() {
    // Подписываемся на изменение размеров окна
    this.resizeSubscription = fromEvent(window, 'resize')
      .pipe(debounceTime(200)) // Добавляем задержку, чтобы не перегружать обработчик
      .subscribe(() => {
        this.calculateSizePerPage();
      });
  }

  ngOnDestroy() {
    // Отписываемся от событий при уничтожении компонента
    if (this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }
  }

  private previousSizePerPage: number = this.sizePerPage;

  calculateSizePerPage(): void {
    const availableHeight = this.getAvailableHeight();
    const itemHeight = this.getItemHeight();

    if (itemHeight > 0) {
      const newSizePerPage = Math.floor(availableHeight / itemHeight);
      const clampedSize = Math.max(1, Math.min(newSizePerPage, 100));

      // Only update and fetch if the calculated size differs from the current and previous values
      if (
        clampedSize !== this.sizePerPage &&
        clampedSize !== this.previousSizePerPage
      ) {
        this.sizePerPage = clampedSize;
        this.previousSizePerPage = clampedSize;
        this.fetchOrders(this.currentPage);
      }
    } else {
      // Default value if calculation fails
      const defaultSize = 3;
      if (
        defaultSize !== this.sizePerPage &&
        defaultSize !== this.previousSizePerPage
      ) {
        this.sizePerPage = defaultSize;
        this.previousSizePerPage = defaultSize;
        this.fetchOrders(this.currentPage);
      }
    }
  }

  getAvailableHeight(): number {
    const windowHeight = window.innerHeight;
    const headerHeight =
      document.querySelector('.custom-header')?.clientHeight || 0;
    const filtersHeight = document.querySelector('.filters')?.clientHeight || 0;
    const tabsHeight =
      document.querySelector('.orders tui-tabs')?.clientHeight || 0;
    const paginationHeight = 150; // Предполагаемая высота пагинации
    const margins = 150; // Дополнительные отступы

    return (
      windowHeight -
      headerHeight -
      filtersHeight -
      tabsHeight -
      paginationHeight -
      margins
    );
  }

  getItemHeight(): number {
    const rowElement =
      this.tableContainer.nativeElement.querySelector('.tui-table__tr');
    return rowElement ? rowElement.clientHeight : 0;
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
    const sizePerPage = this.sizePerPage;
    const sortField = 'COST';
    const sortDirection = 'DESC';
    const archive = true;

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
      const startDate =
        dateRange?.from instanceof TuiDay
          ? dateRange.from.toLocalNativeDate()
          : null;
      const endDate =
        dateRange?.to instanceof TuiDay
          ? dateRange.to.toLocalNativeDate()
          : null;

      this.orderService
        .getPaginatedArchivedUserOrders(
          uuid,
          page,
          sizePerPage,
          sortField,
          sortDirection,
          archive,
          selectedStatusValues,
          selectedServiceValues,
          startDate,
          endDate,
          this.form.value.searchAll
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
              this.orders = newOrders;
              this.totalPages = data.totalPages;
            } else {
              this.hasOrders = false;
              this.orders = [];
              this.totalPages = 0;
            }
            this.cdRef.markForCheck();
            this.cdRef.detectChanges();

            // Wait for Angular to stabilize the view before calculating sizePerPage
            this.ngZone.onStable.pipe(take(1)).subscribe(() => {
              this.calculateSizePerPage();
            });
          },
          error: (error: any) => {
            console.error('Произошла ошибка при загрузке заказов!', error);
            this.hasOrders = false;
            this.orders = []; // Ensure orders list is empty
            this.totalPages = 0;
            this.cdRef.markForCheck();
          },
        });
    } else {
      console.error('UUID пользователя не найден.');
      this.hasOrders = false;
    }
  }

  unarchiveSelectedOrder(orderUuid: string) {
    const data: TuiPromptData = {
      content: 'Вы уверены, что хотите вернуть из архива этот заказ?',
      yes: 'Да',
      no: 'Отмена',
    };

    this.dialogService
      .open<boolean>(TUI_PROMPT, {
        label: 'Подтверждение',
        size: 's',
        data,
      })
      .pipe(
        switchMap((confirmed) => {
          if (confirmed) {
            return this.orderService.unarchiveOrder(orderUuid);
          } else {
            return []; // Return an empty observable if the user cancels
          }
        })
      )
      .subscribe({
        next: (response) => {
          this.alertService
            .open('Заказ успешно разархивирован.', { status: 'success' }) // Показываем текст ответа
            .subscribe();
          this.fetchOrders(this.currentPage); // Обновляем список заказов
        },
        error: (error) => {
          console.error('Ошибка при помещении заказа в архив:', error);
          this.alertService
            .open('Ошибка при помещении заказа в архив.', { status: 'error' })
            .subscribe();
        },
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

  get anySelected(): boolean {
    return this.orders.some((order) => order.selected);
  }

  unarchiveSelectedOrders() {
    const selectedOrders = this.orders.filter((order) => order.selected);
    if (selectedOrders.length === 0) {
      return;
    }

    const data: TuiPromptData = {
      content: `Вы уверены, что хотите вернуть ${
        selectedOrders.length
      } выбранн${this.getSelectedForm(
        selectedOrders.length
      )} ${this.getOrderWord(selectedOrders.length)} из архива?`,
      yes: 'Да',
      no: 'Отмена',
    };

    this.dialogService
      .open<boolean>(TUI_PROMPT, {
        label: 'Подтверждение',
        size: 's',
        data,
      })
      .pipe(
        switchMap((confirmed) => {
          if (confirmed) {
            const archiveObservables = selectedOrders.map((order) =>
              this.orderService.unarchiveOrder(order.uuid)
            );
            return forkJoin(archiveObservables);
          } else {
            return []; // Возвращаем пустой observable, если пользователь отменил действие
          }
        })
      )
      .subscribe({
        next: (response) => {
          this.alertService
            .open('Выбранные заказы успешно возвращены из архива.', {
              status: 'success',
            })
            .subscribe();
          this.fetchOrders(this.currentPage); // Обновляем список заказов
        },
        error: (error) => {
          console.error('Ошибка при возвращении заказов из архива:', error);
          this.alertService
            .open('Ошибка при возвращении заказов из архива.', {
              status: 'error',
            })
            .subscribe();
        },
      });
  }

  get selectedCount(): number {
    return this.orders.filter((order) => order.selected).length;
  }

  clearSelection() {
    this.orders.forEach((order) => (order.selected = false));
  }

  // Функция для выбора правильного склонения слова "выбран"
  getSelectedWord(count: number): string {
    return count === 1 ? 'Выбран' : 'Выбрано';
  }

  // Функция для выбора правильного окончания слова "заказ"
  getOrderWord(count: number): string {
    if (count === 1) {
      return 'заказ';
    }

    const cases = [2, 0, 1, 1, 1, 2];
    const titles = ['заказ', 'заказа', 'заказов'];
    return titles[
      count % 100 > 4 && count % 100 < 20 ? 2 : cases[Math.min(count % 10, 5)]
    ];
  }

  // Функция для выбора правильного склонения слова "выбранных"
  getSelectedForm(count: number): string {
    return count === 1 ? 'ый' : 'ых';
  }
}
