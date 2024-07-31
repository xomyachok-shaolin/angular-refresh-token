import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { RegisterComponent } from './register/register.component';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { ProfileComponent } from './profile/profile.component';
import { BoardUserComponent } from './board-user/board-user.component';
import { BoardModeratorComponent } from './board-moderator/board-moderator.component';
import { BoardAdminComponent } from './board-admin/board-admin.component';
import { PersonalCabinetComponent } from './personal-cabinet/personal-cabinet.component';
import { MainComponent } from './personal-cabinet/main/main.component';
import { AdditionalComponent } from './personal-cabinet/additional/additional.component';
import { NotificationsComponent } from './personal-cabinet/notifications/notifications.component';
import { OrdersComponent } from './orders/orders.component';
import { ActiveComponent } from './orders/active/active.component';
import { ArchivedComponent } from './orders/archived/archived.component';
import { ServicesComponent } from './services/services.component';

const routes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'user', component: BoardUserComponent },
  { path: 'services', component: ServicesComponent },
  { path: 'mod', component: BoardModeratorComponent },
  { path: 'admin', component: BoardAdminComponent },
  { path: 'personal-cabinet', component: PersonalCabinetComponent, children: [
    { path: 'main', component: MainComponent },
    { path: 'additional', component: AdditionalComponent },
    { path: 'notifications', component: NotificationsComponent },
    { path: '', redirectTo: 'main', pathMatch: 'full' }
  ]
},
{ path: 'orders', component: OrdersComponent, children: [
    { path: 'active', component: ActiveComponent },
    { path: 'archived', component: ArchivedComponent },
    { path: '', redirectTo: 'active', pathMatch: 'full' }
  ]
},
  { path: '', redirectTo: 'home', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
