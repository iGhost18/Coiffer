/**
 * Haversine distance between two lat/lng points, in kilometers.
 */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius, km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Builds a Google Maps "get directions" deep link.
 */
export function directionsUrl(origin, destLat, destLng) {
  const originPart = origin ? `&origin=${origin.lat},${origin.lng}` : "";
  return `https://www.google.com/maps/dir/?api=1${originPart}&destination=${destLat},${destLng}`;
}