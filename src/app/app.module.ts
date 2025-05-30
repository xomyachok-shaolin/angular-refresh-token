import { of } from 'rxjs';
import { TUI_LANGUAGE, TUI_RUSSIAN_LANGUAGE, TuiLanguage } from '@taiga-ui/i18n';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import {
  BrowserAnimationsModule,
  provideAnimations,
} from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import {
  tuiSvgOptionsProvider,
  TUI_SANITIZER,
  TuiSvgDefsHostModule,
  TuiButtonModule,
  TuiTextfieldControllerModule,
  TuiHintModule,
  TuiDropdownModule,
  TuiDataListModule,
  TuiHostedDropdownModule,
  TuiLoaderModule,
  TuiNotificationModule,
  TuiRootModule,
  TuiDialogModule,
  TuiAlertModule,
  TuiSvgModule,
  TuiScrollbarModule,
  TuiLinkModule,
  TuiModeModule,
  TuiScrollIntoViewModule,
  TuiErrorModule,
  TuiGroupModule,
} from '@taiga-ui/core';

import { NgDompurifySanitizer } from '@tinkoff/ng-dompurify';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { HomeComponent } from './home/home.component';
import { ProfileComponent } from './profile/profile.component';
import { BoardAdminComponent } from './board-admin/board-admin.component';
import { BoardModeratorComponent } from './board-moderator/board-moderator.component';
import { BoardUserComponent } from './board-user/board-user.component';

import { httpInterceptorProviders } from './_helpers/http.interceptor';

import {
  TuiInputModule,
  TuiCheckboxModule,
  TuiCheckboxLabeledModule,
  TuiInputPasswordModule,
  TuiTabsModule,
  TuiBadgedContentModule,
  TuiBadgeModule,
  TuiAvatarModule,
  TuiPaginationModule,
  TuiInputDateRangeModule,
  TuiIslandModule,
  TuiSelectModule,
  TuiMultiSelectModule,
  TuiInputNumberModule,
  TuiSelectOptionModule,
  TuiAccordionModule,
  TuiDataListWrapperModule,
  TuiComboBoxModule,
  TuiInputRangeModule,
  TuiToggleModule,
  TuiHighlightModule,
  TuiInputSliderModule,
  TuiTextareaModule,
  TuiStepperModule,
  TuiInputFilesModule,
  TuiFieldErrorPipeModule,
  TuiRadioBlockModule,
  TuiRadioModule,
  TuiTagModule,
  TuiInputInlineModule,
  TuiInputPhoneModule,
  TUI_VALIDATION_ERRORS,
  TuiPdfViewerModule,
} from '@taiga-ui/kit';
import {
  TuiDropdownMobileModule,
  TuiTabBarModule,
} from '@taiga-ui/addon-mobile';
import { PolymorpheusModule }       from '@tinkoff/ng-polymorpheus';
import { TuiSurfaceModule } from '@taiga-ui/experimental';
import { TuiMoneyModule } from '@taiga-ui/addon-commerce';
import { PersonalCabinetComponent } from './personal-cabinet/personal-cabinet.component';
import { OrdersComponent } from './orders/orders.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { MainComponent } from './personal-cabinet/main/main.component';
import { AdditionalComponent } from './personal-cabinet/additional/additional.component';
import { NotificationsComponent } from './personal-cabinet/notifications/notifications.component';
import { ActiveComponent } from './orders/active/active.component';
import { ArchivedComponent } from './orders/archived/archived.component';
import { OrderService } from './_services/order.service';
import { TuiTableFiltersModule, TuiTableModule } from '@taiga-ui/addon-table';
import {
  TuiDropdownHostModule,
  TuiOverscrollModule,
  TuiScrollControlsModule,
} from '@taiga-ui/cdk';
import { ServicesComponent } from './services/services.component';
import { CommonModule } from '@angular/common';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { BasketComponent } from './basket/basket.component';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ConfigService } from './config.service';
import { OrderDetailsDialogComponent } from './orders/order-details-dialog/order-details-dialog.component';
import { PolygonViewerComponent } from './orders/order-details-dialog/polygon-viewer.component';

