import React from 'react';
import Card from 'antd/es/card';
import 'antd/es/card/style/css';
import { Minimap } from 'gg-editor';

const FlowMiniMap = () => {
  return (
    <Card type='inner' size='small' title='Minimap' bordered={false}>
      <Minimap height={200} />
    </Card>
  );
};

export default FlowMiniMap;
