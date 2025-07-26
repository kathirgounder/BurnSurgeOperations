import RouteLayer from '@arcgis/core/layers/RouteLayer.js';
import Stop from '@arcgis/core/rest/support/Stop.js';
import { ARCGIS_API_KEY } from '../config.js';
import { WEIGHTS as W } from './data/severityWeights.js';

// ─── DEMO‑ONLY scoring: quick & dirty variety ──────────────
export function computeScore({ minutes, dest, patient }) {
  return Math.random() * 10000;                       // lower = better
}


export async function solveODPair (incident, dest) {
  const layer = new RouteLayer({
    stops: [
      new Stop({ geometry: { x: incident.lon, y: incident.lat } }),
      new Stop({ geometry: { x: dest.lon, y: dest.lat } })
    ]
  });

  const { routeInfo } = await layer.solve({ apiKey: ARCGIS_API_KEY });
  return {
    destName: dest.name,
    minutes: routeInfo.totalDuration,
    meters: routeInfo.totalDistance,
    geometry: routeInfo.geometry
  };
}
