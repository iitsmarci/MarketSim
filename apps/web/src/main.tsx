import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@marketsim/ui/styles.css';
import './styles.css';
import { App } from './App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('MarketSim root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration failed: ', err);
    });
  });
}
