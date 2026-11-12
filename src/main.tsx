import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary, FatalScreen, hasWebGL } from './ui/ErrorBoundary';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {hasWebGL() ? (
        <App />
      ) : (
        <FatalScreen
          title="3D not supported"
          body="Candy Sort 3D needs WebGL. Please enable hardware acceleration or try a recent version of Chrome, Safari, Firefox or Edge."
        />
      )}
    </ErrorBoundary>
  </React.StrictMode>,
);

// Dev-only hook for automated browser checks.
if (import.meta.env.DEV) {
  void Promise.all([import('./store/gameStore'), import('./store/progressStore'), import('./store/uiStore')]).then(([g, p, u]) => {
    (window as unknown as Record<string, unknown>).__candy = { game: g.useGame, progress: p.useProgress, ui: u.useUi };
  });
}
