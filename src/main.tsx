import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { db } from './db';
import { ensureSeed } from './seed';
import './styles.css';

registerSW({ immediate: true });

// Den Browser bitten, die Daten dauerhaft zu behalten (nicht automatisch aufräumen).
navigator.storage?.persist?.().catch(() => {});

async function start() {
  try {
    await db.open();
    await ensureSeed();
  } catch (e) {
    console.error(e);
    document.getElementById('root')!.innerHTML =
      '<p style="padding:2rem;font-family:sans-serif">Die lokale Datenbank konnte nicht geöffnet werden. Bitte nicht im privaten Fenster öffnen.</p>';
    return;
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  );
}
start();
