import React from 'react';
import { ItemPanel } from 'gg-editor';
import Card from 'antd/es/card';
import 'antd/es/card/style/css';

import NodeItem from './NodeItem';
import nodes from './nodesData';
import './style.css';

const FlowItemPanel = () => {
  return (
    <ItemPanel className='sidebar-wrapper'>
      <Card className='sidebar' bodyStyle={{ padding: 0 }}>
        {nodes && nodes.map((item, i) => <NodeItem key={i} {...item} />)}
      </Card>
    </ItemPanel>
  );
};

export default FlowItemPanel;
