import esriConfig from '@arcgis/core/config.js';
import Map from '@arcgis/core/Map.js';
import MapView from '@arcgis/core/views/MapView.js';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils.js';
import TileLayer from '@arcgis/core/layers/TileLayer.js';
import Basemap from "@arcgis/core/Basemap.js"

import { hospitals } from './data/hospitals.js';
import incidents from './data/incidents.js';
import patientTmpls from './data/patients.js';
import { FlashingIncidentLayer } from './flashingIncidentLayer.js';
import { CrossLayer } from './breathingCrossLayer.js';
import { solveODPair, computeScore } from './routeService.js';

/* ── 1.  API key (covers basemap + OD) ───────────────────── */
esriConfig.apiKey =
  'AAPTxy8BH1VEsoebNVZXo8HurExiheV8fp-Y5bdvR4oy2dC-XI7t-pbEluS39zbJeg0GaiY7Vp5WjXY_ze7MroCgHxBCRuJUHYcNagIHynfKvB5cMm-rvGo_V_yJ4WlBKew2aNjHsyU88PXm_FXwJh3_w_0MpxGfgoFapEas5kzZd5I23PwVuJLoo811sevETSYTS1NnT5zxgCdFTJwgeBwyOFJ86mFJk9OBPS3TVbJ5oBctSqPdMnm5zNLTHpkQcfSEAT1_d9LFzwbr';

/* ── 2.  Map bootstrap ──────────────────────────────────── */
const incident = incidents[0];

const hillshade = new TileLayer({
  portalItem: {
    id: '1b243539f4514b6ba35e7d995890db1d' // world hillshade
  }, // Living Atlas hillshade service
  blendMode: 'overlay', // lets relief shading show through the dark base
  opacity: 1, // tweak to taste
});

const basemap = await Basemap.fromId("dark-gray");
console.log(basemap);

const map = new Map({ basemap, layers: [hillshade]});

const view = new MapView({
  container: 'viewDiv',
  map,
  center: [incident.lon, incident.lat, 34.1],
  zoom: 13
});

// Pick Incident

const layer = new GraphicsLayer();
map.add(layer);

const routeLayer = new GraphicsLayer({ title: 'Routes' });
map.add(routeLayer);

const incidentgs = incidents.map(i => ({
  geometry: webMercatorUtils.geographicToWebMercator({
    x: i.lon,
    y: i.lat,
    spatialReference: { wkid: 4326 },
    type: 'point'
  }),
  attributes: {
    NAME: i.name
    // add any other attributes you want here
  }
}));

const hospitalgs = hospitals.map(h => ({
  geometry: webMercatorUtils.geographicToWebMercator({
    x: h.lon, 
    y: h.lat,
    spatialReference: { wkid: 4326},
    type: 'point'
  }),
  attributes: {
    NAME: h.name
    // add any other attributes you want here
  }
}))


const hospitalLayer = new CrossLayer({
  popupTemplate: {
    title: 'Flashing Hospital Layer',
    content: 'Hello World'
  },
  sizePx     : 70,

  coreRadius : 12,         // arm length 18 px
  armWidth   : 0.07,       // 0.13 × 70 ≈ 9 px bar thickness
  glowRadius : 18,

  pulseFreq  : 0.6,
  sparkAmpl  : 0.03,
  sparkFreq  : 15,

  coreColor  : [0.80,0.80,0.95],
  glowColor  : [0.55,0.55,0.60],
  graphics   : hospitalgs
});

map.add(hospitalLayer);

// Create an instance of the custom layer with 4 initial graphics.
const incidentLayer = new FlashingIncidentLayer({
  pulseFreq: 5,
  coreRadius: 8.0,
  glowRadius: 24.0,
  sparkAmpl:  0.10,    // obvious crackle
  sparkFreq:  60.0,     // rapid shimmer
  sizePx: 70,
  popupTemplate: {
    title: 'Flashing Incident Layer',
    content: 'Population: {POPULATION}.'
  },
  graphics: incidentgs
});

map.add(incidentLayer);


function expandPatients (manifest, templates) {
  const lut = Object.fromEntries(templates.map(t => [t.id, t]));
  return manifest.flatMap(stub =>
    Array.from({ length: stub.count }, (_, i) => ({
      ...lut[stub.template],
      uid: `${stub.template}-${i + 1}`
    }))
  );
}

const patients = expandPatients(incident.patients, patientTmpls);

console.log(patients);

// parallel OD solves, will finish executing even if some of the pair solves fail and we can filter
// for proper promise fulfillment
// solveODPair returns an object like this
// {
//     destId:   dest.id,
//     minutes:  routeInfo.totalDuration,
//     meters:   routeInfo.totalDistance,
//     geometry: routeInfo.geometry
// };
const results = await Promise.allSettled(
  hospitals.map(h => solveODPair(incident, h))
);

