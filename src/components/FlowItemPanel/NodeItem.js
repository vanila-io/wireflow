import React from 'react';
import { Item } from 'gg-editor';

const NodeItem = (props) => {
  const { label, img } = props;

  return (
    <Item
      type='node'
      size={[96, 88]}
      model={{ img: img, label: label }}
      src={img}
    />
  );
};

export default NodeItem;