export function initializeApp(configService: ConfigService) {
  return () => configService.loadConfig();
}

// Создаем «кастомную» копию русского языка:
const TUI_RUSSIAN_LANGUAGE_CUSTOM: TuiLanguage = {
  ...TUI_RUSSIAN_LANGUAGE,
  digitalInformationUnits: ['Б', 'КБ', 'МБ'], // вместо B, KiB, MiB
};


@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    OrderDetailsDialogComponent,
    PolygonViewerComponent,
    RegisterComponent,
    HomeComponent,
    ProfileComponent,
    BoardAdminComponent,
    BoardModeratorComponent,
    BoardUserComponent,
    PersonalCabinetComponent,
    OrdersComponent,
    SidebarComponent,
    MainComponent,
    AdditionalComponent,
    NotificationsComponent,
    ActiveComponent,
    ArchivedComponent,
    ServicesComponent,
    ForgotPasswordComponent,
    ResetPasswordComponent,
    BasketComponent,
  ],
  imports: [
    PolymorpheusModule,
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    TuiErrorModule,
    TuiPdfViewerModule,
    TuiAccordionModule,
    TuiIslandModule,
    TuiCheckboxLabeledModule,
    TuiNotificationModule,
    TuiPaginationModule,
    TuiSurfaceModule,
    TuiHighlightModule,
    TuiStepperModule,
    TuiSvgModule,
    TuiLinkModule,
    TuiMoneyModule,
    TuiModeModule,
    TuiInputInlineModule,
    TuiGroupModule,
    TuiRadioModule,
    TuiRadioBlockModule,
    TuiTagModule,
    TuiInputFilesModule,
    TuiScrollbarModule,
    TuiScrollIntoViewModule,
    TuiScrollControlsModule,
    TuiFieldErrorPipeModule,
    TuiOverscrollModule,
    ScrollingModule,
    TuiTableModule,
    TuiSvgDefsHostModule,
    TuiInputDateRangeModule,
    TuiSelectModule,
    TuiSelectOptionModule,
    TuiInputRangeModule,
    TuiToggleModule,
    TuiInputModule,
    TuiMultiSelectModule,
    TuiRootModule,
    TuiButtonModule,
    TuiDialogModule,
    TuiBadgeModule,
    TuiBadgedContentModule,
    TuiAvatarModule,
    TuiAlertModule,
    TuiTextfieldControllerModule,
    TuiTextareaModule,
    TuiHintModule,
    TuiTabsModule,
    TuiTabBarModule,
    TuiInputPhoneModule,
    TuiInputPasswordModule,
    TuiInputSliderModule,
    TuiCheckboxModule,
    TuiDropdownModule,
    TuiDropdownMobileModule,
    TuiDropdownHostModule,
    TuiComboBoxModule,
    TuiDataListModule,
    TuiDataListWrapperModule,
    TuiInputNumberModule,
    TuiLoaderModule,
    TuiTableFiltersModule,
    TuiHostedDropdownModule,
    TuiAlertModule,
    ReactiveFormsModule,
    CommonModule,
  ],
  providers: [
    OrderService,
    httpInterceptorProviders,
    provideAnimations(),
    tuiSvgOptionsProvider({
      path: 'assets/taiga-ui/icons',
    }),
    {
      provide: TUI_SANITIZER,
      useClass: NgDompurifySanitizer,
    },
    {
      provide: TUI_LANGUAGE,
      useValue: of(TUI_RUSSIAN_LANGUAGE_CUSTOM),
    },
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: {
        required: 'Поле обязательно для заполнения',
        email: 'Введите корректный email',
        minlength: ({requiredLength}: {requiredLength: number}) =>
          `Минимальная длина ${requiredLength} символов`,
        maxlength: ({requiredLength}: {requiredLength: number}) =>
          `Максимальная длина ${requiredLength} символов`,
        pattern: 'Неверный формат',
        min: ({min}: {min: number}) => `Минимальное значение ${min}`,
      },
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [ConfigService],
      multi: true
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
