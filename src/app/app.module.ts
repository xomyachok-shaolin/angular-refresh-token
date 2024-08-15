import { NgModule } from '@angular/core';
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
  TUI_ICONS,
  TUI_ICONS_PATH,
  TuiRootModule,
  TuiDialogModule,
  TuiAlertModule,
  TuiSvgModule,
  TuiScrollbarModule,
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
  TuiSelectModule,
  TuiMultiSelectModule,
  TuiInputNumberModule,
  TuiSelectOptionModule,
  TuiAccordionModule,
  TuiDataListWrapperModule,
  TuiComboBoxModule,
  TuiInputRangeModule,
  TuiToggleModule,
} from '@taiga-ui/kit';
import {
  TuiDropdownMobileModule,
  TuiTabBarModule,
} from '@taiga-ui/addon-mobile';
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
import { TuiDropdownHostModule } from '@taiga-ui/cdk';
import { ServicesComponent } from './services/services.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
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
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    TuiAccordionModule,
    TuiCheckboxLabeledModule,
    TuiNotificationModule,
    TuiPaginationModule,
    TuiSvgModule,
    TuiScrollbarModule,
    TuiTableModule,
    TuiSvgDefsHostModule,
    TuiInputDateRangeModule,
    TuiSelectModule,
    TuiSelectOptionModule,
    TuiCheckboxModule,
    TuiInputRangeModule,
    TuiToggleModule,
    TuiInputModule,
    TuiMultiSelectModule,
    TuiRootModule,
    TuiButtonModule,
    TuiDialogModule,
    TuiBadgeModule,
    TuiAvatarModule,
    TuiAlertModule,
    TuiTextfieldControllerModule,
    TuiHintModule,
    TuiTabsModule,
    TuiBadgedContentModule,
    TuiTabBarModule,
    TuiInputPasswordModule,
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
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
