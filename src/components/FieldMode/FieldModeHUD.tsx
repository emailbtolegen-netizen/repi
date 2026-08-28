import React, { useState, useMemo } from 'react';
import { PropertyObject, PropertyStatus, UserLocation } from '../../types';
import { calculateDistanceMeters, formatDistance, formatKZT, getNavigationLinks } from '../../utils/geoUtils';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Navigation, 
  Camera, 
  Crosshair, 
  Check, 
  AlertTriangle, 
  HelpCircle, 
  MapPin
} from 'lucide-react';

interface FieldModeHUDProps {
  objects: PropertyObject[];
  userLocation: UserLocation | null;
  initialSelectedId?: number;
  onClose: () => void;
  onUpdateObject: (id: number, updates: Partial<PropertyObject>, action?: string, details?: string) => Promise<void>;
  onRequestUserLocation: () => void;
}

export const FieldModeHUD: React.FC<FieldModeHUDProps> = ({
  objects,
  userLocation,
  initialSelectedId,
  onClose,
  onUpdateObject,
  onRequestUserLocation
}) => {
  const activeObjects = useMemo(() => objects.filter((o) => !o.isArchived), [objects]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialSelectedId) {
      const idx = activeObjects.findIndex((o) => o.id === initialSelectedId);
      if (idx >= 0) return idx;
    }
    return 0;
  });

  const [quickComment, setQuickComment] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const currentObj = activeObjects[currentIndex] || activeObjects[0];

  // Calculate distance to current object
  let currentDistance: number | null = null;
  if (userLocation && currentObj) {
    currentDistance = calculateDistanceMeters(
      userLocation.latitude,
      userLocation.longitude,
      currentObj.currentLatitude || currentObj.originalLatitude,
      currentObj.currentLongitude || currentObj.originalLongitude
    );
  }

  const navLinks = currentObj
    ? getNavigationLinks(
        currentObj.currentLatitude || currentObj.originalLatitude,
        currentObj.currentLongitude || currentObj.originalLongitude,
        currentObj.normalizedAddress || currentObj.originalAddress
      )
    : null;

  // Handle Quick Status
  const handleQuickStatus = async (status: PropertyStatus) => {
    if (!currentObj) return;
    const nowIso = new Date().toISOString();
    const updates: Partial<PropertyObject> = {
      status,
      verifiedAt: nowIso,
      verifier: 'Полевой инспектор (HUD)'
    };

    if (userLocation) {
      updates.actualLatitude = userLocation.latitude;
      updates.actualLongitude = userLocation.longitude;
      updates.gpsAccuracy = Math.round(userLocation.accuracy);
    }

    if (quickComment) {
      updates.verificationComment = currentObj.verificationComment
        ? `${currentObj.verificationComment} | ${quickComment}`
        : quickComment;
    }

    await onUpdateObject(
      currentObj.id,
      updates,
      'Быстрая проверка (Режим в машине)',
      `Статус изменен на ${status}`
    );

    setJustSaved(true);
    setQuickComment('');
    setTimeout(() => {
      setJustSaved(false);
      // Auto move to next unchecked if available
      handleNext();
    }, 900);
  };

  // Find nearest object
  const handleJumpToNearest = () => {
    if (!userLocation) {
      onRequestUserLocation();
      return;
    }
    let minD = Infinity;
    let minIdx = 0;
    activeObjects.forEach((obj, idx) => {
      if (obj.status === 'UNCHECKED') {
        const d = calculateDistanceMeters(
          userLocation.latitude,
          userLocation.longitude,
          obj.currentLatitude || obj.originalLatitude,
          obj.currentLongitude || obj.originalLongitude
        );
        if (d < minD) {
          minD = d;
          minIdx = idx;
        }
      }
    });
    setCurrentIndex(minIdx);
  };

  const handleNext = () => {
    if (currentIndex < activeObjects.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Quick photo upload
  const handleQuickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentObj) return;

    const filesList = Array.from(files);
    filesList.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        if (base64) {
          const newPhotos = [...(currentObj.photos || []), base64];
          await onUpdateObject(
            currentObj.id,
            { photos: newPhotos },
            'Фото из машины',
            'Прикреплено фото в полевом режиме'
          );
        }
      };
      reader.readAsDataURL(file);
    });
  };

  if (!currentObj) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-3 sm:p-5 select-none">
      {/* Top HUD Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-extrabold text-sm sm:text-base tracking-wider text-slate-200">
            ПОЛЕВОЙ HUD РЕЖИМ
          </span>
          <span className="text-xs text-slate-400">
            ({currentIndex + 1}/{activeObjects.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleJumpToNearest}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 transition"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ближайший</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Target Object Card */}
      <div className="my-auto py-2">
        <div className="relative p-5 rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl">
          {justSaved && (
            <div className="absolute inset-0 bg-emerald-600/90 rounded-3xl flex items-center justify-center text-white font-extrabold text-xl z-20 animate-fade-in">
              ✓ ПРОВЕРКА ЗАФИКСИРОВАНА!
            </div>
          )}

          <div className="flex items-start justify-between gap-3 mb-2">
            <span className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-black text-base shadow-md">
              № {currentObj.id}
            </span>

            {currentDistance !== null ? (
              <span className="px-3.5 py-1.5 rounded-xl bg-blue-950 border border-blue-500/50 text-blue-400 font-extrabold text-sm flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-400" />
                {formatDistance(currentDistance)}
              </span>
            ) : (
              <button
                onClick={onRequestUserLocation}
                className="text-xs text-blue-400 underline font-semibold"
              >
                Включить GPS
              </button>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white leading-snug mb-2">
            {currentObj.normalizedAddress || currentObj.originalAddress}
          </h2>

          <div className="flex flex-wrap items-center justify-between text-sm text-slate-400 gap-2 mb-4">
            <div>
              Оценка: <strong className="text-emerald-400 font-bold text-base">{formatKZT(currentObj.estimatedValue)}</strong>
            </div>
            <div className="text-xs text-slate-400">
              Статус: <strong className="text-white">{currentObj.status}</strong>
            </div>
          </div>

          {/* Large Navigation & Camera Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {navLinks && (
              <a
                href={navLinks.twoGis}
                target="_blank"
                rel="noreferrer"
                className="py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
              >
                <Navigation className="w-5 h-5" />
                <span>НАВИГАЦИЯ (2GIS)</span>
              </a>
            )}

            <label className="cursor-pointer py-4 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg active:scale-95 transition text-center">
              <Camera className="w-5 h-5" />
              <span>ФОТО ({currentObj.photos?.length || 0})</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleQuickPhoto}
                className="hidden"
              />
            </label>
          </div>

          {/* Quick Note Input */}
          <input
            type="text"
            placeholder="Быстрая заметка (напр: 2 этажа, синяя крыша)..."
            value={quickComment}
            onChange={(e) => setQuickComment(e.target.value)}
            className="w-full p-3 mb-4 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 outline-hidden focus:border-blue-500"
          />

          {/* 4 BIG INSTANT TOUCH STATUS BUTTONS */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleQuickStatus('FOUND')}
              className="py-4 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Check className="w-5 h-5" />
              <span>НАЙДЕН</span>
            </button>

            <button
              onClick={() => handleQuickStatus('DISCREPANCY')}
              className="py-4 px-3 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition"
            >
              <AlertTriangle className="w-5 h-5" />
              <span>НЕСООТВЕТСТВИЕ</span>
            </button>

            <button
              onClick={() => handleQuickStatus('NOT_FOUND')}
              className="py-4 px-3 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition"
            >
              <X className="w-5 h-5" />
              <span>НЕ НАЙДЕН</span>
            </button>

            <button
              onClick={() => handleQuickStatus('NEEDS_CLARIFICATION')}
              className="py-4 px-3 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition"
            >
              <HelpCircle className="w-5 h-5" />
              <span>УТОЧНЕНИЕ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Pager Controls */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Предыдущий</span>
        </button>

        <button
          onClick={handleNext}
          disabled={currentIndex === activeObjects.length - 1}
          className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg"
        >
          <span>Следующий</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
