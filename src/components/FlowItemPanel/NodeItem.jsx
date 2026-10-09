import { Item } from 'gg-editor';

const NodeItem = (props) => {
  const { label, img } = props;

  return (
    <div className='sidebar-item' title={label}>
      <Item type='node' size={[96, 88]} model={{ img: img, label: label }}>
        <img src={img} alt={label} draggable={false} />
        <span className='sidebar-item-label'>{label}</span>
      </Item>
    </div>
  );
};

export default NodeItem;
