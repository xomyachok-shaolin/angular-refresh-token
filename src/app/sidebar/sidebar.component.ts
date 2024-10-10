import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  constructor(private router: Router) {}

  get isAuthRoute() {
    // Checks if the current route is '/login'
    return this.router.url === '/login' || this.router.url === '/register' || this.router.url === '/forgot-password' || this.router.url === '/reset-password';
  }
}
