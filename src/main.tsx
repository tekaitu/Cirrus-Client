import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initTheme } from "./core/theme";
import { initWindowFrame } from "./core/windowFrame";
import "./styles/legacy.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/pages.css";
import "./styles/effects.css";
import "./styles/studio.css";
import "./styles/ui.css";
import "./styles/classic.css";

initTheme();
initWindowFrame();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
