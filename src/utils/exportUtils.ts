import * as XLSX from 'xlsx';
import { PropertyObject, PropertyStatus } from '../types';
import { calculateDistanceMeters, formatDateTime } from './geoUtils';

export function getStatusLabel(status: PropertyStatus): string {
  switch (status) {
    case 'FOUND':
      return '🟢 Объект найден';
    case 'DISCREPANCY':
      return '🟡 Есть несоответствие';
    case 'NOT_FOUND':
      return '🔴 Объект не найден';
    case 'NEEDS_CLARIFICATION':
      return '⚫ Требует уточнения';
    case 'UNCHECKED':
    default:
      return '🔵 Не проверен';
  }
}

/**
 * Prepares data rows for Excel/CSV export
 */
export function prepareExportRows(objects: PropertyObject[]) {
  return objects.map((obj) => {
    let diffMeters = '';
    if (obj.actualLatitude && obj.actualLongitude) {
      const dist = calculateDistanceMeters(
        obj.originalLatitude,
        obj.originalLongitude,
        obj.actualLatitude,
        obj.actualLongitude
      );
      diffMeters = `${dist} м`;
    }

    return {
      '№': obj.id,
      'Адрес исходный': obj.originalAddress,
      'Адрес нормализованный': obj.normalizedAddress || obj.originalAddress,
      'Оценочная стоимость (₸)': obj.estimatedValue,
      'Статус': getStatusLabel(obj.status),
      'Фактический адрес': obj.actualAddress || '',
      'Исходная широта': obj.originalLatitude,
      'Исходная долгота': obj.originalLongitude,
      'Фактическая широта': obj.actualLatitude ?? '',
      'Фактическая долгота': obj.actualLongitude ?? '',
      'Отклонение координат': diffMeters,
      'Точность GPS (м)': obj.gpsAccuracy ? `±${obj.gpsAccuracy}м` : '',
      'Комментарий инспектора': obj.verificationComment || '',
      'Дата и время проверки': obj.verifiedAt ? formatDateTime(obj.verifiedAt) : '',
      'Инспектор': obj.verifier || 'Инспектор полевой группы',
      'Кол-во фото': obj.photos?.length || 0
    };
  });
}

/**
 * Downloads an Excel (.xlsx) file with professional formatting
 */
export function exportToExcel(objects: PropertyObject[], filename = 'Реестр_проверки_объектов_Атырау.xlsx') {
  const rows = prepareExportRows(objects);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Column widths
  worksheet['!cols'] = [
    { wch: 6 },  // №
    { wch: 38 }, // Адрес исходный
    { wch: 38 }, // Адрес нормализованный
    { wch: 22 }, // Стоимость
    { wch: 24 }, // Статус
    { wch: 32 }, // Фактический адрес
    { wch: 16 }, // Исходная широта
    { wch: 16 }, // Исходная долгота
    { wch: 18 }, // Фактическая широта
    { wch: 18 }, // Фактическая долгота
    { wch: 20 }, // Отклонение
    { wch: 16 }, // Точность GPS
    { wch: 45 }, // Комментарий
    { wch: 20 }, // Дата проверки
    { wch: 24 }, // Инспектор
    { wch: 14 }  // Кол-во фото
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Проверка Атырау');
  XLSX.writeFile(workbook, filename);
}

/**
 * Downloads a CSV file with UTF-8 BOM
 */
export function exportToCSV(objects: PropertyObject[], filename = 'Реестр_проверки_объектов_Атырау.csv') {
  const rows = prepareExportRows(objects);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

  // Add UTF-8 BOM so Excel opens Cyrillic properly
  const blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parses uploaded Excel or CSV file
 */
export async function parseImportFile(file: File): Promise<Array<{ id?: number; address: string; estimatedValue: number; lat?: number; lng?: number }>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: Array<Record<string, any>> = XLSX.utils.sheet_to_json(worksheet);

        const parsedItems: Array<{ id?: number; address: string; estimatedValue: number; lat?: number; lng?: number }> = [];

        json.forEach((row, idx) => {
          // Normalize column headers
          const id = row['№'] || row['id'] || row['ID'] || row['No'] || idx + 1;
          const address = row['Адрес'] || row['address'] || row['Адрес исходный'] || row['Адрес объекта'] || '';
          const rawPrice = row['Стоимость'] || row['Оценочная стоимость'] || row['estimatedValue'] || row['Оценочная стоимость (₸)'] || 0;
          const price = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/[^\d.-]/g, '')) || 0 : Number(rawPrice);
          const lat = parseFloat(row['Широта'] || row['latitude'] || row['Исходная широта'] || 0);
          const lng = parseFloat(row['Долгота'] || row['longitude'] || row['Исходная долгота'] || 0);

          if (address) {
            parsedItems.push({
              id: Number(id),
              address: String(address).trim(),
              estimatedValue: price,
              lat: lat || undefined,
              lng: lng || undefined
            });
          }
        });

        resolve(parsedItems);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
