import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { BasketService } from '../_services/basket.service';
import { StorageService } from '../_services/storage.service';
import { TuiAlertService, TuiDialogService, tuiScrollbarOptionsProvider } from '@taiga-ui/core';
import { TUI_PROMPT, TuiPromptData } from '@taiga-ui/kit';
import { switchMap } from 'rxjs';

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
  basketData: any;
  hasBasket: boolean = true;
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

  get checked(): boolean | null {
    // const every = this.basketData.every(({ selected }) => selected);
    // const some = this.basketData.some(({ selected }) => selected);

    // return every || (some && null);

    return null;
  }

  onCheck(checked: boolean): void {
    // this.basketData.forEach((item) => {
    //   item.selected = checked;
    // });
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
            console.log(data)
            this.hasBasket = true;
            this.basketData = data.services.map((service: any) => ({
              uuid: service.uuid,
              title: service.title,
              description: service.description,
              cost: service.cost,
              selected: false,
            }));
            this.totalAmount = data.cost;
          }
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
          this.loadBasket(); 
        },
        error: (error) => {
          console.error('Ошибка при удалении услуги из корзины:', error);
          this.alertService
            .open('Ошибка при удалении услуги из корзины.', { status: 'error' })
            .subscribe();
        },
      });
  }
}
