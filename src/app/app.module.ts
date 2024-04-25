import { NgModule } from '@angular/core';
import {BrowserAnimationsModule, provideAnimations} from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms'; 
import {tuiSvgOptionsProvider, TUI_SANITIZER, TuiSvgDefsHostModule, TuiButtonModule, TuiTextfieldControllerModule, TuiHintModule} from '@taiga-ui/core';
import {NgDompurifySanitizer} from '@tinkoff/ng-dompurify';
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
import { TuiInputModule, TuiCheckboxModule, 
  TuiCheckboxLabeledModule, TuiInputPasswordModule,
  TuiTabsModule, TuiBadgedContentModule, 
  TuiBadgeModule,
  TuiAvatarModule} from '@taiga-ui/kit';
import {TuiTabBarModule} from '@taiga-ui/addon-mobile';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,
    HomeComponent,
    ProfileComponent,
    BoardAdminComponent,
    BoardModeratorComponent,
    BoardUserComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule, 
    TuiCheckboxLabeledModule,
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
  providers: [httpInterceptorProviders,
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
