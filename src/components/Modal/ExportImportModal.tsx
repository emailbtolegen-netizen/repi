import React, { useState } from 'react';
import { PropertyObject } from '../../types';
import { exportToExcel, exportToCSV, parseImportFile } from '../../utils/exportUtils';
import { StorageService } from '../../services/storageService';
import { 
  X, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  Database, 
  AlertOctagon, 
  Check, 
  RotateCcw
} from 'lucide-react';

interface ExportImportModalProps {
  objects: PropertyObject[];
  onClose: () => void;
  onDataReload: () => Promise<void>;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  objects,
  onClose,
  onDataReload
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'backup'>('export');
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const showMsg = (text: string, isError = false) => {
    setStatusMsg({ text, isError });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleExportExcel = () => {
    try {
      exportToExcel(objects);
      showMsg('Файл Excel (.xlsx) успешно сформирован и скачан!');
    } catch {
      showMsg('Ошибка при экспорте в Excel', true);
    }
  };

  const handleExportCSV = () => {
    try {
      exportToCSV(objects);
      showMsg('Файл CSV успешно сформирован и скачан!');
    } catch {
      showMsg('Ошибка при экспорте в CSV', true);
    }
  };

  const handleExportBackupJSON = async () => {
    try {
      const json = await StorageService.exportBackupData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_atyrau_gis_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMsg('Резервная копия JSON сохранена!');
    } catch {
      showMsg('Ошибка создания резервной копии', true);
    }
  };

  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const imported = await parseImportFile(file);
      if (imported.length === 0) {
        showMsg('Файл не содержит распознаваемых строк с адресами', true);
        setIsProcessing(false);
        return;
      }

      // Merge into storage without erasing existing verification data
      const updates = imported.map((row) => ({
        id: row.id || Math.floor(Math.random() * 10000),
        originalAddress: row.address,
        estimatedValue: row.estimatedValue,
        ...(row.lat && row.lng ? { originalLatitude: row.lat, originalLongitude: row.lng } : {})
      }));

      await StorageService.saveMultipleUpdates(updates);
      await onDataReload();
      showMsg(`Успешно импортировано ${imported.length} записей без потери существующих проверок!`);
    } catch {
      showMsg('Ошибка при чтении Excel файла', true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const count = await StorageService.restoreBackupData(text);
        await onDataReload();
        showMsg(`Успешно восстановлено ${count} объектов из резервной копии!`);
      } catch {
        showMsg('Ошибка при восстановлении из JSON', true);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = async () => {
    const confirmed = window.confirm(
      'ВНИМАНИЕ! Это действие сбросит только ваши отметки проверок, фото и комментарии к исходному состоянию 130 объектов. Сами 130 объектов НЕ удалятся. Продолжить?'
    );
    if (!confirmed) return;

    setIsProcessing(true);
    await StorageService.resetUserDataOnly();
    await onDataReload();
    setIsProcessing(false);
    showMsg('Пользовательские данные сброшены к исходному состоянию');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Экспорт, импорт и резервные копии</h2>
              <p className="text-xs text-slate-300">Сохранение и выгрузка отчетов о проверке 130 объектов</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 text-xs sm:text-sm font-semibold">
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Выгрузка отчетов (Экспорт)
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Импорт данных
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === 'backup'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Резервная копия
          </button>
        </div>

        {/* Message Banner */}
        {statusMsg && (
          <div
            className={`p-3 text-xs font-semibold flex items-center gap-2 ${
              statusMsg.isError
                ? 'bg-rose-50 border-b border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-b border-emerald-200 text-emerald-800'
            }`}
          >
            {statusMsg.isError ? <AlertOctagon className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'export' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Выгрузите актуальный реестр со всеми результатами проверок, зафиксированными координатами, рассчитанными расхождениями и комментариями.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  id="btn-export-xlsx"
                  onClick={handleExportExcel}
                  className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-2 transition shadow-xs active:scale-98"
                >
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                  <span>Скачать Excel (.xlsx)</span>
                  <span className="text-[11px] font-normal text-emerald-700">С цветными статусами и формулами</span>
                </button>

                <button
                  id="btn-export-csv"
                  onClick={handleExportCSV}
                  className="p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-2 transition shadow-xs active:scale-98"
                >
                  <FileText className="w-8 h-8 text-blue-600" />
                  <span>Скачать CSV (.csv)</span>
                  <span className="text-[11px] font-normal text-blue-700">UTF-8 кодировка для 1C и аналитики</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <strong>Правило безопасности данных:</strong> При импорте новых или обновленных таблиц ваши сохраненные проверки, статусы, фото и комментарии <u>НЕ перезаписываются</u>.
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 hover:bg-slate-100 transition">
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <h4 className="font-bold text-sm text-slate-800 mb-1">Загрузить таблицу Excel (.xlsx) или CSV</h4>
                <p className="text-xs text-slate-500 mb-4">
                  Файл должен содержать столбцы: №, Адрес, Оценочная стоимость
                </p>

                <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Выбрать файл Excel / CSV</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportExcelFile}
                    className="hidden"
                    disabled={isProcessing}
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-blue-600" />
                  Полный дамп состояния (JSON)
                </h4>
                <p className="text-xs text-slate-500">
                  Сохраняет все 130 объектов, фото, GPS координаты, статусы и журнал аудита в один файл для переноса на другой телефон или компьютер.
                </p>

                <div className="flex gap-2 flex-wrap pt-2">
                  <button
                    onClick={handleExportBackupJSON}
                    className="py-2 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать резервную копию</span>
                  </button>

                  <label className="cursor-pointer py-2 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Восстановить из файла</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreJSON}
                      className="hidden"
                      disabled={isProcessing}
                    />
                  </label>
                </div>
              </div>

              {/* Danger Zone: Reset user marks */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
                <h4 className="font-bold text-xs text-rose-800 flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                  Сброс пользовательских отметок
                </h4>
                <p className="text-xs text-rose-700">
                  Очищает только сохраненные отметки инспекции, возвращая все 130 объектов в исходный статус «Не проверен».
                </p>
                <button
                  onClick={handleResetData}
                  disabled={isProcessing}
                  className="py-2 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Сбросить только отметки</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
