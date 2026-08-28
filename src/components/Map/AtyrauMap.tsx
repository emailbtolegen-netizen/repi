import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { PropertyObject, PropertyStatus, UserLocation } from '../../types';
import { formatDistance, formatKZT, calculateDistanceMeters } from '../../utils/geoUtils';
import { Layers, Crosshair, ZoomIn, ZoomOut, Compass, Navigation } from 'lucide-react';

interface AtyrauMapProps {
  objects: PropertyObject[];
  selectedObject: PropertyObject | null;
  userLocation: UserLocation | null;
  onSelectObject: (obj: PropertyObject) => void;
  onOpenInspection: (obj: PropertyObject) => void;
  onRequestUserLocation: () => void;
}

// Marker color definitions matching GIS statuses
function getStatusColor(status: PropertyStatus): { bg: string; border: string; text: string } {
  switch (status) {
    case 'FOUND':
      return { bg: '#16a34a', border: '#15803d', text: '#ffffff' }; // 🟢
    case 'DISCREPANCY':
      return { bg: '#eab308', border: '#ca8a04', text: '#713f12' }; // 🟡
    case 'NOT_FOUND':
      return { bg: '#ef4444', border: '#b91c1c', text: '#ffffff' }; // 🔴
    case 'NEEDS_CLARIFICATION':
      return { bg: '#334155', border: '#0f172a', text: '#ffffff' }; // ⚫
    case 'UNCHECKED':
    default:
      return { bg: '#2563eb', border: '#1d4ed8', text: '#ffffff' }; // 🔵
  }
}

// Create custom HTML SVG marker with number badge
function createMarkerIcon(obj: PropertyObject, isSelected: boolean): L.DivIcon {
  const color = getStatusColor(obj.status);
  const size = isSelected ? 38 : 30;
  const fontSize = obj.id > 99 ? '10px' : '11px';
  const ringStyle = isSelected
    ? `box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.4), 0 4px 12px rgba(0,0,0,0.3); transform: scale(1.15);`
    : `box-shadow: 0 2px 6px rgba(0,0,0,0.25);`;

  const html = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;
      background: ${color.bg};
      border: 2px solid ${color.border};
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      ${ringStyle}
    ">
      <span style="
        transform: rotate(45deg);
        color: ${color.text};
        font-weight: 700;
        font-size: ${fontSize};
        line-height: 1;
        user-select: none;
      ">
        ${obj.id}
      </span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-atyrau-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size]
  });
}

