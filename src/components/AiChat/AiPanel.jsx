import { useEffect, useMemo, useRef, useState } from 'react';
import { withPropsAPI } from 'gg-editor';
import { Alert, Button, Checkbox, Drawer, Input, Select, Space, Typography } from 'antd';

import { providers, getProvider } from '../../ai/providers';
import { runRequest, TOOLS } from '../../ai/agent';
import { applyActions } from '../../ai/diagram';
import { systemPrompt } from '../../ai/prompt';
import { normalize, saveData } from '../../utils/saveData';
import './style.css';

const SETTINGS = 'wireflow-ai';
const PANEL_WIDTH = 420;

// Remembered settings live in this browser only. The key is stored only when the
// user ticks "Remember on this device".
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS)) ?? {};
  } catch {
    return {};
  }
}
function storeSettings(settings) {
  try {
    localStorage.setItem(SETTINGS, JSON.stringify(settings));
  } catch {
    // storage blocked: settings just won't persist
  }
}

const money = (usd) => `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(3)}`;
const maskKey = (key) => `${key.slice(0, 7)}…${key.slice(-4)}`;

const STATUS_NOTE = {
  refused: 'The model declined this request.',
  truncated: 'The response was cut off; nothing more was applied.',
  step_limit: 'Stopped after too many steps.',
};

// The part of the canvas the user can see, in canvas coordinates: the canvas minus
// what the open panel covers. Sent to the model so it places screens in view.
function visibleArea(graph) {
  const box = graph.getGraphContainer().getBoundingClientRect();
  const from = graph.getPointByClient({ x: box.left, y: box.top });
  const to = graph.getPointByClient({
    x: Math.max(box.left, Math.min(box.right, window.innerWidth - PANEL_WIDTH)),
    y: Math.max(box.top, Math.min(box.bottom, window.innerHeight)),
  });
  return { x: Math.round(from.x), y: Math.round(from.y), width: Math.round(to.x - from.x), height: Math.round(to.y - from.y) };
}

let nextId = 0;

