import { useEffect, useRef, useState } from 'react';
import { Card, Input } from 'antd';

import templates from '../components/FlowItemPanel/nodesData';
import '../components/FlowItemPanel/style.css';

// The template sidebar with the same markup and styles as FlowItemPanel, but dragged
// with Pointer Events instead of gg-editor's mouse events, so it works with mouse,
// pen and touch. Items have `touch-action: pan-y`: a vertical swipe scrolls the list,
// a sideways drag picks up the template.
const Sidebar = ({ onDrop }) => {
  const [items, setItems] = useState(templates);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const dragging = drag !== null;

  useEffect(() => {
    if (!dragging) return undefined;
    const move = (event) => {
      if (event.pointerId !== dragRef.current?.pointerId) return;
      setDrag((current) => current && { ...current, x: event.clientX, y: event.clientY });
    };
    const end = (event) => {
      if (event.pointerId !== dragRef.current?.pointerId) return;
      const { item } = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (event.type === 'pointerup') onDrop(item, { x: event.clientX, y: event.clientY });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [dragging, onDrop]);

  const start = (item) => (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = { item, pointerId: event.pointerId };
    setDrag({ item, x: event.clientX, y: event.clientY });
  };

  function onChange(e) {
    const keyword = e.target.value.toLowerCase();
    setItems(templates.filter((n) => n.label.toLowerCase().includes(keyword)));
  }

  return (
    <div className='sidebar-wrapper'>
      <Card className='sidebar' styles={{ body: { padding: 0 } }}>
        <Input.Search className='sidebar-search' placeholder='Search' allowClear size='small' onChange={onChange} />
        {items.map((item, i) => (
          <div key={i} className='rf-template' onPointerDown={start(item)}>
            <img src={item.img} alt={item.label} draggable={false} />
          </div>
        ))}
      </Card>
      {drag && (
        <img className='rf-drag-ghost' src={drag.item.img} alt='' style={{ left: drag.x - 48, top: drag.y - 44 }} />
      )}
    </div>
  );
};

export default Sidebar;
