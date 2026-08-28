import React from 'react';
import { PropertyObject, PropertyStatus, UserLocation } from '../../types';
import { formatDistance, formatKZT, calculateDistanceMeters, getNavigationLinks } from '../../utils/geoUtils';
import { 
  MapPin, 
  ChevronRight, 
  Camera, 
  MessageSquare, 
  Navigation, 
  Check, 
  AlertTriangle, 
  X, 
  HelpCircle,
  Clock
} from 'lucide-react';

interface ObjectCardProps {
  object: PropertyObject;
  isSelected: boolean;
  userLocation: UserLocation | null;
  onSelect: (obj: PropertyObject) => void;
  onOpenInspection: (obj: PropertyObject) => void;
  onQuickVerifyFound?: (obj: PropertyObject) => void;
}

export function getStatusBadge(status: PropertyStatus) {
  switch (status) {
    case 'FOUND':
      return {
        label: 'Объект найден',
        icon: <Check className="w-3 h-3 text-emerald-700" />,
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    case 'DISCREPANCY':
      return {
        label: 'Есть несоответствие',
        icon: <AlertTriangle className="w-3 h-3 text-amber-700" />,
        classes: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    case 'NOT_FOUND':
      return {
        label: 'Объект не найден',
        icon: <X className="w-3 h-3 text-rose-700" />,
        classes: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    case 'NEEDS_CLARIFICATION':
      return {
        label: 'Требует уточнения',
        icon: <HelpCircle className="w-3 h-3 text-slate-700" />,
        classes: 'bg-slate-100 text-slate-700 border-slate-300'
      };
    case 'UNCHECKED':
    default:
      return {
        label: 'Не проверен',
        icon: <Clock className="w-3 h-3 text-blue-700" />,
        classes: 'bg-blue-50 text-blue-700 border-blue-200'
      };
  }
}

export const ObjectCard: React.FC<ObjectCardProps> = ({
  object,
  isSelected,
  userLocation,
  onSelect,
  onOpenInspection
}) => {
  const badge = getStatusBadge(object.status);

  // Calculate distance
  let distanceMeters: number | null = null;
  if (userLocation) {
    const lat = object.currentLatitude || object.originalLatitude;
    const lng = object.currentLongitude || object.originalLongitude;
    distanceMeters = calculateDistanceMeters(userLocation.latitude, userLocation.longitude, lat, lng);
  }

  const navLinks = getNavigationLinks(
    object.currentLatitude || object.originalLatitude,
    object.currentLongitude || object.originalLongitude,
    object.normalizedAddress || object.originalAddress
  );

  return (
    <div
      id={`object-card-${object.id}`}
      onClick={() => onSelect(object)}
      className={`relative p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
        isSelected
          ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-400 shadow-md'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md font-black text-[11px] uppercase ${
            isSelected ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-900 text-white'
          }`}>
            № {object.id}
          </span>
          {isSelected && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded font-black tracking-wider uppercase">
              ВЫБРАН
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badge.classes}`}
          >
            {badge.icon}
            {badge.label}
          </span>
        </div>

        {distanceMeters !== null && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            ~{formatDistance(distanceMeters)}
          </span>
        )}
      </div>

      {/* Address */}
      <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2 mb-1">
        {object.normalizedAddress || object.originalAddress}
      </h3>

      {/* Estimated value */}
      <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
        <span>
          Оценочная стоимость: <strong className="text-slate-900 font-bold">{formatKZT(object.estimatedValue)}</strong>
        </span>
      </div>

      {/* Verified details / photos / comments preview */}
      {(object.photos?.length > 0 || object.verificationComment || object.actualAddress) && (
        <div className="flex items-center gap-3 text-[11px] text-slate-500 bg-slate-100/70 rounded-lg px-2 py-1 mb-2">
          {object.photos?.length > 0 && (
            <span className="flex items-center gap-1 text-slate-700 font-medium">
              <Camera className="w-3 h-3 text-blue-600" /> {object.photos.length} фото
            </span>
          )}
          {object.verificationComment && (
            <span className="flex items-center gap-1 truncate max-w-[170px] text-slate-600">
              <MessageSquare className="w-3 h-3 text-amber-600" /> {object.verificationComment}
            </span>
          )}
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <button
          id={`nav-btn-${object.id}`}
          onClick={(e) => {
            e.stopPropagation();
            window.open(navLinks.twoGis, '_blank');
          }}
          title="Открыть в 2GIS / Навигатор"
          className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 transition"
        >
          <Navigation className="w-3.5 h-3.5 text-blue-600" />
          <span>2GIS</span>
        </button>

        <button
          id={`inspect-btn-${object.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenInspection(object);
          }}
          className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1 transition active:scale-95"
        >
          <span>Проверить</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
