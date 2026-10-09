import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

import App from './containers/App';
import 'antd/dist/reset.css';
import './index.css';

// Proof of concept for #60: `?engine=rf` opens the editor built on React Flow. It is
// loaded on demand, so the default (gg-editor) bundle doesn't grow.
const ReactFlowApp = lazy(() => import('./rf/App'));
const engine = new URLSearchParams(window.location.search).get('engine');

// ponytail: no <StrictMode> for the gg-editor app. Its dev-only mount -> unmount -> remount check makes
// gg-editor 2.x destroy its editor in componentWillUnmount and then reuse the dead
// instance, so `pnpm dev` white-screens (getMatrix of undefined). Production builds
// were unaffected. The React Flow editor runs under StrictMode.
createRoot(document.getElementById('root')).render(
  engine === 'rf' ? (
    <StrictMode>
      <Suspense fallback={null}>
        <ReactFlowApp />
      </Suspense>
    </StrictMode>
  ) : (
    <App />
  ),
);
