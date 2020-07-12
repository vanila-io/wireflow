import React from 'react';
import Card from 'antd/es/card';
import 'antd/es/card/style/css';
import Descriptions from 'antd/es/descriptions';
import 'antd/es/descriptions/style/css';
import {
  CanvasPanel,
  DetailPanel,
  EdgePanel,
  GroupPanel,
  MultiPanel,
  NodePanel,
} from 'gg-editor';

import DetailForm from './DetailForm';
import './style.css';

const FlowDetailPanel = () => {
  return (
    <DetailPanel className='details'>
      <NodePanel>
        <DetailForm type='node' />
      </NodePanel>
      <EdgePanel>
        <DetailForm type='edge' />
      </EdgePanel>
      <GroupPanel>
        <DetailForm type='group' />
      </GroupPanel>
      <MultiPanel>
        <Card
          type='inner'
          size='small'
          title='Multi Select'
          className='details__card'
          bordered={false}
        />
      </MultiPanel>
      <CanvasPanel>
        <Card
          type='inner'
          size='small'
          title='Canvas'
          className='details__card'
          bordered={false}
        >
          <Descriptions
            column={1}
            layout='horizontal'
            bordered
            title='Keyboard Shortcuts'
          >
            <Descriptions.Item label='Zoom in'>
              <code>Ctrl</code> + <code> =</code>
            </Descriptions.Item>
            <Descriptions.Item label='Zoom out'>
              <code>Ctrl</code> + <code>-</code>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </CanvasPanel>
    </DetailPanel>
  );
};

export default FlowDetailPanel;
