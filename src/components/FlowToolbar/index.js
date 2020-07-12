import React from 'react';
import { Toolbar } from 'gg-editor';
import Divider from 'antd/es/divider';
import 'antd/es/divider/style/css';

import ToolbarButton from './ToolbarButton';
import './style.css';

const FlowToolbar = () => {
  return (
    <Toolbar className='toolbar'>
      <ToolbarButton command='undo' />
      <ToolbarButton command='redo' />
      <Divider type='vertical' />
      <ToolbarButton command='copy' />
      <ToolbarButton command='paste' />
      <ToolbarButton command='delete' />
      <Divider type='vertical' />
      <ToolbarButton command='zoomIn' icon='zoomin' text='Zoom In' />
      <ToolbarButton command='zoomOut' icon='zoomout' text='Zoom Out' />
      <ToolbarButton command='autoZoom' icon='fit-map' text='Fit Map' />
      <ToolbarButton
        command='resetZoom'
        icon='actual-size'
        text='Actual Size'
      />
      <Divider type='vertical' />
      <ToolbarButton command='toBack' icon='to-back' text='To Back' />
      <ToolbarButton command='toFront' icon='to-front' text='To Front' />
      <Divider type='vertical' />
      <ToolbarButton
        command='multiSelect'
        icon='multi-select'
        text='Multi Select'
      />
      <ToolbarButton command='addGroup' icon='-group' text='Add Group' />
      <ToolbarButton command='unGroup' icon='ungroup' text='Ungroup' />
    </Toolbar>
  );
};

export default FlowToolbar;
