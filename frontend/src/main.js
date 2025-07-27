import esriConfig from "@arcgis/core/config.js";
import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import * as webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import Basemap from "@arcgis/core/Basemap.js";

import { hospitals } from "./data/hospitals.js";
import { generalHospitals } from "./data/generalHospitals.js";
import incidents from "./data/incidents.js";
import patientTmpls from "./data/patients.js";
import { FlashingIncidentLayer } from "./flashingIncidentLayer.js";
import { CrossLayer } from "./breathingCrossLayer.js";
import { solveODPair, computeScore } from "./routeService.js";

import { createServiceArea } from "./serviceArea.js";
import Point from "@arcgis/core/geometry/Point.js";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine.js";
import Graphic from "@arcgis/core/Graphic.js";

/* Global Variables */
let HOSPITALS_ARE_SELECTED = true;
let RESULTS_HAVE_LOADED = false;
let RESULTS_IS_LOADING = false;
let hospitalSelections = {};
let filteredHospitals = [];
// initialize hospitalSelections
hospitals.forEach((hospital) => (hospitalSelections[hospital.name] = true));

let routeByDest;

/* ── 1.  API key (covers basemap + OD) ───────────────────── */
esriConfig.apiKey =
  "AAPTxy8BH1VEsoebNVZXo8HurExiheV8fp-Y5bdvR4oy2dC-XI7t-pbEluS39zbJeg0GaiY7Vp5WjXY_ze7MroCgHxBCRuJUHYcNagIHynfKvB5cMm-rvGo_V_yJ4WlBKew2aNjHsyU88PXm_FXwJh3_w_0MpxGfgoFapEas5kzZd5I23PwVuJLoo811sevETSYTS1NnT5zxgCdFTJwgeBwyOFJ86mFJk9OBPS3TVbJ5oBctSqPdMnm5zNLTHpkQcfSEAT1_d9LFzwbr";

/* ── 2.  Map bootstrap ──────────────────────────────────── */
// Use selected incident from landing page, or fall back to random selection
const incident =
  window.selectedIncident ||
  incidents[Math.floor(Math.random() * incidents.length)];
const incidentGraphic = {
  geometry: webMercatorUtils.geographicToWebMercator({
    x: incident.lon,
    y: incident.lat,
    spatialReference: { wkid: 4326 },
    type: "point",
  }),
  attributes: {
    NAME: incident.name,
    // shove anything else you want to use in the shader / popup:
    ID: incident.id,
    DATETIME: incident.datetime,
    SEVERITY: incident.severity,
  },
};

// Create an instance of the custom layer with 4 initial graphics.
const incidentLayer = new FlashingIncidentLayer({
  pulseFreq: 5,
  coreRadius: 8.0,
  glowRadius: 24.0,
  sparkAmpl: 0.1, // obvious crackle
  sparkFreq: 60.0, // rapid shimmer
  sizePx: 70,
  popupTemplate: {
    title: "{NAME}",
    content: "Severity: {SEVERITY}.",
  },
  graphics: [incidentGraphic],
});

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
  zoom: 11,
});

// Pick Incident

const layer = new GraphicsLayer();
map.add(layer);

const routeLayer = new GraphicsLayer({ title: "Routes" });
map.add(routeLayer);

// const gs = incidents.map((i) => ({
//   geometry: webMercatorUtils.geographicToWebMercator({
//     x: i.lon,
//     y: i.lat,
//     spatialReference: { wkid: 4326 },
//     type: "point",
//   }),
//   attributes: {
//     NAME: i.name,
//     // add any other attributes you want here
//   },
// }));
// Create an instance of the custom layer with 4 initial graphics.
// const incidentLayer = new CustomLayer({
//   popupTemplate: {
//     title: "Flashing Incident Layer",
//     content: "Population: {POPULATION}.",
//   },
//   graphics: gs,
// })

const serviceAreaLayer = new GraphicsLayer({ title: "Service Area" });
serviceAreaLayer.visible = false;
map.add(serviceAreaLayer);

