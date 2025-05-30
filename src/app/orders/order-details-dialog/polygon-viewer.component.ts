// polygon-viewer.component.ts
import { Component, Input, OnInit, ElementRef } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-polygon-viewer',
  template: '<div class="map" style="height:200px;"></div>',
})
export class PolygonViewerComponent implements OnInit {
  @Input() polygon!: { points: { x: number; y: number }[] };

  constructor(private el: ElementRef) {}

  ngOnInit() {
    const dom = this.el.nativeElement.firstChild as HTMLElement;
    const coords = this.polygon.points.map(pt => [pt.y, pt.x] as [number, number]);

    const map = L.map(dom, {
      attributionControl: false,  // <-- отключили подпись Leaflet
    }).setView(coords[0], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: ''          // <-- убрали текст
    }).addTo(map);

    L.polygon(coords, { weight: 2 }).addTo(map);
    map.fitBounds(coords);
  }
}
