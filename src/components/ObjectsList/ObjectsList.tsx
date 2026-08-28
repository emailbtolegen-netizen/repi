import React, { useMemo } from 'react';
import { PropertyObject, PropertyStatus, FilterOptions, UserLocation } from '../../types';
import { ObjectCard } from './ObjectCard';
import { calculateDistanceMeters, formatDistance } from '../../utils/geoUtils';
import { 
  Search, 
  X, 
  ArrowUpDown, 
  MapPin, 
  Navigation,
  SlidersHorizontal
} from 'lucide-react';

interface ObjectsListProps {
  objects: PropertyObject[];
  selectedObject: PropertyObject | null;
  userLocation: UserLocation | null;
  filters: FilterOptions;
  onFilterChange: (newFilters: Partial<FilterOptions>) => void;
  onSelectObject: (obj: PropertyObject) => void;
  onOpenInspection: (obj: PropertyObject) => void;
}

export const ObjectsList: React.FC<ObjectsListProps> = ({
  objects,
  selectedObject,
  userLocation,
  filters,
  onFilterChange,
  onSelectObject,
  onOpenInspection
}) => {
  // Find the closest unchecked object
  const closestUnchecked = useMemo(() => {
    if (!userLocation) return null;
    const uncheckedList = objects.filter((o) => !o.isArchived && o.status === 'UNCHECKED');
    if (uncheckedList.length === 0) return null;

    let minDistance = Infinity;
    let closest: PropertyObject | null = null;

    uncheckedList.forEach((obj) => {
      const lat = obj.currentLatitude || obj.originalLatitude;
      const lng = obj.currentLongitude || obj.originalLongitude;
      const dist = calculateDistanceMeters(userLocation.latitude, userLocation.longitude, lat, lng);
      if (dist < minDistance) {
        minDistance = dist;
        closest = obj;
      }
    });

    return closest ? { object: closest, distance: minDistance } : null;
  }, [objects, userLocation]);

  // Filter and sort objects
  const filteredAndSortedObjects = useMemo(() => {
    return objects
      .filter((obj) => {
        if (obj.isArchived) return false;

        // Status filter
        if (filters.status !== 'ALL' && obj.status !== filters.status) {
          return false;
        }

        // Search query filter (matches address, ID, price, notes, comment)
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase().trim();
          const matchesId = String(obj.id) === q || `№${obj.id}`.toLowerCase().includes(q) || `№ ${obj.id}`.toLowerCase().includes(q);
          const matchesOrigAddr = obj.originalAddress.toLowerCase().includes(q);
          const matchesNormAddr = (obj.normalizedAddress || '').toLowerCase().includes(q);
          const matchesPrice = String(obj.estimatedValue).includes(q);
          const matchesComment = (obj.verificationComment || '').toLowerCase().includes(q);
          const matchesActualAddr = (obj.actualAddress || '').toLowerCase().includes(q);

          if (!matchesId && !matchesOrigAddr && !matchesNormAddr && !matchesPrice && !matchesComment && !matchesActualAddr) {
            return false;
          }
        }

        // Only nearby filter
        if (filters.onlyNearby && userLocation) {
          const lat = obj.currentLatitude || obj.originalLatitude;
          const lng = obj.currentLongitude || obj.originalLongitude;
          const dist = calculateDistanceMeters(userLocation.latitude, userLocation.longitude, lat, lng);
          if (dist > filters.maxDistanceKm * 1000) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'id') {
          return a.id - b.id;
        }
        if (filters.sortBy === 'price_desc') {
          return b.estimatedValue - a.estimatedValue;
        }
        if (filters.sortBy === 'price_asc') {
          return a.estimatedValue - b.estimatedValue;
        }
        if (filters.sortBy === 'status') {
          const rank: Record<PropertyStatus, number> = {
            UNCHECKED: 1,
            NEEDS_CLARIFICATION: 2,
            DISCREPANCY: 3,
            FOUND: 4,
            NOT_FOUND: 5
          };
          return (rank[a.status] || 0) - (rank[b.status] || 0);
        }
        if (filters.sortBy === 'distance' && userLocation) {
          const distA = calculateDistanceMeters(
            userLocation.latitude,
            userLocation.longitude,
            a.currentLatitude || a.originalLatitude,
            a.currentLongitude || a.originalLongitude
          );
          const distB = calculateDistanceMeters(
            userLocation.latitude,
            userLocation.longitude,
            b.currentLatitude || b.originalLatitude,
            b.currentLongitude || b.originalLongitude
          );
          return distA - distB;
        }
        return a.id - b.id;
      });
  }, [objects, filters, userLocation]);

  const statusOptions: Array<{ value: PropertyStatus | 'ALL'; label: string; count: number }> = useMemo(() => {
    const counts = {
      ALL: objects.filter((o) => !o.isArchived).length,
      UNCHECKED: objects.filter((o) => !o.isArchived && o.status === 'UNCHECKED').length,
      FOUND: objects.filter((o) => !o.isArchived && o.status === 'FOUND').length,
      DISCREPANCY: objects.filter((o) => !o.isArchived && o.status === 'DISCREPANCY').length,
      NOT_FOUND: objects.filter((o) => !o.isArchived && o.status === 'NOT_FOUND').length,
      NEEDS_CLARIFICATION: objects.filter((o) => !o.isArchived && o.status === 'NEEDS_CLARIFICATION').length
    };
    return [
      { value: 'ALL', label: 'Все', count: counts.ALL },
      { value: 'UNCHECKED', label: '🔵 Не проверены', count: counts.UNCHECKED },
      { value: 'FOUND', label: '🟢 Найдены', count: counts.FOUND },
      { value: 'DISCREPANCY', label: '🟡 Несоответствие', count: counts.DISCREPANCY },
      { value: 'NOT_FOUND', label: '🔴 Не найдены', count: counts.NOT_FOUND },
      { value: 'NEEDS_CLARIFICATION', label: '⚫ Требует уточнения', count: counts.NEEDS_CLARIFICATION }
    ];
  }, [objects]);

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      {/* Top Search & Filter Bar */}
      <div className="p-3 bg-white border-b border-slate-200 space-y-2">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="search-objects-input"
            type="text"
            placeholder="Поиск по адресу, №, стоимости или комментарию..."
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            className="w-full pl-9 pr-8 py-2 bg-slate-100/80 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 border border-transparent focus:border-blue-500 rounded-xl outline-hidden transition"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange({ searchQuery: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFilterChange({ status: opt.value })}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition shrink-0 cursor-pointer ${
                filters.status === opt.value
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>

        {/* Sorting & Nearby toggle */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="sort-objects-select"
              value={filters.sortBy}
              onChange={(e) => onFilterChange({ sortBy: e.target.value as any })}
              className="bg-transparent font-semibold text-slate-700 outline-hidden cursor-pointer"
            >
              <option value="id">По номеру (1 → 130)</option>
              {userLocation && <option value="distance">По расстоянию от меня</option>}
              <option value="price_desc">По стоимости (убыв.)</option>
              <option value="price_asc">По стоимости (возр.)</option>
              <option value="status">По статусу проверки</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.onlyNearby}
              onChange={(e) => onFilterChange({ onlyNearby: e.target.checked })}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span className="font-medium text-slate-700">Рядом (до 3 км)</span>
          </label>
        </div>
      </div>

      {/* Recommendation Banner: Next Closest Unchecked Object */}
      {closestUnchecked && (
        <div className="mx-3 my-2 p-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1 text-blue-100">
              <Navigation className="w-3 h-3 text-white" /> Ближайший непроверенный
            </span>
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-md">
              {formatDistance(closestUnchecked.distance)}
            </span>
          </div>
          <p className="text-xs font-bold truncate mb-1.5">
            №{closestUnchecked.object.id}: {closestUnchecked.object.normalizedAddress || closestUnchecked.object.originalAddress}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onSelectObject(closestUnchecked.object)}
              className="flex-1 bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold py-1 px-2 rounded-lg transition"
            >
              Показать на карте
            </button>
            <button
              onClick={() => onOpenInspection(closestUnchecked.object)}
              className="flex-1 bg-white text-blue-700 hover:bg-blue-50 text-[11px] font-bold py-1 px-2 rounded-lg shadow-xs transition"
            >
              Проверить объект
            </button>
          </div>
        </div>
      )}

      {/* Objects Cards Scrollable List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>Найдено: <strong className="text-slate-800 font-bold">{filteredAndSortedObjects.length}</strong> из {objects.length}</span>
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange({ searchQuery: '', status: 'ALL', onlyNearby: false })}
              className="text-blue-600 hover:underline font-medium"
            >
              Сбросить фильтры
            </button>
          )}
        </div>

        {filteredAndSortedObjects.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-sm">Объекты не найдены</p>
            <p className="text-xs text-slate-400 mt-1">Попробуйте изменить параметры поиска или фильтры</p>
            <button
              onClick={() => onFilterChange({ searchQuery: '', status: 'ALL', onlyNearby: false })}
              className="mt-3 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
            >
              Показать все 130 объектов
            </button>
          </div>
        ) : (
          filteredAndSortedObjects.map((obj) => (
            <ObjectCard
              key={obj.id}
              object={obj}
              isSelected={selectedObject?.id === obj.id}
              userLocation={userLocation}
              onSelect={onSelectObject}
              onOpenInspection={onOpenInspection}
            />
          ))
        )}
      </div>
    </div>
  );
};
