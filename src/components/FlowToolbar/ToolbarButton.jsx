import { Command } from 'gg-editor';
import { Tooltip } from 'antd';

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
