import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface Card {
  title: string;
  image: string;
  description: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  cards: Card[] = [
    {
      title: 'Сервис услуг',
      image: 'assets/services.png',
      description: 'Описание сервиса услуг. Здесь можно добавить информацию о сервисе.',
    },
    {
      title: 'Сервис услуг',
      image: 'assets/services1.png',
      description: 'Описание сервиса услуг. Здесь можно добавить информацию о сервисе.',
    },
    {
      title: 'Сервис услуг',
      image: 'assets/services2.png',
      description: 'Описание сервиса услуг. Здесь можно добавить информацию о сервисе.',
    },
  ];

  constructor(private router: Router) {
    console.log('HomeComponent constructor called');
  }

  ngOnInit(): void {
    console.log('HomeComponent ngOnInit called');
  }
  navigateToServices(): void {
    this.router.navigate(['/services']);
  }
}
