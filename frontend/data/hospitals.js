export const hospitals = [
  /* ───────────── Burn Resource Centers (capability ≈ 0.5‑0.75) ───────────── */
  {
    name: "Antelope Valley Hospital",
    lat: 34.6881827, lon: -118.159146,
    type: "Burn Resource Center",
    bedsAvailable: 4,
    capability: 0.65,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "LAC Harbor‑UCLA Medical Center",
    lat: 33.8296271, lon: -118.2944347,
    type: "Burn Resource Center",
    bedsAvailable: 0,          // pushes severe cases elsewhere
    capability: 0.70,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Cedars‑Sinai Medical Center",
    lat: 34.0749112, lon: -118.381072,
    type: "Burn Resource Center",
    bedsAvailable: 5,
    capability: 0.75,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "Los Angeles General MC",
    lat: 34.0579, lon: -118.2089,
    type: "Burn Resource Center",
    bedsAvailable: 2,
    capability: 0.70,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Children's Hospital LA",
    lat: 34.0975, lon: -118.29056,
    type: "Burn Resource Center",
    bedsAvailable: 3,
    capability: 0.68,
    hasPedsUnit: true,         // key for paediatric burns
    hasTeleBurn: true
  },
  {
    name: "MemorialCare Long Beach MC",
    lat: 33.8081383, lon: -118.1867731,
    type: "Burn Resource Center",
    bedsAvailable: 1,
    capability: 0.60,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "California Hospital MC",
    lat: 34.037396, lon: -118.265781,
    type: "Burn Resource Center",
    bedsAvailable: 0,
    capability: 0.55,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Pomona Valley Hospital MC",
    lat: 34.077037, lon: -117.750447,
    type: "Burn Resource Center",
    bedsAvailable: 4,
    capability: 0.63,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Northridge Hospital MC",
    lat: 34.219983, lon: -118.532949,
    type: "Burn Resource Center",
    bedsAvailable: 3,
    capability: 0.60,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "Providence Holy Cross MC",
    lat: 34.2798363, lon: -118.4599993,
    type: "Burn Resource Center",
    bedsAvailable: 2,
    capability: 0.58,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "St. Mary MC (Long Beach)",
    lat: 33.7799933, lon: -118.1861378,
    type: "Burn Resource Center",
    bedsAvailable: 0,
    capability: 0.57,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Ronald Reagan UCLA MC",
    lat: 34.0664495, lon: -118.4463683,
    type: "Burn Resource Center",
    bedsAvailable: 1,
    capability: 0.72,
    hasPedsUnit: true,
    hasTeleBurn: true
  },
  {
    name: "Henry Mayo Newhall Hospital",
    lat: 34.39778, lon: -118.55333,
    type: "Burn Resource Center",
    bedsAvailable: 2,
    capability: 0.50,
    hasPedsUnit: false,
    hasTeleBurn: false
  },
  {
    name: "Huntington Hospital",
    lat: 34.13455, lon: -118.15295,
    type: "Burn Resource Center",
    bedsAvailable: 3,
    capability: 0.62,
    hasPedsUnit: false,
    hasTeleBurn: true
  },

  /* ─────────────────── Certified Burn Centers (capability ≥ 0.9) ─────────────────── */
  {
    name: "LA General Burn Unit",
    lat: 34.0577836, lon: -118.2080392,
    type: "Burn Center",
    bedsAvailable: 2,
    capability: 1.00,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "Grossman Burn Center (West Hills)",
    lat: 34.2026898, lon: -118.6289065,
    type: "Burn Center",
    bedsAvailable: 1,
    capability: 0.95,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "Torrance Memorial Burn Center",
    lat: 33.8118863, lon: -118.3435984,
    type: "Burn Center",
    bedsAvailable: 0,
    capability: 0.92,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "UC Irvine Burn Center",
    lat: 33.7880317, lon: -117.8903927,
    type: "Burn Center",
    bedsAvailable: 2,
    capability: 0.97,
    hasPedsUnit: true,
    hasTeleBurn: true
  },
  {
    name: "Orange County Global MC",
    lat: 33.7543963, lon: -117.833338,
    type: "Burn Center",
    bedsAvailable: 3,
    capability: 0.94,
    hasPedsUnit: false,
    hasTeleBurn: true
  },
  {
    name: "Arrowhead Regional Medical Center",
    lat: 34.0741, lon: -117.3512,
    type: "Burn Center",
    bedsAvailable: 1,
    capability: 0.90,
    hasPedsUnit: false,
    hasTeleBurn: false
  }
];
