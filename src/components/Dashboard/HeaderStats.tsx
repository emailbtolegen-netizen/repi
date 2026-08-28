import React from 'react';
import { DashboardStats } from '../../types';
import { formatKZT } from '../../utils/geoUtils';
import { 
  Building2, 
  CheckCircle2, 
  Smartphone, 
  Download, 
  ShieldCheck,
  MapPin
} from 'lucide-react';

interface HeaderStatsProps {
  stats: DashboardStats;
  lastSaveTime: string | null;
  isOnline: boolean;
  onOpenFieldMode: () => void;
  onOpenExportModal: () => void;
  onOpenAdmin: () => void;
}

export const HeaderStats: React.FC<HeaderStatsProps> = ({
  stats,
  lastSaveTime,
  isOnline,
  onOpenFieldMode,
  onOpenExportModal,
  onOpenAdmin
}) => {
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-2.5 sm:px-6 shadow-xs shrink-0 z-30">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-xs text-white flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight uppercase text-slate-900 leading-tight">
                Инспекция Атырау
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                130 объектов
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Система полевой проверки недвижимости GIS
            </p>
          </div>
        </div>

        {/* Bento Stat Counters */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          <div className="bg-slate-50 px-3 sm:px-4 py-1.5 rounded-xl border border-slate-200 flex flex-col items-center min-w-[70px] sm:min-w-[80px] shrink-0">
            <span className="text-[10px] uppercase text-slate-400 font-extrabold tracking-wider">Всего</span>
            <span className="text-base sm:text-lg font-black text-slate-800 leading-tight">{stats.total}</span>
          </div>

          <div className="bg-emerald-50 px-3 sm:px-4 py-1.5 rounded-xl border border-emerald-200 flex flex-col items-center min-w-[70px] sm:min-w-[80px] shrink-0">
            <span className="text-[10px] uppercase text-emerald-600 font-extrabold tracking-wider">Найдено</span>
            <span className="text-base sm:text-lg font-black text-emerald-700 leading-tight">{stats.found}</span>
          </div>

          <div className="bg-amber-50 px-3 sm:px-4 py-1.5 rounded-xl border border-amber-200 flex flex-col items-center min-w-[70px] sm:min-w-[80px] shrink-0">
            <span className="text-[10px] uppercase text-amber-600 font-extrabold tracking-wider">Несоотв.</span>
            <span className="text-base sm:text-lg font-black text-amber-700 leading-tight">{stats.discrepancy}</span>
          </div>

          <div className="bg-rose-50 px-3 sm:px-4 py-1.5 rounded-xl border border-rose-200 flex flex-col items-center min-w-[70px] sm:min-w-[80px] shrink-0">
            <span className="text-[10px] uppercase text-rose-600 font-extrabold tracking-wider">Не найден</span>
            <span className="text-base sm:text-lg font-black text-rose-700 leading-tight">{stats.notFound}</span>
          </div>

          <div className="bg-blue-50 px-3 sm:px-4 py-1.5 rounded-xl border border-blue-200 flex flex-col items-center min-w-[70px] sm:min-w-[80px] shrink-0">
            <span className="text-[10px] uppercase text-blue-600 font-extrabold tracking-wider">Осталось</span>
            <span className="text-base sm:text-lg font-black text-blue-700 leading-tight">{stats.remaining}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-open-field-mode"
            onClick={onOpenFieldMode}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-200 transition active:scale-95 cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>В машине</span>
          </button>

          <button
            id="btn-open-export-modal"
            onClick={onOpenExportModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Экспорт</span>
          </button>

          <button
            id="btn-open-admin-panel"
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Реестр</span>
          </button>
        </div>
      </div>
    </header>
  );
};
