export interface FormattedDistance {
  meters: number;
  text: string;
}

/**
 * Calculates distance in meters between two geographical points using the Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Formats distance in meters into friendly text ("750 м" or "2,4 км")
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || isNaN(meters)) {
    return '—';
  }
  if (meters < 1000) {
    return `${meters} м`;
  }
  const km = (meters / 1000).toFixed(1).replace('.', ',');
  return `${km} км`;
}

/**
 * Formats currency in Kazakhstan Tenge (₸) with thousands separator
 */
export function formatKZT(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0 ₸';
  }
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0
  })
    .format(amount)
    .replace('KZT', '₸');
}

/**
 * Formats ISO timestamp to "28.08.2026 14:35"
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Не проверено';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

/**
 * Returns navigation links for mobile and desktop navigation apps
 */
export function getNavigationLinks(lat: number, lng: number, address?: string) {
  const encAddress = encodeURIComponent(address || `Объект (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
  return {
    twoGis: `https://2gis.kz/atyrau/geo/${lng},${lat}`,
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    yandexMaps: `https://yandex.kz/maps/?rtext=~${lat},${lng}&rtt=auto`,
    appleMaps: `https://maps.apple.com/?daddr=${lat},${lng}&q=${encAddress}`
  };
}

/**
 * Checks if coordinates are within reasonable Atyrau bounding box
 */
export function isWithinAtyrau(lat: number, lng: number): boolean {
  return lat >= 46.90 && lat <= 47.30 && lng >= 51.70 && lng <= 52.20;
}
