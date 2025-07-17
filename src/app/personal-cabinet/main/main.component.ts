import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TuiAlertService, TuiNotification } from '@taiga-ui/core';
import { StorageService } from '../../_services/storage.service';
import { ConfigService } from '../../config.service';
import { debounceTime } from 'rxjs';

export type ClientType = 'INDIVIDUALS' | 'ENTERPRISER' | 'LEGAL';

@Component({
  selector: 'main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
})
export class MainComponent implements OnInit {
  form!: FormGroup;

  private originalDataJson = '';

  isLoading = false;

  private readonly DADATA_API_TOKEN = this.configService.getDadataToken();

  companySuggestions: any[] = [];
  showCompanySuggestions = false;
  bankSuggestions: any[] = [];
  showBankSuggestions = false;

  // 1) кеш под-форм
  private readonly cache: Partial<Record<ClientType, FormGroup>> = {};

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private storageService: StorageService,
    private alerts: TuiAlertService,
    private configService: ConfigService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      clientType: new FormControl<ClientType>('INDIVIDUALS'),
      data: this.getGroup('INDIVIDUALS'),
    });

    const ctl = this.form.get('clientType') as FormControl<ClientType>;
    ctl.valueChanges.subscribe((type: ClientType) => {
      // 2) при переключении берём из кеша, а не создаём заново
      this.form.setControl('data', this.getGroup(type));
      this.setupDirtyTracking(); 
    });

    this.loadClientData();
  }

  private setupDirtyTracking() {
    // отписаться от предыдущих подписок, если нужно
    this.dataGroup.valueChanges
      .pipe(debounceTime(50))   // чтобы не гонять слишком часто
      .subscribe(() => {
        const now = JSON.stringify(this.dataGroup.value);
        if (now === this.originalDataJson) {
          this.dataGroup.markAsPristine();
        } else {
          this.dataGroup.markAsDirty();
        }
      });
  }

  /** Доступ к текущей под-группе */
  get dataGroup(): FormGroup {
    return this.form.get('data') as FormGroup;
  }

  /** Возвращает одну и ту же группу для каждого типа */
  private getGroup(type: ClientType): FormGroup {
    if (!this.cache[type]) {
      // на первом вызове — создаём и кладём в кеш
      this.cache[type] = this.buildGroup(type);
    }
    return this.cache[type]!;
  }

  /** Строит форму по типу клиента */
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
  
  /** Загрузка из API */
  private loadClientData(): void {
    const user = this.storageService.getUser();
    if (!user?.uuid) return;

    this.http.get<any>(`/api/client/?uuid=${user.uuid}`).subscribe({
      next: (data) => {
        const type = (data.clientType as ClientType) ?? 'INDIVIDUALS';

        // а) переключаем корневой clientType (сменит dataGroup)
        this.form.patchValue({ clientType: type });

        // б) патчим кешированную группу
        const payload = this.mapFromServer(type, data);
        this.getGroup(type).patchValue(payload);

        this.originalDataJson = JSON.stringify(this.dataGroup.value);
        this.dataGroup.markAsPristine();
      },
      error: (err) => console.error(err),
    });
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

  /** Сброс к серверным данным */
  onReset(): void {
    this.loadClientData();
  }

  /** Сохранение */
  onSave(): void {
    if (this.dataGroup.invalid) {
      this.alerts
        .open('Проверьте правильность заполнения полей', {
          status: TuiNotification.Error,
        })
        .subscribe();
      return;
    }
    const user = this.storageService.getUser();
    if (!user?.uuid) return;

    const payload = {
      uuid: user.uuid,
      clientType: this.form.value.clientType,
      ...this.dataGroup.value,
    };

    this.isLoading = true;
    this.http
      .put('/api/client/update', payload, { responseType: 'text' })
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.alerts
            .open('Данные успешно обновлены', {
              status: TuiNotification.Success,
            })
            .subscribe();
          this.dataGroup.markAsPristine();
        },
        error: (err) => {
          this.isLoading = false;
          this.alerts
            .open('Ошибка при сохранении данных', {
              status: TuiNotification.Error,
            })
            .subscribe();
          console.error(err);
        },
      });
  }

  // Автодополнение DaData для поиска компании (для ИП и ЮЛ)
  onCompanyNameInput(query: string): void {
    const type = this.form.get('clientType')!.value as ClientType;
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
    this.dataGroup.patchValue({
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
    this.dataGroup.markAsDirty();       
    this.dataGroup.markAllAsTouched();   
    this.dataGroup.updateValueAndValidity();
  }

  // Автодополнение DaData для банка
  onBankInput(query: string): void {
    const type = this.form.get('clientType')!.value as ClientType;
    if (!query || !query.trim() || type === 'INDIVIDUALS') {
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
    this.dataGroup.patchValue({
      bankName: data.name?.payment || data.name?.full || '',
      bic: data.bic || '',
      correspondentAccount: data.correspondent_account || '',
    });

  this.dataGroup.markAsDirty();
  this.dataGroup.markAllAsTouched();
  this.dataGroup.updateValueAndValidity();
  }
}
