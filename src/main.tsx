import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Dev-only hook for automated browser checks.
if (import.meta.env.DEV) {
  void Promise.all([import('./store/gameStore'), import('./store/progressStore'), import('./store/uiStore')]).then(([g, p, u]) => {
    (window as unknown as Record<string, unknown>).__candy = { game: g.useGame, progress: p.useProgress, ui: u.useUi };
  });
}
