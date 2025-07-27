import RouteLayer from '@arcgis/core/layers/RouteLayer.js';
import Stop from '@arcgis/core/rest/support/Stop.js';
import { ARCGIS_API_KEY } from '../config.js';
import { WEIGHTS as W } from './data/severityWeights.js';

// ─── DEMO‑ONLY scoring: quick & dirty variety ──────────────
// routeService.js  ─────────────────────────────────────────────
    
export function computeScore({ minutes, dest, patient }) {
  /* ---------- HARD FILTERS ---------- */
  const isPedsRed = patient.ageGroup === "pediatric" && patient.priority === "red";
  if (isPedsRed && ((dest.type != 'Burn Center' && dest.capability < 4) || (!dest.hasPedsUnit))) {
    console.log(dest.name)
    console.log(dest.type)
    console.log(dest.hasPedsUnit)
    return Infinity;           // cannot take this patient
  }

  /* ---------- SOFT SCORING ---------- */
  /* ─── SOFT SCORING  (lower = better) ─────────────────── */
  const bedsShortfall = 1 - (dest.bedsAvailable ?? 0);   // 0 → 1

  let score =
        W.travelMin   * minutes +
        W.tbsaPct     * patient.tbsa +
        W.inhalation  * (patient.inhalation ? 1 : 0) +
        W.bedsPenalty * bedsShortfall;

  /* bonuses for strong facilities */
  score += (dest.capability >= 4 ? W.capabilityBoost : 0);
  score += (dest.type === "Burn Center" ? W.burnCenterBoost : 0);

  /* paediatric red bump (already filtered for peds unit) */
  if (isPedsRed) score += W.pediatricAdj;

  /* NEW: keep yellow/moderate burns out of Burn‑Centers */
  if (patient.priority === "yellow" && dest.type === "Burn Center")
    score *= W.yellowPenalty;

  /* tiny jitter so ties don’t all pick the same hospital */
  score += Math.random() * 0.5;

  return score;          // **lower score wins**
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
