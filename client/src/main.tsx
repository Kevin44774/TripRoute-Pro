// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import "leaflet/dist/leaflet.css";

import App from "./App";

// // ✅ Fix Leaflet marker icon URLs for bundlers (Vite/Webpack)
// import L from "leaflet";
// import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
// import markerIconUrl from "leaflet/dist/images/marker-icon.png";
// import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

// (L.Icon.Default as any).mergeOptions({
//   iconRetinaUrl: markerIcon2xUrl,
//   iconUrl: markerIconUrl,
//   shadowUrl: markerShadowUrl,
// });

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