const generalHospitalsLayer = new CrossLayer({
  popupTemplate: {
    title: "Potential Burn Resource Centers",
    content: `
      <ul>
        <li><b>Beds open:</b> {beds}</li>
        <li><b>Burn capability:</b> {capability}%</li>
        <li><b>Pediatric unit:</b> {peds}</li>
        <li><b>Tele‑burn enabled:</b> {tele}</li>
      </ul>`,
  },
  sizePx: 70,

  coreRadius: 12, // arm length 18 px
  armWidth: 0.06, // 0.13 × 70 ≈ 9 px bar thickness
  glowRadius: 18,

  pulseFreq: 0.6,
  sparkAmpl: 0.03,
  sparkFreq: 15,

  coreColor: [0.98, 0.62, 0.21],
  glowColor: [0.55, 0.33, 0.05],
});
generalHospitalsLayer.visible = false;
map.add(generalHospitalsLayer);

const point = new Point({
  longitude: incident.lon,
  latitude: incident.lat,
  spatialReference: { wkid: 4326 },
});

createServiceArea({
  point: point,
  serviceAreaLayer: serviceAreaLayer,
  view: view,
}).then((serviceAreaPolygons) => {
  queryHospitalsInServiceArea(serviceAreaPolygons, generalHospitalsLayer);
});

/* General OnClick Service Area Functionality */
// view.when(() => {
//   view.on("click", async (event) => {
//     const point = event.mapPoint;

//     createServiceArea({point: point, serviceAreaLayer: serviceAreaLayer, view: view, size: 8}).then(serviceAreaPolygons => {
//       queryHospitalsInServiceArea(serviceAreaPolygons, generalHospitalsLayer);
//     });
//   });
// });

// const incidentgs = incident.map(i => ({
//   geometry: webMercatorUtils.geographicToWebMercator({
//     x: i.lon,
//     y: i.lat,
//     spatialReference: { wkid: 4326 },
//     type: 'point'
//   }),
//   attributes: {
//     NAME: i.name
//     // add any other attributes you want here
//   }
// }));

const sbcgs = hospitals
  .filter((h) => h.type === "Burn Center")
  .map((h) => ({
    geometry: webMercatorUtils.geographicToWebMercator({
      x: h.lon,
      y: h.lat,
      spatialReference: { wkid: 4326 },
      type: "point",
    }),
    attributes: {
      NAME: h.name,
      beds: h.bedsAvailable ?? "n/a",
      capability: Math.round(h.capability * 100), // 95 → 95 %
      peds: h.hasPedsUnit ? "Yes" : "No",
      tele: h.hasTeleBurn ? "Yes" : "No",
    },
  }));

const brcgs = hospitals
  .filter((h) => h.type === "Burn Resource Center")
  .map((h) => ({
    geometry: webMercatorUtils.geographicToWebMercator({
      x: h.lon,
      y: h.lat,
      spatialReference: { wkid: 4326 },
      type: "point",
    }),
    attributes: {
      NAME: h.name,
      beds: h.bedsAvailable ?? "n/a",
      capability: Math.round(h.capability * 100),
      peds: h.hasPedsUnit ? "Yes" : "No",
      tele: h.hasTeleBurn ? "Yes" : "No",
    },
  }));

const brcLayer = new CrossLayer({
  popupTemplate: {
    title: "{NAME} (Resource Center)",
    content: `
      <ul>
        <li><b>Beds open:</b> {beds}</li>
        <li><b>Burn capability:</b> {capability}%</li>
        <li><b>Pediatric unit:</b> {peds}</li>
        <li><b>Tele‑burn enabled:</b> {tele}</li>
      </ul>`,
  },
  sizePx: 70,

  coreRadius: 12, // arm length 18 px
  armWidth: 0.06, // 0.13 × 70 ≈ 9 px bar thickness
  glowRadius: 18,

  pulseFreq: 0.6,
  sparkAmpl: 0.03,
  sparkFreq: 15,

  coreColor: [0.36, 0.42, 0.86],
  glowColor: [0.2, 0.25, 0.57],
  graphics: brcgs,
});
map.add(brcLayer);

