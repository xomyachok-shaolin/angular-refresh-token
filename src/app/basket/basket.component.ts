import {
  Component,
  OnInit,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  Inject,
  TemplateRef,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  TuiAlertService,
  TuiDialogService,
  TuiNotification,
} from '@taiga-ui/core';
import { StorageService } from '../_services/storage.service';
import { BasketService } from '../_services/basket.service';
import { Router } from '@angular/router';
import { switchMap, of, forkJoin, take, map, delay, debounceTime } from 'rxjs';
import {
  TUI_PROMPT,
  TuiFileLike,
  TuiPdfViewerService,
  TuiPromptData,
} from '@taiga-ui/kit';
import { ConfigService } from '../config.service';
import { TUI_IS_MOBILE } from '@taiga-ui/cdk';
import { DomSanitizer } from '@angular/platform-browser';
import { OrderService } from '../_services/order.service';

export type ClientType = 'INDIVIDUALS' | 'ENTERPRISER' | 'LEGAL';

interface BasketItem {
  uuid: string;
  title: string;
  description: string;
  cost: number;
  files?: any[];
  parameters?: any[];
  comment?: string;
  selected: boolean;
}

@Component({
  selector: 'app-basket',
  templateUrl: './basket.component.html',
  styleUrls: ['./basket.component.less'],
})
export class BasketComponent implements OnInit {
  // Степпер: 0 – Корзина, 1 – Оформление заказа, 2 – Подтверждение
  currentStep = 0;
  basketData: any[] = [];
  hasBasket = false;
  totalAmount = 0;

  @ViewChild('actionsTpl') actionsTpl!: TemplateRef<unknown>;
  orderUuid: string = '';
  orderNumber: string = '';
  receiptPdfUrl: string = '';

  orderForm!: FormGroup;
  private readonly cache: Partial<Record<ClientType, FormGroup>> = {};

  isLoading = false;
  private originalFormValue: string = '';

  // DaData токен
  private readonly DADATA_API_TOKEN = this.configService.getDadataToken();

  companySuggestions: any[] = [];
  showCompanySuggestions = false;
  bankSuggestions: any[] = [];
  showBankSuggestions = false;

  allSelected = false;

  @ViewChild('tableContainer') tableContainer!: ElementRef;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private storageService: StorageService,
    private basketService: BasketService,
    private dialogService: TuiDialogService,
    private alertService: TuiAlertService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private sanitizer: DomSanitizer,
    @Inject(TuiPdfViewerService)
    private readonly pdfService: TuiPdfViewerService,
    @Inject(TUI_IS_MOBILE) private readonly isMobile: boolean,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    // 1) создаём форму
    this.orderForm = this.fb.group({
      clientType: new FormControl<ClientType>('INDIVIDUALS', { nonNullable: true }),
      data:       this.getGroup('INDIVIDUALS'),
    });

    // 2) переключение типа
    this.orderForm.get('clientType')!.valueChanges
      .subscribe(t => {
        this.orderForm.setControl('data', this.getGroup(t));
        this.setupDirtyTracker(); // перезапустить трекер на новую группу
      });

    // 3) сразу настроить трекер
    this.setupDirtyTracker();

