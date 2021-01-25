import React, { useState } from 'react';
import { ItemPanel } from 'gg-editor';
import { Card, Input } from 'antd/es';
import 'antd/es/card/style/css';

import NodeItem from './NodeItem';
import nodes from './nodesData';
import './style.css';

const FlowItemPanel = () => {
  const [items, setItems] = useState(nodes);

  function onChange(e) {
    const keyword = e.target.value.toLowerCase();
    const searchResults = nodes.filter(n => n.label.toLowerCase().includes(keyword));
    setItems(searchResults);
  }

  return (
    <ItemPanel className='sidebar-wrapper'> 
      <Card className='sidebar' bodyStyle={{ padding: 0 }}>
        <Input.Search className='sidebar-search' placeholder='Search' allowClear size='small' onChange={onChange} />
        {items && items.map((item, i) => <NodeItem key={i} {...item} />)}
      </Card>
    </ItemPanel>
  );
};

export default FlowItemPanel;
