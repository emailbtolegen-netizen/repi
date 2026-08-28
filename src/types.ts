export type PropertyStatus =
  | 'UNCHECKED'          // 🔵 Не проверен
  | 'FOUND'              // 🟢 Объект найден
  | 'DISCREPANCY'        // 🟡 Найден, но есть несоответствие
  | 'NOT_FOUND'          // 🔴 Объект не найден
  | 'NEEDS_CLARIFICATION'; // ⚫ Адрес требует уточнения

export type CoordinateAccuracyStatus =
  | 'ACCURATE'           // Точные координаты здания
  | 'STREET_ACCURATE'    // Координаты по улице / району
  | 'NEEDS_VERIFICATION' // Требует уточнения координат
  | 'USER_ADJUSTED';     // Уточнены инспектором вручную или по GPS

export type PropertyCategory = 'house' | 'apartment' | 'garage_parking' | 'commercial' | 'plot' | 'residential';

export interface HistoryEvent {
  id: string;
  timestamp: string; // ISO 8601 string
  action: string;
  details: string;
  user?: string;
}

export interface PropertyObject {
  // INITIAL DATA (Базовые данные из реестра)
  id: number;
  originalAddress: string;
  normalizedAddress: string;
  estimatedValue: number; // in KZT (₸)
  originalLatitude: number;
  originalLongitude: number;
  initialCoordinateStatus?: CoordinateAccuracyStatus;
  category?: PropertyCategory;

  // USER / FIELD VERIFICATION DATA (Данные инспектора)
  currentLatitude: number;
  currentLongitude: number;
  status: PropertyStatus;
  coordinateStatus?: CoordinateAccuracyStatus;
  
  actualAddress?: string;
  actualLatitude?: number | null;
  actualLongitude?: number | null;
  gpsAccuracy?: number | null; // GPS precision in meters
  
  verificationComment?: string;
  photos: string[]; // Base64 data URLs or stored photo IDs
  verifiedAt?: string | null; // ISO timestamp
  verifier?: string;
  
  history: HistoryEvent[];
  isArchived?: boolean;
  notes?: string;
  updatedAt?: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp?: number;
  heading?: number | null;
  speed?: number | null;
}

export interface FilterOptions {
  status: PropertyStatus | 'ALL';
  searchQuery: string;
  onlyNearby: boolean;
  maxDistanceKm: number;
  sortBy: 'id' | 'distance' | 'price_desc' | 'price_asc' | 'status' | 'address';
  categoryFilter?: string;
}

export interface DashboardStats {
  total: number;
  verified: number;
  found: number;
  discrepancy: number;
  notFound: number;
  needsClarification: number;
  remaining: number;
  totalEstimatedValue: number;
  verifiedValue: number;
  percentComplete: number;
}
