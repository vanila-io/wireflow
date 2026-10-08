import { Card, Descriptions } from 'antd';
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

const canvasShortcuts = [
  {
    key: 'zoomIn',
    label: 'Zoom in',
    children: (
      <>
        <code>Ctrl</code> + <code> =</code>
      </>
    ),
  },
  {
    key: 'zoomOut',
    label: 'Zoom out',
    children: (
      <>
        <code>Ctrl</code> + <code>-</code>
      </>
    ),
  },
];

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
          variant='borderless'
        />
      </MultiPanel>
      <CanvasPanel>
        <Card
          type='inner'
          size='small'
          title='Canvas'
          className='details__card'
          variant='borderless'
        >
          <Descriptions
            column={1}
            layout='horizontal'
            bordered
            title='Keyboard Shortcuts'
            items={canvasShortcuts}
          />
        </Card>
      </CanvasPanel>
    </DetailPanel>
  );
};

export default FlowDetailPanel;
