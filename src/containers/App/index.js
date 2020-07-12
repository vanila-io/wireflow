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

GGEditor.setTrackable(false);

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

  return (
    <Layout>
      <GGEditor onBeforeCommandExecute={onBeforeCommandExecute}>
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
