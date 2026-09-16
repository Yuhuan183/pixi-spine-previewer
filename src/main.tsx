import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';

async function boot(): Promise<void> {
  // The dev host has to be installed before @/bridge is first evaluated.
  if (import.meta.env.DEV) await (await import('./dev/devHost')).installDevHost();

  const { App } = await import('./App');

  createRoot(document.querySelector('#root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
