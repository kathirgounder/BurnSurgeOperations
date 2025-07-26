export const hospitals = [
  /* ───────────── Burn Resource Centers (capability ≈ 1.0-5.0) ───────────── */
  {
    name: "Antelope Valley Hospital",
    lat: 34.6881827, lon: -118.159146,
    type: "Burn Resource Center",
    bedsAvailable: 420,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "LAC Harbor‑UCLA Medical Center",
    lat: 33.8296271, lon: -118.2944347,
    type: "Burn Resource Center",
    bedsAvailable: 453,          // pushes severe cases elsewhere
    capability: 2,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Cedars‑Sinai Medical Center",
    lat: 34.0749112, lon: -118.381072,
    type: "Burn Resource Center",
    bedsAvailable: 886,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "Los Angeles General MC",
    lat: 34.0579, lon: -118.2089,
    type: "Burn Resource Center",
    bedsAvailable: 600,
    capability: 2,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Children's Hospital LA",
    lat: 34.0975, lon: -118.29056,
    type: "Burn Resource Center",
    bedsAvailable: 386,
    capability: 1,
    hasPedsUnit: true,         // key for paediatric burns
    hasTeleBurn: true
  },
  {
    name: "MemorialCare Long Beach MC",
    lat: 33.8081383, lon: -118.1867731,
    type: "Burn Resource Center",
    bedsAvailable: 481,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "California Hospital MC",
    lat: 34.037396, lon: -118.265781,
    type: "Burn Resource Center",
    bedsAvailable: 318,
    capability: 2,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Pomona Valley Hospital MC",
    lat: 34.077037, lon: -117.750447,
    type: "Burn Resource Center",
    bedsAvailable: 427,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Northridge Hospital MC",
    lat: 34.219983, lon: -118.532949,
    type: "Burn Resource Center",
    bedsAvailable: 394,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "Providence Holy Cross MC",
    lat: 34.2798363, lon: -118.4599993,
    type: "Burn Resource Center",
    bedsAvailable: 377,
    capability: 4,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "St. Mary MC (Long Beach)",
    lat: 33.7799933, lon: -118.1861378,
    type: "Burn Resource Center",
    bedsAvailable: 389,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Ronald Reagan UCLA MC",
    lat: 34.0664495, lon: -118.4463683,
    type: "Burn Resource Center",
    bedsAvailable: 520,
    capability: 2,
    hasPedsUnit: true,
    hasTeleBurn: true
  },
  {
    name: "Henry Mayo Newhall Hospital",
    lat: 34.39778, lon: -118.55333,
    type: "Burn Resource Center",
    bedsAvailable: 357,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Huntington Hospital",
    lat: 34.13455, lon: -118.15295,
    type: "Burn Resource Center",
    bedsAvailable: 619,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: true
  },

  /* ─────────────────── Certified Burn Centers (capability ≥ 0.9) ─────────────────── */
  {
    name: "St. Francis Medical Center",
    lat: 33.930826, lon: -118.203228,
    type: "Burn Center",
    bedsAvailable: 16,
    capability: 5,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "LA General Burn Unit",
    lat: 34.0577836, lon: -118.2080392,
    type: "Burn Center",
    bedsAvailable: 20,
    capability: 5,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "Grossman Burn Center (West Hills)",
    lat: 34.2026898, lon: -118.6289065,
    type: "Burn Center",
    bedsAvailable: 31,
    capability: 5,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "Torrance Memorial Burn Center",
    lat: 33.8118863, lon: -118.3435984,
    type: "Burn Center",
    bedsAvailable: 12,
    capability: 5,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "UC Irvine Burn Center",
    lat: 33.7880317, lon: -117.8903927,
    type: "Burn Center",
    bedsAvailable: 8,
    capability: 5,
    hasPedsUnit: true,
    hasTeleBurn: true
  },
  {
    name: "Orange County Global MC",
    lat: 33.7543963, lon: -117.833338,
    type: "Burn Center",
    bedsAvailable: 7,
    capability: 5,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "Arrowhead Regional Medical Center",
    lat: 34.0741, lon: -117.3512,
    type: "Burn Center",
    bedsAvailable: 14,
    capability: 5,
    hasPedsUnit: false,
    hasTeleBurn: false
  }
];
