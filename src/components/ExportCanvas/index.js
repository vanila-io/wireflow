import React from 'react';
import Button from 'antd/es/button';
import 'antd/es/button/style/css';
import htmlToImage from 'html-to-image';
import { ContextMenu, Command, CanvasMenu } from 'gg-editor';

import IconFont from '../IconFont';
import './style.css';

const ExportCanvas = () => {
  function saveCanvas() {
    htmlToImage
      .toJpeg(document.getElementById('canvas_1'), { quality: 1 })
      .then(function (dataUrl) {
        var link = document.createElement('a');
        link.download = 'wireflow.jpg';
        link.href = dataUrl;
        link.click();
      });
  }

  return (
    <ContextMenu>
      <CanvasMenu>
        <Command name='autoZoom'>
          <div className='export'>
            <Button
              onClick={saveCanvas}
              type='dashed'
              size='large'
              shape='circle'
              icon={<IconFont type='icon-upload-demo' />}
            />
          </div>
        </Command>
      </CanvasMenu>
    </ContextMenu>
  );
};

export default ExportCanvas;
