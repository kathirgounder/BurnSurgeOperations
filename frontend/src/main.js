import esriConfig from "@arcgis/core/config.js";
import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import * as webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import Basemap from "@arcgis/core/Basemap.js";

import { hospitals } from "./data/hospitals.js";
import incidents from "./data/incidents.js";
import patientTmpls from "./data/patients.js";
import { CustomLayer } from "./flashingIncidentLayer.js";
import { solveODPair, computeScore } from "./routeService.js";

/* Global Variables */
let HOSPITALS_ARE_SELECTED = false;
let RESULTS_HAVE_LOADED = false;
let RESULTS_IS_LOADING = false;
let hospitalSelections = {};
let filteredHospitals = [];
// initialize hospitalSelections
hospitals.forEach((hospital) => (hospitalSelections[hospital.name] = false));

let routeByDest;

/* ── 1.  API key (covers basemap + OD) ───────────────────── */
esriConfig.apiKey =
  "AAPTxy8BH1VEsoebNVZXo8HurExiheV8fp-Y5bdvR4oy2dC-XI7t-pbEluS39zbJeg0GaiY7Vp5WjXY_ze7MroCgHxBCRuJUHYcNagIHynfKvB5cMm-rvGo_V_yJ4WlBKew2aNjHsyU88PXm_FXwJh3_w_0MpxGfgoFapEas5kzZd5I23PwVuJLoo811sevETSYTS1NnT5zxgCdFTJwgeBwyOFJ86mFJk9OBPS3TVbJ5oBctSqPdMnm5zNLTHpkQcfSEAT1_d9LFzwbr";

/* ── 2.  Map bootstrap ──────────────────────────────────── */
const incident = incidents[0];

const hillshade = new TileLayer({
  portalItem: {
    id: "1b243539f4514b6ba35e7d995890db1d", // world hillshade
  }, // Living Atlas hillshade service
  blendMode: "overlay", // lets relief shading show through the dark base
  opacity: 1, // tweak to taste
});

const basemap = await Basemap.fromId("dark-gray");
console.log(basemap);

const map = new Map({ basemap, layers: [hillshade] });

const view = new MapView({
  container: "viewDiv",
  map,
  center: [incident.lon, incident.lat, 34.1],
  zoom: 13,
});

// Pick Incident

const layer = new GraphicsLayer();
map.add(layer);

const routeLayer = new GraphicsLayer({ title: "Routes" });
map.add(routeLayer);

const gs = incidents.map((i) => ({
  geometry: webMercatorUtils.geographicToWebMercator({
    x: i.lon,
    y: i.lat,
    spatialReference: { wkid: 4326 },
    type: "point",
  }),
  attributes: {
    NAME: i.name,
    // add any other attributes you want here
  },
}));
// Create an instance of the custom layer with 4 initial graphics.
const incidentLayer = new CustomLayer({
  popupTemplate: {
    title: "Flashing Incident Layer",
    content: "Population: {POPULATION}.",
  },
  graphics: gs,
});

map.add(incidentLayer);

function expandPatients(manifest, templates) {
  const lut = Object.fromEntries(templates.map((t) => [t.id, t]));
  return manifest.flatMap((stub) =>
    Array.from({ length: stub.count }, (_, i) => ({
      ...lut[stub.template],
      uid: `${stub.template}-${i + 1}`,
    }))
  );
}

const patients = expandPatients(incident.patients, patientTmpls);

console.log("patients", patients);

const patientAssignments = patients.map((patient) => {
  return { patientId: patient.uid, severity: patient.priority, patient };
});

console.log("patientAssignments", patientAssignments);

function addPatientAssignmentsListActionBtn(patientAssignments) {
  const actionBar = document.getElementById("burn-surge-ops-action-bar");
  const patientAssignmentsActionButton =
    document.createElement("calcite-action");
  patientAssignmentsActionButton.id = "patient-assignments-action-btn";
  patientAssignmentsActionButton.icon = "person-2";
  patientAssignmentsActionButton.text = "Patient Assignments";
  patientAssignmentsActionButton.textEnabled = true;
  patientAssignmentsActionButton.onclick = () =>
    displayPatientAssignmentsListPopover(patientAssignments);
  actionBar.appendChild(patientAssignmentsActionButton);
}

