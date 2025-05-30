import { Component, Inject } from '@angular/core';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import { Order, Service } from '../order.model';

@Component({
  selector: 'app-order-details-dialog',
  templateUrl: './order-details-dialog.component.html',
  styleUrls: ['./order-details-dialog.component.less'],
})
export class OrderDetailsDialogComponent {
  constructor(
    @Inject(POLYMORPHEUS_CONTEXT)
    private readonly context: { data: Order },
  ) {}

  get order(): Order {
    return this.context.data;
  }
  /** Преобразуем статус оплаты в цвет тега */
  statusColor(status: string): 'success' | 'warning' | 'error' | 'neutral' {
    return status === 'Paid' ? 'success' : 'warning';
  }

  /** Читаем текстовое представление статуса выполнения */
  mapExecution(status: string): string {
    switch (status) {
      case 'Paid':        return 'Оплачено';
      case 'Ready':       return 'Готово';
      case 'inProcessing':return 'В обработке';
      default:            return status;
    }
  }

  /** Отображаем значение параметра в зависимости от типа */
  showValue(p: any): string {
    if (p.parametersType === 'CHECKBOX') {
      return p.restrictions?.defaultValue ? 'Да' : 'Нет';
    }
    if (p.parametersType === 'COUNT') {
      return String(p.restrictions?.defaultValue);
    }
    // По умолчанию просто выводим raw-значение
    return p.values ?? '';
  }
}
