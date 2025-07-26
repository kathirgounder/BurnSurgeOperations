export const WEIGHTS = {
  travelMin:   0.7,
  tbsaPct:     0.4,
  inhalation:  5,

  bedsPenalty:         12,   // no open beds
  noPedsPenalty:       8,    // paediatric need unmet
  noTelePenalty:       6,    // severe burn but no tele‑consult 
  capabilityBonusMult: -20   // multiplied by dest.capability (negative = bonus)
};