function displayPatientAssignmentsListPopover(patientAssignments) {
  const popovers = document.getElementsByClassName("burn-surge-ops-popover");
  for (const popover of popovers) {
    popover.remove();
  } // remove old popover if exists
  const patientAssignmentsPopover = document.createElement("calcite-popover");
  const patientAssignmentsActionBtn = document.getElementById(
    "patient-assignments-action-btn"
  );
  document.body.appendChild(patientAssignmentsPopover);
  patientAssignmentsPopover.id = "patient-assignments-popover";
  patientAssignmentsPopover.className = "burn-surge-ops-popover";
  patientAssignmentsPopover.label = "Patient Assignments";
  patientAssignmentsPopover.pointerDisabled = true;
  patientAssignmentsPopover.offsetSkidding = 6;
  patientAssignmentsPopover.referenceElement = patientAssignmentsActionBtn;
  patientAssignmentsPopover.placement = "leading";
  const panelElement = document.createElement("calcite-panel");
  panelElement.closable = true;
  panelElement.addEventListener("calcitePanelClose", () => {
    patientAssignmentsPopover.remove();
  });
  panelElement.heading = "Patient Assignments";
  patientAssignmentsPopover.appendChild(panelElement);
  patientAssignments.forEach((patientAssignment) => {
    const patientAssignmentBtn = document.createElement("calcite-action");
    if (!HOSPITALS_ARE_SELECTED) {
      patientAssignmentBtn.disabled = true;
      const toolTip = document.createElement("calcite-tooltip");
      toolTip.innerHTML = "Please select at least 2 hospitals";
      toolTip.referenceElement = patientAssignmentBtn;
      document.body.appendChild(toolTip);
    } else if (!RESULTS_HAVE_LOADED) {
      patientAssignmentBtn.loading = true;
      patientAssignmentBtn.disabled = true;
    }
    patientAssignmentBtn.className = "patient-assignment-action";
    patientAssignmentBtn.text = patientAssignment.patientId;
    patientAssignmentBtn.textEnabled = true;
    patientAssignmentBtn.dataset.pid = patientAssignment.patientId; //  <-- NOW present
    patientAssignmentBtn.onclick = () => {
      // set all patient assignment buttons' active prop to be false
      const allPatientAssignmentBtns = document.getElementsByClassName(
        "patient-assignment-action"
      );
      for (const btn of allPatientAssignmentBtns) {
        btn.active = false;
      }
      patientAssignmentBtn.active = true;
      highlightRouteFor(patientAssignment, patientAssignmentBtn);
    };
    panelElement.appendChild(patientAssignmentBtn);
  });
}

function setPatientAssignmentsListReady() {
  const patientAssignmentActions = document.getElementsByClassName(
    "patient-assignment-action"
  );
  for (const patientAssignmentAction of patientAssignmentActions) {
    patientAssignmentAction.loading = false;
    patientAssignmentAction.disabled = false;
  }
  RESULTS_HAVE_LOADED = true;
}

addPatientAssignmentsListActionBtn(patientAssignments);

function addHospitalSelectionsActionBtn(hospitals) {
  const actionBar = document.getElementById("burn-surge-ops-action-bar");
  const hospitalSelectionsActionButton =
    document.createElement("calcite-action");
  hospitalSelectionsActionButton.id = "hospital-selections-action-btn";
  hospitalSelectionsActionButton.icon = "medical";
  hospitalSelectionsActionButton.text = "Hospital Selections";
  hospitalSelectionsActionButton.textEnabled = true;
  hospitalSelectionsActionButton.onclick = () =>
    displayHospitalSelectionsPopover(hospitals);
  actionBar.appendChild(hospitalSelectionsActionButton);
}

