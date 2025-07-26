export default [
  {
    id: 'adult‑mod',
    ageGroup: 'adult',
    tbsa: 15,
    inhalation: false,
    priority: 'yellow',
    expectedBedDays: 5,
    burnType: "thermal"
  },
  {
    id: 'adult‑severe',
    ageGroup: 'adult',
    tbsa: 40,
    inhalation: true,
    priority: 'red',
    expectedBedDays: 14,
    burnType: "thermal"
  },
  {
    id: 'pediatric‑severe',
    ageGroup: 'pediatric',
    tbsa: 20,
    inhalation: true,
    priority: 'red',
    expectedBedDays: 14,
    burnType: "thermal"
  }
];
