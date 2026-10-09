import { useEffect } from 'react';
import { Button, notification } from 'antd';
import { useRegisterSW } from 'virtual:pwa-register/react';

const KEY = 'sw-update';
const HOUR = 60 * 60 * 1000;

const reload = () => window.location.reload();

// Registers the offline service worker (src/service-worker.js; production builds
// only, `pnpm dev` gets a no-op) and offers a reload once a new build has been
// downloaded. The diagram autosaves on every change, so reloading loses nothing.
const UpdatePrompt = () => {
  const [api, contextHolder] = notification.useNotification();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // The effect below reloads instead. vite-plugin-pwa only reloads a tab that
    // was already controlled by a worker when it registered, so a tab opened on
    // a first visit would miss the update it was offered.
    onNeedReload() {},
  });

  // Browsers look for a new worker when a page is opened. A tab left open for
  // days should still notice new deploys. (Offline, update() just fails.)
  useEffect(() => {
    const check = () =>
      navigator.serviceWorker
        ?.getRegistration()
        .then((registration) => registration?.update())
        .catch(() => {});
    const timer = setInterval(check, HOUR);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!needRefresh) return;
    const { serviceWorker } = navigator;
    // The new worker takes over every open tab at once, whichever tab's Reload
    // button activated it, so every tab that was offered the update reloads.
    serviceWorker.addEventListener('controllerchange', reload);
    const onClick = async () => {
      const registration = await serviceWorker.getRegistration();
      if (registration?.waiting) updateServiceWorker(); // controllerchange follows
      else reload(); // another tab has already switched to the new build
    };
    api.info({
      key: KEY,
      title: 'Update available',
      description: 'A new version of Wireflow is ready.',
      actions: (
        <Button type='primary' size='small' onClick={onClick}>
          Reload
        </Button>
      ),
      duration: false,
      placement: 'bottomRight',
    });
    return () => serviceWorker.removeEventListener('controllerchange', reload);
  }, [needRefresh, api, updateServiceWorker]);

  return contextHolder;
};

export default UpdatePrompt;
