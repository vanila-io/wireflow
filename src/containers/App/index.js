import React from 'react';
import Layout from 'antd/es/layout';
import Row from 'antd/es/row';
import Col from 'antd/es/col';
import GGEditor from 'gg-editor';

import 'antd/es/layout/style/css';
import 'antd/es/row/style/css';
import 'antd/es/col/style/css';

import {
  NodeRegisteWithHeader,
  NodeRegisteWithoutHeader,
} from '../register/node';
import FlowToolbar from '../../components/FlowToolbar';
import FlowCanvas from '../../components/FlowCanvas';
import FlowItemPanel from '../../components/FlowItemPanel';
import FlowDetailPanel from '../../components/FlowDetailPanel';
import FlowMiniMap from '../../components/FlowMiniMap';
import ExportCanvas from '../../components/ExportCanvas';
import { saveData } from '../../utils/saveData';

GGEditor.setTrackable(false);

let counter = 0;

const App = () => {
  function onBeforeCommandExecute(ev) {
    const { command } = ev;

    if (command.name !== 'add') return;

    const { addModel, type } = command;

    if (type === 'node') {
      addModel.shape = 'node-image-header';
    }

    if (type === 'edge') {
      addModel.shape = 'flow-polyline-round';
      addModel.color = '#a4b2c0';
      addModel.style = { lineWidth: 2 };
    }
  }

  function onAfterCommandExecute(ev) {
    if (!['toFront', 'toBack'].includes(ev.command.name)) return;

    // this event is triggered twice for every `toBack` or `toFront`
    // first time with outdated snapshot and second time with updated snapshot.
    // there's no way to tell them apart

    // if we setData with the outdated snapshot, it doesn't trigger the second time
    // and we don't get the updated snapshot

    // so using a dirty trick here
    if (counter % 2 === 1) saveData(ev.command.snapShot);
    counter += 1;
  }

  return (
    <Layout>
      <GGEditor
        onAfterCommandExecute={onAfterCommandExecute}
        onBeforeCommandExecute={onBeforeCommandExecute}
      >
        <FlowItemPanel />
        <Row style={{ marginLeft: 112 }}>
          <Col span={19} className='text-center'>
            <ExportCanvas />
            <FlowToolbar />
            <FlowCanvas />
          </Col>
          <Col span={5}>
            <FlowDetailPanel />
            <FlowMiniMap />
          </Col>
        </Row>
        <NodeRegisteWithHeader />
        <NodeRegisteWithoutHeader />
      </GGEditor>
    </Layout>
  );
};

export default App;
