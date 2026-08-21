import { IncidentRecorderApp } from "./ui/app.js";

window.addEventListener("DOMContentLoaded", () => {
  const app = new IncidentRecorderApp();
  app.init();
  window.IncidentRecorderApp = app;
});
