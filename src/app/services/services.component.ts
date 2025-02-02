import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  combineLatest,
  filter,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  Injector,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import 'leaflet-draw';
import drawLocales from 'leaflet-draw-locales';
import * as turf from '@turf/turf';
import { AbstractControl, FormControl, ValidatorFn } from '@angular/forms';
import {
  TuiAlertService,
  TuiDialogService,
  tuiNumberFormatProvider,
} from '@taiga-ui/core';
import './SmoothWheelZoom.js';
import { TuiFileLike, tuiToggleOptionsProvider } from '@taiga-ui/kit';
import { StorageService } from '../_services/storage.service';
import { TUI_IS_E2E, TuiValidationError } from '@taiga-ui/cdk';

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
  description?: string;
  parametersType: string;
  restrictions: any;
  polygon?: {
    points: { x: number; y: number }[];
  };
  values?: any;
  control?: any;
}

@Component({
  selector: 'app-services',
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss'],
  providers: [
    tuiNumberFormatProvider({
      thousandSeparator: '',
    }),
    tuiToggleOptionsProvider({
      icons: {
        toggleOff: 'tuiIconClose',
        toggleOn: 'tuiIconCheck',
      },
      showIcons: true,
    }),
  ],
})
export class ServicesComponent implements OnInit, OnDestroy {
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

  hasHeightParameter: boolean = false;
  hasTerritoryParameter: boolean = false;
  hasTerritoryParameterInside: boolean = false;
  hasCountParameter: boolean = false;

  readonly sliderStep = 1;
  readonly quantum = 0.00001;

  min = 0;
  max = 100;
  steps = (this.max - this.min) / this.sliderStep;
  control = new FormControl(this.min);

  isLoading: boolean = true;
  selectedRestrictionPolygon: L.Polygon | null = null;
  currentGeometryParameter: Parameter | null = null;

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

  isParametersLoading: boolean = false;
  isCalculationLoading: boolean = false;
  isCheckoutLoading: boolean = false;

  @ViewChild('contentSuccess', { static: true })
  contentSuccess!: TemplateRef<any>;
  @ViewChild('contentAuth', { static: true }) contentAuth!: TemplateRef<any>;

