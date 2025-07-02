import {
  Component,
  OnInit,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  Inject,
  TemplateRef,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  TuiAlertService,
  TuiDialogService,
  TuiNotification,
} from '@taiga-ui/core';
import { StorageService } from '../_services/storage.service';
import { BasketService } from '../_services/basket.service';
import { Router } from '@angular/router';
import { switchMap, of, forkJoin, take, map, delay } from 'rxjs';
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

  // Для каждого типа клиента своя форма
  individualForm: FormGroup;
  enterpriserForm: FormGroup;
  legalForm: FormGroup;
  // Текущий тип клиента (для переключения)
  clientType: ClientType = 'INDIVIDUALS';

  isLoading = false;
  // Сохраняем исходное значение формы для последующего сравнения
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
    private orderService: OrderService,
  ) {
    // Форма для физического лица
    this.individualForm = this.fb.group({
      clientType: ['INDIVIDUALS', Validators.required],
      lastName: ['', Validators.required],
      firstName: ['', Validators.required],
      middleName: [''],
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(
            /^(\+7|8)\s?[\(]?\d{3}[\)]?\s?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/
          ),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
    });

    // Форма для ИП
    this.enterpriserForm = this.fb.group({
      clientType: ['ENTERPRISER', Validators.required],
      lastName: ['', Validators.required],
      firstName: ['', Validators.required],
      middleName: [''],
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(
            /^(\+7|8)\s?[\(]?\d{3}[\)]?\s?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/
          ),
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

    // Форма для юридического лица
    this.legalForm = this.fb.group({
      clientType: ['LEGAL', Validators.required],
      // ФИО руководителя (общие поля)
      lastName: ['', Validators.required],
      firstName: ['', Validators.required],
      middleName: [''],
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(
            /^(\+7|8)\s?[\(]?\d{3}[\)]?\s?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/
          ),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
      // Дополнительные поля для юрлица
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

  ngOnInit(): void {
    this.loadBasket();
    this.loadClientDataIntoOrderForm();

    this.basketService.getBasketItemCount();

    // При изменении текущей формы сохраняем её значение в строку для сравнения
    this.getCurrentForm().valueChanges.subscribe(() => {
      const currentValue = JSON.stringify(this.getCurrentForm().value);
      if (currentValue === this.originalFormValue) {
        this.getCurrentForm().markAsPristine();
      }
    });
  }

  // Метод для выбора текущей формы в зависимости от clientType
  getCurrentForm(): FormGroup {
    switch (this.clientType) {
      case 'INDIVIDUALS':
        return this.individualForm;
      case 'ENTERPRISER':
        return this.enterpriserForm;
      case 'LEGAL':
        return this.legalForm;
      default:
        return this.individualForm;
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

  // Загрузка данных клиента из ЛК и подстановка в форму заказа
  loadClientDataIntoOrderForm(): void {
    const user = this.storageService.getUser();
    if (!user || !user.uuid) return;
    this.http.get<any>(`/api/client/?uuid=${user.uuid}`).subscribe({
      next: (data) => {
        if (!data) return;
        this.clientType = data.clientType || 'INDIVIDUALS';
        // Заполняем нужную форму
        if (this.clientType === 'INDIVIDUALS') {
          this.individualForm.patchValue({
            clientType: data.clientType || 'INDIVIDUALS',
            lastName: data.lastName || '',
            firstName: data.firstName || '',
            middleName: data.middleName || '',
            phone: data.phone || '',
            email: data.email || '',
          });
          this.originalFormValue = JSON.stringify(this.individualForm.value);
          this.individualForm.markAsPristine();
        } else if (this.clientType === 'ENTERPRISER') {
          this.enterpriserForm.patchValue({
            clientType: data.clientType || 'ENTERPRISER',
            lastName: data.lastName || '',
            firstName: data.firstName || '',
            middleName: data.middleName || '',
            phone: data.phone || '',
            email: data.email || '',
            ogrnip: data.ogrnip || data.OGRNIP || '',
            inn: data.inn || data.INN || '',
            checkingAccount: data.paymentAccount || '',
            registrationAddress: data.registrationAddress || '',
          });
          this.originalFormValue = JSON.stringify(this.enterpriserForm.value);
          this.enterpriserForm.markAsPristine();
        } else if (this.clientType === 'LEGAL') {
          this.legalForm.patchValue({
            clientType: data.clientType || 'LEGAL',
            lastName: data.lastName || '',
            firstName: data.firstName || '',
            middleName: data.middleName || '',
            phone: data.phone || '',
            email: data.email || '',
            fullNameOrganization: data.fullNameOrganization || '',
            abbreviatedNameOrganization: data.abbreviatedNameOrganization || '',
            inn: data.inn || data.INN || '',
            kpp: data.kpp || data.KPP || '',
            ogrn: data.ogrn || data.OGRN || '',
            okpo: data.okpo || data.OKPO || '',
            legalAddress: data.legalAddress || '',
            fax: data.faxNumber || '',
            website: data.linkToWebsite || '',
            checkingAccount: data.paymentAccount || '',
            correspondentAccount: data.correspondentAccount || '',
            bic: data.BIC || '',
            bankName: data.bankName || '',
          });
          this.originalFormValue = JSON.stringify(this.legalForm.value);
          this.legalForm.markAsPristine();
        }
      },
      error: (err) => {
        console.error('Ошибка загрузки данных клиента:', err);
      },
    });
  }

  // Сохранение обновленных данных клиента из формы заказа
  updateClientData(): void {
    const currentForm = this.getCurrentForm();
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
      // Остальные поля берутся из текущей формы
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
    const payload = {
      services_uuids: this.basketData.filter(i => i.selected).map(i => i.basketUuid),
      dtoInput:       this.getCurrentForm().value,
      clientType:     this.clientType,
    };
  
    this.basketService.createOrder(payload).pipe(
      // 1) достаём чистый UUID
      map((msg: string) => msg.split(':')[1].trim()),
      delay(300),
      // 2) сохраняем UUID и запрашиваем детали заказа
      switchMap(uuid => {
        this.orderUuid = uuid;
        return this.orderService.getOrderDetails(uuid);
      }),
      // 3) сохраняем бизнес-номер и загружаем PDF
      switchMap(order => {
        this.orderNumber = order.orderNumber;
        return this.basketService.getReceiptPdf(this.orderUuid);
      })
    ).subscribe({
      next: (blob: Blob) => {
        const url  = URL.createObjectURL(blob);
        const safe = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.pdfService.open(safe, {
          label: `Счёт №${this.orderNumber}`,
          actions: this.actionsTpl,
        }).subscribe();
  
        // очищаем корзину и обновляем счётчик
        this.currentStep = 2;
        this.basketData = [];
        this.totalAmount = 0;
        this.basketService.getBasketItemCount();
      },
      error: err => {
        console.error(err);
        this.alertService.open('Ошибка оформления заказа', { status: 'error' }).subscribe();
      }
    });
  }
  

  // Автодополнение DaData для компании (ИНН, наименование)
  onCompanyNameInput(query: string): void {
    const type = this.clientType;
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
    this.getCurrentForm().patchValue({
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
  }

  // Автодополнение DaData для банка
  onBankInput(query: string): void {
    const type = this.clientType;
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
    this.getCurrentForm().patchValue({
      bankName: data.name?.payment || data.name?.full || '',
      bic: data.bic || '',
      correspondentAccount: data.correspondent_account || '',
    });
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
