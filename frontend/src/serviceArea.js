import * as serviceArea from "@arcgis/core/rest/serviceArea.js";
import ServiceAreaParams from "@arcgis/core/rest/support/ServiceAreaParameters.js";
import FeatureSet from "@arcgis/core/rest/support/FeatureSet.js";
import Graphic from "@arcgis/core/Graphic.js";

export async function createServiceArea({point, serviceAreaLayer, view, size=0}) {    
    serviceAreaLayer.removeAll();
    
    // Add clicked point as a white marker
    const locationGraphic = new Graphic({
      geometry: point,
      symbol: {
        type: "simple-marker",
        color: "white",
        size: size,
        outline: {
          color: "black",
          width: 0
        }
      }
    });
    serviceAreaLayer.add(locationGraphic);
    
    const driveTimeCutoffs = [10, 20, 30]; // minutes
    const featureSet = new FeatureSet({
      features: [locationGraphic]
    });
    
    const params = new ServiceAreaParams({
      facilities: featureSet,
      defaultBreaks: driveTimeCutoffs,
      trimOuterPolygon: true,
      outSpatialReference: view.spatialReference
    });
    
    const serviceAreaUrl =
      "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea";
    
    try {
      const result = await serviceArea.solve(serviceAreaUrl, params);
      console.log(result.serviceAreaPolygons.features)
      if (result.serviceAreaPolygons?.features?.length) {
        result.serviceAreaPolygons.features.forEach((polygon) => {
        const breakValue = polygon.attributes.ToBreak;
    
        console.log(polygon.attributes)
    
        let fillColor;
        if (breakValue === 10) {
          fillColor = "rgba(5, 255, 5, 0.5)"; // 5 min – green
        } else if (breakValue === 20) {
          fillColor = "rgba(246, 255, 0, 0.5)"; // 10 min – yellow
        } else if (breakValue === 30) {
          fillColor = "rgba(255, 153, 0, 0.5)"; // 15 min – orange
        } else {
          fillColor = "rgba(255, 50, 50, 0.5)";
        }
    
        polygon.symbol = {
          type: "simple-fill",
          color: fillColor,
          outline: {
            color: [0, 0, 0, 0.4],
            width: 1
          }
        };
    
        serviceAreaLayer.add(polygon);
      });
      }
    } catch (err) {
      console.error("Service area error:", err);
    }
}