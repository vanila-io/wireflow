import { useState } from 'react';
import { FloatButton } from 'antd';
import { RobotOutlined } from '@ant-design/icons';

const LOAD_FAILED = "Couldn't load the AI assistant. Check the connection and try again.";

// Renders in the canvas column, inside <GGEditor> so the panel can reach the editor's
// propsAPI. The panel (and the provider SDK it pulls in) loads on first open only; a
// failed load (offline, or a newer version was deployed) leaves the editor running.
const AiChat = () => {
  const [open, setOpen] = useState(false);
  const [Panel, setPanel] = useState(null);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    if (Panel) {
      setOpen((o) => !o);
      return;
    }
    try {
      const { default: AiPanel } = await import('./AiPanel');
      setPanel(() => AiPanel);
      setFailed(false);
      setOpen(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <FloatButton
        className='ai-toggle'
        type='primary'
        icon={<RobotOutlined />}
        tooltip={failed ? LOAD_FAILED : 'AI assistant'}
        aria-label={failed ? LOAD_FAILED : 'AI assistant'}
        // Bottom-right corner of the canvas column (its positioned ancestor).
        style={{ position: 'absolute', insetInlineEnd: 24, insetBlockEnd: 24 }}
        onClick={toggle}
      />
      {Panel && <Panel open={open} onClose={() => setOpen(false)} />}
    </>
  );
};

export default AiChat;