function displayHospitalSelectionsPopover(hospitals) {
  const popovers = document.getElementsByClassName("burn-surge-ops-popover");
  for (const popover of popovers) {
    popover.remove();
  } // remove old popover if exists
  const hospitalSelectionsPopover = document.createElement("calcite-popover");
  const hospitalSelectionsActionBtn = document.getElementById(
    "hospital-selections-action-btn"
  );
  document.body.appendChild(hospitalSelectionsPopover);
  hospitalSelectionsPopover.id = "hospital-selections-popover";
  hospitalSelectionsPopover.className = "burn-surge-ops-popover";
  hospitalSelectionsPopover.style.cssText = "height: 50%;";
  hospitalSelectionsPopover.label = "Hospital Selections";
  hospitalSelectionsPopover.pointerDisabled = true;
  hospitalSelectionsPopover.offsetSkidding = 6;
  hospitalSelectionsPopover.referenceElement = hospitalSelectionsActionBtn;
  hospitalSelectionsPopover.placement = "leading";
  const panelElement = document.createElement("calcite-panel");
  panelElement.style.cssText = "height: 500px;";
  panelElement.closable = true;
  panelElement.addEventListener("calcitePanelClose", () => {
    hospitalSelectionsPopover.remove();
  });
  panelElement.heading = "Hospital Selections";
  const listElement = document.createElement("calcite-list");
  hospitalSelectionsPopover.appendChild(panelElement);
  hospitals.forEach((hospital) => {
    const hospitalSelectionListItem =
      document.createElement("calcite-list-item");
    hospitalSelectionListItem.label = hospital.name;
    // hospitalSelectionListItem.disabled = true;
    const hospitalSelectionSwitch = document.createElement("calcite-switch");
    hospitalSelectionSwitch.className = "hospital-switch";
    hospitalSelectionSwitch.label = hospital.name;
    hospitalSelectionSwitch.slot = "content-end";
    hospitalSelectionSwitch.checked = hospitalSelections[hospital.name];
    hospitalSelectionSwitch.addEventListener("calciteSwitchChange", () => {
      // count number of checked hospitals
      let count = 0;
      const hospitalListItemElements = listElement.children;
      for (const switchElement of hospitalListItemElements) {
        if (switchElement.children[0].checked === true) {
          count++;
        }
      }
      if (count >= 2) {
        HOSPITALS_ARE_SELECTED = true;
        const hospitalApplyBtn = document.getElementById("hospital-apply-btn");
        hospitalApplyBtn.disabled = false;
      } else {
        HOSPITALS_ARE_SELECTED = false;
        const hospitalApplyBtn = document.getElementById("hospital-apply-btn");
        hospitalApplyBtn.disabled = true;
      }
    });
    hospitalSelectionListItem.appendChild(hospitalSelectionSwitch);
    listElement.appendChild(hospitalSelectionListItem);
  });
  panelElement.appendChild(listElement);

  // render Apply button
  const applyButton = document.createElement("calcite-button");
  applyButton.id = "hospital-apply-btn";
  applyButton.innerHTML = "Apply";
  applyButton.slot = "footer";
  applyButton.width = "full";
  if (!HOSPITALS_ARE_SELECTED) {
    applyButton.disabled = true;
  }
  applyButton.onclick = () => {
    RESULTS_IS_LOADING = true;
    applyButton.disabled = true;
    applyButton.loading = true;
    const hospitalSwitches = document.getElementsByClassName("hospital-switch");
    for (const hospitalSwitch of hospitalSwitches) {
      const hospitalName = hospitalSwitch.label;
      hospitalSelections[hospitalName] = hospitalSwitch.checked;
    }
    console.log(
      "After clicking apply. New hospitalSelections ",
      hospitalSelections
    );
    const selectedHospitalsList = Object.keys(hospitalSelections).filter(
      (hospital) => hospitalSelections[hospital] === true
    );

    const selectedHospitalsSet = new Set(selectedHospitalsList);

    filteredHospitals = hospitals.filter((hospital) =>
      selectedHospitalsSet.has(hospital.name)
    );
    run();
  };
  panelElement.appendChild(applyButton);
}

function setResultsHaveLoaded() {
  RESULTS_IS_LOADING = false;
  const hospitalApplyBtn = document.getElementById("hospital-apply-btn");
  hospitalApplyBtn.disabled = false;
  hospitalApplyBtn.loading = false;
}

addHospitalSelectionsActionBtn(hospitals);

// parallel OD solves, will finish executing even if some of the pair solves fail and we can filter
// for proper promise fulfillment
// solveODPair returns an object like this
// {
//     destId:   dest.id,
//     minutes:  routeInfo.totalDuration,
//     meters:   routeInfo.totalDistance,
//     geometry: routeInfo.geometry
// };
// const results = await Promise.allSettled(
//   hospitals.map((h) => solveODPair(incident, h))
// );

