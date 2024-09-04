import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { StorageService } from '../../_services/storage.service';

@Component({
  selector: 'main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  companyName = 'Наименование компании';
  directorName = 'Неизвестно';
  actualAddress = 'Неизвестно';
  legalAddress = 'Неизвестно';
  contacts = 'Неизвестно';
  email = 'Неизвестно';
  phone = 'Неизвестно';

  constructor(private http: HttpClient, private storageService: StorageService) {}

  ngOnInit() {
    this.loadMain();
  }

  loadMain() {
    const user = this.storageService.getUser();
    if (user && user.uuid) {
      this.http.get<any>(`/api/client/?uuid=${user.uuid}`).subscribe(data => {
        this.companyName = data.companyName || 'Неизвестно';
        this.directorName = `${data.lastName || ''} ${data.firstName || ''} ${data.middleName || ''}`.trim() || 'Неизвестно';
        this.actualAddress = data.actualAddress || 'Неизвестно';
        this.legalAddress = data.legalAddress || 'Неизвестно';
        this.contacts = data.contacts || 'Неизвестно';
        this.email = data.email || 'Неизвестно';
        this.phone = data.phone || 'Неизвестно';
      }, error => {
        console.error('Ошибка при получении информации о компании:', error);
      });
    } else {
      console.error('UUID пользователя не найден.');
    }
  }
}
