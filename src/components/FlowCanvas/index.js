import React, { useState, useEffect } from 'react';
import { Flow } from 'gg-editor';
import './style.css';

// doesn't work in a useEffect, for some strange reason
const initData = JSON.parse(localStorage.getItem("graph") || "{}");

const FlowCanvas = () => {
  const [edge, setEdge] = useState({});
  const [oncanvas, setOnCanvas] = useState(false);

  const [data, setData] = useState(initData);

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
      onAfterChange={(e) => {
        // `changeData` is caused by setData and allowing `group` causes some error
        if (e.action === "changeData" || e.item.type === "group") return;
        const dataMap = e.item && e.item.dataMap;

        const data = { nodes: [], edges: [], groups: [] };
        dataMap &&
          Object.keys(dataMap).forEach((id) => {
            const item = dataMap[id];
            if (item.type === "node") data.nodes.push(item);
            else if (!!item.source && !!item.target) data.edges.push(item);
            else if (!!item.x && !!item.y) {
              // just assuming that if an item doesn't have x and y, it's a group
              data.groups.push(item);
            }
          });

        setData(data);
        localStorage.setItem("graph", JSON.stringify(data));
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
