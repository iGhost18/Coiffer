import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { BrowserRouter } from 'react-router-dom';
import { AuthContextProvider } from './components/context/AuthContext';
import { StaffAuthContextProvider } from "./components/context/StaffAuthContext";
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});


const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <StaffAuthContextProvider>
        <AuthContextProvider>
          <App />
        </AuthContextProvider>
      </StaffAuthContextProvider>
    </BrowserRouter>
  </React.StrictMode>
);