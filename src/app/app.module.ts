import { NgModule } from '@angular/core';
import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { tuiSvgOptionsProvider, TUI_SANITIZER, TuiSvgDefsHostModule, TuiButtonModule, TuiTextfieldControllerModule, TuiHintModule } from '@taiga-ui/core';
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

import { TuiRootModule, TuiDialogModule, TuiAlertModule, TuiSvgModule } from '@taiga-ui/core';
import {
  TuiInputModule, TuiCheckboxModule,
  TuiCheckboxLabeledModule, TuiInputPasswordModule,
  TuiTabsModule, TuiBadgedContentModule,
  TuiBadgeModule, TuiAvatarModule,
  TuiPaginationModule
} from '@taiga-ui/kit';
import { TuiTabBarModule } from '@taiga-ui/addon-mobile';
import { PersonalCabinetComponent } from './personal-cabinet/personal-cabinet.component';
import { OrdersComponent } from './orders/orders.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { MainComponent } from './personal-cabinet/main/main.component';
import { AdditionalComponent } from './personal-cabinet/additional/additional.component';
import { NotificationsComponent } from './personal-cabinet/notifications/notifications.component';
import { ActiveComponent } from './orders/active/active.component';
import { ArchivedComponent } from './orders/archived/archived.component';
import { OrderService } from './orders/order.service';

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
    ArchivedComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    TuiCheckboxLabeledModule,
    TuiPaginationModule,
    TuiSvgModule,
    TuiSvgDefsHostModule,
    TuiRootModule,
    TuiButtonModule,
    TuiDialogModule,
    TuiBadgeModule,
    TuiAvatarModule,
    TuiAlertModule,
    TuiInputModule,
    TuiTextfieldControllerModule,
    TuiHintModule,
    TuiTabsModule,
    TuiBadgedContentModule,
    TuiTabBarModule,
    TuiInputPasswordModule,
    TuiCheckboxModule,
    ReactiveFormsModule
  ],
  providers: [
    OrderService,
    httpInterceptorProviders,
    provideAnimations(),
    tuiSvgOptionsProvider({
      path: 'https://taiga-ui.dev/assets/taiga-ui/icons',
    }),
    {
      provide: TUI_SANITIZER,
      useClass: NgDompurifySanitizer,
    },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
