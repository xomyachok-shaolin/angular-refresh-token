
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TuiAlertService, TuiNotification } from '@taiga-ui/core';
import { StorageService } from '../../_services/storage.service';
import { ConfigService } from '../../config.service';

export type ClientType = 'INDIVIDUAL' | 'ENTERPRISER' | 'LEGAL';
 
@Component({
  selector: 'main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
})
export class MainComponent implements OnInit {
  // Для каждого типа клиента своя форма
  individualForm: FormGroup;
  enterpriserForm: FormGroup;
  legalForm: FormGroup;
  // Текущий тип клиента (для переключения)
  clientType: ClientType = 'INDIVIDUAL';

  isLoading = false;
  // Сохраняем исходное значение формы для последующего сравнения
  private originalFormValue: string = '';

  // DaData токен
  private readonly DADATA_API_TOKEN = this.configService.getDadataToken();

  // Подсказки DaData для компании и банка
  companySuggestions: any[] = [];
  showCompanySuggestions = false;
  bankSuggestions: any[] = [];
  showBankSuggestions = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private storageService: StorageService,
    private alerts: TuiAlertService, 
    private configService: ConfigService
  ) {
    // Форма для физического лица
    this.individualForm = this.fb.group({
      clientType: ['INDIVIDUAL', Validators.required],
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
    // Загрузка данных с сервера (при этом выбирается нужная форма)
    this.loadClientData();

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
      case 'INDIVIDUAL':
        return this.individualForm;
      case 'ENTERPRISER':
        return this.enterpriserForm;
      case 'LEGAL':
        return this.legalForm;
      default:
        return this.individualForm;
    }
  }

  // Загрузка данных клиента с сервера
  loadClientData(): void {
    const user = this.storageService.getUser();
    if (!user || !user.uuid) {
      console.error('UUID пользователя не найден.');
      return;
    }
    this.http.get<any>(`/api/client/?uuid=${user.uuid}`).subscribe({
      next: (data) => {
        // Определяем тип клиента из данных
        this.clientType = data.clientType || 'INDIVIDUAL';
        // Заполняем нужную форму
        if (this.clientType === 'INDIVIDUAL') {
          this.individualForm.patchValue({
            clientType: data.clientType || 'INDIVIDUAL',
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
        console.error('Ошибка при получении данных клиента:', err);
      },
    });
  }

  // Сброс изменений – вернуть значения из базы (можно повторно вызвать loadClientData)
  onReset(): void {
    this.loadClientData();
  }

  // Сохранение изменений в личном кабинете
  onSave(): void {
    const currentForm = this.getCurrentForm();
    if (currentForm.invalid) {
      this.alerts
        .open('Проверьте правильность заполнения полей', {
          status: TuiNotification.Error,
        })
        .subscribe();
      return;
    }
    const user = this.storageService.getUser();
    if (!user || !user.uuid) {
      console.error('UUID пользователя не найден.');
      return;
    }
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
          this.alerts
            .open('Данные успешно обновлены', {
              status: TuiNotification.Success,
            })
            .subscribe();
          this.originalFormValue = JSON.stringify(currentForm.value);
          currentForm.markAsPristine();
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Ошибка при обновлении клиента:', err);
          this.alerts
            .open('Ошибка при сохранении данных', {
              status: TuiNotification.Error,
            })
            .subscribe();
        },
      });
  }

  // Автодополнение DaData для поиска компании (для ИП и ЮЛ)
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

  // Выбор подсказки DaData для компании
  selectCompanySuggestion(sugg: any): void {
    this.showCompanySuggestions = false;
    const data = sugg.data;
    // Заполняем поля, если они предусмотрены для ИП/ЮЛ
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
    if (!query || !query.trim() || type === 'INDIVIDUAL') {
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
}
