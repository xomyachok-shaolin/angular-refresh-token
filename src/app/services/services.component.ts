import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import 'leaflet-draw';
import drawLocales from 'leaflet-draw-locales';
import * as turf from '@turf/turf';
import { FormControl } from '@angular/forms';
import { TuiDialogService, tuiNumberFormatProvider } from '@taiga-ui/core';
import './SmoothWheelZoom.js';

drawLocales('ru');

declare module 'leaflet' {
  interface MapOptions {
    smoothWheelZoom?: boolean;
    smoothSensitivity?: number;
  }
  interface Polygon {
    restrictionPolygon?: L.Polygon;
    originalLatLngs?: number[][][];
    editing: any;
  }
}

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
  providers: [
    tuiNumberFormatProvider({
      zeroPadding: false,
    }),
  ],
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
  restrictionPolygons: L.Polygon[] = [];
  errorTooltip: L.Draw.Tooltip | null = null;
  area: number = 0;
  heightEnabled: boolean = false;

  readonly sliderStep = 1;
  readonly quantum = 0.00001;

  min = 0;
  max = 100;
  steps = (this.max - this.min) / this.sliderStep;
  control = new FormControl([this.min, this.max]);

  isLoading: boolean = true;
  selectedRestrictionPolygon: L.Polygon | null = null;

  private readonly dialogs = inject(TuiDialogService);

  private cloneLatLngs(latlngs: L.LatLng[][]): number[][][] {
    return latlngs.map((ring) =>
      ring.map((latlng) => [latlng.lat, latlng.lng])
    );
  }

  formattedArea: string = '';

  showYearRangeSlider: boolean = false;
  yearRangeControl: FormControl<[number, number] | null> = new FormControl([
    2000, 2023,
  ]);
  minYear: number = 2000;
  maxYear: number = 2023;
  yearSteps: number = this.maxYear - this.minYear;
  restrictionPolygonsData: any[] = [];
  legendControl: L.Control | null = null;

  openServiceAccordion: boolean = true; // Service Selection Accordion
  openParametersAccordion: boolean = false; // Parameters Accordion
  openCalculationAccordion: boolean = false; // Calculation Accordion
  openCheckoutAccordion: boolean = false; // Checkout Accordion

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.initMap();
    this.fetchServices();

    // Subscribe to valueChanges of the yearRangeControl
    this.yearRangeControl.valueChanges.subscribe(
      (range: [number, number] | null) => {
        if (range) {
          this.onYearRangeChange(range);
        }
      }
    );

    this.fetchRestrictionPolygons();
  }

  initMap(): void {
    setTimeout(() => {
      this.map = L.map('map', {
        scrollWheelZoom: false, // disable original zoom function
        smoothWheelZoom: true, // enable smooth zoom
        smoothSensitivity: 1, // zoom speed. default is 1

        attributionControl: false,
      }).setView([56.8519, 60.6122], 11);
      L.tileLayer('/tiles/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
              color: 'magenta',
              fillOpacity: 0.2,
            },
            allowIntersection: false,
            showArea: false,
            drawError: {
              color: '#e1e100',
              message: 'Невозможно нарисовать это пересечение.',
            },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
      });

      // this.map.addControl(this.drawControl);

      this.map.on(L.Draw.Event.CREATED, (event: any) => {
        const layer = event.layer;
        layer.restrictionPolygon = this.selectedRestrictionPolygon;
        this.drawnLayers.addLayer(layer);
        this.isConfirmDisabled = false;
        this.updateArea();

        // Добавляем обработчики событий для изменения непрозрачности заливки при наведении
        layer.on('mouseover', function () {
          layer.setStyle({ fillOpacity: 0.5 }); // Увеличиваем непрозрачность при наведении
        });
        layer.on('mouseout', function () {
          layer.setStyle({ fillOpacity: 0.2 }); // Возвращаем непрозрачность при уходе курсора
        });
      });

      this.map.on(L.Draw.Event.DRAWSTART, (event: any) => {
        this.map.once('click', (e: L.LeafletMouseEvent) => {
          const latlng = e.latlng;
          let foundPolygon = false;

          for (const poly of this.restrictionPolygons) {
            if (this.isPointInPolygon(latlng, [poly])) {
              this.selectedRestrictionPolygon = poly;
              poly.setStyle({ color: 'cyan' });
              foundPolygon = true;
              break;
            }
          }

          if (!foundPolygon) {
            this.showErrorTooltip(
              'Рисование можно начать только внутри одного из ограничивающих полигонов.',
              latlng
            );
            const drawHandler =
              this.drawControl._toolbars.draw._modes.polygon.handler;
            drawHandler.disable();
            drawHandler.enable();
          }
        });
      });

      this.map.on('draw:editstart', (event: any) => {
        const layers = this.drawnLayers.getLayers();
        layers.forEach((layer) => {
          if (layer instanceof L.Polygon) {
            const polygon = layer as L.Polygon;
            polygon.originalLatLngs = this.cloneLatLngs(
              polygon.getLatLngs() as L.LatLng[][]
            );
          }
        });
      });

      this.map.on('draw:editvertex', (event: any) => {
        const layer = event.layer;
        if (layer instanceof L.Polygon) {
          const polygon = layer as L.Polygon;
          const latLngs = polygon.getLatLngs() as L.LatLng[][];
          let isValid = true;

          for (const latLng of latLngs[0]) {
            if (
              polygon.restrictionPolygon &&
              !this.isPointInPolygon(latLng, [polygon.restrictionPolygon])
            ) {
              isValid = false;
              break;
            }
          }

          if (!isValid) {
            this.drawControl._toolbars['edit'].disable();

            this.showErrorTooltip(
              'Полигоны нельзя редактировать за пределами выбранной области.',
              polygon.getBounds().getCenter()
            );
          } else {
            // Update originalLatLngs to the new valid coordinates
            polygon.originalLatLngs = this.cloneLatLngs(
              polygon.getLatLngs() as L.LatLng[][]
            );
          }
        }
      });

      this.map.on(L.Draw.Event.EDITED, (event: any) => {
        const layers = event.layers;
        layers.eachLayer((layer: L.Layer) => {
          if (layer instanceof L.Polygon) {
            const polygon = layer as L.Polygon;
            const latLngs = polygon.getLatLngs() as L.LatLng[][];
            let isValid = true;

            for (const latLng of latLngs[0]) {
              if (
                polygon.restrictionPolygon &&
                !this.isPointInPolygon(latLng, [polygon.restrictionPolygon])
              ) {
                isValid = false;
                break;
              }
            }

            if (!isValid) {
              this.drawControl._toolbars['edit'].disable();
              this.showErrorTooltip(
                'Отредактированный многоугольник должен находиться внутри ограниченной зоны.',
                polygon.getBounds().getCenter()
              );
            }
          }
        });
        this.updateArea();
      });

      this.map.on('draw:drawvertex', (event: any) => {
        const layers = event.layers.getLayers();
        for (let layer of layers) {
          if (layer && layer instanceof L.Marker) {
            const latlng = layer.getLatLng();
            if (
              this.selectedRestrictionPolygon &&
              !this.isPointInPolygon(latlng, [this.selectedRestrictionPolygon])
            ) {
              this.showErrorTooltip(
                'Вы можете рисовать только внутри выбранного полигона.',
                latlng
              );
              const drawHandler =
                this.drawControl._toolbars.draw._modes.polygon.handler;
              if (drawHandler._poly?.getLatLngs().length <= 1) {
                setTimeout(() => {
                  drawHandler.disable();
                  drawHandler.enable();
                }, 0);
              } else {
                drawHandler.deleteLastVertex();
              }
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
          latlng = this.map.getCenter();
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
        this.updateArea();
      });

      this.map.on(L.Draw.Event.DRAWSTOP, () => {
        if (this.drawnLayers.getLayers().length === 0) {
          this.isConfirmDisabled = true;
        }
        this.updateArea();

        this.map.off('mousemove', this.onDrawingMouseMove);
        // Сбросить стиль выбранного полигона, если необходимо
        if (this.selectedRestrictionPolygon) {
          this.selectedRestrictionPolygon.setStyle({ color: '#3388ff' });
          this.selectedRestrictionPolygon = null;
        }
      });
    }, 1000);
  }

  onDrawingMouseMove = (event: L.LeafletMouseEvent) => {
    const latlng = event.latlng;
    let foundPolygon = false;

    for (const poly of this.restrictionPolygons) {
      if (this.isPointInPolygon(latlng, [poly])) {
        if (this.selectedRestrictionPolygon !== poly) {
          // Сбросить стиль предыдущего полигона
          if (this.selectedRestrictionPolygon) {
            this.selectedRestrictionPolygon.setStyle({ color: '#3388ff' });
          }
          // Установить новый выбранный полигон
          this.selectedRestrictionPolygon = poly;
          poly.setStyle({ color: 'cyan' });
        }
        foundPolygon = true;
        break;
      }
    }

    if (!foundPolygon && this.selectedRestrictionPolygon) {
      // Если курсор не над полигоном, сбросить стиль
      this.selectedRestrictionPolygon.setStyle({ color: '#3388ff' });
      this.selectedRestrictionPolygon = null;
    }
  };

  updateArea(): void {
    const areaValue =
      this.drawnLayers.getLayers().reduce((sum, layer) => {
        if (layer instanceof L.Polygon) {
          const latLngs = layer.getLatLngs() as L.LatLng[][];
          const coords = latLngs[0].map((latLng) => [latLng.lng, latLng.lat]);

          // Ensure the polygon is closed
          if (
            coords[0][0] !== coords[coords.length - 1][0] ||
            coords[0][1] !== coords[coords.length - 1][1]
          ) {
            coords.push(coords[0]);
          }

          const polygon = turf.polygon([coords]);
          return sum + turf.area(polygon);
        }
        return sum;
      }, 0) / 10000; // Convert to hectares

    // Format the area without commas and with two decimal places
    this.formattedArea = areaValue.toFixed(2).replace(/,/g, '');
  }

  removeLastVertex() {
    const lastPolygon =
      this.drawnLayers.getLayers()[this.drawnLayers.getLayers().length - 1];
    if (lastPolygon && lastPolygon instanceof L.Polygon) {
      const latlngs = lastPolygon.getLatLngs() as L.LatLng[][];
      if (latlngs[0].length > 1) {
        latlngs[0].pop();
        lastPolygon.setLatLngs(latlngs);
      }
    }
  }

  startDrawing(): void {
    if (!this.selectedService) {
      this.showWarningDialog();
      return;
    }

    if (!this.isDrawingEnabled) {
      this.map.addControl(this.drawControl);
      this.isDrawingEnabled = true;
      const drawPolygonButton = document.querySelector(
        '.leaflet-draw-draw-polygon'
      );
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
    const url = '/api/service/all';
    this.http.get<Service[]>(url).subscribe({
      next: (data) => {
        this.services = data;
        this.filteredServices = data;
      },
      error: (error) =>
        console.error('There was an error fetching services!', error),
    });
  }

  onAccordionItemOpen(index: number): void {
    if (!this.selectedService) {
      this.showWarningDialog();
    }
  }

  showWarningDialog(): void {
    this.dialogs
      .open(
        '<div><strong>Внимание:</strong> Не закончено заполнение услуги.</div>',
        { label: 'Предупреждение', size: 'm' }
      )
      .subscribe();
  }

  fetchParameters(serviceUuid: string): void {
    const url = `/api/service/parameters?uuid=${serviceUuid}`;
    this.http.get<{ parameter: any }>(url).subscribe({
      next: (data) => {
        if (data && data.parameter) {
          this.parameters = [data.parameter]; // Convert the single parameter object into an array
          this.filteredParameters = this.parameters;
          this.selectedParameter = this.parameters[0];
          this.onParameterChange(this.selectedParameter);
          this.updateRangeSlider(this.selectedParameter);
        }
      },
      error: (error) => {
        console.error('There was an error fetching parameters!', error);
      },
    });
  }

  updateRangeSlider(parameter: Parameter): void {
    if (parameter.parametersType === 'COUNT') {
      this.min = parameter.restrictions.min;
      this.max = parameter.restrictions.max;
      this.steps = (this.max - this.min) / this.sliderStep;
      this.control.setValue([this.min, this.max]);
    }
  }

  onServiceChange(service: Service): void {
    this.selectedService = service;
    this.parameters = [];
    this.selectedParameter = null;
    this.resetDrawingState();

    // Update accordion states
    this.openServiceAccordion = false;
    this.openParametersAccordion = !!service; // Open if service is selected
    this.openCalculationAccordion = false;
    this.openCheckoutAccordion = false;

    // Remove existing polygons and legend when service changes
    this.toggleRestrictionPolygons(false);
    if (this.legendControl) {
      this.map.removeControl(this.legendControl);
      this.legendControl = null;
    }

    if (service) {
      this.fetchParameters(service.uuid);
      // If polygons data is already fetched, display the polygons
      const range = this.yearRangeControl.value;
      if (range) {
        this.onYearRangeChange(range);
      }
    } else {
      this.openParametersAccordion = false;
      // Remove polygons and legend if no service is selected
      this.toggleRestrictionPolygons(false);
      if (this.legendControl) {
        this.map.removeControl(this.legendControl);
        this.legendControl = null;
      }
    }
  }

  fetchRestrictionPolygons(): void {
    if (this.restrictionPolygonsData.length > 0) {
      return;
    }

    this.isLoading = true; // Начало загрузки
    // const url = `/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=gxp:108_РБ_все_года&outputFormat=JSON&bbox=${bbox}`;
    const url = `/api/get_geo_json/`;
    this.http.get<any>(url).subscribe({
      next: (data) => {
        this.restrictionPolygonsData = data; // Store the original data
        this.initializeYearRange(); // Initialize year range values
      },
      error: (error) =>
        console.error('Ошибка при загрузке ограничительных полигонов', error),
      complete: () => (this.isLoading = false), // Завершение загрузки
    });
  }

  initializeYearRange(): void {
    const years = this.restrictionPolygonsData.map((item) => item.year);
    this.minYear = Math.min(...years);
    this.maxYear = Math.max(...years);
    this.yearRangeControl.setValue([this.minYear, this.maxYear]);
    this.yearSteps = this.maxYear - this.minYear;
  }

  // Toggle the visibility of the year range slider
  toggleFilter(): void {
    this.showYearRangeSlider = !this.showYearRangeSlider;
  }

  // Handle changes in the year range slider
  onYearRangeChange(range: [number, number] | null): void {
    if (range && this.selectedService) {
      const [startYear, endYear] = range;
      const filteredData = this.restrictionPolygonsData.filter(
        (item) => item.year >= startYear && item.year <= endYear
      );

      // Remove existing polygons from the map
      this.restrictionPolygons.forEach((polygon) =>
        this.map.removeLayer(polygon)
      );

      // Convert filtered data to polygons and add to the map
      this.restrictionPolygons = this.convertGeoJsonToPolygons(filteredData);
      this.toggleRestrictionPolygons(true);
    } else {
      // No service selected or range is null
      this.toggleRestrictionPolygons(false);
      if (this.legendControl) {
        this.map.removeControl(this.legendControl);
        this.legendControl = null;
      }
    }
  }

  convertGeoJsonToPolygons(data: any[]): L.Polygon[] {
    const polygons: L.Polygon[] = [];

    // Определите диапазон лет для градиента
    const years = data.map((item) => item.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    this.addLegend(minYear, maxYear);

    data.forEach((item: any) => {
      const coordinates = item.coordinates[0].map(
        (coord: number[]) => [coord[1], coord[0]] // Перестановка координат
      );
      const year = item.year;

      const color = this.getColorForYear(year, minYear, maxYear);

      const polygon = L.polygon(coordinates, {
        color: color,
        weight: 1,
        fillOpacity: 0.2,
        className: 'no-focus-poly',
      });

      // Добавляем всплывающую подсказку при наведении
      polygon.bindTooltip(`Год съёмки: ${year}`, {
        sticky: true,
      });

      // Добавляем обработчики событий для изменения стиля при наведении
      polygon.on('mouseover', function (this: L.Polygon) {
        this.setStyle({
          weight: 1,
          color: '#aaa',
          dashArray: '',
          fillOpacity: 0.6,
        });
      });

      polygon.on('mouseout', function (this: L.Polygon) {
        this.setStyle({
          weight: 1,
          color: color,
          dashArray: '',
          fillOpacity: 0.2,
        });
      });

      polygons.push(polygon);
    });

    return polygons;
  }

  getColorForYear(year: number, minYear: number, maxYear: number): string {
    if (minYear === maxYear) {
      return 'rgb(0, 0, 255)';
    }
    // Цвета градиента (можете выбрать свои цвета)
    const startColor = [255, 0, 0]; // Красный
    const endColor = [0, 0, 255]; // Синий

    const fraction = (year - minYear) / (maxYear - minYear);

    const r = Math.round(
      startColor[0] + fraction * (endColor[0] - startColor[0])
    );
    const g = Math.round(
      startColor[1] + fraction * (endColor[1] - startColor[1])
    );
    const b = Math.round(
      startColor[2] + fraction * (endColor[2] - startColor[2])
    );

    return `rgb(${r},${g},${b})`;
  }

  addLegend(minYear: number, maxYear: number): void {
    // Remove existing legend if any
    if (this.legendControl) {
      this.map.removeControl(this.legendControl);
    }

    if (!this.selectedService) {
      return;
    }

    this.legendControl = new L.Control({ position: 'bottomleft' });

    this.legendControl.onAdd = (map) => {
      const div = L.DomUtil.create('div', 'info legend');
      div.innerHTML +=
        '<i style="background: linear-gradient(to right, red , blue); width: 150px; height: 15px; display: block;"></i>';
      div.innerHTML += `<span>${minYear}</span><span style="float: right;">${maxYear}</span>`;
      return div;
    };

    this.legendControl.addTo(this.map);
  }

  toggleRestrictionPolygons(show: boolean): void {
    if (show && this.selectedService) {
      this.restrictionPolygons.forEach((polygon) => this.map.addLayer(polygon));
    } else {
      this.restrictionPolygons.forEach((polygon) =>
        this.map.removeLayer(polygon)
      );
    }
  }

  onParameterChange(parameter: Parameter): void {
    this.selectedParameter = parameter;
    this.clearPolygons();

    if (parameter.restrictions.mustBeInside) {
      // Если полигоны еще не загружены, загрузить их
      if (this.restrictionPolygons.length === 0) {
        this.fetchRestrictionPolygons();
      }

      this.toggleRestrictionPolygons(true);
    } else {
      this.toggleRestrictionPolygons(false);
      this.drawServicePolygons();
    }
  }

  drawServicePolygons(): void {
    if (!this.selectedService) {
      return;
    }

    // Clear previously drawn polygons before drawing new ones
    this.clearPolygons();

    this.selectedService.parameters.forEach((parameter) => {
      if (parameter.polygon) {
        const points: L.LatLngTuple[] = parameter.polygon.points.map(
          (point: { x: number; y: number }) => [point.y, point.x]
        );
        const polygon = L.polygon(points).addTo(this.map);
        this.drawnPolygons.push(polygon);

        // if the selected parameter has restrictions, set the restriction polygon
        if (
          this.selectedParameter &&
          this.selectedParameter.restrictions.mustBeInside
        ) {
          const closedPoints = points.concat([points[0]]);
          this.restrictionPolygons.push(L.polygon(closedPoints));
        }
      }
    });

    if (this.drawnPolygons.length > 0) {
      const allBounds = this.drawnPolygons.map((polygon) =>
        polygon.getBounds()
      );
      const combinedBounds = allBounds.reduce(
        (acc, bounds) => acc.extend(bounds),
        L.latLngBounds([])
      );
      this.map.fitBounds(combinedBounds);
    }
    this.updateArea();
  }

  clearPolygons(): void {
    // Очистить пользовательские полигоны
    this.drawnPolygons.forEach((polygon) => this.map.removeLayer(polygon));
    this.drawnPolygons = [];

    // Очистить слои рисования
    this.drawnLayers.clearLayers();

    this.updateArea();
  }

  filterServices(event: Event): void {
    const input = event.target as HTMLInputElement;
    const query = input.value;
    this.filteredServices = this.services.filter((service) =>
      service.title.toLowerCase().includes(query.toLowerCase())
    );
  }

  filterParameters(event: Event): void {
    const input = event.target as HTMLInputElement;
    const query = input.value;
    this.filteredParameters = this.parameters.filter((parameter) =>
      parameter.title.toLowerCase().includes(query.toLowerCase())
    );
  }

  getServiceTitle(service: Service | null): string {
    return service ? service.title : '';
  }

  getParameterTitle(parameter: Parameter | null): string {
    return parameter ? parameter.title : '';
  }

  goBack(): void {
    this.router.navigate(['/'], { replaceUrl: true }).then(() => {
      window.location.reload();
    });
  }

  isPointInPolygon(marker: L.LatLng, polys: L.Polygon[]): boolean {
    const point = turf.point([marker.lng, marker.lat]);

    for (const poly of polys) {
      const allPolyPoints = poly.getLatLngs() as L.LatLng[][];
      const polygonCoords: number[][][] = allPolyPoints.map((ring) => {
        const coords = ring.map((latLng) => [latLng.lng, latLng.lat]);
        if (coords.length > 0) {
          const firstCoord = coords[0];
          const lastCoord = coords[coords.length - 1];
          if (
            firstCoord[0] !== lastCoord[0] ||
            firstCoord[1] !== lastCoord[1]
          ) {
            coords.push(firstCoord);
          }
        }
        return coords;
      });

      const polygon = turf.polygon(polygonCoords);
      if (turf.booleanPointInPolygon(point, polygon)) {
        return true;
      }
    }

    return false;
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
