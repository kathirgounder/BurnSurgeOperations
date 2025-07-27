export const WEIGHTS = {
  /* patient factors (bigger → more important) */
  tbsaPct         : 4,        // %TBSA   × 4
  inhalation      : 25,       // add 25 pts if airway risk
  pediatricAdj    : 20,       // red‑peds extra bump

  /* destination factors */
  travelMin       : 3,        // minutes of drive time
  bedsPenalty     : 40,       // (1 – bedsAvail) × 40
  capabilityBoost : -30,      // subtract if capability ≥ 4
  burnCenterBoost : -50,      // subtract if dest.type === "Burn Center"
  pedsRequiredPen : 9999,     // disqualify if peds burn but no peds unit

  yellowPenalty   :  60,
};