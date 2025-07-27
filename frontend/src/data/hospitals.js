export const hospitals = [
  /* ───────────── Burn Resource Centers (capability ≈ 1.0-5.0) ───────────── */
  {
    name: "Antelope Valley Hospital",
    lat: 34.6881827,
    lon: -118.159146,
    type: "Burn Resource Center",
    bedsAvailable: 0.4699,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: true,
    county: "LA"
  },
  {
    name: "LAC Harbor‑UCLA Medical Center",
    lat: 33.8296271,
    lon: -118.2944347,
    type: "Burn Resource Center",
    bedsAvailable: 0.5074, 
    capability: 2,
    hasPedsUnit: false,
    hasTeleBurn: false,
    county: "LA"
  },
  {
    name: "Cedars‑Sinai Medical Center",
    lat: 34.0749112,
    lon: -118.381072,
    type: "Burn Resource Center",
    bedsAvailable: 1,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: true,
    county: "LA"
  },
  {
    name: "Los Angeles General MC",
    lat: 34.0579,
    lon: -118.2089,
    type: "Burn Resource Center",
    bedsAvailable: 0.6746,
    capability: 2,
    hasPedsUnit: false,
    hasTeleBurn: false,
    county: "LA"
  },
  {
    name: "Children's Hospital LA",
    lat: 34.0975,
    lon: -118.29056,
    type: "Burn Resource Center",
    bedsAvailable: 0.4312,
    capability: 1,
    hasPedsUnit: true, // key for paediatric burns
    hasTeleBurn: true,
    county: "LA"
  },
  {
    name: "MemorialCare Long Beach MC",
    lat: 33.8081383,
    lon: -118.1867731,
    type: "Burn Resource Center",
    bedsAvailable: 0.5392,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: true,
    county: "LA"
  },
  {
    name: "California Hospital MC",
    lat: 34.037396,
    lon: -118.265781,
    type: "Burn Resource Center",
    bedsAvailable: 0.3538,
    capability: 2,
    hasPedsUnit: false,
    hasTeleBurn: false,
    county: "LA"
  },
  {
    name: "Pomona Valley Hospital MC",
    lat: 34.077037,
    lon: -117.750447,
    type: "Burn Resource Center",
    bedsAvailable: 0.4778,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: false,
    county: "LA"
  },
  {
    name: "Northridge Hospital MC",
    lat: 34.219983,
    lon: -118.532949,
    type: "Burn Resource Center",
    bedsAvailable: 0.4403,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: true,
    county: "LA"
  },
  {
    name: "Providence Holy Cross MC",
    lat: 34.2798363,
    lon: -118.4599993,
    type: "Burn Resource Center",
    bedsAvailable: 0.4209,
    capability: 4,
    hasPedsUnit: false,
    hasTeleBurn: false,
    county: "LA"
  },
  {
    name: "St. Mary MC (Long Beach)",
    lat: 33.7799933,
    lon: -118.1861378,
    type: "Burn Resource Center",
    bedsAvailable: 0.4346,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: false,
    county: "LA"
  },
  {
    name: "Ronald Reagan UCLA MC",
    lat: 34.0664495,
    lon: -118.4463683,
    type: "Burn Resource Center",
    bedsAvailable: 0.5836,
    capability: 2,
    hasPedsUnit: true,
    hasTeleBurn: true,
    county: "LA"
  },
  {
    name: "Henry Mayo Newhall Hospital",
    lat: 34.39778,
    lon: -118.55333,
    type: "Burn Resource Center",
    bedsAvailable: 0.3982,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: false,
    county: "LA"
  },
  {
    name: "Huntington Hospital",
    lat: 34.13455,
    lon: -118.15295,
    type: "Burn Resource Center",
    bedsAvailable: 0.6962,
    capability: 1,
    hasPedsUnit: false,
    hasTeleBurn: true,
    county: "LA"
  },

  /* ─────────────────── Certified Burn Centers (capability ≥ 0.9) ─────────────────── */
  {
    name: "St. Francis Medical Center",
    lat: 33.930826,
    lon: -118.203228,
    type: "Burn Center",
    bedsAvailable: 0.0102,
    capability: 5,
    hasPedsUnit: false,
    hasTeleBurn: true,
    county: "LA"
  },
  {
    name: "LA General Burn Unit",
    lat: 34.0577836,
    lon: -118.2080392,
    type: "Burn Center",
    bedsAvailable: 0.0148,
    capability: 5,
    hasPedsUnit: false,
    hasTeleBurn: true,
    county: "LA"
  },
  {
    name: "Grossman Burn Center (West Hills)",
    lat: 34.2026898,
    lon: -118.6289065,
    type: "Burn Center",
    bedsAvailable: 0.0273,
    capability: 5,
    hasPedsUnit: false,
    hasTeleBurn: true,
    county: "LA"
  },
  {
    name: "Torrance Memorial Burn Center",
    lat: 33.8118863,
    lon: -118.3435984,
    type: "Burn Center",
    bedsAvailable: 0.0057,
    capability: 5,
    hasPedsUnit: false,
    hasTeleBurn: true,
    county: "LA"
  },
  {
    name: "UC Irvine Burn Center",
    lat: 33.7880317,
    lon: -117.8903927,
    type: "Burn Center",
    bedsAvailable: 0.0011,
    capability: 5,
    hasPedsUnit: true,
    hasTeleBurn: true,
    county: "Orange"
  },
  {
    name: "Orange County Global MC",
    lat: 33.7543963,
    lon: -117.833338,
    type: "Burn Center",
    bedsAvailable: 0,
    capability: 5,
    hasPedsUnit: false,
    hasTeleBurn: true,
    county: "Orange"
  },
  {
    name: "Arrowhead Regional Medical Center",
    lat: 34.0741,
    lon: -117.3512,
    type: "Burn Center",
    bedsAvailable: 0.008,
    capability: 5,
    hasPedsUnit: true,
    hasTeleBurn: false,
    county: "SanBernardino"
  },
];
