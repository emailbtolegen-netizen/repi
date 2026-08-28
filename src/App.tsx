import React, { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { PropertyObject, FilterOptions, UserLocation, DashboardStats } from './types';
import { StorageService } from './services/storageService';
import { HeaderStats } from './components/Dashboard/HeaderStats';
import { ObjectsList } from './components/ObjectsList/ObjectsList';
import { AtyrauMap } from './components/Map/AtyrauMap';
import { QuickInspectionCard } from './components/Dashboard/QuickInspectionCard';
import { ObjectDetailModal } from './components/Modal/ObjectDetailModal';
import { FieldModeHUD } from './components/FieldMode/FieldModeHUD';
import { ExportImportModal } from './components/Modal/ExportImportModal';
import { AdminPanel } from './components/Admin/AdminPanel';
import { 
  Map as MapIcon, 
  List, 
  Smartphone, 
  Loader2, 
  AlertCircle,
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock
} from 'lucide-react';

export default function App() {
  const [objects, setObjects] = useState<PropertyObject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedObject, setSelectedObject] = useState<PropertyObject | null>(null);
  const [inspectingObject, setInspectingObject] = useState<PropertyObject | null>(null);
  const [isFieldModeOpen, setIsFieldModeOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [mobileView, setMobileView] = useState<'split' | 'list' | 'map'>('split');
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterOptions>({
    status: 'ALL',
    searchQuery: '',
    sortBy: 'id',
    onlyNearby: false,
    maxDistanceKm: 3
  });

  // Load objects from storage engine on mount
  const loadData = useCallback(async () => {
    try {
      const loaded = await StorageService.loadAllObjects();
      setObjects(loaded);
      if (loaded.length > 0 && !selectedObject) {
        setSelectedObject(loaded[0]);
      }
      setLastSaveTime(StorageService.getLastSaveTime());
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [selectedObject]);

  useEffect(() => {
    loadData();

    // Subscribe to auto-save updates
    const unsubscribe = StorageService.subscribeLastSave((time) => {
      setLastSaveTime(time);
    });

    // Network status listener
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  // Request & Watch User GPS Geolocation
  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Геолокация не поддерживается вашим браузером');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed
        });
        setLocationError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Доступ к геолокации запрещен в настройках браузера');
        } else {
          setLocationError('Не удалось определить координаты GPS');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
  }, []);

  useEffect(() => {
    requestGeolocation();

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [requestGeolocation]);

  // Calculate Dashboard Statistics
  const stats: DashboardStats = useMemo(() => {
    const active = objects.filter((o) => !o.isArchived);
    const total = active.length;
    const found = active.filter((o) => o.status === 'FOUND').length;
    const discrepancy = active.filter((o) => o.status === 'DISCREPANCY').length;
    const notFound = active.filter((o) => o.status === 'NOT_FOUND').length;
    const needsClarification = active.filter((o) => o.status === 'NEEDS_CLARIFICATION').length;
    const unchecked = active.filter((o) => o.status === 'UNCHECKED').length;
    const verified = total - unchecked;
    const percentComplete = total > 0 ? Math.round((verified / total) * 100) : 0;

    const totalEstimatedValue = active.reduce((acc, curr) => acc + (curr.estimatedValue || 0), 0);
    const verifiedValue = active
      .filter((o) => o.status !== 'UNCHECKED')
      .reduce((acc, curr) => acc + (curr.estimatedValue || 0), 0);

    return {
      total,
      verified,
      found,
      discrepancy,
      notFound,
      needsClarification,
      remaining: unchecked,
      percentComplete,
      totalEstimatedValue,
      verifiedValue
    };
  }, [objects]);

  // Trigger celebration confetti when 100% completed
  useEffect(() => {
    if (stats.total > 0 && stats.verified === stats.total && stats.total >= 100) {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 }
      });
    }
  }, [stats.verified, stats.total]);

  // Handle Object Update
  const handleUpdateObject = async (
    id: number,
    updates: Partial<PropertyObject>,
    action = 'Обновление данных',
    details = 'Изменение параметров объекта'
  ) => {
    const existing = objects.find((o) => o.id === id);
    if (!existing) return;

    const newHistoryEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      user: 'Инспектор'
    };
    const updatedHistory = [newHistoryEvent, ...(existing.history || [])];
    const mergedUpdates = { ...updates, history: updatedHistory };

    setObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...mergedUpdates } : o))
    );

    if (selectedObject?.id === id) {
      setSelectedObject((prev) => (prev ? { ...prev, ...mergedUpdates } : null));
    }
    if (inspectingObject?.id === id) {
      setInspectingObject((prev) => (prev ? { ...prev, ...mergedUpdates } : null));
    }

    await StorageService.saveObjectUpdate(id, mergedUpdates);
  };

  const handleSelectObject = (obj: PropertyObject) => {
    setSelectedObject(obj);
    if (window.innerWidth < 768 && mobileView === 'list') {
      setMobileView('map');
    }
  };

  const handleOpenInspection = (obj: PropertyObject) => {
    setSelectedObject(obj);
    setInspectingObject(obj);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-3" />
        <h2 className="text-base font-bold">Загрузка реестра 130 объектов Атырау...</h2>
        <p className="text-xs text-slate-400 mt-1">Инициализация базы данных и карт</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f0f2f5] font-sans text-slate-900">
      {/* Top Bento Header & Statistics */}
      <HeaderStats
        stats={stats}
        lastSaveTime={lastSaveTime}
        isOnline={isOnline}
        onOpenFieldMode={() => setIsFieldModeOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* GPS Warning Banner if any */}
      {locationError && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-1 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{locationError}</span>
          </div>
          <button
            onClick={requestGeolocation}
            className="text-amber-800 font-bold underline hover:text-amber-950 cursor-pointer"
          >
            Повторить запрос GPS
          </button>
        </div>
      )}

      {/* Main Bento Grid Workspace */}
      <main className="flex-1 grid grid-cols-12 gap-3 sm:gap-4 p-3 sm:p-4 overflow-hidden">
        {/* Bento Column 1: Objects Registry */}
        <div
          className={`col-span-12 md:col-span-5 lg:col-span-4 xl:col-span-3 h-full overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-xs ${
            mobileView === 'map' ? 'hidden md:block' : 'block'
          }`}
        >
          <ObjectsList
            objects={objects}
            selectedObject={selectedObject}
            userLocation={userLocation}
            filters={filters}
            onFilterChange={(newFilters) => setFilters((prev) => ({ ...prev, ...newFilters }))}
            onSelectObject={handleSelectObject}
            onOpenInspection={handleOpenInspection}
          />
        </div>

        {/* Bento Column 2: Interactive GIS Map */}
        <div
          className={`col-span-12 md:col-span-7 lg:col-span-5 xl:col-span-6 h-full overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-xs relative ${
            mobileView === 'list' ? 'hidden md:block' : 'block'
          }`}
        >
          <AtyrauMap
            objects={objects}
            selectedObject={selectedObject}
            userLocation={userLocation}
            onSelectObject={handleSelectObject}
            onOpenInspection={handleOpenInspection}
            onRequestUserLocation={requestGeolocation}
          />
        </div>

        {/* Bento Column 3: Quick Inspector Card (Desktop / Widescreen) */}
        <div className="hidden lg:block lg:col-span-3 xl:col-span-3 h-full overflow-hidden">
          <QuickInspectionCard
            object={selectedObject}
            userLocation={userLocation}
            onUpdateObject={handleUpdateObject}
            onOpenFullModal={handleOpenInspection}
            onRequestUserLocation={requestGeolocation}
          />
        </div>
      </main>

      {/* Bottom Bento Status Footer */}
      <footer className="bg-white border-t border-slate-200 px-4 sm:px-6 py-2 flex items-center justify-between shrink-0 text-xs text-slate-500 z-30 shadow-xs">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="font-bold text-[11px] text-slate-700 uppercase tracking-tight">
              Синхронизация: {isOnline ? 'Онлайн' : 'Офлайн (Локально)'}
            </span>
          </div>

          {lastSaveTime && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <CheckCircle2 className="w-3 h-3 text-blue-500" />
              Последнее сохранение: {lastSaveTime}
            </span>
          )}
        </div>

        <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          Атырау ГИС Мониторинг v1.4.2
        </div>
      </footer>

      {/* Mobile Floating Bottom Bar for Field Navigation */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-12 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-2 py-1.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-1">
        <button
          onClick={() => setMobileView('list')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
            mobileView === 'list' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          <List className="w-4 h-4" />
          <span>Список ({objects.length})</span>
        </button>

        <button
          onClick={() => setMobileView('map')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
            mobileView === 'map' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>Карта</span>
        </button>

        <button
          onClick={() => setIsFieldModeOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs"
        >
          <Smartphone className="w-4 h-4" />
          <span>В машине</span>
        </button>
      </nav>

      {/* Inspection Modal */}
      {inspectingObject && (
        <ObjectDetailModal
          object={inspectingObject}
          userLocation={userLocation}
          onClose={() => setInspectingObject(null)}
          onUpdateObject={handleUpdateObject}
          onRequestUserLocation={requestGeolocation}
        />
      )}

      {/* Dedicated Car / Field HUD Mode */}
      {isFieldModeOpen && (
        <FieldModeHUD
          objects={objects}
          userLocation={userLocation}
          initialSelectedId={selectedObject?.id}
          onClose={() => setIsFieldModeOpen(false)}
          onUpdateObject={handleUpdateObject}
          onRequestUserLocation={requestGeolocation}
        />
      )}

      {/* Export / Import / Backup Modal */}
      {isExportModalOpen && (
        <ExportImportModal
          objects={objects}
          onClose={() => setIsExportModalOpen(false)}
          onDataReload={loadData}
        />
      )}

      {/* Admin Panel */}
      {isAdminOpen && (
        <AdminPanel
          objects={objects}
          onClose={() => setIsAdminOpen(false)}
          onDataReload={loadData}
        />
      )}
    </div>
  );
}
