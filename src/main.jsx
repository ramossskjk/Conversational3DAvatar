import React from "react";
import ReactDOM from "react-dom/client";
import App     from "./App.jsx";
import Overlay from "./Overlay.jsx";
import "./styles/globals.css";

const isOverlay = window.location.pathname === "/overlay";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isOverlay ? <Overlay /> : <App />}
  </React.StrictMode>
);

// Suprime warnings de depreciação do three-vrm
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.("THREE.Clock")) return;
  originalWarn(...args);
};