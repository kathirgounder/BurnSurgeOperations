import esriConfig from "@arcgis/core/config.js";
import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import * as webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import Basemap from "@arcgis/core/Basemap.js";
import Legend from "@arcgis/core/widgets/Legend.js";

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
let layerConfigs;
let routeFeatureLayer;
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

let currDate = new Date(incident.datetime);
const options = { month: "long", day: "numeric", year: "numeric" };
const formattedDate = currDate.toLocaleDateString("en-US", options);

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
    DATETIME: formattedDate,
    COUNTY: incident.county,
    NOTES: incident.notes,
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
    content: `
            Date: <b>{DATETIME}</b><br>
            County: <b>{COUNTY}</b><br>
            Notes: <b>{NOTES}</b><br>`,
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

let serviceAreaFeatureLayer;

createServiceArea({
  point: point,
  serviceAreaLayer: serviceAreaLayer,
  view: view,
}).then((serviceAreaPolygons) => {
  queryHospitalsInServiceArea(serviceAreaPolygons, generalHospitalsLayer);
  // 1. Extract graphics from serviceAreaLayer
  const serviceAreaGraphics = serviceAreaLayer.graphics.toArray
    ? serviceAreaLayer.graphics.toArray()
    : serviceAreaLayer.graphics;

  // 2. Define fields for FeatureLayer
  const serviceAreaFields = [
    { name: "ObjectId", type: "oid" },
    { name: "ToBreak", type: "double" }, // Example field, adjust as needed
    // Add other fields if your polygons have more attributes
  ];

  // 3. Create FeatureLayer
  serviceAreaFeatureLayer = new FeatureLayer({
    geometryType: "polygon",
    titles: "serviceAreas",
    source: serviceAreaGraphics.map((g, idx) => {
      g.attributes = { ...g.attributes, ObjectId: idx + 1 };
      return g;
    }),
    objectIdField: "ServiceArea",
    fields: serviceAreaFields,
    popupTemplate: {
      title: "Service Area",
      content: `
      <ul>
        <li><b>Break Value:</b> {ToBreak}</li>
      </ul>`,
    },
    renderer: {
      type: "unique-value",
      field: "ToBreak",

      // symbol: {
      //   type: "simple-fill",
      //   color: [102, 204, 255, 0.3], // light blue with transparency
      //   outline: {
      //     color: [0, 122, 204, 1],
      //     width: 2,
      //   },
      // },
      uniqueValueInfos: [
        {
          value: 10,
          label: "5 min",
          symbol: {
            type: "simple-fill",
            color: [5, 255, 5, 0.5], // green
            outline: null,
          },
        },
        {
          value: 20,
          label: "10 min",
          symbol: {
            type: "simple-fill",
            color: [246, 255, 0, 0.5], // yellow
            outline: null,
          },
        },
        {
          value: 30,
          label: "15 min",
          symbol: {
            type: "simple-fill",
            color: [255, 153, 0, 0.5], // orange
            outline: null,
          },
        },
      ],
    },
  });
  serviceAreaFeatureLayer.visible = false;
  // Add to map and legend if needed
  map.add(serviceAreaFeatureLayer, 0);
  legend.layerInfos.push({
    layer: serviceAreaFeatureLayer,
    title: "Service Area",
  });
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

// 1. Extract graphics from incidentLayer
const incidentGraphics = incidentLayer.graphics.toArray
  ? incidentLayer.graphics.toArray()
  : incidentLayer.graphics;

// 2. Define fields for FeatureLayer
const incidentFields = [
  { name: "ObjectId", type: "oid" },
  { name: "NAME", type: "string" },
  { name: "SEVERITY", type: "string" },
  // Add other fields as needed
];

// 3. Create FeatureLayer
const incidentFeatureLayer = new FeatureLayer({
  source: incidentGraphics.map((g, idx) => {
    // Ensure each graphic has a unique ObjectId
    g.attributes = { ...g.attributes, ObjectId: idx + 1 };
    return g;
  }),
  objectIdField: "generalHospitals",
  title: "incident",
  fields: incidentFields,
  popupTemplate: {
    title: "{NAME}",
    content: "Severity: {SEVERITY}.",
  },
  renderer: {
    label: "Incident Location",
    type: "simple",
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: [255, 64, 64, 1], // bright red
      size: 4,
      outline: {
        color: [255, 64, 64, 1], // bright red
        width: 2,
      },
    },
  },
});

// 1. Extract graphics
const sbcGraphics = sbcLayer.graphics.toArray
  ? sbcLayer.graphics.toArray()
  : sbcLayer.graphics;
const brcGraphics = brcLayer.graphics.toArray
  ? brcLayer.graphics.toArray()
  : brcLayer.graphics;

// 2. Define fields
const hospitalFields = [
  { name: "ObjectId", type: "oid" },
  { name: "NAME", type: "string" },
  { name: "beds", type: "string" },
  { name: "capability", type: "string" },
  { name: "peds", type: "string" },
  { name: "tele", type: "string" },
];

// 3. Create FeatureLayers
const sbcFeatureLayer = new FeatureLayer({
  geometryType: "point",
  source: sbcGraphics.map((g, idx) => {
    g.attributes = { ...g.attributes, ObjectId: idx + 1 };
    return g;
  }),
  objectIdField: "sbc",
  fields: hospitalFields,
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
  renderer: {
    label: "Specialized Burn Center",
    type: "simple",
    symbol: {
      type: "simple-marker",
      style: "cross",
      color: [34, 194, 214, 1], // cyan
      size: 6,
      outline: {
        color: [18, 122, 140, 0.7],
        width: 2,
      },
    },
  },
});

const brcFeatureLayer = new FeatureLayer({
  geometryType: "point",
  source: brcGraphics.map((g, idx) => {
    g.attributes = { ...g.attributes, ObjectId: idx + 1 };
    return g;
  }),
  objectIdField: "brc",
  fields: hospitalFields,
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
  renderer: {
    label: "Burn Resource Center",
    type: "simple",
    symbol: {
      type: "simple-marker",
      style: "cross",
      color: [92, 107, 220, 1], // blue
      size: 6,
      outline: {
        color: [32, 41, 86, 0.7],
        width: 2,
      },
    },
  },
});

brcFeatureLayer.visible = false;
sbcFeatureLayer.visible = false;

// sbcFeatureLayer.opacity = 0.5;
// brcFeatureLayer.opacity = 0.5;

map.add(sbcFeatureLayer);
map.add(brcFeatureLayer);

map.add(incidentFeatureLayer);
let generalHospitalsFeatureLayer;

const legendDiv = document.createElement("div");
legendDiv.id = "mini‑legend";
view.ui.add(legendDiv, "bottom-left");

const legend = new Legend({
  view: view,
  container: legendDiv,
  layerInfos: [
    {
      layer: incidentFeatureLayer,
    },
    {
      layer: sbcFeatureLayer,
    },
    {
      layer: brcFeatureLayer,
    },
  ],
});

legend.respectLayerVisibility = false;



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

  // 1. Extract graphics from generalHospitalsLayer
  const generalHospitalsGraphics = generalHospitalsLayer.graphics.toArray
    ? generalHospitalsLayer.graphics.toArray()
    : generalHospitalsLayer.graphics;

  // 2. Define fields for FeatureLayer
  const generalHospitalsFields = [
    { name: "ObjectId", type: "oid" },
    { name: "NAME", type: "string" },
    { name: "beds", type: "string" },
    { name: "capability", type: "string" },
    { name: "peds", type: "string" },
    { name: "tele", type: "string" },
  ];

  // 3. Create FeatureLayer
  generalHospitalsFeatureLayer = new FeatureLayer({
    geometryType: "point",
    source: generalHospitalsGraphics.map((g, idx) => {
      g.attributes = { ...g.attributes, ObjectId: idx + 1 };
      return g;
    }),
    objectIdField: "generalHospitals",
    fields: generalHospitalsFields,
    popupTemplate: {
      title: "{NAME}",
      content: `
      <ul>
        <li><b>Beds open:</b> {beds}</li>
        <li><b>Burn capability:</b> {capability}%</li>
        <li><b>Pediatric unit:</b> {peds}</li>
        <li><b>Tele‑burn enabled:</b> {tele}</li>
      </ul>`,
    },
    renderer: {
      label: "General Hospitals",
      type: "simple",
      symbol: {
        type: "simple-marker",
        style: "cross",
        color: [246, 255, 0, 0.5], // yellow
        size: 6,
        outline: {
          color: [140, 85, 13, 0.7],
          width: 2,
        },
      },
    },
  });
  generalHospitalsFeatureLayer.visible = false;
  legend.layerInfos.push({
    layer: generalHospitalsFeatureLayer,
  });
  // layerConfigs[2].layers.push(generalHospitalsFeatureLayer);
  map.add(generalHospitalsFeatureLayer);
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

// Add Back to Landing Page functionality
function addBackToLandingActionBtn() {
  const actionBar = document.getElementById("burn-surge-ops-action-bar");
  const backToLandingActionButton = document.createElement("calcite-action");
  backToLandingActionButton.id = "back-to-landing-action-btn";
  backToLandingActionButton.icon = "arrow-left";
  backToLandingActionButton.text = "Back to Landing";
  backToLandingActionButton.textEnabled = true;
  backToLandingActionButton.onclick = () => goBackToLanding();
  actionBar.appendChild(backToLandingActionButton);
}

function goBackToLanding() {
  // Clear any existing popovers
  const popovers = document.getElementsByClassName("burn-surge-ops-popover");
  for (const popover of popovers) {
    popover.remove();
  }

  // Clear any existing alerts
  const alerts = document.querySelectorAll("calcite-alert");
  for (const alert of alerts) {
    alert.remove();
  }

  // Clear any existing tables
  const tables = document.querySelectorAll("table");
  for (const table of tables) {
    table.remove();
  }

  // Reset global variables
  window.selectedIncident = null;
  HOSPITALS_ARE_SELECTED = true;
  RESULTS_HAVE_LOADED = false;
  RESULTS_IS_LOADING = false;

  // Reset hospital selections
  hospitals.forEach((hospital) => (hospitalSelections[hospital.name] = true));
  filteredHospitals = [];

  // Clear route layer
  if (routeLayer) {
    routeLayer.removeAll();
  }

  // Hide dashboard and show landing page
  const dashboardContainer = document.getElementById("dashboard-container");
  const landingPage = document.getElementById("landing-page");

  dashboardContainer.classList.remove("active");
  landingPage.style.display = "flex";

  // Force a page reload to properly reset the landing page
  window.location.reload();
}

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
  layerConfigs = [
    {
      name: "Incident Layer",
      layers: [incidentLayer, incidentFeatureLayer],
      id: "incident-layer",
      description: "Flashing incident location",
    },
    {
      name: "Service Area",
      layers: [serviceAreaLayer, serviceAreaFeatureLayer],
      id: "service-area-layer",
      description: "Drive time service areas",
    },
    {
      name: "General Hospitals",
      layers: [generalHospitalsLayer, generalHospitalsFeatureLayer],
      id: "general-hospitals-layer",
      description: "General hospitals in service area",
    },
    {
      name: "Burn Resource Centers",
      layers: [brcLayer, brcFeatureLayer],
      id: "brc-layer",
      description: "Burn Resource Centers (blue crosses)",
    },
    {
      name: "Burn Centers",
      layers: [sbcLayer, sbcFeatureLayer],
      id: "sbc-layer",
      description: "Specialized Burn Centers (cyan crosses)",
    },
    {
      name: "Routes",
      layers: [routeLayer, routeFeatureLayer],
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
    layerSwitch.checked = config.layers[0].visible;
    layerSwitch.addEventListener("calciteSwitchChange", () => {
      // `forEach` needs a *block* body ({}), not an expression wrapped in ()
      config.layers.forEach((layer) => {
        {
          if (layer !== brcFeatureLayer || layer !== sbcFeatureLayer || layer !== generalHospitalsFeatureLayer){
            layer.visible = layerSwitch.checked;
          }
        }
      });
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
    config.layers.forEach((layer) => {
      layer.visible = true;
    });
    const switchElement = document.getElementById(config.id);
    if (switchElement) switchElement.checked = true;
  });
};

const hideAllBtn = document.createElement("calcite-button");
hideAllBtn.innerHTML = "Hide All";
hideAllBtn.width = "half";
hideAllBtn.onclick = () => {
  layerConfigs.forEach((config) => {
    config.layers.forEach((layer) => { layer.visible = false; });
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
            const r = routeByDest[h.name]; // need to parse the whole route object
            return {
              dest: h,
              minutes: r.minutes,
              score: computeScore({ minutes: r.minutes, dest: h, patient: p }),
            };
          })
          .sort((a, b) => a.score - b.score);

        console.log(scored[0]);

        return {
          patientId: p.uid,
          severity: p.priority,
          patient: p,
          bestDest: scored[0].dest.name,
          minutes: scored[0].minutes,
          score: scored[0].score,
        };
      });

      console.log("Inside Generate Report Button Func", assignments);

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

// Add back button last so it appears at the bottom of the action bar
addBackToLandingActionBtn();

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

    console.log("Patients");
    console.log(patients);
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

    console.log("Inside Run Function");
    console.table(assignments);

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

  const RANK_COLORS = ["#4ADE80", "#FACC15", "#F87171"];
  // 3. Draw
  ranked.forEach(({ dest, route }, idx) => {
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
        RANK_COLORS[idx] // scoreVal < 1000 ? "#30B37E" : scoreVal < 5000 ? "#EFB95B" : "#E54C4C"
      ), // any RGBA → last value is 55 % opacity
      attributes: {
        destName: dest.name,
        minutes: route.minutes.toFixed(1),
        score: scoreVal.toFixed(1),
        patientId: row.patientId,
        patientTbsa: row.patient.tbsa,
        patientInhalation: row.patient.inhalation,
        patientPriority: row.patient.priority,
        patientEbd: row.patient.expectedBedDays,
        patientBurnType: row.patient.burnType,
        rank: idx + 1, // <-- Add rank attribute (1, 2, 3)
      },
      popupTemplate: {
        title: "{destName}",
        content: `
            Patient: <b>{patientId}</b><br>
            Travel time: <b>{minutes} min</b><br>
            Score: <b>{score}</b><br>
            TBSA: <b>{patientTbsa}</b><br>
            Inhalation: <b>{patientInhalation}</b><br>
            Priority: <b>{patientPriority}</b><br>
            Expected Bed Days: <b>{patientEbd}</b><br>
            Burn Type: <b>{patientBurnType}</b>`,
      },
    });
  });

  // 1. Extract graphics from routeLayer
  const routeGraphics = routeLayer.graphics.toArray
    ? routeLayer.graphics.toArray()
    : routeLayer.graphics;

  // 2. Define fields for FeatureLayer
  const routeFields = [
    { name: "ObjectId", type: "oid" },
    { name: "destName", type: "string" },
    { name: "minutes", type: "double" },
    { name: "score", type: "double" },
    { name: "patientId", type: "string" },
    { name: "patientTbsa", type: "string" },
    { name: "patientInhalation", type: "string" },
    { name: "patientPriority", type: "string" },
    { name: "patientEbd", type: "string" },
    { name: "patientBurnType", type: "string" },
  ];

  // 3. Create FeatureLayer
  routeFeatureLayer = new FeatureLayer({
    geometryType: "polyline",
    source: routeGraphics.map((g, idx) => {
      g.attributes = { ...g.attributes, ObjectId: idx + 1 };
      return g;
    }),
    objectIdField: "routes",
    fields: routeFields,
    popupTemplate: {
      title: "{destName}",
      content: `
      <ul>
        <li><b>Patient:</b> {patientId}</li>
        <li><b>Travel time:</b> {minutes} min</li>
        <li><b>Score:</b> {score}</li>
        <li><b>TBSA:</b> {patientTbsa}</li>
        <li><b>Inhalation:</b> {patientInhalation}</li>
        <li><b>Priority:</b> {patientPriority}</li>
        <li><b>Expected Bed Days:</b> {patientEbd}</li>
        <li><b>Burn Type:</b> {patientBurnType}</li>
      </ul>`,
    },
    renderer: {
      type: "unique-value",
      field: "rank",
      uniqueValueInfos: [
        {
          value: 1,
          label: "Best Route",
          symbol: {
            type: "simple-line",
            style: "solid",
            color: [74, 222, 128, 1], // #4ADE80 green
            width: 4,
          },
        },
        {
          value: 2,
          label: "Second Best",
          symbol: {
            type: "simple-line",
            style: "solid",
            color: [250, 204, 21, 1], // #FACC15 yellow
            width: 4,
          },
        },
        {
          value: 3,
          label: "Third Best",
          symbol: {
            type: "simple-line",
            style: "solid",
            color: [248, 113, 113, 1], // #F87171 red
            width: 4,
          },
        },
      ],
    },
  });

  // Add to map and legend if needed
  map.add(routeFeatureLayer);
  legend.layerInfos = legend.layerInfos.filter(
    (info) => info.title !== "Routes"
  );
  legend.layerInfos.push({
    layer: routeFeatureLayer,
    title: "Routes",
  });

  map.reorder(routeLayer, map.layers.length - 1);
  map.reorder(sbcLayer, map.layers.length - 1);
  map.reorder(brcLayer, map.layers.length - 1);
  map.reorder(incidentLayer, map.layers.length - 1);

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
