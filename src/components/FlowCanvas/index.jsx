import { useState, useEffect } from 'react';
import { Flow } from 'gg-editor';
import './style.css';
import { dataMapToData } from '../../utils/dataMapToData';
import { saveData } from '../../utils/saveData';
import { currentImg } from '../../utils/templates';

// Template image URLs change between builds (and moved from /static/media/ when the app
// left Create React App), so re-point saved nodes at this build's URL of their template.
const data = JSON.parse(localStorage.getItem('data'));
data?.nodes?.forEach((node) => {
  if (node.img) node.img = currentImg(node.img);
});

const FlowCanvas = () => {
  const [edge, setEdge] = useState({});
  const [oncanvas, setOnCanvas] = useState(false);

  const mouseEvent = async (e) => {
    const event = await e;
    const EVENT_TYPE = e._type;

    if (!event?.item) {
      switch (EVENT_TYPE) {
        case 'mouseleave':
          setOnCanvas(true);
          break;
        case 'mouseenter':
          setOnCanvas(false);
          break;
        default:
          break;
      }
    }
  };

  useEffect(() => {
    if (edge.type === 'edge') {
      // `edge` is a mutable G6 item instance owned by gg-editor, not React data.
      // eslint-disable-next-line react-hooks/immutability
      oncanvas ? (edge.isSelected = false) : (edge.isSelected = true);
    }
  }, [oncanvas, edge]);

  return (
    <Flow
      onAfterItemSelected={async (e) => {
        const item = await e.item;

        setEdge(item);
      }}
      onAfterChange={(e) => {
        // `changeData` is caused by setData and allowing `group` causes some error
        if (
          e.action === 'changeData' ||
          (e.item.type === 'group' && e.action !== 'remove')
        ) {
          return;
        }

        saveData(dataMapToData(e.item && e.item.dataMap, e.item.itemMap));
      }}
      data={data}
      onBeforeItemUnselected={() => setEdge({})}
      onMouseEnter={mouseEvent}
      onMouseLeave={mouseEvent}
      className='flow'
    />
  );
};

export default FlowCanvas;
