import React from 'react';
import { Command } from 'gg-editor';
import Tooltip from 'antd/es/tooltip';
import 'antd/es/tooltip/style/css';

import { upperFirst } from '../../utils';
import IconFont from '../IconFont';

const ToolbarButton = (props) => {
  const { command, icon, text } = props;

  return (
    <Command name={command}>
      <Tooltip title={text || upperFirst(command)} placement='bottom'>
        <IconFont type={`icon-${icon || command}`} />
      </Tooltip>
    </Command>
  );
};

export default ToolbarButton;
