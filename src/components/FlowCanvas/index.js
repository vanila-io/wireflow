import React, { useState, useEffect } from 'react';
import { Flow } from 'gg-editor';
import './style.css';

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
      oncanvas ? (edge.isSelected = false) : (edge.isSelected = true);
    }
  }, [oncanvas, edge]);

  return (
    <Flow
      onAfterItemSelected={async (e) => {
        const item = await e.item;

        setEdge(item);
      }}
      onBeforeItemUnselected={() => setEdge({})}
      onMouseEnter={mouseEvent}
      onMouseLeave={mouseEvent}
      className='flow'
    />
  );
};

export default FlowCanvas;
