import incidents from "./data/incidents.js";

// Global variable to store selected incident
window.selectedIncident = null;

// Initialize the landing page
function initializeLandingPage() {
  const incidentSelect = document.getElementById("incident-select");
  const dashboardBtn = document.getElementById("dashboard-btn");
  const landingPage = document.getElementById("landing-page");
  const dashboardContainer = document.getElementById("dashboard-container");

  // Populate incident dropdown
  incidents.forEach((incident, index) => {
    const option = document.createElement("calcite-option");
    option.value = index.toString();
    option.textContent = incident.name;
    incidentSelect.appendChild(option);
  });

  // Set first incident as default selection
  if (incidents.length > 0) {
    incidentSelect.value = "0";
    window.selectedIncident = incidents[0];
    dashboardBtn.disabled = false;
  }

  // Handle incident selection
  incidentSelect.addEventListener("calciteSelectChange", (event) => {
    const selectedIndex = parseInt(event.target.value);
    if (selectedIndex >= 0 && selectedIndex < incidents.length) {
      window.selectedIncident = incidents[selectedIndex];
      dashboardBtn.disabled = false;
    } else {
      window.selectedIncident = null;
      dashboardBtn.disabled = true;
    }
  });

  // Handle dashboard launch
  dashboardBtn.addEventListener("click", () => {
    if (window.selectedIncident) {
      // Hide landing page and show dashboard
      landingPage.style.display = "none";
      dashboardContainer.classList.add("active");
      
      // Load the main application
      loadDashboard();
    }
  });
}

// Load the dashboard application
async function loadDashboard() {
  try {
    // Dynamically import the main application
    const mainModule = await import("./main.js");
    
    // The main.js will now use window.selectedIncident instead of random selection
    console.log("Dashboard loaded with incident:", window.selectedIncident);
  } catch (error) {
    console.error("Failed to load dashboard:", error);
    alert("Failed to load dashboard. Please refresh the page.");
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initializeLandingPage); 