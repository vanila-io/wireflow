import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Button, Card, Col, Divider, Input, Layout, Row, Switch, Tooltip } from 'antd';
import { ConnectionMode, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { toJpeg } from 'html-to-image';
import '@xyflow/react/dist/style.css';

import IconFont from '../components/IconFont';
import '../components/FlowToolbar/style.css';
import '../components/ExportCanvas/style.css';
import '../components/FlowDetailPanel/style.css';
import { saveData } from '../utils/saveData';
import { HEADER_SHAPE, NODE_SIZE, PLAIN_SHAPE } from './convert';
import { applyActions } from './ops';
import { createDiagramStore } from './store';
import { currentTemplateUrl } from './templateUrl';
import { nodeTypes } from './nodes';
import Sidebar from './Sidebar';
import './style.css';

function readSavedDiagram() {
  try {
    return JSON.parse(localStorage.getItem('data'));
  } catch {
    return null;
  }
}

const isTyping = (target) => target.closest?.('input, textarea, [contenteditable="true"]');

function ToolbarButton({ name, icon, text, onClick, disabled, active }) {
  return (
    <Tooltip title={text} placement='bottom'>
      <button
        type='button'
        className={`command rf-command${disabled ? ' disable' : ''}${active ? ' rf-command--active' : ''}`}
        data-command={name}
        aria-label={text}
        disabled={disabled}
        onClick={onClick}
      >
        <IconFont type={`icon-${icon ?? name}`} />
      </button>
    </Tooltip>
  );
}

function Details({ store, state }) {
  const selected = [...state.nodes, ...state.edges].filter((item) => item.selected);
  const [item] = selected;
  let title = 'Canvas';
  if (selected.length > 1) title = 'Multi Select';
  else if (item) title = item.type === 'screen' ? 'Node' : item.type === 'group' ? 'Group' : 'Edge';

  const update = (model) => store.apply((doc) => applyActions(doc, [{ kind: 'update', id: item.id, model }]), [item.id]);

  return (
    <Card type='inner' size='small' title={title} className='details__card rf-details' variant='borderless'>
      {selected.length === 1 && (
        <>
          <label className='rf-details__row'>
            <span>Label</span>
            <Input
              key={item.id}
              name='label'
              size='small'
              defaultValue={item.data?.label ?? ''}
              onBlur={(e) => e.target.value !== (item.data?.label ?? '') && update({ label: e.target.value })}
              onPressEnter={(e) => e.currentTarget.blur()}
            />
          </label>
          {item.type === 'screen' && (
            <label className='rf-details__row'>
              <span>Header</span>
              <Switch
                size='small'
                checked={item.data.header}
                onChange={(header) => {
                  const shape = header ? HEADER_SHAPE : PLAIN_SHAPE;
                  update({ shape, size: NODE_SIZE[shape] });
                }}
              />
            </label>
          )}
        </>
      )}
      <p className='rf-details__note'>
        React Flow preview (<code>?engine=rf</code>). It edits the same saved diagram as the current editor.{' '}
        <a href='?engine=gg'>Back to the current editor</a>
      </p>
      {state.dropped.length > 0 && (
        <p className='rf-details__note'>
          {state.dropped.length} edge(s) with a loose end were not loaded and are removed on the next change.
        </p>
      )}
    </Card>
  );
}

function Editor() {
  const [store] = useState(() => createDiagramStore({ doc: readSavedDiagram(), img: currentTemplateUrl, save: (json) => saveData(JSON.parse(json)) }));
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [selectMode, setSelectMode] = useState(false);
  const flow = useReactFlow();

  // Highlight the group a dragged item would be dropped into (#81).
  const nodes = useMemo(
    () => (state.dropTarget ? state.nodes.map((n) => (n.id === state.dropTarget ? { ...n, className: 'rf-drop-target' } : n)) : state.nodes),
    [state.nodes, state.dropTarget],
  );

  const onTemplateDrop = useCallback(
    (template, point) => {
      if (!document.elementFromPoint(point.x, point.y)?.closest('.rf-canvas .react-flow')) return;
      store.addScreen(template, flow.screenToFlowPosition(point));
    },
    [store, flow],
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTyping(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.key === 'Delete' || event.key === 'Backspace') store.remove();
      else if (mod && key === 'z' && !event.shiftKey) store.undo();
      else if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) store.redo();
      else if (mod && key === 'c') store.copy();
      else if (mod && key === 'v') store.paste();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  // Export the whole diagram, not just the visible part, at zoom 1 and twice the pixel
  // density, independent of the current viewport (#68).
  const exportImage = async () => {
    if (state.nodes.length === 0) return;
    const padding = 40;
    const bounds = flow.getNodesBounds(state.nodes);
    const width = Math.ceil(bounds.width + padding * 2);
    const height = Math.ceil(bounds.height + padding * 2);
    const dataUrl = await toJpeg(document.querySelector('.rf-canvas .react-flow__viewport'), {
      backgroundColor: '#f0f2f5',
      quality: 0.95,
      pixelRatio: 2,
      width,
      height,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${padding - bounds.x}px, ${padding - bounds.y}px) scale(1)` },
    });
    const link = document.createElement('a');
    link.download = 'wireflow.jpg';
    link.href = dataUrl;
    link.click();
  };

  const selected = [...state.nodes, ...state.edges].filter((item) => item.selected);
  const selectedNodes = state.nodes.filter((node) => node.selected);

  return (
    <Layout>
      <Sidebar onDrop={onTemplateDrop} />
      <Row style={{ marginLeft: 112 }}>
        <Col span={19} className='text-center rf-canvas'>
          <div className='export'>
            <Button onClick={exportImage} type='dashed' size='large' shape='circle' aria-label='Export as JPEG' icon={<IconFont type='icon-upload-demo' />} />
          </div>
          <ReactFlow
            nodes={nodes}
            edges={state.edges}
            nodeTypes={nodeTypes}
            onNodesChange={store.onNodesChange}
            onEdgesChange={store.onEdgesChange}
            onConnect={store.onConnect}
            isValidConnection={(connection) => connection.source !== connection.target}
            // Any handle can start or end an edge, like gg-editor's anchors.
            connectionMode={ConnectionMode.Loose}
            // gg-editor opens at zoom 1 with the canvas origin at the top-left.
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            // Deleting goes through the store so a group is removed with its contents.
            deleteKeyCode={null}
            selectionOnDrag={selectMode}
            panOnDrag={!selectMode}
          />
          <div className='toolbar'>
            <ToolbarButton name='undo' text='Undo' onClick={store.undo} disabled={!state.canUndo} />
            <ToolbarButton name='redo' text='Redo' onClick={store.redo} disabled={!state.canRedo} />
            <Divider orientation='vertical' />
            <ToolbarButton name='copy' text='Copy' onClick={store.copy} disabled={selectedNodes.length === 0} />
            <ToolbarButton name='paste' text='Paste' onClick={store.paste} />
            <ToolbarButton name='delete' text='Delete' onClick={store.remove} disabled={selected.length === 0} />
            <Divider orientation='vertical' />
            <ToolbarButton name='zoomIn' icon='zoomin' text='Zoom In' onClick={() => flow.zoomIn()} />
            <ToolbarButton name='zoomOut' icon='zoomout' text='Zoom Out' onClick={() => flow.zoomOut()} />
            <ToolbarButton name='autoZoom' icon='fit-map' text='Fit Map' onClick={() => flow.fitView({ padding: 0.1 })} />
            <ToolbarButton name='resetZoom' icon='actual-size' text='Actual Size' onClick={() => flow.zoomTo(1)} />
            <Divider orientation='vertical' />
            <ToolbarButton name='multiSelect' icon='multi-select' text='Multi Select (drag a box)' onClick={() => setSelectMode((on) => !on)} active={selectMode} />
            <ToolbarButton name='addGroup' icon='-group' text='Add Group' onClick={store.group} disabled={selectedNodes.length < 2} />
            <ToolbarButton
              name='unGroup'
              icon='ungroup'
              text='Ungroup'
              onClick={store.ungroup}
              disabled={!(selectedNodes.length === 1 && selectedNodes[0].type === 'group')}
            />
          </div>
        </Col>
        <Col span={5}>
          <div className='details'>
            <Details store={store} state={state} />
          </div>
          <Card type='inner' size='small' title='Minimap' variant='borderless'>
            <MiniMap className='rf-minimap' pannable zoomable nodeColor='#ced4d9' nodeStrokeColor='#a3b1bf' />
          </Card>
        </Col>
      </Row>
    </Layout>
  );
}

export default function ReactFlowApp() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