const AiPanel = ({ open, onClose, propsAPI }) => {
  const saved = useMemo(loadSettings, []);
  const [providerId, setProviderId] = useState(saved.provider ?? providers[0].id);
  const provider = getProvider(providerId);
  const [model, setModel] = useState(
    provider.models.some((m) => m.id === saved.model) ? saved.model : provider.defaultModel,
  );
  const [apiKey, setApiKey] = useState(saved.apiKey ?? null);
  const [keyDraft, setKeyDraft] = useState('');
  const [remember, setRemember] = useState(!!saved.apiKey);
  const [keyError, setKeyError] = useState(null);
  const [checkingKey, setCheckingKey] = useState(false);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);

  const chat = useRef(null);
  const abort = useRef(null);
  const listEnd = useRef(null);
  const composer = useRef(null);

  useEffect(() => {
    // Braces matter: newer browsers return a Promise here, which React would take as a cleanup.
    listEnd.current?.scrollIntoView({ block: 'end' });
  }, [messages]);
  useEffect(() => {
    if (open && apiKey) composer.current?.focus();
  }, [open, apiKey]);

  const persist = (patch) => {
    const next = { provider: providerId, model, ...(remember && apiKey ? { apiKey } : {}), ...patch };
    storeSettings(next);
  };

  const newChat = () => {
    abort.current?.abort();
    chat.current = null;
    setMessages([]);
  };

  // The editor as the agent sees it: read the live diagram, apply a plan as one undo step.
  const editor = {
    read: () => ({
      data: normalize(propsAPI.save()),
      selected: propsAPI.getSelected().map((item) => item.id),
      view: visibleArea(propsAPI.currentPage.getGraph()),
    }),
    // The command saves the diagram itself, so a redo of it is saved as well.
    apply: (actions) => applyActions(propsAPI, actions, saveData),
  };

  const update = (id, fn) => setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    setBusy(true);

    const id = ++nextId;
    setMessages((ms) => [...ms, { id: `u${id}`, role: 'user', text }, { id, role: 'assistant', text: '', thinking: '', applied: [], status: 'streaming' }]);

    chat.current ??= provider.createChat({ apiKey, model, system: systemPrompt(), tools: TOOLS });
    const controller = new AbortController();
    abort.current = controller;
    let gap = false; // separate text from consecutive steps

    try {
      const result = await runRequest({
        chat: chat.current,
        text,
        editor,
        signal: controller.signal,
        onEvent: (e) => {
          if (e.type === 'step' && e.step > 0) gap = true;
          if (e.type === 'text') {
            const sep = gap ? '\n\n' : '';
            gap = false;
            update(id, (m) => ({ ...m, text: m.text ? m.text + sep + e.delta : e.delta }));
          }
          if (e.type === 'thinking') update(id, (m) => ({ ...m, thinking: m.thinking + e.delta }));
          if (e.type === 'applied') {
            const command = propsAPI.editor.getCurrentCommand();
            update(id, (m) => ({ ...m, applied: [...m.applied, { count: e.count, summary: e.summary, command, undone: false }] }));
          }
          if (e.type === 'tool_error') update(id, (m) => ({ ...m, retries: (m.retries ?? 0) + 1 }));
        },
      });
      update(id, (m) => ({ ...m, status: result.status, cost: result.usage.usd }));
      setSessionCost((c) => c + result.usage.usd);
    } catch (err) {
      update(id, (m) => ({ ...m, status: err.kind === 'aborted' ? 'aborted' : 'error', error: err.message, errorKind: err.kind }));
      if (err.kind !== 'aborted') console.warn('[ai]', err.cause ?? err);
    } finally {
      abort.current = null;
      setBusy(false);
    }
  }

  function undo(messageId, index) {
    const msg = messages.find((m) => m.id === messageId);
    const entry = msg.applied[index];
    // Only undo while this AI change is still the latest command; otherwise it
    // would undo something the user did afterwards.
    if (propsAPI.editor.getCurrentCommand() !== entry.command) return;
    propsAPI.executeCommand('undo');
    update(messageId, (m) => ({ ...m, applied: m.applied.map((a, i) => (i === index ? { ...a, undone: true } : a)) }));
  }

  async function saveKey() {
    const key = keyDraft.trim();
    if (!key) return;
    setCheckingKey(true);
    setKeyError(null);
    try {
      await provider.validateKey({ apiKey: key, model });
      setApiKey(key);
      setKeyDraft('');
      chat.current = null;
      storeSettings({ provider: providerId, model, ...(remember ? { apiKey: key } : {}) });
    } catch (err) {
      setKeyError(err.message);
    } finally {
      setCheckingKey(false);
    }
  }

  function forgetKey() {
    newChat();
    setApiKey(null);
    storeSettings({ provider: providerId, model });
  }

  const header = (
    <Space size='small'>
      {providers.length > 1 && (
        <Select
          size='small'
          value={providerId}
          options={providers.map((p) => ({ value: p.id, label: p.label }))}
          onChange={(id) => {
            const p = getProvider(id);
            setProviderId(id);
            setModel(p.defaultModel);
            forgetKey();
          }}
        />
      )}
      <Select
        size='small'
        className='ai-model'
        value={model}
        popupMatchSelectWidth={false}
        options={provider.models.map((m) => ({ value: m.id, label: `${m.label}  ($${m.price.input}/$${m.price.output} per MTok)` }))}
        labelRender={({ value }) => provider.models.find((m) => m.id === value)?.label}
        onChange={(m) => {
          setModel(m);
          newChat(); // a conversation stays on one model
          persist({ model: m });
        }}
      />
    </Space>
  );

  return (
    <Drawer
      rootClassName='ai-panel'
      title='AI assistant'
      extra={header}
      placement='right'
      size={PANEL_WIDTH}
      mask={false}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
    >
      {!apiKey ? (
        <div className='ai-key'>
          <Typography.Paragraph>
            Paste a {provider.label} API key. Requests go straight from this browser to {provider.label}; Wireflow has no server.
          </Typography.Paragraph>
          <Input.Password
            placeholder={provider.keyHint}
            autoComplete='off'
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onPressEnter={saveKey}
            aria-label='API key'
          />
          <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
            Remember on this device
          </Checkbox>
          {keyError && <Alert type='error' showIcon title={keyError} />}
          <Button type='primary' loading={checkingKey} disabled={!keyDraft.trim()} onClick={saveKey}>
            Check &amp; use key
          </Button>
          <Typography.Text type='secondary'>
            Tip: use a dedicated key with an expiry and a spend limit.{' '}
            <a href={provider.keyUrl} target='_blank' rel='noreferrer'>
              Create a key
            </a>
          </Typography.Text>
        </div>
      ) : (
        <>
          <div className='ai-messages' aria-live='polite'>
            {!messages.length && (
              <Typography.Text type='secondary' className='ai-empty'>
                Describe a flow to build (&quot;a sign-up flow with email verification&quot;) or a change to make (&quot;rename the selected
                screen to Basket and connect it to Checkout&quot;).
              </Typography.Text>
            )}
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className='ai-msg ai-msg--user'>
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className='ai-msg ai-msg--assistant' data-status={m.status}>
                  {m.thinking && (
                    <details className='ai-thinking'>
                      <summary>Thinking</summary>
                      {m.thinking}
                    </details>
                  )}
                  {m.status === 'streaming' && !m.text && <Typography.Text type='secondary'>Thinking…</Typography.Text>}
                  {m.text && <div className='ai-text'>{m.text}</div>}
                  {m.applied.map((a, i) => (
                    <div key={i} className='ai-applied'>
                      <span>
                        {a.undone ? 'Undone: ' : 'Applied: '}
                        {a.summary || `${a.count} changes`}
                      </span>
                      {!a.undone && (
                        <Button size='small' type='link' onClick={() => undo(m.id, i)} disabled={busy}>
                          Undo
                        </Button>
                      )}
                    </div>
                  ))}
                  {STATUS_NOTE[m.status] && <Alert type='warning' showIcon title={STATUS_NOTE[m.status]} />}
                  {m.status === 'aborted' && <Typography.Text type='secondary'>Stopped.</Typography.Text>}
                  {m.status === 'error' && (
                    <Alert
                      type='error'
                      showIcon
                      title={m.error}
                      action={
                        m.errorKind === 'auth' && (
                          <Button size='small' onClick={forgetKey}>
                            Change key
                          </Button>
                        )
                      }
                    />
                  )}
                  {m.cost !== undefined && <div className='ai-cost'>{money(m.cost)}</div>}
                </div>
              ),
            )}
            <div ref={listEnd} />
          </div>
          <div className='ai-composer'>
            <Input.TextArea
              ref={composer}
              autoSize={{ minRows: 2, maxRows: 8 }}
              placeholder='Ask for a flow or a change…'
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              aria-label='Message'
            />
            {busy ? (
              <Button danger onClick={() => abort.current?.abort()}>
                Stop
              </Button>
            ) : (
              <Button type='primary' onClick={send} disabled={!draft.trim()}>
                Send
              </Button>
            )}
          </div>
          <div className='ai-footer'>
            <span>{money(sessionCost)} this session</span>
            <span>
              {maskKey(apiKey)}{' '}
              <Button size='small' type='link' onClick={forgetKey}>
                Forget key
              </Button>
              <Button size='small' type='link' onClick={newChat} disabled={busy || !messages.length}>
                New chat
              </Button>
            </span>
          </div>
        </>
      )}
    </Drawer>
  );
};

export default withPropsAPI(AiPanel);
