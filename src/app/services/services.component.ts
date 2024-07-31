import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import 'leaflet-draw';
import drawLocales from 'leaflet-draw-locales';
import * as turf from '@turf/turf';

drawLocales('ru');

interface Service {
  uuid: string;
  title: string;
  parameters: any[];
}

interface Parameter {
  title: string;
  cost: number;
  parametersType: string;
  restrictions: any;
  polygon?: {
    points: { x: number; y: number }[];
  };
}

@Component({
  selector: 'app-services',
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss'],
})
export class ServicesComponent implements OnInit {
  map: any;
  drawControl: any;
  services: Service[] = [];
  filteredServices: Service[] = [];
  parameters: Parameter[] = [];
  filteredParameters: Parameter[] = [];
  selectedService: Service | null = null;
  selectedParameter: Parameter | null = null;
  drawnPolygons: L.Polygon[] = [];
  drawnLayers: L.FeatureGroup = L.featureGroup();
  isDrawingEnabled: boolean = false;
  isConfirmDisabled: boolean = true;
  restrictionPolygon: GeoJSON.Feature<GeoJSON.Polygon> | null = null;
  errorTooltip: L.Draw.Tooltip | null = null;

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.initMap();
    this.fetchServices();
  }

  initMap(): void {
    setTimeout(() => {
      this.map = L.map('map', { attributionControl: false }).setView([56.8519, 60.6122], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(this.map);

      this.map.addLayer(this.drawnLayers);

      this.drawControl = new L.Control.Draw({
        edit: {
          featureGroup: this.drawnLayers,
          remove: true,
        },
        draw: {
          polygon: {
            shapeOptions: {
              color: '#97009c'
            },
            allowIntersection: false, // Prevent intersections
            showArea: false,
            drawError: {
              color: '#e1e100',
              message: 'Невозможно нарисовать это пересечение.'
            }
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
      });

      this.map.addControl(this.drawControl);

      this.map.on(L.Draw.Event.CREATED, (event: any) => {
        const layer = event.layer;
        if (this.checkPolygonInRestriction(layer)) {
          this.drawnLayers.addLayer(layer);
          this.isConfirmDisabled = false;
        } else {
          alert('Нарисованный многоугольник должен находиться внутри ограниченной зоны.');
          this.map.removeLayer(layer);
        }
      });

      this.map.on('draw:drawvertex', (event: any) => {
        const layers = event.layers.getLayers();
        if (layers.length > 0) {
          const layer = layers[0];
          if (layer && layer instanceof L.Marker) {
            const latlng = layer.getLatLng();
            const point = turf.point([latlng.lng, latlng.lat]);
            if (this.restrictionPolygon && !turf.booleanPointInPolygon(point, this.restrictionPolygon)) {
              this.map.removeLayer(layer);
              this.showErrorTooltip('Нарисованный многоугольник должен находиться внутри ограниченной зоны.', latlng);

              const drawHandler = this.drawControl._toolbars.draw._modes.polygon.handler;
              setTimeout(() => {
                drawHandler.disable();
                drawHandler.enable();
              }, 0);

              return;
            }
          }
        }
      });

      this.map.on('draw:error', (event: any) => {
        const error = event.message;
        const layer = event.layer;
        let latlng;

        if (layer && layer.getLatLng) {
          latlng = layer.getLatLng();
        } else {
          latlng = this.map.getCenter(); // Если не удается получить координаты, используем центр карты
        }

        this.showErrorTooltip(error, latlng);
      });

      this.map.on('mousemove', (event: any) => {
        if (this.errorTooltip) {
          this.errorTooltip.updatePosition(event.latlng);
        }
      });

      this.map.on(L.Draw.Event.DELETED, () => {
        if (this.drawnLayers.getLayers().length === 0) {
          this.isConfirmDisabled = true;
        }
      });

      this.map.on(L.Draw.Event.DRAWSTOP, () => {
        if (this.drawnLayers.getLayers().length === 0) {
          this.isConfirmDisabled = true;
        }
      });

    }, 100);
  }

  startDrawing(): void {
    if (!this.isDrawingEnabled) {
      this.map.addControl(this.drawControl);
      this.isDrawingEnabled = true;
      const drawPolygonButton = document.querySelector('.leaflet-draw-draw-polygon');
      if (drawPolygonButton) {
        (drawPolygonButton as HTMLElement).click();
      }
    }
  }

  resetDrawingState(): void {
    if (this.isDrawingEnabled) {
      this.map.removeControl(this.drawControl);
      this.isDrawingEnabled = false;
    }
    this.isConfirmDisabled = true;
    this.clearPolygons();
  }

  fetchServices(): void {
    this.http.get<Service[]>('/api/service/all').subscribe({
      next: (data) => {
        this.services = data;
        this.filteredServices = data;
      },
      error: (error) => console.error('There was an error fetching services!', error)
    });
  }

  fetchParameters(serviceUuid: string): void {
    this.http.get<{ parameters: Parameter[] }>(`/api/service/parameters?uuid=${serviceUuid}`).subscribe({
      next: (data) => {
        this.parameters = data.parameters;
        this.filteredParameters = data.parameters;
        this.drawServicePolygons();
      },
      error: (error) => console.error('There was an error fetching parameters!', error)
    });
  }

  onServiceChange(service: Service): void {
    this.selectedService = service;
    this.parameters = [];
    this.selectedParameter = null;
    this.resetDrawingState();
    if (service) {
      this.fetchParameters(service.uuid);
    }
  }

  onParameterChange(parameter: Parameter): void {
    this.selectedParameter = parameter;
    this.clearPolygons();
    this.drawServicePolygons();
  }

  drawServicePolygons(): void {
    if (!this.selectedService) {
      return;
    }

    this.selectedService.parameters.forEach(parameter => {
      if (parameter.polygon) {
        const points: L.LatLngTuple[] = parameter.polygon.points.map((point: { x: number, y: number }) => [point.y, point.x]);
        const polygon = L.polygon(points).addTo(this.map);
        this.drawnPolygons.push(polygon);
        const closedPoints = points.concat([points[0]]);
        this.restrictionPolygon = turf.polygon([closedPoints.map(point => [point[1], point[0]])]);
      }
    });

    if (this.drawnPolygons.length > 0) {
      const allBounds = this.drawnPolygons.map(polygon => polygon.getBounds());
      const combinedBounds = allBounds.reduce((acc, bounds) => acc.extend(bounds), L.latLngBounds([]));
      this.map.fitBounds(combinedBounds);
    }
  }

  clearPolygons(): void {
    this.drawnPolygons.forEach(polygon => this.map.removeLayer(polygon));
    this.drawnPolygons = [];
    this.drawnLayers.clearLayers();
    this.restrictionPolygon = null;
  }

  filterServices(event: Event): void {
    const input = event.target as HTMLInputElement;
    const query = input.value;
    this.filteredServices = this.services.filter(service => service.title.toLowerCase().includes(query.toLowerCase()));
  }

  filterParameters(event: Event): void {
    const input = event.target as HTMLInputElement;
    const query = input.value;
    this.filteredParameters = this.parameters.filter(parameter => parameter.title.toLowerCase().includes(query.toLowerCase()));
  }

  getServiceTitle(service: Service | null): string {
    return service ? service.title : '';
  }

  getParameterTitle(parameter: Parameter | null): string {
    return parameter ? parameter.title : '';
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  checkPolygonInRestriction(layer: L.Layer): boolean {
    if (this.selectedParameter && this.selectedParameter.polygon && this.selectedParameter.restrictions.mustBeInside) {
      const restrictionPolygon = turf.polygon([
        this.selectedParameter.polygon.points.map(point => [point.x, point.y])
      ]);
      const drawnPolygonCoords = (layer as L.Polygon).getLatLngs() as L.LatLng[][];
      const drawnPolygon = turf.polygon([drawnPolygonCoords[0].map((point: L.LatLng) => [point.lng, point.lat])]);

      return turf.booleanContains(restrictionPolygon, drawnPolygon);
    }
    return true;
  }

  showErrorTooltip(message: string, latlng: L.LatLng): void {
    if (this.errorTooltip) {
      this.errorTooltip.dispose();
    }
    this.errorTooltip = new L.Draw.Tooltip(this.map);
    this.errorTooltip.updateContent({ text: message });
    this.errorTooltip.updatePosition(latlng);
    this.errorTooltip.showAsError();
    setTimeout(() => {
      if (this.errorTooltip) {
        this.errorTooltip.dispose();
        this.errorTooltip = null;
      }
    }, 1200);
  }
}
