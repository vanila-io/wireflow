import { useEffect } from 'react';
import { Button, notification } from 'antd';
import { useRegisterSW } from 'virtual:pwa-register/react';

const KEY = 'sw-update';
const HOUR = 60 * 60 * 1000;

// Registers the offline service worker (src/service-worker.js; production builds
// only, `pnpm dev` gets a no-op) and offers a reload once a new build has been
// downloaded. The diagram autosaves on every change, so reloading loses nothing.
const UpdatePrompt = () => {
  const [api, contextHolder] = notification.useNotification();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Browsers only look for a new worker on navigation; a tab left open for
    // days should still notice new deploys.
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update().catch(() => {}), HOUR);
    },
    // reload() below reloads instead: workbox-window only reports the controller
    // change for an update it saw start, not for one found later (hourly check).
    onNeedReload() {},
  });

  useEffect(() => {
    if (!needRefresh) return;
    const reload = () => {
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
      updateServiceWorker(); // tells the waiting worker to take over
    };
    api.info({
      key: KEY,
      title: 'Update available',
      description: 'A new version of Wireflow is ready.',
      actions: (
        <Button type='primary' size='small' onClick={reload}>
          Reload
        </Button>
      ),
      duration: false,
      placement: 'bottomRight',
    });
  }, [needRefresh, api, updateServiceWorker]);

  return contextHolder;
};

export default UpdatePrompt;
