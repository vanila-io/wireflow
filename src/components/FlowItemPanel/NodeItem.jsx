import { Item } from 'gg-editor';

// A template tile. Many names only repeat the category heading above them ("Article" x6,
// "Blog" x9), so the name is the tooltip and alt text rather than a caption. That keeps
// the tiles as compact as they were before the categories.
const NodeItem = (props) => {
  const { label, img } = props;

  return (
    <div className='sidebar-item' title={label}>
      <Item type='node' size={[96, 88]} model={{ img: img, label: label }}>
        <img src={img} alt={label} draggable={false} />
      </Item>
    </div>
  );
};

export default NodeItem;
