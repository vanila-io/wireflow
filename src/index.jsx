import { createRoot } from 'react-dom/client';

import App from './containers/App';
import 'antd/dist/reset.css';
import './index.css';

// ponytail: no <StrictMode>. Its dev-only mount -> unmount -> remount check makes
// gg-editor 2.x destroy its editor in componentWillUnmount and then reuse the dead
// instance, so `pnpm dev` white-screens (getMatrix of undefined). Production builds
// were unaffected. Re-add StrictMode if the diagram engine is ever replaced.
createRoot(document.getElementById('root')).render(<App />);