    // 4) загрузить данные и корзину
    this.loadClientDataIntoOrderForm();
    this.loadBasket();
  }

  private setupDirtyTracker() {
    const dataCtrl = this.orderForm.get('data') as FormGroup;

    dataCtrl.valueChanges
      .pipe(debounceTime(50))
      .subscribe(() => {
        const now = JSON.stringify(dataCtrl.value);
        if (now === this.originalFormValue) {
          dataCtrl.markAsPristine();
        } else {
          dataCtrl.markAsDirty();
        }
      });
  }

  /** Возвращает или создаёт кешированную под-группу */
  private getGroup(type: ClientType): FormGroup {
    if (!this.cache[type]) {
      this.cache[type] = this.buildGroup(type);
    }
    return this.cache[type]!;
  }

  /** Построить FormGroup с тем же набором контролов и валидаторов */
  private buildGroup(type: ClientType): FormGroup {
    switch (type) {
      case 'INDIVIDUALS':
        return this.fb.group({
          lastName: ['', Validators.required,],
          firstName: ['', Validators.required],
          middleName: [''],
          phone: [
            '',
            [
              Validators.required,
              Validators.pattern(/^(\+7|8)\d{10}$/),
            ],
          ],
          email: ['', [Validators.required, Validators.email]],
        });

      case 'ENTERPRISER':
        return this.fb.group({
          lastName: ['', Validators.required],
          firstName: ['', Validators.required],
          middleName: [''],
          phone: [
            '',
            [
              Validators.required,
              Validators.pattern(/^(\+7|8)\d{10}$/),
            ],
          ],
          email: ['', [Validators.required, Validators.email]],
          ogrnip: [
            '',
            [
              Validators.required,
              Validators.pattern(/^\d+$/),
              Validators.minLength(15),
              Validators.maxLength(15),
            ],
          ],
          inn: [
            '',
            [
              Validators.required,
              Validators.pattern(/^\d+$/),
              Validators.minLength(10),
              Validators.maxLength(12),
            ],
          ],
          checkingAccount: [
            '',
            [
              Validators.required,
              Validators.pattern(/^\d+$/),
              Validators.minLength(20),
              Validators.maxLength(20),
            ],
          ],
          registrationAddress: ['', Validators.required],
        });

      case 'LEGAL':
        return this.fb.group({
          phone: [
            '',
            [
              Validators.required,
              Validators.pattern(/^(\+7|8)\d{10}$/),
            ],
          ],
          email: ['', [Validators.required, Validators.email]],
          fullNameOrganization: ['', Validators.required],
          abbreviatedNameOrganization: ['', Validators.required],
          inn: [
            '',
            [
              Validators.required,
              Validators.pattern(/^\d+$/),
              Validators.minLength(10),
              Validators.maxLength(12),
            ],
          ],
          kpp: [
            '',
            [
              Validators.required,
              Validators.pattern(/^\d+$/),
              Validators.minLength(9),
              Validators.maxLength(9),
            ],
          ],
          ogrn: [
            '',
            [
              Validators.required,
              Validators.pattern(/^\d+$/),
              Validators.minLength(13),
              Validators.maxLength(13),
            ],
          ],
          okpo: [
            '',
            [
              Validators.required,
              Validators.pattern(/^\d+$/),
              Validators.minLength(8),
              Validators.maxLength(8),
            ],
          ],
          legalAddress: ['', Validators.required],
          fax: [''],
          website: [''],
          checkingAccount: [
            '',
            [
              Validators.required,
              Validators.pattern(/^\d+$/),
              Validators.minLength(20),
              Validators.maxLength(20),
            ],
          ],
          correspondentAccount: [
            '',
            [
              Validators.required,
              Validators.pattern(/^\d+$/),
              Validators.minLength(20),
              Validators.maxLength(20),
            ],
          ],
          bic: [
            '',
            [
              Validators.required,
              Validators.pattern(/^\d+$/),
              Validators.minLength(9),
              Validators.maxLength(9),
            ],
          ],
          bankName: ['', Validators.required],
        });
    }
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

    const allSelected = selectedUuids.length === this.basketData.length;

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
            return this.basketService.deleteServices(
              selectedUuids,
              allSelected
            );
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

            if (this.basketData.length === 0) {
              this.currentStep = 0;
              this.hasBasket = false;
            }

            this.basketService.getBasketItemCount();
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

  // Загрузка корзины
  loadBasket(): void {
    const user = this.storageService.getUser();
    if (!user || !user.uuid) {
      console.error('UUID пользователя не найден.');
      this.hasBasket = false;
      return;
    }
    this.basketService.getBasket().subscribe({
      next: (data: any) => {
        if (!data || !data.services || data.services.length === 0) {
          this.hasBasket = false;
          this.basketData = [];
        } else {
          this.hasBasket = true;
          this.basketData = data.services.map((service: any) => ({
            uuid: service.uuid,
            basketUuid: service.uuid_basket,
            title: service.title,
            description: service.description,
            parameters: service.parameters,
            cost: service.cost,
            files: service.files,
            comment: service.comment,
            selected: true,
          }));
          this.calculateTotalAmount();
        }
      },
      error: (err) => {
        console.error('Ошибка при загрузке корзины:', err);
      },
    });
  }

  calculateTotalAmount(): void {
    this.totalAmount = this.basketData
      .filter((item) => item.selected)
      .reduce((sum, item) => sum + item.cost, 0);
  }

  private mapFromServer(type: ClientType, src: any): Record<string, any> {
    switch (type) {
      case 'INDIVIDUALS':
        return {
          lastName: src.lastName,
          firstName: src.firstName,
          middleName: src.middleName,
          phone: src.phone,
          email: src.email,
        };
      case 'ENTERPRISER':
        return {
          lastName: src.lastName,
          firstName: src.firstName,
          middleName: src.middleName,
          phone: src.phone,
          email: src.email,
          ogrnip: src.ogrnip ?? src.OGRNIP,
          inn: src.inn ?? src.INN,
          checkingAccount: src.paymentAccount,
          registrationAddress: src.registrationAddress,
        };
      case 'LEGAL':
        return {
          lastName: src.lastName,
          firstName: src.firstName,
          middleName: src.middleName,
          phone: src.phone,
          email: src.email,
          fullNameOrganization: src.fullNameOrganization,
          abbreviatedNameOrganization: src.abbreviatedNameOrganization,
          inn: src.inn ?? src.INN,
          kpp: src.kpp ?? src.KPP,
          ogrn: src.ogrn ?? src.OGRN,
          okpo: src.okpo ?? src.OKPO,
          legalAddress: src.legalAddress,
          fax: src.faxNumber,
          website: src.linkToWebsite,
          checkingAccount: src.paymentAccount,
          correspondentAccount: src.correspondentAccount,
          bic: src.BIC,
          bankName: src.bankName,
        };
    }
  }

  // Загрузка данных клиента из ЛК и подстановка в форму заказа
  loadClientDataIntoOrderForm(): void {
    const user = this.storageService.getUser();
    if (!user?.uuid) return;

    this.http.get<any>(`/api/client/?uuid=${user.uuid}`)
      .subscribe({
        next: data => {
          const t = data.clientType as ClientType;
          this.orderForm.patchValue({ clientType: t });
          this.getGroup(t).patchValue(this.mapFromServer(t, data));

          //  — сохраняем шаблонный JSON
          const dataCtrl = this.orderForm.get('data')!;
          this.originalFormValue = JSON.stringify(dataCtrl.value);
          dataCtrl.markAsPristine();
        },
      });
  }

  // Сохранение обновленных данных клиента из формы заказа
  updateClientData(): void {
    const currentForm = this.orderForm.get('data')!;
    if (currentForm.invalid) {
      this.alertService
        .open('Проверьте правильность заполнения полей', {
          status: TuiNotification.Error,
        })
        .subscribe();
      return;
    }
    const user = this.storageService.getUser();
    if (!user || !user.uuid) return;
    const body = {
      uuid: user.uuid,
      clientType: this.orderForm.get('clientType')!.value,
      ...currentForm.value,
    };

    this.isLoading = true;
    this.http
      .put('/api/client/update', body, { responseType: 'text' })
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.alertService
            .open('Данные клиента обновлены', {
              status: TuiNotification.Success,
            })
            .subscribe();
          this.originalFormValue = JSON.stringify(currentForm.value);
          currentForm.markAsPristine();
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Ошибка обновления клиента:', err);
          this.alertService
            .open('Ошибка обновления клиента', {
              status: TuiNotification.Error,
            })
            .subscribe();
        },
      });
  }

  // basket.component.ts
  showReceipt(orderUuid: string): void {
    this.basketService
      .getReceiptPdf(orderUuid)
      .pipe(take(1))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const safe = this.sanitizer.bypassSecurityTrustResourceUrl(url);

          this.pdfService
            .open(safe, {
              label: `Счёт №${orderUuid}`,
              actions: this.actionsTpl,
            })
            .subscribe();
        },
        error: (err) => {
          console.error('Не удалось загрузить PDF счёта:', err);
          this.alertService
            .open('Не удалось загрузить счёт', { status: 'error' })
            .subscribe();
        },
      });
  }

  placeOrder(): void {
    const type = this.orderForm.get('clientType')!.value as ClientType;
    const dto = this.orderForm.get('data')!.value;

    const payload = {
      services_uuids: this.basketData
        .filter((i) => i.selected)
        .map((i) => i.basketUuid),
      clientType: type,
      dtoInput: dto,
    };

    this.basketService
      .createOrder(payload)
      .pipe(
        // 1) достаём чистый UUID
        map((msg: string) => msg.split(':')[1].trim()),
        delay(300),
        // 2) сохраняем UUID и запрашиваем детали заказа
        switchMap((uuid) => {
          this.orderUuid = uuid;
          return this.orderService.getOrderDetails(uuid);
        }),
        // 3) сохраняем бизнес-номер и загружаем PDF
        switchMap((order) => {
          this.orderNumber = order.orderNumber;
          return this.basketService.getReceiptPdf(this.orderUuid);
        })
      )
      .subscribe({
        next: (blob: Blob) => {
          const url = URL.createObjectURL(blob);
          const safe = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.pdfService
            .open(safe, {
              label: `Счёт №${this.orderNumber}`,
              actions: this.actionsTpl,
            })
            .subscribe();

          // очищаем корзину и обновляем счётчик
          this.currentStep = 2;
          this.basketData = [];
          this.totalAmount = 0;
          this.basketService.getBasketItemCount();
        },
        error: (err) => {
          console.error(err);
          this.alertService
            .open('Ошибка оформления заказа', { status: 'error' })
            .subscribe();
        },
      });
  }

  // Автодополнение DaData для компании (ИНН, наименование)
  onCompanyNameInput(query: string): void {
    const type = this.orderForm.get('clientType')!.value as ClientType;
    if ((type !== 'ENTERPRISER' && type !== 'LEGAL') || !query.trim()) {
      this.showCompanySuggestions = false;
      this.companySuggestions = [];
      return;
    }
    const url =
      'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party';
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Token ${this.DADATA_API_TOKEN}`,
    });
    const body = { query: query.trim(), count: 5 };
    this.isLoading = true;
    this.http.post<any>(url, body, { headers }).subscribe({
      next: (resp) => {
        this.isLoading = false;
        if (resp && resp.suggestions && resp.suggestions.length) {
          this.companySuggestions = resp.suggestions;
          this.showCompanySuggestions = true;
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Ошибка DaData party:', err);
      },
    });
  }

  selectCompanySuggestion(sugg: any): void {
    this.showCompanySuggestions = false;
    const data = sugg.data;
    this.orderForm.get('data')!.patchValue({
      inn: data.inn || '',
      kpp: data.kpp || '',
      ogrn: data.ogrn || '',
      ogrnip: data.ogrn || '',
      fullNameOrganization: data.name?.full_with_opf || '',
      abbreviatedNameOrganization: data.name?.short_with_opf || '',
      legalAddress: data.address?.value || '',
      registrationAddress: data.address?.value || '',
      okpo: data.okpo || '',
    });
  this.orderForm.markAsDirty();
  this.orderForm.markAllAsTouched();
  this.orderForm.updateValueAndValidity();
  }

  // Автодополнение DaData для банка
  onBankInput(query: string): void {
    const type = this.orderForm.get('clientType')!.value as ClientType;
    if (!query.trim() || type === 'INDIVIDUALS') {
      this.bankSuggestions = [];
      this.showBankSuggestions = false;
      return;
    }
    const url =
      'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/bank';
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Token ${this.DADATA_API_TOKEN}`,
    });
    const body = { query: query.trim(), count: 5 };
    this.isLoading = true;
    this.http.post<any>(url, body, { headers }).subscribe({
      next: (resp) => {
        this.isLoading = false;
        if (resp && resp.suggestions && resp.suggestions.length) {
          this.bankSuggestions = resp.suggestions;
          this.showBankSuggestions = true;
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Ошибка DaData bank:', err);
      },
    });
  }

  selectBankSuggestion(sugg: any): void {
    this.showBankSuggestions = false;
    const data = sugg.data;
    this.orderForm.get('data')!.patchValue({
      bankName: data.name?.payment || data.name?.full || '',
      bic: data.bic || '',
      correspondentAccount: data.correspondent_account || '',
    });

  this.orderForm.markAsDirty();
  this.orderForm.markAllAsTouched();
  this.orderForm.updateValueAndValidity();
  }

  nextStep(): void {
    if (this.currentStep === 0 && !this.anySelected) {
      this.alertService
        .open('Выберите хотя бы одну услугу', {
          status: TuiNotification.Warning,
        })
        .subscribe();
      return;
    }
    if (this.currentStep < 2) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  deleteService(event: Event, uuid: string): void {
    event.stopPropagation();
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
            return of(null);
          }
        })
      )
      .subscribe({
        next: (response) => {
          this.alertService
            .open('Услуга успешно удалена.', { status: 'success' })
            .subscribe();
          this.basketData = this.basketData.filter(
            (item) => item.uuid !== uuid
          );
          this.calculateTotalAmount();
          this.allSelected = this.basketData.every((item) => item.selected);

          if (this.basketData.length === 0) {
            this.currentStep = 0;
            this.hasBasket = false;
          }

          this.basketService.getBasketItemCount();
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
