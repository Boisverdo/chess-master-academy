import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './pwa/update';
import './ui/theme.css';
import './ui/learning.css';
import './ui/analysis.css';
import './ui/mobile.css';

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Application installable et utilisable hors ligne (version de production uniquement).
if (import.meta.env.PROD) window.addEventListener('load', registerServiceWorker);
