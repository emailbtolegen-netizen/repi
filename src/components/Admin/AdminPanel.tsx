import React, { useState } from 'react';
import { PropertyObject, PropertyCategory } from '../../types';
import { formatKZT, formatDateTime } from '../../utils/geoUtils';
import { StorageService } from '../../services/storageService';
import { 
  X, 
  Plus, 
  Save, 
  Trash2, 
  Search, 
  ShieldCheck, 
  Database, 
  Check, 
  AlertCircle
} from 'lucide-react';

interface AdminPanelProps {
  objects: PropertyObject[];
  onClose: () => void;
  onDataReload: () => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  objects,
  onClose,
  onDataReload
}) => {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // New object form state
  const [newAddress, setNewAddress] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newLat, setNewLat] = useState('47.116000');
  const [newLng, setNewLng] = useState('51.916000');
  const [newCategory, setNewCategory] = useState<PropertyCategory>('residential');

  const filteredObjects = objects.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(o.id).includes(q) ||
      o.originalAddress.toLowerCase().includes(q) ||
      (o.normalizedAddress || '').toLowerCase().includes(q) ||
      (o.verificationComment || '').toLowerCase().includes(q)
    );
  });

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAddObject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.trim()) {
      alert('Пожалуйста, введите адрес объекта');
      return;
    }

    const nextId = Math.max(...objects.map((o) => o.id), 130) + 1;
    const newObj: PropertyObject = {
      id: nextId,
      originalAddress: newAddress.trim(),
      normalizedAddress: newAddress.trim(),
      estimatedValue: parseFloat(newValue) || 0,
      originalLatitude: parseFloat(newLat) || 47.116,
      originalLongitude: parseFloat(newLng) || 51.916,
      currentLatitude: parseFloat(newLat) || 47.116,
      currentLongitude: parseFloat(newLng) || 51.916,
      status: 'UNCHECKED',
      category: newCategory,
      photos: [],
      history: [
        {
          id: `${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'Создание объекта',
          details: 'Объект добавлен администратором',
          user: 'Администратор'
        }
      ]
    };

    await StorageService.saveCustomObject(newObj);
    await onDataReload();
    setShowAddForm(false);
    setNewAddress('');
    setNewValue('');
    showNotification(`Объект №${nextId} успешно добавлен в реестр!`);
  };

  const handleArchive = async (id: number) => {
    if (!window.confirm(`Архивировать объект №${id}?`)) return;
    await StorageService.saveObjectUpdate(id, { isArchived: true });
    await onDataReload();
    showNotification(`Объект №${id} скрыт (архивирован)`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">Панель администратора реестра</h2>
              <p className="text-xs text-slate-300">
                Управление объектами, базой данных и журналом проверок г. Атырау
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success notification */}
        {successMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs px-4 py-2 flex items-center gap-1.5 font-semibold">
            <Check className="w-4 h-4 text-emerald-600" />
            {successMsg}
          </div>
        )}

        {/* Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск объекта..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white text-xs sm:text-sm text-slate-900 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить объект в реестр</span>
            </button>
          </div>
        </div>

        {/* Add Object Form Dropdown */}
        {showAddForm && (
          <form
            onSubmit={handleAddObject}
            className="p-4 bg-blue-50/70 border-b border-blue-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
          >
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Адрес объекта:</label>
              <input
                type="text"
                required
                placeholder="г. Атырау, ул. ..."
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Оценочная стоимость (₸):</label>
              <input
                type="number"
                placeholder="25000000"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Категория:</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg"
              >
                <option value="residential">Жилой дом</option>
                <option value="apartment">Квартира</option>
                <option value="commercial">Коммерция</option>
                <option value="garage_parking">Гараж / Паркинг</option>
                <option value="plot">Земельный участок</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Широта (Lat):</label>
              <input
                type="number"
                step="0.000001"
                value={newLat}
                onChange={(e) => setNewLat(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Долгота (Lng):</label>
              <input
                type="number"
                step="0.000001"
                value={newLng}
                onChange={(e) => setNewLng(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div className="sm:col-span-2 flex items-end justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Сохранить в базу</span>
              </button>
            </div>
          </form>
        )}

        {/* Objects Table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-bold">
                <th className="p-2.5 w-12 text-center">№</th>
                <th className="p-2.5">Адрес объекта</th>
                <th className="p-2.5">Стоимость (₸)</th>
                <th className="p-2.5">Статус</th>
                <th className="p-2.5">Координаты</th>
                <th className="p-2.5">Проверено</th>
                <th className="p-2.5 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredObjects.map((obj) => (
                <tr key={obj.id} className="hover:bg-slate-50 transition">
                  <td className="p-2.5 text-center font-bold text-slate-900 bg-slate-50/50">
                    {obj.id}
                  </td>
                  <td className="p-2.5 font-medium text-slate-800 max-w-[280px]">
                    <div className="font-bold">{obj.normalizedAddress || obj.originalAddress}</div>
                    {obj.verificationComment && (
                      <div className="text-[11px] text-slate-500 italic mt-0.5 truncate">
                        {obj.verificationComment}
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 font-semibold text-slate-900 whitespace-nowrap">
                    {formatKZT(obj.estimatedValue)}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                        obj.status === 'FOUND'
                          ? 'bg-emerald-100 text-emerald-800'
                          : obj.status === 'DISCREPANCY'
                          ? 'bg-amber-100 text-amber-800'
                          : obj.status === 'NOT_FOUND'
                          ? 'bg-rose-100 text-rose-800'
                          : obj.status === 'NEEDS_CLARIFICATION'
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {obj.status === 'FOUND'
                        ? '🟢 Найден'
                        : obj.status === 'DISCREPANCY'
                        ? '🟡 Несоответствие'
                        : obj.status === 'NOT_FOUND'
                        ? '🔴 Не найден'
                        : obj.status === 'NEEDS_CLARIFICATION'
                        ? '⚫ Уточнение'
                        : '🔵 Не проверен'}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    {(obj.currentLatitude || obj.originalLatitude).toFixed(5)}, {(obj.currentLongitude || obj.originalLongitude).toFixed(5)}
                  </td>
                  <td className="p-2.5 text-slate-500 whitespace-nowrap text-[11px]">
                    {formatDateTime(obj.verifiedAt)}
                  </td>
                  <td className="p-2.5 text-center whitespace-nowrap">
                    <button
                      onClick={() => handleArchive(obj.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Архивировать"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Database className="w-4 h-4 text-blue-600" />
            <span>База данных: {objects.length} записей в хранилище IndexedDB</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition"
          >
            Закрыть панель
          </button>
        </div>
      </div>
    </div>
  );
};
