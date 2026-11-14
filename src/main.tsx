import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { migrateStorage } from './services/storageMigration';
import { logFeatureGateStatus, getEdition } from './features';

// Run storage migration on app startup
migrateStorage();

if (import.meta.env.DEV) {
  logFeatureGateStatus();
  if (typeof window !== 'undefined') {
    (window as any).__ASTRALYR_LOG_FEATURES__ = logFeatureGateStatus;
    (window as any).__ASTRALYR_GET_EDITION__ = getEdition;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

