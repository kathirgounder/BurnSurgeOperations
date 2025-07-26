export default [
  {
    id: 'fire‑0725‑glendale',
    name: 'Glendale Wildland‑Urban Interface Fire',
    lat: 34.2, 
    lon: -118.23,
    datetime: '2025-07-25T15:00:00-07:00',
    patients: [
      { template: 'adult‑mod', count: 1 },
      { template: 'adult‑severe', count: 1 },
      { template: 'pediatric‑severe', count: 1 }
    ],
    notes:
      'WUI ignition with rapid uphill run; mix of smoke and flame injuries.'
  },
  {
    id: "wildfire‑chino‑hills",
    name: "Chino Hills WUI Fire",
    lat: 33.951,
    lon: -117.730,
    datetime: "2025-07-27T14:20:00-07:00",
    patients: [
      { template: "adult‑mod",     count: 3 },
      { template: "pediatric‑severe", count: 1 }
    ],
    notes: "Fast‑moving canyon fire with limited local burn resources."
  },
  {
    id: "attack‑spacex‑long‑beach",
    name: "SpaceX Long Beach Plant Explosion",
    lat: 33.7582,
    lon: -118.2053,
    datetime: "2025-07-27T13:30:00-07:00",
    patients: [
      { template: "adult‑mod",     count: 3 },
      { template: "adult‑severe",  count: 3 }
    ],
    notes: "Sabotage blast in methane‑tank area; thick smoke and flash burns among workers."
  },
  {
    id: "attack‑anduril‑costa‑mesa",
    name: "Anduril HQ Drone Strike",
    lat: 33.6540,
    lon: -117.8827,
    datetime: "2025-07-27T10:45:00-07:00",
    patients: [
      { template: "adult‑mod",     count: 4 },
      { template: "adult‑severe",  count: 2 }
    ],
    notes: "Precision drone explodes over Anduril Industries campus (Costa Mesa Technology Corridor)."
  },
  {
    id: "fire‑raytheon‑fullerton",
    name: "Raytheon Microelectronics Clean‑Room Flash",
    lat: 33.8633,
    lon: -117.9990,
    datetime: "2025-07-27T11:05:00-07:00",
    patients: [
      { template: "adult‑mod",     count: 6 }
    ],
    notes: "Lithography solvent flash ignites; mostly 1st–2nd degree burns on hands and forearms."
  },
  {
    id: "wui‑santa‑ana‑canyon‑fire",
    name: "Santa Ana Canyon Wind‑Driven Fire",
    lat: 33.8610,
    lon: -117.7080,
    datetime: "2025-07-27T14:50:00-07:00",
    patients: [
      { template: "adult‑mod",        count: 2 },
      { template: "pediatric‑severe", count: 1 }
    ],
    notes: "40 mph gusts push flames uphill near La Palma & Weir Canyon; limited local burn resources."
  },
];
