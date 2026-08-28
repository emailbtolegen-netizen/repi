import React, { useState } from 'react';
import { PropertyObject, PropertyStatus, UserLocation } from '../../types';
import { formatKZT, formatDistance, formatDateTime, calculateDistanceMeters, getNavigationLinks } from '../../utils/geoUtils';
import { 
  X, 
  MapPin, 
  Camera, 
  Navigation, 
  Save, 
  Check, 
  AlertTriangle, 
  HelpCircle, 
  Clock, 
  Trash2, 
  History, 
  Crosshair, 
  Maximize2,
  ExternalLink
} from 'lucide-react';

interface ObjectDetailModalProps {
  object: PropertyObject;
  userLocation: UserLocation | null;
  onClose: () => void;
  onUpdateObject: (id: number, updates: Partial<PropertyObject>, historyAction?: string, historyDetails?: string) => Promise<void>;
  onRequestUserLocation: () => void;
}

export const ObjectDetailModal: React.FC<ObjectDetailModalProps> = ({
  object,
  userLocation,
  onClose,
  onUpdateObject,
  onRequestUserLocation
}) => {
  const [comment, setComment] = useState(object.verificationComment || '');
  const [actualAddress, setActualAddress] = useState(object.actualAddress || '');
  const [editLat, setEditLat] = useState(String(object.currentLatitude || object.originalLatitude));
  const [editLng, setEditLng] = useState(String(object.currentLongitude || object.originalLongitude));
  const [photos, setPhotos] = useState<string[]>(object.photos || []);
  const [activeTab, setActiveTab] = useState<'inspection' | 'coords' | 'history'>('inspection');
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const navLinks = getNavigationLinks(
    object.currentLatitude || object.originalLatitude,
    object.currentLongitude || object.originalLongitude,
    object.normalizedAddress || object.originalAddress
  );

  // Quick comment templates
  const quickTemplates = [
    'Здание найдено, адрес полностью соответствует.',
    'На месте находится нежилое помещение.',
    'По указанному адресу находится другой объект.',
    'Строение снесено / свободный земельный участок.',
    'Закрытая территория / шлагбаум, доступ ограничен.'
  ];

  const showSavedNotification = (text: string) => {
    setSaveSuccessMsg(text);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  // Status Change Handler with automatic GPS and timestamp capture
  const handleSetStatus = async (newStatus: PropertyStatus) => {
    setIsSaving(true);
    const nowIso = new Date().toISOString();
    const updates: Partial<PropertyObject> = {
      status: newStatus,
      verifiedAt: object.verifiedAt || nowIso,
      verifier: object.verifier || 'Полевой инспектор'
    };

    // Automatically attach user GPS if available and not yet recorded
    if (userLocation && (!object.actualLatitude || !object.actualLongitude)) {
      updates.actualLatitude = userLocation.latitude;
      updates.actualLongitude = userLocation.longitude;
      updates.gpsAccuracy = Math.round(userLocation.accuracy);
    }

    const statusNames: Record<PropertyStatus, string> = {
      FOUND: '🟢 Объект найден',
      DISCREPANCY: '🟡 Есть несоответствие',
      NOT_FOUND: '🔴 Объект не найден',
      NEEDS_CLARIFICATION: '⚫ Требует уточнения',
      UNCHECKED: '🔵 Не проверен'
    };

    await onUpdateObject(
      object.id,
      updates,
      'Изменение статуса',
      `Статус изменён на "${statusNames[newStatus]}"`
    );
    setIsSaving(false);
    showSavedNotification(`Статус сохранён: ${statusNames[newStatus]}`);
  };

  // Record GPS Coordinates
  const handleRecordGPS = async () => {
    if (!userLocation) {
      onRequestUserLocation();
      return;
    }

    setIsSaving(true);
    const nowIso = new Date().toISOString();
    const updates: Partial<PropertyObject> = {
      actualLatitude: userLocation.latitude,
      actualLongitude: userLocation.longitude,
      gpsAccuracy: Math.round(userLocation.accuracy),
      verifiedAt: nowIso
    };

    const distFromOriginal = calculateDistanceMeters(
      object.originalLatitude,
      object.originalLongitude,
      userLocation.latitude,
      userLocation.longitude
    );

    await onUpdateObject(
      object.id,
      updates,
      'Фиксация GPS',
      `Зафиксированы координаты (${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}), отклонение: ${distFromOriginal} м, точность GPS: ±${Math.round(userLocation.accuracy)}м`
    );
    setIsSaving(false);
    showSavedNotification('GPS координаты зафиксированы!');
  };

  // Save manual coordinates
  const handleSaveManualCoords = async () => {
    const lat = parseFloat(editLat);
    const lng = parseFloat(editLng);

    if (isNaN(lat) || isNaN(lng)) {
      alert('Пожалуйста, введите корректные числовые координаты широты и долготы');
      return;
    }

    setIsSaving(true);
    await onUpdateObject(
      object.id,
      {
        currentLatitude: lat,
        currentLongitude: lng,
        coordinateStatus: 'USER_ADJUSTED'
      },
      'Корректировка координат',
      `Координаты изменены вручную на (${lat.toFixed(6)}, ${lng.toFixed(6)})`
    );
    setIsSaving(false);
    showSavedNotification('Координаты сохранены!');
  };

  // Save Inspector Comment & Actual Address
  const handleSaveComment = async () => {
    setIsSaving(true);
    await onUpdateObject(
      object.id,
      {
        verificationComment: comment,
        actualAddress: actualAddress
      },
      'Обновление комментария',
      `Комментарий инспектора обновлен`
    );
    setIsSaving(false);
    showSavedNotification('Комментарий сохранён!');
  };

  // Photo capture via input
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesList = Array.from(files);
    filesList.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          const newPhotos = [...photos, base64];
          setPhotos(newPhotos);
          await onUpdateObject(
            object.id,
            { photos: newPhotos },
            'Добавление фото',
            `Прикреплена новая фотография объекта`
          );
          showSavedNotification('Фотография сохранена!');
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = async (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    await onUpdateObject(
      object.id,
      { photos: newPhotos },
      'Удаление фото',
      `Удалена фотография #${index + 1}`
    );
    showSavedNotification('Фото удалено');
  };

  // Calculate coordinates discrepancy in meters
  let coordinateDiscrepancy: number | null = null;
  if (object.actualLatitude && object.actualLongitude) {
    coordinateDiscrepancy = calculateDistanceMeters(
      object.originalLatitude,
      object.originalLongitude,
      object.actualLatitude,
      object.actualLongitude
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-blue-600 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-md">
                ОБЪЕКТ № {object.id}
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {object.category === 'apartment' ? 'Квартира' : object.category === 'garage_parking' ? 'Паркинг/Гараж' : object.category === 'commercial' ? 'Коммерция' : object.category === 'plot' ? 'Участок' : 'Жилой дом'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold leading-tight text-white">
              {object.normalizedAddress || object.originalAddress}
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Оценочная стоимость: <strong className="text-emerald-400 font-bold">{formatKZT(object.estimatedValue)}</strong>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 text-xs sm:text-sm font-semibold">
          <button
            onClick={() => setActiveTab('inspection')}
            className={`py-3 px-3 border-b-2 transition ${
              activeTab === 'inspection'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Проверка и статус
          </button>
          <button
            onClick={() => setActiveTab('coords')}
            className={`py-3 px-3 border-b-2 transition ${
              activeTab === 'coords'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Координаты и навигация
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 border-b-2 transition ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            История ({object.history?.length || 0})
          </button>
        </div>

        {/* Save feedback indicator */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs px-4 py-2 flex items-center gap-1.5 font-semibold animate-pulse">
            <Check className="w-4 h-4 text-emerald-600" />
            {saveSuccessMsg}
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'inspection' && (
            <>
              {/* STATUS SELECTION: Big Touch Targets */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  1. Результат полевой проверки
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    id="btn-status-found"
                    type="button"
                    onClick={() => handleSetStatus('FOUND')}
                    className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition shadow-xs active:scale-98 ${
                      object.status === 'FOUND'
                        ? 'bg-emerald-600 text-white ring-3 ring-emerald-300'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${object.status === 'FOUND' ? 'bg-white text-emerald-700' : 'bg-emerald-200 text-emerald-800'}`}>
                      <Check className="w-4 h-4 font-extrabold" />
                    </div>
                    <div className="text-left">
                      <div className="font-extrabold">ОБЪЕКТ НАЙДЕН</div>
                      <div className="text-[11px] font-normal opacity-90">Здание на месте, адрес верен</div>
                    </div>
                  </button>

                  <button
                    id="btn-status-discrepancy"
                    type="button"
                    onClick={() => handleSetStatus('DISCREPANCY')}
                    className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition shadow-xs active:scale-98 ${
                      object.status === 'DISCREPANCY'
                        ? 'bg-amber-500 text-white ring-3 ring-amber-300'
                        : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${object.status === 'DISCREPANCY' ? 'bg-white text-amber-700' : 'bg-amber-200 text-amber-900'}`}>
                      <AlertTriangle className="w-4 h-4 font-extrabold" />
                    </div>
                    <div className="text-left">
                      <div className="font-extrabold">ЕСТЬ НЕСООТВЕТСТВИЕ</div>
                      <div className="text-[11px] font-normal opacity-90">Другой объект / смещение</div>
                    </div>
                  </button>

                  <button
                    id="btn-status-not-found"
                    type="button"
                    onClick={() => handleSetStatus('NOT_FOUND')}
                    className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition shadow-xs active:scale-98 ${
                      object.status === 'NOT_FOUND'
                        ? 'bg-rose-600 text-white ring-3 ring-rose-300'
                        : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${object.status === 'NOT_FOUND' ? 'bg-white text-rose-700' : 'bg-rose-200 text-rose-800'}`}>
                      <X className="w-4 h-4 font-extrabold" />
                    </div>
                    <div className="text-left">
                      <div className="font-extrabold">НЕ НАЙДЕН</div>
                      <div className="text-[11px] font-normal opacity-90">Снесено / адрес отсутствует</div>
                    </div>
                  </button>

                  <button
                    id="btn-status-clarification"
                    type="button"
                    onClick={() => handleSetStatus('NEEDS_CLARIFICATION')}
                    className={`p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition shadow-xs active:scale-98 ${
                      object.status === 'NEEDS_CLARIFICATION'
                        ? 'bg-slate-700 text-white ring-3 ring-slate-400'
                        : 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${object.status === 'NEEDS_CLARIFICATION' ? 'bg-white text-slate-800' : 'bg-slate-300 text-slate-800'}`}>
                      <HelpCircle className="w-4 h-4 font-extrabold" />
                    </div>
                    <div className="text-left">
                      <div className="font-extrabold">ТРЕБУЕТ УТОЧНЕНИЯ</div>
                      <div className="text-[11px] font-normal opacity-90">Неоднозначный адрес</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* GPS FIXATION ACTION */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                      2. Фиксация фактического GPS места
                    </span>
                  </div>
                  {object.verifiedAt && (
                    <span className="text-[11px] font-medium text-slate-500">
                      Проверено: {formatDateTime(object.verifiedAt)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 mb-3">
                  <div>
                    <span className="text-slate-400">Исходные координаты: </span>
                    <strong className="text-slate-800">{object.originalLatitude.toFixed(6)}, {object.originalLongitude.toFixed(6)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Фактические координаты: </span>
                    {object.actualLatitude && object.actualLongitude ? (
                      <strong className="text-emerald-700 font-bold">
                        {object.actualLatitude.toFixed(6)}, {object.actualLongitude.toFixed(6)}
                      </strong>
                    ) : (
                      <span className="text-slate-400 italic">Не зафиксированы</span>
                    )}
                  </div>
                </div>

                {coordinateDiscrepancy !== null && (
                  <div className={`p-2 rounded-lg text-xs font-semibold mb-3 flex items-center gap-2 ${
                    coordinateDiscrepancy > 50 ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Смещение фактической точки от исходной: <strong>{coordinateDiscrepancy} метров</strong>
                      {object.gpsAccuracy ? ` (Точность GPS: ±${object.gpsAccuracy}м)` : ''}
                    </span>
                  </div>
                )}

                <button
                  id="btn-record-my-gps"
                  type="button"
                  onClick={handleRecordGPS}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-98"
                >
                  <Crosshair className="w-4 h-4" />
                  <span>Зафиксировать моё текущее GPS местоположение</span>
                </button>
              </div>

              {/* PHOTO UPLOAD & CAMERA */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-blue-600" />
                    3. Фотографии объекта ({photos.length})
                  </label>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition shadow-xs">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Сделать / Добавить фото</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {photos.length === 0 ? (
                  <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 bg-slate-50">
                    Фотографии еще не прикреплены. Нажмите «Сделать / Добавить фото» прямо с камеры телефона.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {photos.map((src, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square border border-slate-200 bg-slate-100">
                        <img
                          src={src}
                          alt={`Фото ${idx + 1}`}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setZoomedPhoto(src)}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                          <button
                            onClick={() => setZoomedPhoto(src)}
                            className="p-1 rounded bg-white text-slate-900 hover:bg-slate-100"
                            title="Увеличить"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemovePhoto(idx)}
                            className="p-1 rounded bg-rose-600 text-white hover:bg-rose-700"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* INSPECTOR COMMENT */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  4. Комментарий инспектора
                </label>

                {/* Quick chip templates */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {quickTemplates.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setComment((prev) => (prev ? `${prev} ${tmpl}` : tmpl))}
                      className="text-[11px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
                    >
                      + {tmpl}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  placeholder="Опишите фактическое состояние объекта, тип строения, этажность, вывески, расхождения с адресом..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 outline-hidden focus:bg-white focus:border-blue-500 transition"
                />

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveComment}
                    disabled={isSaving}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Сохранить комментарий</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'coords' && (
            <div className="space-y-4">
              {/* Navigation buttons */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-2">
                  Построить маршрут к объекту
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <a
                    href={navLinks.twoGis}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>2GIS</span>
                  </a>
                  <a
                    href={navLinks.googleMaps}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Google Maps</span>
                  </a>
                  <a
                    href={navLinks.yandexMaps}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Яндекс</span>
                  </a>
                  <a
                    href={navLinks.appleMaps}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Apple Maps</span>
                  </a>
                </div>
              </div>

              {/* Manual Coordinate adjustment */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                  Ручная корректировка координат объекта
                </h4>
                <p className="text-xs text-slate-500">
                  Исходные координаты ({object.originalLatitude}, {object.originalLongitude}) сохраняются в реестре без изменений. Изменения сохраняются как текущие рабочие координаты.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Широта (Latitude):</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={editLat}
                      onChange={(e) => setEditLat(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Долгота (Longitude):</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={editLng}
                      onChange={(e) => setEditLng(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {userLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditLat(String(userLocation.latitude));
                        setEditLng(String(userLocation.longitude));
                      }}
                      className="py-2 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Вставить моё GPS положение</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveManualCoords}
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 ml-auto"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>💾 Сохранить координаты</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                Журнал действий и проверок
              </h4>
              {(!object.history || object.history.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  История изменений пока пуста.
                </div>
              ) : (
                <div className="space-y-2">
                  {object.history.map((ev) => (
                    <div key={ev.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div className="flex justify-between items-center text-slate-500 mb-1">
                        <span className="font-bold text-slate-800">{ev.action}</span>
                        <span>{formatDateTime(ev.timestamp)}</span>
                      </div>
                      <p className="text-slate-600">{ev.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            ✓ Все изменения сохраняются автоматически
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-xs transition"
          >
            Готово
          </button>
        </div>
      </div>

      {/* Fullscreen Photo Zoom Modal */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomedPhoto(null)}
        >
          <button
            onClick={() => setZoomedPhoto(null)}
            className="absolute top-4 right-4 p-2 text-white bg-white/20 hover:bg-white/30 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={zoomedPhoto}
            alt="Увеличенное фото"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
};
