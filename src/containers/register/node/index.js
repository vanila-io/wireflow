import React from 'react';
import { RegisterNode } from 'gg-editor';

const NodeRegisteWithoutHeader = () => {
  const config = {
    afterDraw(cfg) {
      const { group } = cfg;
      const size = cfg.size || [100, 100];
      const width = size[0];
      const height = size[1];
      group.addShape('Path', {
        attrs: {
          fill: '#EBEFF0',
          stroke: '#BCC2C6',
        },
      });
      group.addShape('image', {
        // attrs: node image style
        attrs: {
          x: -(width - 3) / 2,
          y: -(height + 11) / 2,
          width: width - 3,
          height: height,
          img: group.model.img,
        },
        draggable: true,
      });
    },
    drawLabel(t) {},
  };

  return (
    <RegisterNode
      name='node-image-without-header'
      config={config}
      extend='flow-rect'
    />
  );
};

const NodeRegisteWithHeader = () => {
  const config = {
    afterDraw(cfg) {
      const { group } = cfg;
      const size = cfg.size || [100, 100];
      const width = size[0];
      const height = size[1];
      group.addShape('Path', {
        attrs: {
          fill: '#EBEFF0',
          stroke: '#BCC2C6',
        },
      });
      group.addShape('image', {
        // attrs: node image style
        attrs: {
          x: -(width - 3) / 2,
          y: -height / 2,
          width: width - 3,
          height: height,
          img: group.model.img,
        },
        draggable: true,
      });
      if (cfg.model.label) {
        group.addShape('text', {
          // attrs: label style
          attrs: {
            x: 0,
            y: -(height - 24) / 2,
            textAlign: 'center',
            fontWeight: 600,
            textBaseline: 'middle',
            text: cfg.model.label,
            fill: '#94A4A5',
            fontSize: 10,
          },
        });
      }
    },
    drawLabel(t) {},
  };

  return (
    <RegisterNode name='node-image-header' config={config} extend='flow-rect' />
  );
};

export { NodeRegisteWithHeader, NodeRegisteWithoutHeader };