  // === LOCAL STORAGE CHANGES: ключи для хранения ===
  private readonly LS_KEY_SERVICE = 'services.selectedService';
  private readonly LS_KEY_PARAMETERS = 'services.parameters';
  private readonly LS_KEY_FILES = 'services.files';
  private readonly LS_KEY_COMMENT = 'services.comment';
  private readonly LS_KEY_CALCULATION = 'services.calculation';
  private readonly LS_KEY_ACCORDION = 'services.accordion';

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private storageService: StorageService,
    private alertService: TuiAlertService,
    @Inject(TUI_IS_E2E) readonly isE2E: boolean,
    @Inject(TuiDialogService) private readonly dialogService: TuiDialogService
  ) {}

  ngOnInit(): void {
    this.initMap();
    this.restoreDrawingState();
    this.fetchServices();

    // Subscribe to valueChanges of the yearRangeControl
    this.yearRangeControl.valueChanges.subscribe(
      (range: [number, number] | null) => {
        if (range) {
          this.onYearRangeChange(range);
          this.cdr.detectChanges();
        }
      }
    );

    this.fetchRestrictionPolygons();

    // Listen for Enter key press
    document.addEventListener('keydown', this.onKeyDown);

    // === LOCAL STORAGE CHANGES: восстанавливаем сохранённые данные ===
    this.restoreDataFromLocalStorage();
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onKeyDown = (event: KeyboardEvent) => {
    if (
      event.key === 'Enter' &&
      !this.isConfirmDisabled &&
      this.isDrawingEnabled
    ) {
      this.onConfirmCost();
    }
  };

  initMap(): void {
    setTimeout(() => {
      this.map = L.map('map', {
        scrollWheelZoom: false, // disable original zoom function
        smoothWheelZoom: true, // enable smooth zoom
        smoothSensitivity: 1, // zoom speed. default is 1

        attributionControl: false,
      }).setView([56.8519, 60.6122], 11);
      L.tileLayer('/tiles/{z}/{x}/{y}.png').addTo(this.map);

      this.map.addLayer(this.drawnLayers);

      this.initializeDrawControl();

      this.cdr.detectChanges();
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

  private initializeDrawControl(): void {
    if (!this.map) return;

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
            opacity: 1,
            weight: 2,
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

    this.map.on(L.Draw.Event.CREATED, (event: any) => {
      const layer = event.layer;
      if (
        this.currentGeometryParameter &&
        this.currentGeometryParameter.restrictions.count
      ) {
        const maxCount = this.currentGeometryParameter.restrictions.count;
        if (this.drawnLayers.getLayers().length >= maxCount) {
          this.drawnLayers.removeLayer(this.drawnLayers.getLayers()[0]);
        }
      }
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

      this.saveDataToLocalStorage();
    });

    this.map.on(L.Draw.Event.DRAWSTART, (event: any) => {
      if (this.hasTerritoryParameter) {
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

          if (!foundPolygon && this.hasTerritoryParameterInside) {
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
      }
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

          if (!isValid && this.hasTerritoryParameterInside) {
            this.drawControl._toolbars['edit'].disable();
            this.showErrorTooltip(
              'Отредактированный многоугольник должен находиться внутри ограниченной зоны.',
              polygon.getBounds().getCenter()
            );
          }
        }
      });
      this.updateArea();
      this.saveDataToLocalStorage();
    });

    this.map.on('draw:drawvertex', (event: any) => {
      if (this.hasTerritoryParameter) {
        const layers = event.layers.getLayers();
        for (let layer of layers) {
          if (layer && layer instanceof L.Marker) {
            const latlng = layer.getLatLng();
            if (
              this.hasTerritoryParameterInside &&
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
      }
    });

    this.map.on('draw:error', (event: any) => {
      const error = event.message;
      const layer = event.layer;
      let latlng;

      if (layer && layer.getLatLng) latlng = layer.getLatLng();
      else latlng = this.map.getCenter();

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
      this.saveDataToLocalStorage();
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
  }

  startDrawing(parameter: Parameter): void {
    if (!this.selectedService) {
      // this.showWarningDialog();
      return;
    }

    this.currentGeometryParameter = parameter;

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
    if (this.map && this.drawControl) {
      this.map.removeControl(this.drawControl);
    }
    this.isDrawingEnabled = false;
    this.isConfirmDisabled = true;
    this.clearPolygons();
    this.saveDrawingState();
  }

  fetchServices(): void {
    const url = '/api/service/all/titles';
    this.http.options<Service[]>(url).subscribe({
      next: (data) => {
        this.services = data;
        this.filteredServices = data;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('There was an error fetching services!', error);
        this.cdr.detectChanges();
      },
    });
  }

  onAccordionItemOpen(index: number): void {
    if (!this.selectedService) {
      // this.showWarningDialog();
    }
  }
  private reorderParameters() {
    if (this.parameters) {
      const geometryParams = this.parameters.filter(
        (param) => param.parametersType === 'GEOMETRY'
      );
      const otherParams = this.parameters.filter(
        (param) => param.parametersType !== 'GEOMETRY'
      );
      this.parameters = [...geometryParams, ...otherParams];
    }
  }

  private restoreGeometryOnMap(
    polygonsData: number[][][],
    param: Parameter
  ): void {
    // Очищаем текущие слои
    this.drawnLayers.clearLayers();

    // Получаем максимальное допустимое количество
    const maxCount = param.restrictions?.count;

    // Обрезаем массив до допустимого количества (если указано)
    const polygonsToAdd = maxCount
      ? polygonsData.slice(-maxCount)
      : polygonsData;

    polygonsToAdd.forEach((coords) => {
      const latLngs = coords.map(([lt, lg]) => L.latLng(lt, lg));
      const polygon = L.polygon([latLngs], {
        color: 'magenta',
        fillOpacity: 0.2,
        opacity: 1,
        weight: 2,
      });

      // Добавляем обработчики событий
      polygon
        .on('mouseover', () => polygon.setStyle({ fillOpacity: 0.5 }))
        .on('mouseout', () => polygon.setStyle({ fillOpacity: 0.2 }))
        .on('edit', () => {
          this.updateArea();
          this.saveDataToLocalStorage();
        });

      this.drawnLayers.addLayer(polygon);
    });

    this.updateArea();
    this.isConfirmDisabled = polygonsToAdd.length === 0;
  }

  fetchParameters(serviceUuid: string): void {
    this.isParametersLoading = true;
    const url = `/api/service/parameters?uuid=${serviceUuid}`;
    this.http.get<{ parameters: any }>(url).subscribe({
      next: (data) => {
        if (data) {
          this.parameters = data.parameters.map((param: Parameter) => {
            if (param.parametersType === 'CHECKBOX') {
              param.values = param.restrictions.defaultValue === true;
            } else if (param.parametersType === 'COUNT') {
              param.control = new FormControl(param.restrictions.defaultValue);
            } else if (param.parametersType === 'COMBOBOX') {
              // Если defaultValue — массив, возьмём первый элемент как дефолт (или пустую строку)
              const defaultVal =
                Array.isArray(param.restrictions.defaultValue) &&
                param.restrictions.defaultValue.length
                  ? param.restrictions.defaultValue[0]
                  : '';
              param.control = new FormControl(defaultVal);
            } else if (param.parametersType === 'STRING') {
              // Если это строковый параметр, можем взять defaultValue целиком, если он есть
              param.control = new FormControl(
                param.restrictions.defaultValue || ''
              );
            } else if (param.parametersType === 'GEOMETRY') {
              this.hasTerritoryParameter = true;
              if (param.restrictions.mustBeInside === true)
                this.hasTerritoryParameterInside = true;
              else this.hasTerritoryParameterInside = false;
            }
            if (param.control) {
              param.control.valueChanges.subscribe(() => {
                this.saveDataToLocalStorage();
              });
            }
            return param;
          });

          this.reorderParameters();

          // === LOCAL STORAGE CHANGES: если уже есть сохранённые значения параметров - применим их
          const savedParams = localStorage.getItem(this.LS_KEY_PARAMETERS);
          if (savedParams) {
            const parsed = JSON.parse(savedParams) as {
              [paramTitle: string]: any;
            };
            this.parameters.forEach((param) => {
              const savedValue = parsed[param.title];
              if (savedValue !== undefined) {
                // Для CHECKBOX
                if (param.parametersType === 'CHECKBOX') {
                  param.values = savedValue;
                }
                // Для COUNT или COMBOBOX, STRING
                else if (
                  param.parametersType === 'COUNT' ||
                  param.parametersType === 'COMBOBOX' ||
                  param.parametersType === 'STRING'
                ) {
                  if (param.control) {
                    param.control.setValue(savedValue);
                  }
                } else if (
                  param.parametersType === 'GEOMETRY' &&
                  Array.isArray(savedValue)
                ) {
                  // Сохраняем текущий геометрический параметр
                  this.currentGeometryParameter = param;

                  // Восстанавливаем с проверкой лимита
                  this.restoreGeometryOnMap(savedValue, param);
                  // Раз у нас есть полигоны, отключим isConfirmDisabled
                  if (savedValue.length > 0) {
                    this.isConfirmDisabled = false;
                  }
                }
              }
            });
          }
          this.cdr.detectChanges();
        }
        this.isParametersLoading = false;
      },
      error: (error) => {
        console.error('There was an error fetching parameters!', error);
        this.isParametersLoading = false;
      },
    });
  }

  private resetServiceData(): void {
    // Сброс данных расчета
    this.cost = null;
    this.days = null;
    this.currentDate = new Date();
    this.futureDate = new Date();

    // Очистка файлов
    this.uploadedFiles.clear();
    this.controlFile.setValue([]);
    this.rejectedFiles.next([]);
    this.loadingFiles.next([]);

    // Сброс комментария
    this.comment = null;

    // Закрытие вкладок
    this.openCalculationAccordion = false;
    this.openCheckoutAccordion = false;

    // Принудительное обновление шаблона
    this.cdr.detectChanges();
  }

  onServiceChange(service: Service): void {
    if (!service) {
      this.clearLocalData(); // Очищаем данные, если услуга сброшена
      return;
    }

    // Сброс данных предыдущей услуги
    this.resetServiceData();

    this.selectedService = service;
    this.parameters = [];
    this.selectedParameter = null;
    this.resetDrawingState();

    if (service) {
      this.openParametersAccordion = true;
      this.cdr.detectChanges();
    }

    // Remove existing polygons and legend when service changes
    this.toggleRestrictionPolygons(false);
    if (this.legendControl) {
      this.map.removeControl(this.legendControl);
      this.legendControl = null;
    }

    if (service) {
      this.fetchParameters(service.uuid);
      const range = this.yearRangeControl.value;
      if (range) this.onYearRangeChange(range);
    } else {
      this.openParametersAccordion = false;
      this.toggleRestrictionPolygons(false);

      if (this.legendControl) {
        this.map.removeControl(this.legendControl);
        this.legendControl = null;
      }

      this.saveDataToLocalStorage();
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
      error: (error) => {
        console.error('Ошибка при загрузке ограничительных полигонов', error);
        this.isLoading = false;

        // Проверяем статус ошибки
        if (error.status === 500) {
          this.alertService
            .open(
              'Ведется техническое обслуживание. Пожалуйста, попробуйте позже.',
              {
                status: 'error',
                label: 'Ошибка сервера',
                autoClose: false,
              }
            )
            .subscribe();
        } else {
          this.alertService
            .open('Произошла ошибка при загрузке данных', {
              status: 'error',
            })
            .subscribe();
        }
      },
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
    // Удаляем существующую легенду, если она есть
    if (this.legendControl) {
      this.map.removeControl(this.legendControl);
    }

    if (!this.selectedService) {
      return;
    }

    this.legendControl = new L.Control({ position: 'bottomleft' });

    this.legendControl.onAdd = (map) => {
      const div = L.DomUtil.create('div', 'info legend');
      div.innerHTML = `
        <div style="
          background: white;
          padding: 6px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        ">
                  <div style="
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #555;
          ">
            <span style="
              background: white;
              padding: 2px 6px;
              border-radius: 3px;
             ">${minYear} год</span>
            <span style="
              background: white;
              padding: 2px 6px;
              border-radius: 3px;
            ">${maxYear} год</span>
          </div>
          <i style="
            background: linear-gradient(to right, red , blue);
            width: 150px;
            height: 15px;
            display: block;
            margin-bottom: 5px;
            border-radius: 4px;
          "></i>

        </div>
      `;
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
    // Очищаем все слои из группы drawnLayers
    this.drawnLayers.eachLayer((layer) => {
      this.map.removeLayer(layer); // Явно удаляем каждый слой с карты
    });
    this.drawnLayers.clearLayers(); // Очищаем группу слоёв

    // Удаляем все полигоны из drawnPolygons
    this.drawnPolygons.forEach((polygon) => this.map.removeLayer(polygon));
    this.drawnPolygons = [];

    // Сбрасываем область
    this.updateArea();
    this.formattedArea = '';

    // Принудительно обновляем карту
    if (this.map) {
      this.map.invalidateSize();
    }
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
    this.router.navigate(['/']);
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

  private saveDrawingState(): void {
    const polygonsData: number[][][] = [];

    this.drawnLayers.getLayers().forEach((layer) => {
      if (layer instanceof L.Polygon) {
        const latLngs = (layer.getLatLngs() as L.LatLng[][])[0];
        polygonsData.push(latLngs.map((ll) => [ll.lat, ll.lng]));
      }
    });

    localStorage.setItem(
      'drawingState',
      JSON.stringify({
        isDrawingEnabled: this.isDrawingEnabled,
        polygons: polygonsData,
        currentParameter: this.currentGeometryParameter?.title,
      })
    );
  }

  private restoreDrawingState(): void {
    const savedState = localStorage.getItem('drawingState');
    if (!savedState) return;

    const { isDrawingEnabled, polygons, currentParameter } =
      JSON.parse(savedState);

    // Находим соответствующий параметр
    const param = this.parameters.find((p) => p.title === currentParameter);

    if (polygons?.length && param?.parametersType === 'GEOMETRY') {
      // Восстанавливаем с учетом ограничений
      this.restoreGeometryOnMap(polygons, param);
    }

    if (polygons?.length) {
      polygons.forEach((coords: number[][]) => {
        const latLngs = coords.map(([lat, lng]) => L.latLng(lat, lng));
        const polygon = L.polygon([latLngs], {
          color: 'magenta',
          fillOpacity: 0.2,
        });

        polygon
          .on('mouseover', () => polygon.setStyle({ fillOpacity: 0.5 }))
          .on('mouseout', () => polygon.setStyle({ fillOpacity: 0.2 }));

        this.drawnLayers.addLayer(polygon);
      });
    }

    if (isDrawingEnabled) {
      this.initializeDrawControl();
      this.map.addControl(this.drawControl);
      this.isDrawingEnabled = true;
    }

    this.currentGeometryParameter =
      this.parameters.find((p) => p.title === currentParameter) || null;

    this.updateArea();
    this.isConfirmDisabled = this.drawnLayers.getLayers().length === 0;
  }

  onConfirmCost(): void {
    if (this.isConfirmDisabled) {
      // Do nothing or show a warning
      return;
    }

    if (!this.selectedService) {
      return;
    }

    // Construct the request payload
    const payload: any = {
      service: this.selectedService.uuid,
      parameters: [],
    };

    this.parameters.forEach((param) => {
      const parameterData: any = {
        title: param.title,
      };

      if (param.parametersType === 'GEOMETRY') {
        // Include the polygon points
        const polygons = this.drawnLayers.getLayers();

        if (polygons.length > 0) {
          const polygon = polygons[0] as L.Polygon;
          const latLngs = polygon.getLatLngs() as L.LatLng[][];
          const points = latLngs[0].map((latlng) => ({
            x: latlng.lng,
            y: latlng.lat,
          }));

          parameterData.value =
            '[' + points.map((obj) => `${obj.x}, ${obj.y}`).join('; ') + ']';
        } else {
          // Handle case where no polygon is drawn
          console.warn('No polygon drawn for GEOMETRY parameter');
        }
      } else if (
        param.parametersType === 'CHECKBOX' ||
        param.parametersType === 'STRING'
      ) {
        // Include the value from the toggle
        parameterData.value = param.values.toString();
      } else if (
        param.parametersType === 'COUNT' ||
        param.parametersType === 'COMBOBOX'
      ) {
        // Include the selected value from the slider
        parameterData.value = param.control.value
          ? param.control.value.toString()
          : '';
      }

      payload.parameters.push(parameterData);
    });

    // Proceed to make the POST request
    this.calculateCost(payload);

    this.map.removeControl(this.drawControl);
    this.isDrawingEnabled = false;
    this.saveDrawingState();
  }

  cost: number | null = null;
  days: number | null = null;
  currentDate: Date = new Date();
  futureDate: Date = new Date();

  comment: string | null = null;

  calculateCost(payload: any): void {
    this.isCalculationLoading = true;
    const url = `/api/service/cost_service?uuid=${payload.service}`;
    this.http.post(url, payload.parameters).subscribe({
      next: (response: any) => {
        // Handle the response, e.g., display cost and time
        this.cost = response.cost;
        this.days = response.days;

        // Compute future date
        this.futureDate = new Date();
        if (this.days !== null) {
          this.futureDate.setDate(this.currentDate.getDate() + this.days);
        }
        // Open the "Расчет" accordion item
        this.openCalculationAccordion = true;
        this.openCheckoutAccordion = true;
        this.cdr.detectChanges();
        this.saveDataToLocalStorage();
        this.isCalculationLoading = false;
      },
      error: (error) => {
        console.error('Error calculating cost:', error);
        this.cdr.detectChanges();
        this.isCalculationLoading = false;
      },
    });
  }

  showLoginModal: boolean = false;
  showRegistrationModal: boolean = false;

  openLoginModal(): void {
    this.showLoginModal = true;
  }

// Метод, вызываемый после успешного входа из модального окна логина
onLoginSuccess(): void {
  this.showLoginModal = false;
  this.addServiceToCart();
}

// Если в окне логина пользователь запрашивает регистрацию,
// закрываем окно логина и открываем окно регистрации
openRegistrationModal(): void {
  this.showLoginModal = false;
  this.showRegistrationModal = true;
}

// После успешной регистрации (которая включает автоматический вход)
onRegistrationSuccess(): void {
  this.showRegistrationModal = false;
  this.addServiceToCart();
}

  onConfirmService(): void {
    // if (!this.selectedService) {
    //   return;
    // }

    // Check if the user is logged in
    if (!this.storageService.isLoggedIn()) {
      // User is not logged in, show notification
      this.showLoginNotification();
    } else {
      // User is logged in, proceed to add service
      this.addServiceToCart();
    }
  }

  addServiceToCart(): void {
    this.isCheckoutLoading = true;
    const payload: any = {
      service: this.selectedService?.uuid,
      parameters: [],
      files: Array.from(this.uploadedFiles.values())
        .map(({ src }) => {
          const fileNameMatch = src?.match(/fileName=([^&]*)/);
          return fileNameMatch?.[1] ?? null;
        })
        .filter(Boolean),
      comment: this.comment,
    };

    this.parameters.forEach((param) => {
      const parameterData: any = {
        title: param.title,
      };

      if (param.parametersType === 'GEOMETRY') {
        // Include the polygon points
        const polygons = this.drawnLayers.getLayers();

        if (polygons.length > 0) {
          const polygon = polygons[0] as L.Polygon;
          const latLngs = polygon.getLatLngs() as L.LatLng[][];
          const points = latLngs[0].map((latlng) => ({
            x: latlng.lng,
            y: latlng.lat,
          }));

          parameterData.value =
            '[' + points.map((obj) => `${obj.x}, ${obj.y}`).join('; ') + ']';
        } else {
          // Handle case where no polygon is drawn
          console.warn('No polygon drawn for GEOMETRY parameter');
        }
      } else if (param.parametersType === 'CHECKBOX') {
        // Include the value from the toggle
        parameterData.value = param.values.toString();
      } else if (param.parametersType === 'COUNT') {
        // Include the selected value from the slider
        parameterData.value = param.control.value
          ? param.control.value.toString()
          : '';
      }

      payload.parameters.push(parameterData);
    });

    // Proceed to make the POST request
    const url = `/api/basket/add_service?service_uuid=${payload.service}`;
    this.http
      .post(
        url,
        {
          parameters: payload.parameters,
          files: payload.files,
          comment: payload.comment,
        },
        { responseType: 'text' }
      )
      .subscribe({
        next: (response: any) => {
          // Show success notification
          this.clearLocalData();
          this.showSuccessNotification();
          this.isCheckoutLoading = false;
        },
        error: (error) => {
          console.error('Error adding service to basket:', error);
          this.alertService
            .open('Ошибка при добавлении в корзину', {
              status: 'error',
            })
            .subscribe();
            this.isCheckoutLoading = false;
        },
      });
  }

  // services.component.ts
  showLoginNotification(): void {
    this.dialogService
      .open<string>(this.contentAuth, {
        size: 's',
        closeable: false,
        dismissible: false,
      })
      .subscribe((result) => {
        if (result === 'login') {
          this.openLoginModal();
        }
      });
  }

  showSuccessNotification(): void {
    this.dialogService
      .open<string>(this.contentSuccess, {
        size: 's',
        closeable: false,
        dismissible: false,
      })
      .subscribe((result) => {
        if (result === 'goToBasket') {
          this.router.navigate(['/basket']);
        }
      });
  }

  goToBasket(): void {
    this.router.navigate(['/basket']);
  }

  readonly controlFile = new FormControl<TuiFileLike[]>(
    [],
    [maxFilesLength(5)]
  );
  rejectedFiles = new BehaviorSubject<TuiFileLike[]>([]);
  loadingFiles = new BehaviorSubject<TuiFileLike[]>([]);
  uploadedFiles: Set<any> = new Set();

  loadedFiles$ = combineLatest([
    this.controlFile.valueChanges,
    this.rejectedFiles,
  ]).pipe(
    map(([files, rejected]) => {
      if (!files || !Array.isArray(files)) {
        return [];
      }
      return files.filter((file) => !rejected.some((r) => r === file)); // Фильтрация отклоненных файлов
    }),
    switchMap((files) => {
      if (files.length > 0) {
        const requests = files.map((file) =>
          this.makeRequest(file as TuiFileLike)
        );
        return forkJoin(requests).pipe(
          map((responses) => responses.filter((file) => file !== null))
        );
      }
      return of([]);
    }),
    map((files) => files as TuiFileLike[])
  );

  onReject(files: TuiFileLike | readonly TuiFileLike[]): void {
    const filesArray = Array.isArray(files) ? files : [files];

    // Синхронизация controlFile и rejectedFiles
    const currentFiles = this.controlFile.value || [];
    this.controlFile.setValue(
      currentFiles.filter((f) => !filesArray.some((rejected) => rejected === f))
    );
    this.rejectedFiles.next([...this.rejectedFiles.getValue(), ...filesArray]);
    // === LOCAL STORAGE CHANGES: перезапишем в localStorage
    this.saveDataToLocalStorage();
  }

  removeFile(file: TuiFileLike): void {
    this.updateFiles(file);
    // === LOCAL STORAGE CHANGES
    this.saveDataToLocalStorage();
  }

  clearRejected(file: TuiFileLike): void {
    this.updateFiles(file);
    // === LOCAL STORAGE CHANGES
    this.saveDataToLocalStorage();
  }

  private updateFiles(file: TuiFileLike): void {
    const currentFiles = this.controlFile.value || [];
    this.controlFile.setValue(currentFiles.filter((f) => f !== file));
    this.rejectedFiles.next(
      this.rejectedFiles.getValue().filter((rejected) => rejected !== file)
    );
    this.uploadedFiles.forEach((uploadedFile) => {
      if (uploadedFile.file === file) {
        this.uploadedFiles.delete(uploadedFile);
      }
    });
  }

  makeRequest(file: TuiFileLike): Observable<TuiFileLike | null> {
    if (Array.from(this.uploadedFiles).some((item) => item.file === file)) {
      return of(file);
    }

    this.loadingFiles.next([...this.loadingFiles.getValue(), file]);

    const formData = new FormData();
    formData.append('file', file as unknown as File, file.name);

    return this.http
      .post('/api/file/upload', formData, { responseType: 'text' })
      .pipe(
        tap({
          error: () => this.onReject(file), // Обработка ошибок через tap
        }),
        map((response) => {
          if (
            typeof response === 'string' &&
            response.includes('File uploaded')
          ) {
            const fileName = response.split(':')[1].trim();
            const src = `/api/file/download_temporaryBucket?fileName=${fileName}`;
            this.uploadedFiles.add({ file, src });
            return file;
          }
          this.onReject(file);
          return null;
        }),
        finalize(() => {
          this.loadingFiles.next(
            this.loadingFiles.getValue().filter((f) => f !== file)
          );
          // === LOCAL STORAGE CHANGES
          this.saveDataToLocalStorage();
        })
      );
  }

  // ========================
  //   LOCAL STORAGE
  // ========================

  /**
   * Сохранение всех нужных данных в localStorage
   */
  public saveDataToLocalStorage(): void {
    // 1. Сервис
    if (this.selectedService) {
      localStorage.setItem(
        this.LS_KEY_SERVICE,
        JSON.stringify(this.selectedService)
      );
    }

    // 2. Параметры
    // Сохраним объект вида { paramTitle: value }
    const paramsToSave: { [key: string]: any } = {};
    this.parameters.forEach((param) => {
      if (param.parametersType === 'CHECKBOX') {
        paramsToSave[param.title] = param.values;
      } else if (
        param.parametersType === 'COUNT' ||
        param.parametersType === 'COMBOBOX' ||
        param.parametersType === 'STRING'
      ) {
        paramsToSave[param.title] = param.control?.value;
      } else if (param.parametersType === 'GEOMETRY') {
        // Сериализуем все полигоны из drawnLayers
        const polygonsData: number[][][] = []; // Массив, где каждый элемент — это массив координат одного полигона

        const polygons = this.drawnLayers
          .getLayers()
          .filter((layer) => layer instanceof L.Polygon);
        polygons.forEach((polygonLayer) => {
          const polygon = polygonLayer as L.Polygon;
          const latLngs = polygon.getLatLngs() as L.LatLng[][];
          if (latLngs.length > 0 && latLngs[0].length > 2) {
            // Берём только первую "дырку" (основной контур), если у вас нет сложных полигонов с «дырами»
            const coords = latLngs[0].map((ll) => [ll.lat, ll.lng]);
            polygonsData.push(coords);
          }
        });

        // Сохраняем в localStorage под ключом param.title
        paramsToSave[param.title] = polygonsData;
      }
    });
    localStorage.setItem(this.LS_KEY_PARAMETERS, JSON.stringify(paramsToSave));

    // 3. Файлы
    // Сохраняем только массив { name, src }
    const filesToSave = Array.from(this.uploadedFiles).map((f) => ({
      name: f.file.name,
      src: f.src,
    }));
    localStorage.setItem(this.LS_KEY_FILES, JSON.stringify(filesToSave));

    // 4. Комментарий
    localStorage.setItem(this.LS_KEY_COMMENT, this.comment || '');

    // 5. Расчеты
    const calculationData = {
      cost: this.cost,
      days: this.days,
      currentDate: this.currentDate.toISOString(),
      futureDate: this.futureDate.toISOString(),
    };
    localStorage.setItem(
      this.LS_KEY_CALCULATION,
      JSON.stringify(calculationData)
    );

    const accordionState = {
      service: this.openServiceAccordion,
      parameters: this.openParametersAccordion,
      calculation: this.openCalculationAccordion,
      checkout: this.openCheckoutAccordion,
    };
    localStorage.setItem(this.LS_KEY_ACCORDION, JSON.stringify(accordionState));
  }

  private restoreDataFromLocalStorage(): void {
    // 1. Сервис
    const savedService = localStorage.getItem(this.LS_KEY_SERVICE);
    if (savedService) {
      try {
        const parsedService = JSON.parse(savedService) as Service;
        this.selectedService = parsedService;
      } catch {}
    }

    // 2. Комментарий
    const savedComment = localStorage.getItem(this.LS_KEY_COMMENT);
    if (savedComment) {
      this.comment = savedComment;
    }

    // 3. Файлы
    const savedFiles = localStorage.getItem(this.LS_KEY_FILES);
    if (savedFiles) {
      try {
        const parsedFiles = JSON.parse(savedFiles) as {
          name: string;
          src: string;
        }[];
        // Создадим массив "фиктивных" TuiFileLike
        const controlFiles: TuiFileLike[] = [];
        parsedFiles.forEach((fileObj) => {
          const fakeFile: TuiFileLike = {
            name: fileObj.name,
            // size: 0,
          };
          // Добавим в Set
          this.uploadedFiles.add({ file: fakeFile, src: fileObj.src });
          // А также в список для controlFile
          controlFiles.push(fakeFile);
        });

        if (controlFiles.length) {
          this.controlFile.setValue(controlFiles);

          // Добавьте небольшую задержку для активации изменений
          setTimeout(() => {
            this.controlFile.updateValueAndValidity();
            this.cdr.markForCheck();
          }, 100);
        }
      } catch {
        // ignore
      }
    }

    // 4. Расчеты
    const savedCalculation = localStorage.getItem(this.LS_KEY_CALCULATION);
    if (savedCalculation) {
      try {
        const calculation = JSON.parse(savedCalculation);
        this.cost = calculation.cost;
        this.days = calculation.days;
        this.currentDate = new Date(calculation.currentDate);
        this.futureDate = new Date(calculation.futureDate);
        if (this.cost !== null) {
          this.openCalculationAccordion = true;
        }
      } catch (e) {
        console.error('Error parsing calculation data:', e);
      }
    }

    const savedAccordion = localStorage.getItem(this.LS_KEY_ACCORDION);
    if (savedAccordion) {
      try {
        const accordion = JSON.parse(savedAccordion);
        this.openServiceAccordion = accordion.service;
        this.openParametersAccordion = accordion.parameters;
        this.openCalculationAccordion = accordion.calculation;
        this.openCheckoutAccordion = accordion.checkout;
      } catch (e) {
        console.error('Error parsing accordion state:', e);
      }
    }

    // Если выбран сервис, подгружаем параметры
    if (this.selectedService?.uuid) {
      this.fetchParameters(this.selectedService.uuid);
      this.openParametersAccordion = true;
    }
  }

  private clearLocalData(): void {
    // Удаляем из localStorage
    localStorage.removeItem(this.LS_KEY_SERVICE);
    localStorage.removeItem(this.LS_KEY_PARAMETERS);
    localStorage.removeItem(this.LS_KEY_FILES);
    localStorage.removeItem(this.LS_KEY_COMMENT);
    localStorage.removeItem(this.LS_KEY_CALCULATION);
    localStorage.removeItem(this.LS_KEY_ACCORDION);

    // Сбрасываем состояние в памяти
    this.selectedService = null;
    this.parameters = [];
    this.comment = null;

    // Очищаем файлы
    this.uploadedFiles.clear();
    this.controlFile.setValue([]); // сбрасываем форму, чтобы TuiFiles не показывал старые файлы

    // Добавляем полный сброс состояния карты
    this.clearPolygons();
    this.resetDrawingState();
    // Сбрасываем флаги рисования
    this.isDrawingEnabled = false;
    this.isConfirmDisabled = true;

    // Если вы хотите скрыть элементы accordion, сбросите соответствующие флаги
    this.openServiceAccordion = true;
    this.openParametersAccordion = false;
    this.openCalculationAccordion = false;
    this.openCheckoutAccordion = false;

    // Если нужно, сбрасываем расчет стоимости
    this.cost = null;
    this.days = null;
    this.currentDate = new Date();
    this.futureDate = new Date();

    this.formattedArea = '';

    this.resetServiceData();

    // Принудительно обновим шаблон
    this.cdr.detectChanges();
  }
}

// Валидатор на кол-во файлов
export function maxFilesLength(maxLength: number): ValidatorFn {
  return ({ value }: AbstractControl) =>
    value.length > maxLength
      ? {
          maxLength: new TuiValidationError(
            'Ошибка: максимальный лимит - 5 файлов для загрузки'
          ),
        }
      : null;
}
