import { memo } from 'react';
import { Handle } from '@xyflow/react';

import { HANDLES } from './convert';

// Four handles like gg-editor's four anchors. With ConnectionMode.Loose every handle can
// start or end an edge, so one "source" handle per side is enough. The handle ids are
// the side names, which are also React Flow's Position values.
const Handles = () => HANDLES.map((side) => <Handle key={side} id={side} type='source' position={side} />);

// gg-editor label: 10px, 600, #94A4A5, centered 12px below the top, cut after 20 chars.
const shortLabel = (label) => (label.length > 23 ? `${label.substr(0, 20)}...` : label);

// A template screen, drawn like src/containers/register/node: a white rounded box with
// the template image, and with the header variant, the label over the image's header bar.
export const ScreenNode = memo(function ScreenNode({ data, width, height, selected }) {
  return (
    <div className={`rf-screen${selected ? ' rf-screen--selected' : ''}`}>
      {/* Same geometry as the G6 image shape: 1.5px inset, and without a header moved up
          5.5px (offsets include the 1px border). G6 draws the SVG onto a canvas, so its
          scaling differs from the browser's by 2-3px. */}
      {data.header && <div className='rf-screen__header' />}
      <svg className='rf-screen__img' width={width - 3} height={height} style={{ top: data.header ? -1 : -6.5 }} aria-label={data.label}>
        <image href={data.img} width={width - 3} height={height} preserveAspectRatio='none' />
      </svg>
      {data.header && data.label && <div className='rf-screen__label'>{shortLabel(data.label)}</div>}
      <Handles />
    </div>
  );
});

// A group frame with its label, drawn like G6's `common` group shape.
export const GroupNode = memo(function GroupNode({ data, selected }) {
  return (
    <div className={`rf-group${selected ? ' rf-group--selected' : ''}`}>
      <div className='rf-group__label'>{data.label}</div>
      <Handles />
    </div>
  );
});

export const nodeTypes = { screen: ScreenNode, group: GroupNode };
