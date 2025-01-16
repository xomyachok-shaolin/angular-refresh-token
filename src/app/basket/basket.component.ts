import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { BasketService } from '../_services/basket.service';
import { StorageService } from '../_services/storage.service';
import {
  TuiAlertService,
  TuiDialogService,
  tuiScrollbarOptionsProvider,
} from '@taiga-ui/core';
import { TUI_PROMPT, TuiFileLike, TuiPromptData } from '@taiga-ui/kit';
import { of, switchMap } from 'rxjs';

interface BasketItem {
  uuid: string;
  title: string;
  description: string;
  cost: number;
  files?: any[];
  parameters?: any[];
  comment?: string,
  selected: boolean;
}

@Component({
  selector: 'app-basket',
  templateUrl: './basket.component.html',
  styleUrls: ['./basket.component.less'],
  providers: [
    tuiScrollbarOptionsProvider({
      mode: 'hover',
    }),
  ],
})
export class BasketComponent implements OnInit {
  open = false;
  onClick(): void {
    this.open = !this.open;
  }
  readonly columns = ['Название услуги', 'Описание', 'Стоимость'] as const;
  basketData: BasketItem[] = [];
  hasBasket: boolean = true;
  allSelected = false;
  selectedItems: Set<string> = new Set();
  totalAmount: number = 0;
  currentStep = 0; // Текущий шаг степпера

  @ViewChild('tableContainer') tableContainer!: ElementRef;

  constructor(
    private basketService: BasketService,
    private storageService: StorageService,
    private dialogService: TuiDialogService,
    private alertService: TuiAlertService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadBasket();
  }

  onCheckboxClick(event: MouseEvent, item: BasketItem): void {
    event.stopPropagation();
    item.selected = !item.selected;
    this.calculateTotalAmount();
  }

  get anySelected(): boolean {
    return this.basketData.some((item) => item.selected);
  }

  get checked(): boolean | null {
    const every = this.basketData.every(({ selected }) => selected);
    const some = this.basketData.some(({ selected }) => selected);

    return every || (some && null);
  }

  onCheck(checked: boolean): void {
    this.basketData.forEach((item) => {
      item.selected = checked;
    });
    this.calculateTotalAmount();
  }

  toggleAll(): void {
    this.allSelected = !this.allSelected;
    this.basketData = this.basketData.map((item) => ({
      ...item,
      selected: this.allSelected,
    }));
  }

  deleteSelected(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    const selectedUuids = this.basketData
      .filter((item) => item.selected)
      .map((item) => item.uuid);

    if (selectedUuids.length === 0) {
      this.alertService
        .open('Не выбрана ни одна услуга.', { status: 'warning' })
        .subscribe();
      return;
    }
    const data: TuiPromptData = {
      content: 'Вы уверены, что хотите удалить выбранные услуги из корзины?',
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
            // Use forkJoin to delete multiple services concurrently
            return selectedUuids.length > 0
              ? of(...selectedUuids).pipe(
                  switchMap((uuid) => this.basketService.deleteService(uuid))
                )
              : of(null);
          } else {
            return of(null);
          }
        })
      )
      .subscribe({
        next: (response) => {
          if (response != null) {
            this.alertService
              .open('Выбранные услуги успешно удалены.', { status: 'success' })
              .subscribe();
            this.basketData = this.basketData.filter(
              (item) => !selectedUuids.includes(item.uuid)
            );
            this.calculateTotalAmount();
            this.allSelected = this.basketData.every((item) => item.selected);
          }
        },
        error: (error) => {
          console.error('Ошибка при удалении услуг из корзины:', error);
          this.alertService
            .open('Ошибка при удалении услуг из корзины.', { status: 'error' })
            .subscribe();
        },
      });
  }

  loadBasket(): void {
    // Get user UUID from StorageService
    const user = this.storageService.getUser();
    const uuid = user ? user.uuid : null;

    if (uuid) {
      this.basketService.getBasket().subscribe({
        next: (data: any) => {
          if (!data || !data.services || data.services.length === 0) {
            this.hasBasket = false;
            this.basketData = [];
          } else {
            console.log(data);
            this.hasBasket = true;
            this.basketData = data.services.map((service: any) => ({
              uuid: service.uuid,
              title: service.title,
              description: service.description,
              cost: service.cost,
              files: service.files,
              parameters: service.parameters,
              comment: service.comment,
              selected: true,
            }));
            // this.totalAmount = data.cost;
          }
          this.calculateTotalAmount();
        },
        error: (error: any) => {
          console.error('Error while fetching basket:', error);
          this.hasBasket = false;
          this.basketData = [];
          this.cdRef.markForCheck();
        },
      });
    } else {
      console.error('UUID пользователя не найден.');
      this.hasBasket = false;
    }
  }

  calculateTotalAmount() {
    this.totalAmount = this.basketData
      .filter((item) => item.selected)
      .reduce((sum, item) => sum + item.cost, 0);
  }

  // Методы для управления степпером
  nextStep(): void {
    if (this.currentStep < 2) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  // Метод для оформления заказа
  placeOrder(): void {
    // Здесь реализуйте логику оформления заказа
    // После успешного оформления переходим к следующему шагу
    this.nextStep();
  }

  deleteService(uuid: string) {
    const data: TuiPromptData = {
      content: 'Вы уверены, что хотите удалить эту услугу из корзины?',
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
            return this.basketService.deleteService(uuid);
          } else {
            return []; // Return an empty observable if the user cancels
          }
        })
      )
      .subscribe({
        next: (response) => {
          this.alertService
            .open('Услуга успешно удалена.', { status: 'success' }) // Показываем текст ответа
            .subscribe();
          this.basketData = this.basketData.filter(
            (item) => item.uuid !== uuid
          );
          this.calculateTotalAmount();
          this.allSelected = this.basketData.every((item) => item.selected);
        },
        error: (error) => {
          console.error('Ошибка при удалении услуги из корзины:', error);
          this.alertService
            .open('Ошибка при удалении услуги из корзины.', { status: 'error' })
            .subscribe();
        },
      });
  }

  getFileLink(fileName: string): TuiFileLike {
    return {
      name: fileName,
      src:
        '/api/file/download_temporaryBucket?fileName=' +
        encodeURIComponent(fileName),
    };
  }
}