async function run() {
  if (filteredHospitals.length > 0) {
    const results = await Promise.allSettled(
      filteredHospitals.map((h) => solveODPair(incident, h))
    );
    setPatientAssignmentsListReady();
    setResultsHaveLoaded();

    console.log("Results");
    console.log(results);

    // Make a dictionary of destId and minutes pairs
    const travelByDest = {};

    results.forEach((r) => {
      if (r.status === "fulfilled") {
        const { destName, minutes } = r.value;

        if (!destName) {
          console.warn("Route returned no destId", r.value);
          return;
        }
        if (!Number.isFinite(minutes)) {
          console.warn("Bad minutes for", destName, r.value);
          return;
        }
        travelByDest[destName] = minutes;
      } else {
        console.error("Route failed:", r.reason);
      }
    });

    // Fast lookup: destName → full route solve object
    routeByDest = Object.fromEntries(
      results
        .filter((r) => r.status === "fulfilled")
        .map((r) => [r.value.destName, r.value]) // destName came from solveODPair
    );

    console.log("travel by dest");
    console.log(travelByDest);

    const assignments = patients.map((p) => {
      const scored = hospitals
        .map((h) => {
          const minutes = travelByDest[h.name];
          return {
            dest: h,
            minutes,
            score: computeScore({ minutes, dest: h, patient: p }),
          };
        })
        .sort((a, b) => a.score - b.score);

      console.log("Scored");
      console.log(scored);

      return {
        patientId: p.uid,
        severity: p.priority,
        patient: p,
        bestDest: scored[0].dest.name,
        minutes: scored[0].minutes.toFixed(1),
        score: scored[0].score.toFixed(1),
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
    renderAssignmentsTable(assignments);

    addReportButton(assignments);
  }
}

function makeFlowLineSymbol(baseColor) {
  // baseColor can be a hex string ("#30B37E") or [r,g,b]
  return {
    type: "simple-line",
    style: "solid",
    width: 3, // thin
    cap: "round",
    join: "round",
    color: [...ArcGISColor(baseColor), 0.7], // 35 % opacity
  };
}

// helper to convert hex → [r,g,b]
function ArcGISColor(c) {
  if (Array.isArray(c)) return c; // already [r,g,b]
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
async function highlightRouteFor(row, btn) {
  // 1. Clear old
  routeLayer.removeAll();

  // 2. Rank
  const ranked = hospitals
    .map((dest) => {
      const route = routeByDest[dest.name];
      if (!route) return null; // skip if OD failed
      const score = computeScore({
        minutes: route.minutes,
        dest,
        patient: row.patient, // full patient object
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
      patient: row.patient,
    });
    routeLayer.add({
      geometry: route.geometry,
      symbol: makeFlowLineSymbol(
        scoreVal < 1000 ? "#30B37E" : scoreVal < 5000 ? "#EFB95B" : "#E54C4C"
      ), // any RGBA → last value is 55 % opacity
      attributes: {
        destName: dest.name,
        minutes: route.minutes.toFixed(1),
        score: scoreVal.toFixed(1),
        patientId: row.patientId,
      },
      popupTemplate: {
        title: "{destName}",
        content: `
            Patient: <b>{patientId}</b><br>
            Travel time: <b>{minutes} min</b><br>
            Score: <b>{score}</b>`,
      },
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
  // if (window.activeBtn) {
  //   window.activeBtn.style.background = "";
  //   window.activeBtn.style.color = "";
  // }
  // window.activeBtn = btn;
  // btn.style.background = "#007AC2";
  // btn.style.color = "#fff";
}

function renderAssignmentsTable(rows) {
  const tbl = document.createElement("table");
  tbl.style.cssText =
    "border-collapse:collapse;margin:8px;font-family:sans-serif";
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
            (r) => `
          <tr>
            <td style="border:1px solid #ccc;padding:4px">${r.patientId}</td>
            <td style="border:1px solid #ccc;padding:4px">${r.severity}</td>
            <td style="border:1px solid #ccc;padding:4px">${r.bestDest}</td>
            <td style="border:1px solid #ccc;padding:4px">${r.minutes}</td>
            <td style="border:1px solid #ccc;padding:4px">${r.score}</td>
          </tr>`
          )
          .join("")}
      </tbody>`;
  document.body.appendChild(tbl);
}

/* -------- inline mini‑report -------- */
function buildReportHTML(rows) {
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
            (r) => `<tr>
          <td>${r.patientId}</td><td>${r.severity}</td><td>${r.bestDest}</td>
          <td>${r.minutes}</td><td>${r.score}</td>
        </tr>`
          )
          .join("")}
      </table>
      <p><em>Generated ${new Date().toLocaleString()}</em></p>
    </body></html>`;
}

function addReportButton(rows) {
  // BROKEN, NEED TO FIX
  const btn = document.createElement("button");
  btn.textContent = "Generate Report";
  btn.style.cssText = "position:absolute;top:10px;left:10px;z-index:9999";

  btn.onclick = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/generate-report/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows }), // wrap in an object if backend expects `rows`
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const htmlString = await response.text();
      const blob = new Blob([htmlString], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err) {
      console.error("Error generating report:", err);
      alert("Failed to generate report.");
    }
  };

  document.body.appendChild(btn);
}

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