// Create marker for actual GPS verified point
function createActualPointIcon(): L.DivIcon {
  const html = `
    <div style="
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #10b981;
      border: 2px solid #ffffff;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 10px;
      font-weight: bold;
    ">
      📍
    </div>
  `;
  return L.divIcon({
    html,
    className: 'actual-gps-pin',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

export const AtyrauMap: React.FC<AtyrauMapProps> = ({
  objects,
  selectedObject,
  userLocation,
  onSelectObject,
  onOpenInspection,
  onRequestUserLocation
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const discrepancyLineRef = useRef<L.Polyline | null>(null);
  const actualMarkerRef = useRef<L.Marker | null>(null);

  const [mapType, setMapType] = useState<'streets' | 'satellite' | 'light'>('streets');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const atyrauCenter: L.LatLngExpression = [47.116, 51.916]; // Atyrau city center
    const map = L.map(mapContainerRef.current, {
      center: atyrauCenter,
      zoom: 13,
      zoomControl: false
    });

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | Атырау GIS'
    }).addTo(map);

    tileLayerRef.current = streetLayer;

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle Tile Layer Type Changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    let url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attribution = '&copy; OpenStreetMap contributors';

    if (mapType === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Atyrau Satellite';
    } else if (mapType === 'light') {
      url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      attribution = '&copy; CARTO';
    }

    const newLayer = L.tileLayer(url, { maxZoom: 19, attribution }).addTo(mapRef.current);
    tileLayerRef.current = newLayer;
  }, [mapType]);

  // Render Object Markers
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    objects.forEach((obj) => {
      if (obj.isArchived) return;

      const lat = obj.currentLatitude || obj.originalLatitude;
      const lng = obj.currentLongitude || obj.originalLongitude;
      const isSelected = selectedObject?.id === obj.id;

      const marker = L.marker([lat, lng], {
        icon: createMarkerIcon(obj, isSelected),
        title: `№${obj.id}: ${obj.normalizedAddress || obj.originalAddress}`
      });

      // Calculate distance if user location is known
      let distanceStr = '';
      if (userLocation) {
        const d = calculateDistanceMeters(userLocation.latitude, userLocation.longitude, lat, lng);
        distanceStr = formatDistance(d);
      }

      // Popup content
      const popupContent = document.createElement('div');
      popupContent.className = 'p-1 font-sans text-slate-800';
      popupContent.innerHTML = `
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
            № ${obj.id}
          </span>
          <span class="text-xs font-semibold px-2 py-0.5 rounded ${
            obj.status === 'FOUND' ? 'bg-green-100 text-green-800' :
            obj.status === 'DISCREPANCY' ? 'bg-amber-100 text-amber-800' :
            obj.status === 'NOT_FOUND' ? 'bg-red-100 text-red-800' :
            obj.status === 'NEEDS_CLARIFICATION' ? 'bg-slate-200 text-slate-800' :
            'bg-blue-100 text-blue-800'
          }">
            ${
              obj.status === 'FOUND' ? '🟢 Найден' :
              obj.status === 'DISCREPANCY' ? '🟡 Несоответствие' :
              obj.status === 'NOT_FOUND' ? '🔴 Не найден' :
              obj.status === 'NEEDS_CLARIFICATION' ? '⚫ Требует уточнения' :
              '🔵 Не проверен'
            }
          </span>
        </div>
        <p class="font-bold text-sm text-slate-900 leading-snug mb-1">${obj.normalizedAddress || obj.originalAddress}</p>
        <p class="text-xs text-slate-600 mb-1.5">Оценка: <strong class="text-slate-900">${formatKZT(obj.estimatedValue)}</strong></p>
        ${distanceStr ? `<p class="text-xs text-blue-600 font-semibold mb-2">📍 Расстояние: ${distanceStr}</p>` : ''}
        <button id="popup-inspect-btn-${obj.id}" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-1.5 px-3 rounded shadow transition">
          Открыть карточку инспекции
        </button>
      `;

      popupContent.querySelector(`#popup-inspect-btn-${obj.id}`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        onOpenInspection(obj);
      });

      marker.bindPopup(popupContent, { minWidth: 220, closeButton: true });

      marker.on('click', () => {
        onSelectObject(obj);
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [objects, selectedObject, userLocation, onSelectObject, onOpenInspection]);

  // Update User Location Marker & Accuracy Circle
  useEffect(() => {
    if (!mapRef.current) return;

    if (!userLocation) {
      if (userMarkerRef.current) {
        mapRef.current.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      if (userAccuracyCircleRef.current) {
        mapRef.current.removeLayer(userAccuracyCircleRef.current);
        userAccuracyCircleRef.current = null;
      }
      return;
    }

    const latLng: L.LatLngExpression = [userLocation.latitude, userLocation.longitude];

    // Pulsing user icon
    const userIcon = L.divIcon({
      className: 'user-pulse-marker',
      html: '<div class="custom-pulse-dot"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(latLng, {
        icon: userIcon,
        zIndexOffset: 1000,
        title: 'Моё местоположение'
      }).addTo(mapRef.current);
    } else {
      userMarkerRef.current.setLatLng(latLng);
    }

    if (!userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current = L.circle(latLng, {
        radius: Math.min(userLocation.accuracy, 200),
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        weight: 1
      }).addTo(mapRef.current);
    } else {
      userAccuracyCircleRef.current.setLatLng(latLng);
      userAccuracyCircleRef.current.setRadius(Math.min(userLocation.accuracy, 200));
    }
  }, [userLocation]);

  // Handle selected object changes: Pan map & draw coordinate discrepancy line
  useEffect(() => {
    if (!mapRef.current || !selectedObject) {
      if (discrepancyLineRef.current) {
        mapRef.current?.removeLayer(discrepancyLineRef.current);
        discrepancyLineRef.current = null;
      }
      if (actualMarkerRef.current) {
        mapRef.current?.removeLayer(actualMarkerRef.current);
        actualMarkerRef.current = null;
      }
      return;
    }

    const lat = selectedObject.currentLatitude || selectedObject.originalLatitude;
    const lng = selectedObject.currentLongitude || selectedObject.originalLongitude;

    mapRef.current.flyTo([lat, lng], 16, { duration: 0.8 });

    // Draw discrepancy line if actual coordinates exist and differ
    if (
      selectedObject.actualLatitude &&
      selectedObject.actualLongitude &&
      (Math.abs(selectedObject.actualLatitude - selectedObject.originalLatitude) > 0.0001 ||
        Math.abs(selectedObject.actualLongitude - selectedObject.originalLongitude) > 0.0001)
    ) {
      const origPt: [number, number] = [selectedObject.originalLatitude, selectedObject.originalLongitude];
      const actPt: [number, number] = [selectedObject.actualLatitude, selectedObject.actualLongitude];

      if (discrepancyLineRef.current) {
        discrepancyLineRef.current.setLatLngs([origPt, actPt]);
      } else {
        discrepancyLineRef.current = L.polyline([origPt, actPt], {
          color: '#ef4444',
          weight: 3,
          dashArray: '6, 8',
          opacity: 0.85
        }).addTo(mapRef.current);
      }

      if (actualMarkerRef.current) {
        actualMarkerRef.current.setLatLng(actPt);
      } else {
        actualMarkerRef.current = L.marker(actPt, {
          icon: createActualPointIcon(),
          title: 'Фактическая точка инспекции'
        }).addTo(mapRef.current);
      }
    } else {
      if (discrepancyLineRef.current) {
        mapRef.current.removeLayer(discrepancyLineRef.current);
        discrepancyLineRef.current = null;
      }
      if (actualMarkerRef.current) {
        mapRef.current.removeLayer(actualMarkerRef.current);
        actualMarkerRef.current = null;
      }
    }
  }, [selectedObject]);

  // Fit all markers in view
  const handleFitAll = () => {
    if (!mapRef.current) return;
    const activeObjects = objects.filter((o) => !o.isArchived);
    if (activeObjects.length === 0) return;

    const bounds = L.latLngBounds(
      activeObjects.map((o) => [o.currentLatitude || o.originalLatitude, o.currentLongitude || o.originalLongitude])
    );
    mapRef.current.fitBounds(bounds, { padding: [40, 40] });
  };

  // Center to user location
  const handleCenterUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo([userLocation.latitude, userLocation.longitude], 16);
    } else {
      onRequestUserLocation();
    }
  };

  return (
    <div className="relative w-full h-full min-h-[350px] bg-slate-100 overflow-hidden">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Map Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        {/* Layer Selector */}
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <button
            id="map-tile-streets"
            onClick={() => setMapType('streets')}
            title="Схема улиц"
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              mapType === 'streets' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Схема</span>
          </button>
          <button
            id="map-tile-satellite"
            onClick={() => setMapType('satellite')}
            title="Спутник"
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              mapType === 'satellite' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span className="hidden sm:inline">Спутник</span>
          </button>
          <button
            id="map-tile-light"
            onClick={() => setMapType('light')}
            title="Светлая GIS"
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              mapType === 'light' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span className="hidden sm:inline">GIS</span>
          </button>
        </div>

        {/* Locate Me & Fit Bounds */}
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <button
            id="btn-map-locate-me"
            onClick={handleCenterUser}
            title="Определить моё местоположение"
            className="p-2.5 rounded-lg text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition flex items-center justify-center"
          >
            <Crosshair className={`w-5 h-5 ${userLocation ? 'text-blue-600' : 'text-slate-600'}`} />
          </button>
          <button
            id="btn-map-fit-all"
            onClick={handleFitAll}
            title="Показать все 130 объектов"
            className="p-2.5 rounded-lg text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition flex items-center justify-center font-bold text-xs"
          >
            130
          </button>
          <button
            id="btn-map-zoom-in"
            onClick={() => mapRef.current?.zoomIn()}
            title="Приблизить"
            className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition flex items-center justify-center"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            id="btn-map-zoom-out"
            onClick={() => mapRef.current?.zoomOut()}
            title="Отдалить"
            className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition flex items-center justify-center"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map Legend (Bottom left corner) */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200 px-3 py-2 text-xs flex flex-wrap gap-2.5 items-center">
        <span className="flex items-center gap-1 font-medium text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span> Не проверен
        </span>
        <span className="flex items-center gap-1 font-medium text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block"></span> Найден
        </span>
        <span className="flex items-center gap-1 font-medium text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Несоответствие
        </span>
        <span className="flex items-center gap-1 font-medium text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span> Не найден
        </span>
        <span className="flex items-center gap-1 font-medium text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block"></span> Требует уточнения
        </span>
      </div>
    </div>
  );
};