const sbcLayer = new CrossLayer({
  popupTemplate: {
    title: "{NAME} (Burn Center)",
    content: `
      <ul>
        <li><b>Beds open:</b> {beds}</li>
        <li><b>Burn capability:</b> {capability}%</li>
        <li><b>Pediatric unit:</b> {peds}</li>
        <li><b>Tele‑burn enabled:</b> {tele}</li>
      </ul>`,
  },
  sizePx: 70,

  coreRadius: 12, // arm length 18 px
  armWidth: 0.06, // 0.13 × 70 ≈ 9 px bar thickness
  glowRadius: 18,

  pulseFreq: 0.6,
  sparkAmpl: 0.03,
  sparkFreq: 15,

  coreColor: [0.22, 0.76, 0.84],
  glowColor: [0.12, 0.48, 0.55],
  graphics: sbcgs,
});

map.add(sbcLayer);

map.add(incidentLayer);

function queryHospitalsInServiceArea(
  serviceAreaPolygons,
  generalHospitalsLayer
) {
  // Clear existing general hospitals
  generalHospitalsLayer.removeAll();

  if (!serviceAreaPolygons || serviceAreaPolygons.length === 0) {
    return;
  }

  // Get the outermost polygon (largest break value)
  const outermostPolygon = serviceAreaPolygons.reduce((outermost, polygon) => {
    const currentBreak = polygon.attributes.ToBreak;
    const outermostBreak = outermost ? outermost.attributes.ToBreak : 0;
    return currentBreak > outermostBreak ? polygon : outermost;
  });

  if (!outermostPolygon) {
    return;
  }

  // Convert general hospitals to points and check if they're within the service area
  const hospitalsInArea = generalHospitals.filter((hospital) => {
    const hospitalPoint = new Point({
      longitude: hospital.lon,
      latitude: hospital.lat,
      spatialReference: { wkid: 4326 },
    });
    // Check if the hospital point is within the outermost service area polygon
    return geometryEngine.contains(outermostPolygon.geometry, hospitalPoint);
  });

  console.log(
    `Found ${hospitalsInArea.length} general hospitals within service area`
  );

  // Add hospitals to the layer
  hospitalsInArea.forEach((hospital) => {
    const hospitalGraphic = new Graphic({
      geometry: webMercatorUtils.geographicToWebMercator({
        x: hospital.lon,
        y: hospital.lat,
        spatialReference: { wkid: 4326 },
        type: "point",
      }),
      // symbol: {
      //   type: "simple-marker",
      //   style: "circle",
      //   color: [255, 255, 255, 0.8], // White with transparency
      //   size: 8,
      //   outline: {
      //     color: [0, 0, 0, 0.8],
      //     width: 1
      //   }
      // },
      attributes: {
        NAME: hospital.name,
        PHONE: hospital.phone,
        CATEGORY: hospital.category,
        ADDRESS: hospital.address,
      },
      popupTemplate: {
        title: "{NAME}",
        content: `
          <ul>
            <li><b>Phone:</b> {PHONE}</li>
            <li><b>Category:</b> {CATEGORY}</li>
            <li><b>Address:</b> {ADDRESS}</li>
          </ul>`,
      },
    });

    generalHospitalsLayer.add(hospitalGraphic);
  });
}

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
    if (!RESULTS_HAVE_LOADED && RESULTS_IS_LOADING) {
      // when the user clicks the apply button
      patientAssignmentBtn.loading = true;
      patientAssignmentBtn.disabled = true;
    } else if (
      !RESULTS_HAVE_LOADED ||
      (!HOSPITALS_ARE_SELECTED && !RESULTS_IS_LOADING)
    ) {
      // when the user hasn't clicked the apply button at all, or hasn't selected at least 2 hospitals
      // a rare case where the user clicks apply, and then toggles off the hospitals leaving less than 2
      patientAssignmentBtn.disabled = true;
      const toolTip = document.createElement("calcite-tooltip");
      toolTip.innerHTML = "Please select at least 2 hospitals";
      toolTip.placement = "left";
      toolTip.referenceElement = patientAssignmentBtn;
      document.body.appendChild(toolTip);
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
  if (RESULTS_IS_LOADING) {
    applyButton.disabled = true;
    applyButton.loading = true;
  }
  applyButton.onclick = () => {
    RESULTS_HAVE_LOADED = false;
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
  if (hospitalApplyBtn) {
    // case where user keeps Hospital Popover open
    hospitalApplyBtn.disabled = false;
    hospitalApplyBtn.loading = false;
  }
}

addHospitalSelectionsActionBtn(hospitals);

// Add Toggle Layers functionality
function addToggleLayersActionBtn() {
  const actionBar = document.getElementById("burn-surge-ops-action-bar");
  const toggleLayersActionButton = document.createElement("calcite-action");
  toggleLayersActionButton.id = "toggle-layers-action-btn";
  toggleLayersActionButton.icon = "layers";
  toggleLayersActionButton.text = "Toggle Layers";
  toggleLayersActionButton.textEnabled = true;
  toggleLayersActionButton.onclick = () => displayToggleLayersPopover();
  actionBar.appendChild(toggleLayersActionButton);
}

function displayToggleLayersPopover() {
  const popovers = document.getElementsByClassName("burn-surge-ops-popover");
  for (const popover of popovers) {
    popover.remove();
  } // remove old popover if exists

  const toggleLayersPopover = document.createElement("calcite-popover");
  const toggleLayersActionBtn = document.getElementById(
    "toggle-layers-action-btn"
  );
  document.body.appendChild(toggleLayersPopover);
  toggleLayersPopover.id = "toggle-layers-popover";
  toggleLayersPopover.className = "burn-surge-ops-popover";
  toggleLayersPopover.label = "Toggle Layers";
  toggleLayersPopover.pointerDisabled = true;
  toggleLayersPopover.offsetSkidding = 6;
  toggleLayersPopover.referenceElement = toggleLayersActionBtn;
  toggleLayersPopover.placement = "leading";

  const panelElement = document.createElement("calcite-panel");
  panelElement.closable = true;
  panelElement.addEventListener("calcitePanelClose", () => {
    toggleLayersPopover.remove();
  });
  panelElement.heading = "Toggle Layers";

  const listElement = document.createElement("calcite-list");
  toggleLayersPopover.appendChild(panelElement);

  // Define all layers with their display names and references
  const layerConfigs = [
    {
      name: "Incident Layer",
      layer: incidentLayer,
      id: "incident-layer",
      description: "Flashing incident location",
    },
    {
      name: "Service Area",
      layer: serviceAreaLayer,
      id: "service-area-layer",
      description: "Drive time service areas",
    },
    {
      name: "General Hospitals",
      layer: generalHospitalsLayer,
      id: "general-hospitals-layer",
      description: "General hospitals in service area",
    },
    {
      name: "Burn Resource Centers",
      layer: brcLayer,
      id: "brc-layer",
      description: "Burn Resource Centers (blue crosses)",
    },
    {
      name: "Burn Centers",
      layer: sbcLayer,
      id: "sbc-layer",
      description: "Specialized Burn Centers (cyan crosses)",
    },
    {
      name: "Routes",
      layer: routeLayer,
      id: "route-layer",
      description: "Patient transport routes",
    },
  ];

  layerConfigs.forEach((config) => {
    const layerListItem = document.createElement("calcite-list-item");
    layerListItem.label = config.name;
    layerListItem.description = config.description;

    const layerSwitch = document.createElement("calcite-switch");
    layerSwitch.className = "layer-switch";
    layerSwitch.id = config.id;
    layerSwitch.label = config.name;
    layerSwitch.slot = "content-end";
    layerSwitch.checked = config.layer.visible;

    layerSwitch.addEventListener("calciteSwitchChange", () => {
      config.layer.visible = layerSwitch.checked;
    });

    layerListItem.appendChild(layerSwitch);
    listElement.appendChild(layerListItem);
  });

  panelElement.appendChild(listElement);

  // Add "Toggle All" buttons
  const buttonContainer = document.createElement("div");
  buttonContainer.style.cssText = "display: flex; gap: 8px; padding: 8px;";

  const showAllBtn = document.createElement("calcite-button");
  showAllBtn.innerHTML = "Show All";
  showAllBtn.width = "half";
  showAllBtn.onclick = () => {
    layerConfigs.forEach((config) => {
      config.layer.visible = true;
      const switchElement = document.getElementById(config.id);
      if (switchElement) switchElement.checked = true;
    });
  };

  const hideAllBtn = document.createElement("calcite-button");
  hideAllBtn.innerHTML = "Hide All";
  hideAllBtn.width = "half";
  hideAllBtn.onclick = () => {
    layerConfigs.forEach((config) => {
      config.layer.visible = false;
      const switchElement = document.getElementById(config.id);
      if (switchElement) switchElement.checked = false;
    });
  };

  buttonContainer.appendChild(showAllBtn);
  buttonContainer.appendChild(hideAllBtn);
  panelElement.appendChild(buttonContainer);
}

addToggleLayersActionBtn();

// Add Generate Report functionality
function addGenerateReportActionBtn() {
  const actionBar = document.getElementById("burn-surge-ops-action-bar");
  const generateReportActionButton = document.createElement("calcite-action");
  generateReportActionButton.id = "generate-report-action-btn";
  generateReportActionButton.icon = "file";
  generateReportActionButton.text = "Generate Report";
  generateReportActionButton.textEnabled = true;
  generateReportActionButton.onclick = () => displayGenerateReportPopover();
  actionBar.appendChild(generateReportActionButton);
}

function displayGenerateReportPopover() {
  const popovers = document.getElementsByClassName("burn-surge-ops-popover");
  for (const popover of popovers) {
    popover.remove();
  } // remove old popover if exists

  const generateReportPopover = document.createElement("calcite-popover");
  const generateReportActionBtn = document.getElementById(
    "generate-report-action-btn"
  );
  document.body.appendChild(generateReportPopover);
  generateReportPopover.id = "generate-report-popover";
  generateReportPopover.className = "burn-surge-ops-popover";
  generateReportPopover.label = "Generate Report";
  generateReportPopover.pointerDisabled = true;
  generateReportPopover.offsetSkidding = 6;
  generateReportPopover.referenceElement = generateReportActionBtn;
  generateReportPopover.placement = "leading";

  const panelElement = document.createElement("calcite-panel");
  panelElement.closable = true;
  panelElement.addEventListener("calcitePanelClose", () => {
    generateReportPopover.remove();
  });
  panelElement.heading = "Generate Report";

  // Add description text
  const descriptionElement = document.createElement("div");
  descriptionElement.style.cssText =
    "padding: 16px; color: var(--calcite-ui-text-3);";
  descriptionElement.innerHTML = `
    <p>Generate a comprehensive report of the current incident including:</p>
    <ul style="margin: 8px 0; padding-left: 20px;">
      <li>Incident details and location</li>
      <li>Patient assignments and severity levels</li>
      <li>Destination hospitals and travel times</li>
      <li>Optimization scores</li>
    </ul>
  `;
  panelElement.appendChild(descriptionElement);

  // Add the generate report button
  const generateButton = document.createElement("calcite-button");
  generateButton.id = "generate-report-btn";
  generateButton.slot = "footer";
  generateButton.innerHTML = "Generate Report";
  generateButton.width = "full";
  generateButton.appearance = "solid";
  generateButton.color = "blue";

  // Check if we have assignments to generate report for
  if (!RESULTS_HAVE_LOADED) {
    generateButton.disabled = true;
    generateButton.innerHTML = "No assignments available";
  }

  generateButton.onclick = async () => {
    if (!RESULTS_HAVE_LOADED) {
      return;
    }

    generateButton.loading = true;
    generateButton.disabled = true;

    try {
      // Get the current assignments from the global scope or recreate them
      const assignments = patients.map((p) => {
        const scored = hospitals
          .map((h) => {
            const minutes = routeByDest[h.name];
            return {
              dest: h,
              minutes: minutes,
              score: computeScore({ minutes, dest: h, patient: p }),
            };
          })
          .sort((a, b) => a.score - b.score);

        console.log(scored[0]);

        return {
          patientId: p.uid,
          severity: p.priority,
          patient: p,
          bestDest: scored[0].dest.name,
          minutes: scored[0].minutes.minutes,
          score: scored[0].score,
        };
      });

      const jsonOutput = {
        incidentName: incident.name,
        incidentDate: incident.datetime,
        incidentNotes: incident.notes,
        patients: assignments.map((r) => ({
          patientId: r.patientId,
          severity: r.severity,
          bestDest: r.bestDest,
          minutes: r.minutes,
          score: r.score,
        })),
        generatedAt: new Date().toISOString(),
      };

      console.log(jsonOutput);
      const response = await fetch("http://127.0.0.1:8000/generate-report/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonOutput),
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const htmlString = await response.json();
      const blob = new Blob([htmlString.message], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");

      // Close the popover after successful generation
      generateReportPopover.remove();
    } catch (err) {
      console.error("Error generating report:", err);
      alert("Failed to generate report. Please try again.");
    } finally {
      generateButton.loading = false;
      generateButton.disabled = false;
    }
  };

  panelElement.appendChild(generateButton);
  generateReportPopover.appendChild(panelElement);
}

addGenerateReportActionBtn();

function renderResultsSuccessAlert() {
  const resultsSuccessAlert = document.createElement("calcite-alert");
  resultsSuccessAlert.open = true;
  resultsSuccessAlert.kind = "success";
  const resultsSuccessAlertTitle = document.createElement("div");
  resultsSuccessAlertTitle.slot = "title";
  resultsSuccessAlertTitle.innerHTML = "Results Generated!";
  const resultsSuccessAlertMessage = document.createElement("div");
  resultsSuccessAlertMessage.slot = "message";
  resultsSuccessAlertMessage.innerHTML =
    "Patient Assignments have been generated. Check Patient Assignments on the action bar to check them out!";

  resultsSuccessAlert.appendChild(resultsSuccessAlertTitle);
  resultsSuccessAlert.appendChild(resultsSuccessAlertMessage);
  document.body.appendChild(resultsSuccessAlert);
}

// parallel OD solves, will finish executing even if some of the pair solves fail and we can filter
// for proper promise fulfillment
// solveODPair returns an object like this
// {
//     destId:   dest.id,
//     minutes:  routeInfo.totalDuration,
//     meters:   routeInfo.totalDistance,
//     geometry: routeInfo.geometry
// };
async function run() {
  if (filteredHospitals.length > 0) {
    const results = await Promise.allSettled(
      filteredHospitals.map((h) => solveODPair(incident, h))
    );
    setPatientAssignmentsListReady();
    setResultsHaveLoaded();
    renderResultsSuccessAlert();

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

    console.log(results);

    console.log("travel by dest");
    console.log(travelByDest);

    const assignments = patients.map((p) => {
      const scored = hospitals
        .map((h) => {
          const minutes = travelByDest[h.name];
          if (minutes) {
            return {
              dest: h,
              minutes,
              score: computeScore({ minutes, dest: h, patient: p }),
            };
          }
        })
        .sort((a, b) => a.score - b.score);

      console.log("Scored");
      console.log(scored);

      // Make a dictionary of destId and minutes pairs
      /* Travel Times from Incident to Destination Hospital 1 * 13 OD Matrix Essentially */
      // const travelByDest = {};

      // results.forEach(r => {
      //   if (r.status === 'fulfilled') {
      //     const { destName, minutes } = r.value;

      //     if (!destName) {
      //       console.warn('Route returned no destId', r.value);
      //       return;
      //     }
      //     if (!Number.isFinite(minutes)) {
      //       console.warn('Bad minutes for', destName, r.value);
      //       return;
      //     }
      //     travelByDest[destName] = minutes;
      //   } else {
      //     console.error('Route failed:', r.reason);
      //   }
      // });

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

    // addReportButton(assignments); // This line is removed as per the new_code, as the report generation is now handled by the new addGenerateReportActionBtn
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

    // dark halo
    routeLayer.add(
      new Graphic({
        geometry: route.geometry,
        symbol: {
          // black outline layer
          type: "simple-line",
          color: [0, 0, 0, 1], // solid black
          width: 5,
          cap: "round",
          join: "round",
        },
      })
    );

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
