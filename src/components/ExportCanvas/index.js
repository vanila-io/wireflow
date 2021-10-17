import React, { useState } from 'react';
import Button from 'antd/es/button';
import Dropdown from 'antd/es/dropdown';
import Menu from 'antd/es/menu';
import Alert from 'antd/es/alert';
import { MoreOutlined, ExportOutlined, ImportOutlined } from '@ant-design/icons';
import 'antd/es/button/style/css';
import 'antd/es/dropdown/style/css';
import 'antd/es/menu/style/css';
import 'antd/es/alert/style/css';
import htmlToImage from 'html-to-image';
import { ContextMenu, Command, CanvasMenu } from 'gg-editor';

import IconFont from '../IconFont';
import './style.css';

const ExportCanvas = () => {  
  const [error, setError] = useState(null)
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

  function exportCanvas() {
    const data = localStorage.getItem('data');    
    const blob = new Blob([data], {type: 'application/json'})    
    const link = document.createElement('a');
    link.download = 'wireflow.json';
    link.href = URL.createObjectURL(blob);
    link.click();
  }  

  function importCanvas(event, b) {    
    const r = new FileReader();
    const file = event.target.files[0];   
    r.onloadend = function(){      
      try {
        const data = atob(r.result.replace('data:application/json;base64,', ''));
        localStorage.setItem('data', data);      
        window.location.reload();
      } catch (error) {
        setError(`Unable to import file. ${error}`)
      }
    }
    r.readAsDataURL(file);
  }

  function hideError() {
    setError(null)
  }

  const menu = (
    <Menu
      className='export-menu'
    >
      <Menu.Item
        onClick={saveCanvas}
      >
        Export Image
        <IconFont type='icon-upload-demo' />       
      </Menu.Item>
      <Menu.Item>
        <span className='import-input-container'>
          <input type='file' onChange={(event) => importCanvas(event)} />
          Import Configuration
        </span>
        <ImportOutlined />
      </Menu.Item>
      <Menu.Item
        onClick={exportCanvas}
      >
        Export Configuration
        <ExportOutlined />
      </Menu.Item>
    </Menu>
  );

  return (
    <ContextMenu>
      <CanvasMenu>
        <Command name='autoZoom'>
          <div className='export'>
            <Dropdown
              overlay={menu}
            >
              <Button                
                type='dashed'
                size='large'
                shape='circle'                
              >
                <MoreOutlined />
              </Button>  
            </Dropdown>            
          </div>
          {error && <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            closable
            onClose={hideError}
          />}
        </Command>
      </CanvasMenu>
    </ContextMenu>
  );
};

export default ExportCanvas;
