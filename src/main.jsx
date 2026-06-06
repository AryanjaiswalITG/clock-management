import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { SettingsProvider } from "./settings/SettingsContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        {/* basename = Vite base ("/clock-management/") so routes resolve under
            the GitHub Pages subpath instead of the domain root. */}
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </SettingsProvider>
    </ThemeProvider>
  </React.StrictMode>
);