console.log('Results');
console.log(results);

// Make a dictionary of destId and minutes pairs
const travelByDest = {};

results.forEach(r => {
  if (r.status === 'fulfilled') {
    const { destName, minutes } = r.value;

    if (!destName) {
      console.warn('Route returned no destId', r.value);
      return;
    }
    if (!Number.isFinite(minutes)) {
      console.warn('Bad minutes for', destName, r.value);
      return;
    }
    travelByDest[destName] = minutes;
  } else {
    console.error('Route failed:', r.reason);
  }
});

// Fast lookup: destName → full route solve object
const routeByDest = Object.fromEntries(
  results
    .filter(r => r.status === 'fulfilled')
    .map(r => [r.value.destName, r.value]) // destName came from solveODPair
);

console.log('travel by dest');
console.log(travelByDest);

const assignments = patients.map(p => {
  const scored = hospitals
    .map(h => {
      const minutes = travelByDest[h.name];
      return {
        dest: h,
        minutes,
        score: computeScore({ minutes, dest: h, patient: p })
      };
    })
    .sort((a, b) => a.score - b.score);

  console.log('Scored');
  console.log(scored);

  return {
    patientId: p.uid,
    severity: p.priority,
    patient: p,
    bestDest: scored[0].dest.name,
    minutes: scored[0].minutes.toFixed(1),
    score: scored[0].score.toFixed(1)
  };
});

console.table(assignments);

// results
//   .filter(r => r.status === 'fulfilled')
//   .forEach(r => {
//     const { geometry, minutes } = r.value;
//     const patientIds = assignments
//      .filter(a => a.bestDest === r.value.destName)
//      .map(a => a.patientId)
//      .join(", ");
//     view.graphics.add({
//       geometry,
//       symbol: {
//        type: "simple-line",
//        width: 4,
//        color: minutes < 30 ? "green" : minutes < 45 ? "orange" : "red"
//      },
//      popupTemplate: {
//        title: `{minutes:numberFormat#0.0} min`,
//        content: "Patients on this route: {patientIds}"
//      }
//     });
//   });

function addPatientCarousel (rows) {
  const bar = document.createElement('div');
  bar.style.cssText = `
    position:absolute;top:10px;right:10px;z-index:9999;
    display:flex;gap:4px;background:#fff;padding:6px;border-radius:6px`;

  rows.forEach(r => {
    const btn = document.createElement('button');
    btn.textContent = r.patientId;
    btn.dataset.pid = r.patientId; //  <-- NOW present
    btn.onclick = () => highlightRouteFor(r, btn);
    bar.appendChild(btn);
  });
  document.body.appendChild(bar);
}

function makeFlowLineSymbol (baseColor) {
  // baseColor can be a hex string ("#30B37E") or [r,g,b]
  return {
    type: 'simple-line',
    style: 'solid',
    width: 3, // thin
    cap: 'round',
    join: 'round',
    color: [...ArcGISColor(baseColor), 0.7] // 35 % opacity
  };
}

