import React, { useState, useEffect } from 'react';
import { PropertyObject, PropertyStatus, UserLocation } from '../../types';
import { formatKZT, formatDistance, calculateDistanceMeters, getNavigationLinks } from '../../utils/geoUtils';
import { 
  Building2, 
  MapPin, 
  Camera, 
  Navigation, 
  Check, 
  AlertTriangle, 
  X, 
  HelpCircle, 
  Maximize2,
  Crosshair,
  Clock,
  Sparkles
} from 'lucide-react';

interface QuickInspectionCardProps {
  object: PropertyObject | null;
  userLocation: UserLocation | null;
  onUpdateObject: (id: number, updates: Partial<PropertyObject>, action?: string, details?: string) => Promise<void>;
  onOpenFullModal: (obj: PropertyObject) => void;
  onRequestUserLocation: () => void;
}

export const QuickInspectionCard: React.FC<QuickInspectionCardProps> = ({
  object,
  userLocation,
  onUpdateObject,
  onOpenFullModal,
  onRequestUserLocation
}) => {
  const [comment, setComment] = useState(object?.verificationComment || '');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setComment(object?.verificationComment || '');
  }, [object]);

  if (!object) {
    return (
      <div className="h-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3">
          <Building2 className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 mb-1">Выберите объект из списка или карты</h3>
        <p className="text-xs text-slate-400 max-w-[220px]">
          Нажмите на любой объект реестра для быстрой верификации и фиксации GPS
        </p>
      </div>
    );
  }

  const handleStatusChange = async (status: PropertyStatus) => {
    const nowIso = new Date().toISOString();
    const updates: Partial<PropertyObject> = {
      status,
      verifiedAt: object.verifiedAt || nowIso,
      verifier: object.verifier || 'Инспектор'
    };

    if (userLocation && (!object.actualLatitude || !object.actualLongitude)) {
      updates.actualLatitude = userLocation.latitude;
      updates.actualLongitude = userLocation.longitude;
      updates.gpsAccuracy = Math.round(userLocation.accuracy);
    }

    await onUpdateObject(object.id, updates, 'Изменение статуса', `Быстрое обновление: ${status}`);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleCommentBlur = async () => {
    if (comment !== (object.verificationComment || '')) {
      await onUpdateObject(
        object.id,
        { verificationComment: comment },
        'Обновление комментария',
        `Комментарий: ${comment.substring(0, 30)}...`
      );
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      if (base64) {
        const updatedPhotos = [...(object.photos || []), base64];
        await onUpdateObject(
          object.id,
          { photos: updatedPhotos },
          'Добавление фото',
          'Фотография прикреплена к объекту'
        );
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2500);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateGps = async () => {
    if (!userLocation) {
      onRequestUserLocation();
      return;
    }
    await onUpdateObject(
      object.id,
      {
        actualLatitude: userLocation.latitude,
        actualLongitude: userLocation.longitude,
        gpsAccuracy: Math.round(userLocation.accuracy)
      },
      'Фиксация GPS',
      `Координаты: ${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`
    );
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const navLinks = getNavigationLinks(
    object.currentLatitude || object.originalLatitude,
    object.currentLongitude || object.originalLongitude,
    object.normalizedAddress || object.originalAddress
  );

  let distanceStr = '';
  if (userLocation) {
    const d = calculateDistanceMeters(
      userLocation.latitude,
      userLocation.longitude,
      object.currentLatitude || object.originalLatitude,
      object.currentLongitude || object.originalLongitude
    );
    distanceStr = formatDistance(d);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-3.5 h-full overflow-y-auto">
      {/* Header Row */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-slate-900 text-white font-extrabold text-[10px] rounded-md uppercase">
            № {object.id}
          </span>
          <h2 className="text-xs font-black uppercase text-slate-500 tracking-wider">
            Карточка инспекции
          </h2>
        </div>
        {isSaved ? (
          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Сохранено
          </span>
        ) : object.verifiedAt ? (
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" /> Проверен
          </span>
        ) : (
          <span className="text-[10px] text-blue-600 font-bold">Ожидает</span>
        )}
      </div>

      {/* Title & Address */}
      <div className="shrink-0">
        <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
          {object.normalizedAddress || object.originalAddress}
        </h3>
        <p className="text-slate-400 text-xs font-medium mt-0.5 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-slate-400" /> г. Атырау, Казахстан {distanceStr ? `• ~${distanceStr}` : ''}
        </p>
      </div>

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-2 gap-2 py-2 border-y border-slate-100 shrink-0">
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Стоимость</p>
          <p className="text-xs sm:text-sm font-black text-slate-800">{formatKZT(object.estimatedValue)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Статус</p>
          <span className={`text-[11px] font-black uppercase ${
            object.status === 'FOUND' ? 'text-emerald-600' :
            object.status === 'DISCREPANCY' ? 'text-amber-600' :
            object.status === 'NOT_FOUND' ? 'text-rose-600' :
            object.status === 'NEEDS_CLARIFICATION' ? 'text-slate-700' :
            'text-blue-600'
          }`}>
            {object.status === 'FOUND' ? '🟢 НАЙДЕН' :
             object.status === 'DISCREPANCY' ? '🟡 НЕСООТВЕТСТВИЕ' :
             object.status === 'NOT_FOUND' ? '🔴 НЕ НАЙДЕН' :
             object.status === 'NEEDS_CLARIFICATION' ? '⚫ УТОЧНЕНИЕ' :
             '🔵 НЕ ПРОВЕРЕН'}
          </span>
        </div>
      </div>

      {/* Quick Status Buttons */}
      <div className="space-y-1.5 shrink-0">
        <button
          onClick={() => handleStatusChange('FOUND')}
          className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
            object.status === 'FOUND'
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          <Check className="w-4 h-4" /> Объект найден
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => handleStatusChange('DISCREPANCY')}
            className={`py-2 px-1 rounded-xl font-bold text-[10px] uppercase transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer ${
              object.status === 'DISCREPANCY'
                ? 'bg-amber-500 text-white font-black ring-2 ring-amber-300'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Несоответствие
          </button>

          <button
            onClick={() => handleStatusChange('NOT_FOUND')}
            className={`py-2 px-1 rounded-xl font-bold text-[10px] uppercase transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer ${
              object.status === 'NOT_FOUND'
                ? 'bg-rose-500 text-white font-black ring-2 ring-rose-300'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
            }`}
          >
            <X className="w-3.5 h-3.5 text-rose-600" /> Не найден
          </button>
        </div>
      </div>

      {/* Quick Photo Capture */}
      <div className="space-y-2 shrink-0">
        <label className="p-2.5 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />
          <Camera className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-600">
            {object.photos?.length > 0 ? `Добавить фото (${object.photos.length} сохранено)` : 'Сделать фото объекта'}
          </span>
        </label>

        {/* Comment input */}
        <textarea
          placeholder="Комментарий инспектора..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={handleCommentBlur}
          rows={2}
          className="w-full p-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs outline-hidden transition resize-none"
        />
      </div>

      {/* GPS Coordinates Block */}
      <div className="bg-blue-50/80 p-2.5 rounded-xl border border-blue-100 shrink-0">
        <div className="flex justify-between items-center mb-1">
          <p className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wider">Координаты</p>
          <button
            onClick={handleUpdateGps}
            className="text-[10px] font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Crosshair className="w-3 h-3 text-blue-600" /> Обновить по GPS
          </button>
        </div>
        <p className="text-[11px] font-mono font-semibold text-slate-700">
          {object.actualLatitude ? object.actualLatitude.toFixed(6) : (object.currentLatitude || object.originalLatitude).toFixed(6)},{' '}
          {object.actualLongitude ? object.actualLongitude.toFixed(6) : (object.currentLongitude || object.originalLongitude).toFixed(6)}
        </p>
      </div>

      {/* Bottom Full Modal and 2GIS triggers */}
      <div className="flex gap-2 pt-1 mt-auto shrink-0">
        <button
          onClick={() => window.open(navLinks.twoGis, '_blank')}
          className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Navigation className="w-3.5 h-3.5 text-blue-400" /> 2GIS
        </button>

        <button
          onClick={() => onOpenFullModal(object)}
          className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Maximize2 className="w-3.5 h-3.5 text-slate-600" /> Подробнее
        </button>
      </div>
    </div>
  );
};
