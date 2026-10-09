import { useState, useEffect } from 'react';
import { Flow } from 'gg-editor';
import './style.css';
import { dataMapToData } from '../../utils/dataMapToData';
import { saveData } from '../../utils/saveData';
import { removeDanglingEdges } from '../../utils/removeDanglingEdges';

// Diagrams saved by the old Create React App build point at template images as
// /static/media/<file>.<hash>.svg, which the Vite build no longer serves.
// Re-point them at the current URL of the same template file.
const templateUrls = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/images/*/*.svg', { eager: true, import: 'default' })
  ).map(([path, url]) => [path.split('/').pop(), url])
);

const stored = JSON.parse(localStorage.getItem('data'));
stored?.nodes?.forEach((node) => {
  const legacy = /\/static\/media\/(.+)\.[0-9a-f]{8}\.svg$/.exec(node.img);
  if (legacy && templateUrls[`${legacy[1]}.svg`]) node.img = templateUrls[`${legacy[1]}.svg`];
});

// Drop edges saved with a loose end (see removeDanglingEdges) and save the result.
const data = removeDanglingEdges(stored);
if (data !== stored) saveData(data);

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
      // gg-editor's Flow defaults to `noEndEdge: true`, which saves an edge dropped
      // on empty canvas with a canvas point as its end. Cancel such drops instead.
      noEndEdge={false}
      onBeforeItemUnselected={() => setEdge({})}
      onMouseEnter={mouseEvent}
      onMouseLeave={mouseEvent}
      className='flow'
    />
  );
};

export default FlowCanvas;
