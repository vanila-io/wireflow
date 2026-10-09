import { useRef } from 'react';
import { Button, Modal, Tooltip, message } from 'antd';
import { FolderOpenOutlined, SaveOutlined } from '@ant-design/icons';
import { toJpeg } from 'html-to-image';
import { ContextMenu, Command, CanvasMenu, withPropsAPI } from 'gg-editor';

import IconFont from '../IconFont';
import { FILE_NAME, parseDiagramFile, serializeDiagram } from '../../utils/diagramFile';
import { saveData } from '../../utils/saveData';
import { removeDanglingEdges } from '../../utils/removeDanglingEdges';
import './style.css';

function download(name, href) {
  const link = document.createElement('a');
  link.download = name;
  link.href = href;
  link.click();
}

const ExportCanvas = ({ propsAPI }) => {
  const fileInput = useRef(null);
  const [modal, modalHolder] = Modal.useModal();
  const [messageApi, messageHolder] = message.useMessage();

  function saveCanvas() {
    toJpeg(document.getElementById('canvas_1'), { quality: 1 })
      .then((dataUrl) => download('wireflow.jpg', dataUrl));
  }

  function saveFile() {
    const blob = new Blob([serializeDiagram(propsAPI.save())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    download(FILE_NAME, url);
    // The download may read the URL after click() returns. FileSaver.js and
    // browser-fs-access also wait tens of seconds before revoking it.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function load(file, name) {
    // Files saved by older builds can hold arrows that don't connect two items. Drop them
    // here, as FlowCanvas does on load and saveData on every write, so the canvas shows
    // exactly what is stored.
    const diagram = removeDanglingEdges(file);
    const dropped = (file.edges?.length ?? 0) - (diagram.edges?.length ?? 0);
    const previous = propsAPI.save();
    propsAPI.currentPage.clearSelected(); // so the detail panel lets go of the old item
    try {
      propsAPI.read(diagram);
      saveData(diagram);
    } catch (error) {
      // Put the previous diagram back. A failed setItem leaves localStorage as it was.
      propsAPI.read(previous);
      const reason = error?.name === 'QuotaExceededError'
        ? "It's too big to keep in this browser's storage."
        : "The diagram in it couldn't be drawn.";
      messageApi.error(`Couldn't open ${name}. ${reason}`);
      return;
    }
    // Undo/redo would replay snapshots of the previous diagram, so start a fresh history.
    // gg-editor 2 has no public API for this; `_command` is gg-editor-core 1.3.4's
    // { queue, current } undo stack, which undo/redo and the toolbar read.
    const history = propsAPI.editor.get('_command');
    history.queue = [];
    history.current = 0;
    propsAPI.editor.setCommandDOMenable();
    messageApi.success(dropped ? `Opened ${name}. Removed ${dropped} unconnected ${dropped === 1 ? 'arrow' : 'arrows'}.` : `Opened ${name}`);
  }

  async function openFile(e) {
    const file = e.target.files[0];
    e.target.value = ''; // so that picking the same file again fires `change`
    if (!file) return;

    let diagram;
    try {
      diagram = parseDiagramFile(await file.text());
    } catch (error) {
      messageApi.error(`Couldn't open ${file.name}. ${error.message ?? ''}`);
      return;
    }

    const { nodes = [], edges = [], groups = [] } = propsAPI.save();
    if (nodes.length + edges.length + groups.length === 0) {
      load(diagram, file.name);
      return;
    }
    modal.confirm({
      title: 'Replace the current diagram?',
      content: `Opening ${file.name} replaces the diagram on the canvas. Save it to a file first if you want to keep it.`,
      okText: 'Replace',
      onOk: () => load(diagram, file.name),
    });
  }

  return (
    <>
      <ContextMenu>
        <CanvasMenu>
          <div className='export'>
            <Command name='autoZoom'>
              <Tooltip title='Export as JPEG' placement='bottom'>
                <Button
                  aria-label='Export as JPEG'
                  onClick={saveCanvas}
                  type='dashed'
                  size='large'
                  shape='circle'
                  icon={<IconFont type='icon-upload-demo' />}
                />
              </Tooltip>
            </Command>
            <Tooltip title='Save to file' placement='bottom'>
              <Button
                aria-label='Save to file'
                onClick={saveFile}
                type='dashed'
                size='large'
                shape='circle'
                icon={<SaveOutlined />}
              />
            </Tooltip>
            <Tooltip title='Open file' placement='bottom'>
              <Button
                aria-label='Open file'
                onClick={() => fileInput.current.click()}
                type='dashed'
                size='large'
                shape='circle'
                icon={<FolderOpenOutlined />}
              />
            </Tooltip>
            <input
              ref={fileInput}
              type='file'
              accept='.json,application/json'
              hidden
              onChange={openFile}
            />
          </div>
        </CanvasMenu>
      </ContextMenu>
      {modalHolder}
      {messageHolder}
    </>
  );
};

export default withPropsAPI(ExportCanvas);
