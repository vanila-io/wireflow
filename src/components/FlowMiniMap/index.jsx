import { Card } from 'antd';
import { Minimap } from 'gg-editor';

const FlowMiniMap = () => {
  return (
    <Card type='inner' size='small' title='Minimap' variant='borderless'>
      <Minimap height={200} />
    </Card>
  );
};

export default FlowMiniMap;
