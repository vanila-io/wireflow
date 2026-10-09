import { lazy, Suspense, useState } from 'react';
import { FloatButton } from 'antd';
import { RobotOutlined } from '@ant-design/icons';

// The panel (and the provider SDK it pulls in) loads on first open only.
const AiPanel = lazy(() => import('./AiPanel'));

// Must render inside <GGEditor> so the panel can reach the editor's propsAPI.
const AiChat = () => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <FloatButton
        className='ai-toggle'
        type='primary'
        icon={<RobotOutlined />}
        tooltip='AI assistant'
        aria-label='AI assistant'
        // Bottom-right corner of the canvas column, clear of the minimap.
        style={{ insetInlineEnd: 'calc((100vw - 112px) * 5 / 24 + 24px)', insetBlockEnd: 24 }}
        onClick={() => {
          setLoaded(true);
          setOpen((o) => !o);
        }}
      />
      {loaded && (
        <Suspense fallback={null}>
          <AiPanel open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
};

export default AiChat;