// helper to convert hex → [r,g,b]
function ArcGISColor (c) {
  if (Array.isArray(c)) return c; // already [r,g,b]
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
async function highlightRouteFor (row, btn) {
  // 1. Clear old
  routeLayer.removeAll();

  // 2. Rank
  const ranked = hospitals
    .map(dest => {
      const route = routeByDest[dest.name];
      if (!route) return null; // skip if OD failed
      const score = computeScore({
        minutes: route.minutes,
        dest,
        patient: row.patient // full patient object
      });
      return { dest, route, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score) // lower score = better
    .slice(0, 3);

  // 3. Draw
  ranked.forEach(({ dest, route }) => {
    const scoreVal = computeScore({
      minutes: route.minutes,
      dest,
      patient: row.patient
    });
    routeLayer.add({
      geometry: route.geometry,
      symbol: makeFlowLineSymbol(
        scoreVal < 1000 ? '#30B37E' : scoreVal < 5000 ? '#EFB95B' : '#E54C4C'
      ), // any RGBA → last value is 55 % opacity
      attributes: {
        destName: dest.name,
        minutes: route.minutes.toFixed(1),
        score: scoreVal.toFixed(1),
        patientId: row.patientId
      },
      popupTemplate: {
        title: '{destName}',
        content: `
            Patient: <b>{patientId}</b><br>
            Travel time: <b>{minutes} min</b><br>
            Score: <b>{score}</b>`
      }
    });
  });

  // 4. Zoom
  if (routeLayer.graphics.length) {
    const fullExtent = routeLayer.graphics.reduce(
      (ext, g) => (ext ? ext.union(g.geometry.extent) : g.geometry.extent),
      null
    );
    if (fullExtent)
      await view.goTo({ target: fullExtent, padding: 20 }, { duration: 600 });
  }

  // 5. Highlight active button
  if (window.activeBtn) {
    window.activeBtn.style.background = '';
    window.activeBtn.style.color = '';
  }
  window.activeBtn = btn;
  btn.style.background = '#007AC2';
  btn.style.color = '#fff';
}

addPatientCarousel(assignments);

function renderAssignmentsTable (rows) {
  const tbl = document.createElement('table');
  tbl.style.cssText =
    'border-collapse:collapse;margin:8px;font-family:sans-serif';
  tbl.innerHTML = `
      <thead>
        <tr>
          <th style="border:1px solid #ccc;padding:4px">Patient</th>
          <th style="border:1px solid #ccc;padding:4px">Severity</th>
          <th style="border:1px solid #ccc;padding:4px">Destination</th>
          <th style="border:1px solid #ccc;padding:4px">Minutes</th>
          <th style="border:1px solid #ccc;padding:4px">Score</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            r => `
          <tr>
            <td style="border:1px solid #ccc;padding:4px">${r.patientId}</td>
            <td style="border:1px solid #ccc;padding:4px">${r.severity}</td>
            <td style="border:1px solid #ccc;padding:4px">${r.bestDest}</td>
            <td style="border:1px solid #ccc;padding:4px">${r.minutes}</td>
            <td style="border:1px solid #ccc;padding:4px">${r.score}</td>
          </tr>`
          )
          .join('')}
      </tbody>`;
  document.body.appendChild(tbl);
}

renderAssignmentsTable(assignments);

/* -------- inline mini‑report -------- */
function buildReportHTML (rows) {
  return `
    <html><head><title>${incident.name} – After‑Action</title>
      <style>
        body{font-family:sans-serif;padding:1rem}
        table{border-collapse:collapse;width:100%}
        td,th{border:1px solid #ccc;padding:4px}
        th{background:#f5f5f5}
      </style>
    </head><body>
      <h1>${incident.name}</h1>
      <h3>${new Date(incident.datetime).toLocaleString()}</h3>
      <p>${incident.notes}</p>
      <h2>Patient Assignment</h2>
      <table>
        <tr><th>Patient</th><th>Severity</th><th>Destination</th><th>Minutes</th><th>Score</th></tr>
        ${rows
          .map(
            r => `<tr>
          <td>${r.patientId}</td><td>${r.severity}</td><td>${r.bestDest}</td>
          <td>${r.minutes}</td><td>${r.score}</td>
        </tr>`
          )
          .join('')}
      </table>
      <p><em>Generated ${new Date().toLocaleString()}</em></p>
    </body></html>`;
}

function addReportButton(rows) {
  // BROKEN, NEED TO FIX
  const btn = document.createElement('button');
  btn.textContent = 'Generate Report';
  btn.style.cssText = 'position:absolute;top:10px;left:10px;z-index:9999';
  
  btn.onclick = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/generate-report/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rows })  // wrap in an object if backend expects `rows`
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const htmlString = await response.text();
      const blob = new Blob([htmlString], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');

    } catch (err) {
      console.error('Error generating report:', err);
      alert('Failed to generate report.');
    }
  };

  document.body.appendChild(btn);
}


addReportButton(assignments);

// Custom OD Cost Matrix Function
// async function addRouteLayer (dest) {
//   const stops = [
//     new Stop({ geometry: { x: incident.lon, y: incident.lat } }),
//     new Stop({ geometry: { x: dest.lon, y: dest.lat } })
//   ];

//   const rl = new RouteLayer({
//     defaultSymbols: {
//       stops: new RouteStopSymbols({
//         last: new SimpleMarkerSymbol({
//           style: 'diamond',
//           size: 12,
//           color: 'red',
//           outline: { color: 'white' }
//         }),
//         first: new SimpleMarkerSymbol({
//           style: 'x',
//           size: 14,
//           color: 'black',
//           outline: { color: 'black' }
//         })
//       })
//     },
//     stops
//   });

//   map.add(rl); // unsolved layers won’t draw yet

//   try {
//     const solveResult = await rl.solve({ apiKey: esriConfig.apiKey });
//     rl.update(solveResult); // now the polyline + directions render

//     console.log(solveResult);

//     // Simple popup for the whole route
//     // ---- attach a popup to the graphic that represents the whole route ----
//     const mins = rl.routeInfo.totalDuration.toFixed(1);
//     rl.routeInfo.popupTemplate = {
//       title: `${mins}&nbsp;min drive`,
//       content: `Distance: ${(rl.routeInfo.totalDistance / 1000).toFixed(1)} km`
//     };
//   } catch (err) {
//     console.error(`Route solve failed for ${dest.name}`, err);
//   }
// }

/* 5 ▸ Kick off all four solves in parallel -------------------------- */
//await Promise.all(hospitals.map(addRouteLayer));
