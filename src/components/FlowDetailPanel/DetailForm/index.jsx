import { Component, createRef } from 'react';
import { withPropsAPI } from 'gg-editor';
import {
  Card,
  ColorPicker,
  Descriptions,
  Form,
  Input,
  Select,
  Slider,
} from 'antd';

import { upperFirst } from '../../../utils';

const { Item } = Form;

const edgeShapeOptions = [
  { value: 'flow-smooth', label: 'Smooth' },
  { value: 'flow-polyline', label: 'Polyline' },
  { value: 'flow-polyline-round', label: 'Polyline Round' },
];

// The first entry is the default edge color (see onBeforeCommandExecute in App).
const edgeColorPalette = [
  '#a4b2c0',
  '#262626',
  '#1677ff',
  '#13c2c2',
  '#52c41a',
  '#faad14',
  '#fa541c',
  '#f5222d',
  '#eb2f96',
  '#722ed1',
];

// Edges are opaque. disabledAlpha hides the picker's alpha controls, but its
// hex field still accepts #rrggbbaa, so keep just #rrggbb.
const toEdgeColor = (color) => color.toHexString().slice(0, 7);

const nodeShortcuts = [
  {
    key: 'hideHeader',
    label: 'Hide Header',
    children: (
      <>
        <code>Ctrl</code> + <code>h</code>
      </>
    ),
  },
  {
    key: 'showHeader',
    label: 'Show Header',
    children: (
      <>
        <code>Ctrl</code> + <code>k</code>
      </>
    ),
  },
  {
    key: 'deleteNode',
    label: 'Delete Node',
    children: (
      <>
        <code>delete</code> / <code>backspace</code>
      </>
    ),
  },
];

const edgeShortcuts = [
  {
    key: 'deleteEdge',
    label: 'Delete Edge',
    children: (
      <>
        <code>delete</code> / <code>backspace</code>
      </>
    ),
  },
];

const inlineFormItemLayout = {
  labelCol: {
    sm: { span: 6 },
  },
  wrapperCol: {
    sm: { span: 18 },
  },
};

class DetailForm extends Component {
  form = createRef();

  // React 18+ batches gg-editor's "deselect old, select new" status updates into
  // one render, so switching straight from one node (or edge) to another no
  // longer remounts this form. Re-render on every selection; the Card below is
  // keyed by item id so its Form starts from the new item's values. Also
  // re-render on every change to the diagram, as undo, redo and other commands
  // change the selected item without going through this form.
  componentDidMount() {
    this.page = this.props.propsAPI.currentPage;
    this.graph = this.page.getGraph();
    this.page.on('afteritemselected', this.refresh);
    this.graph.on('afterchange', this.refresh);
    // Only this panel's instance listens, and only while it is mounted, i.e.
    // while a single node is selected.
    if (this.props.type === 'node') {
      document.addEventListener('keydown', this.handleNodeShortcut, true);
    }
    this.shown = this.item && this.values;
  }

  // A Form reads initialValues only when it mounts. When the selected item's
  // values change afterwards (on undo, for example), copy just the changed ones
  // into the form: a change to something else must not reset a label being
  // typed or a color being dragged.
  componentDidUpdate() {
    const previous = this.shown;
    this.shown = this.item && this.values;
    if (!previous || !this.shown) return;

    const changed = Object.entries(this.shown).filter(
      ([name, value]) => value !== previous[name]
    );
    if (changed.length) {
      this.form.current?.setFieldsValue(Object.fromEntries(changed));
    }
  }

  componentWillUnmount() {
    this.page.off('afteritemselected', this.refresh);
    this.graph.off('afterchange', this.refresh);
    document.removeEventListener('keydown', this.handleNodeShortcut, true);
  }

  refresh = () => this.forceUpdate();

  get item() {
    const { propsAPI } = this.props;
    return propsAPI.getSelected()[0];
  }

  // The selected item's values, as this panel's form fields show them.
  get values() {
    const { type } = this.props;
    const model = this.item.getModel();

    if (type === 'edge') {
      const { label = '', shape = 'flow-polyline-round', color, style } = model;
      // An edge from an opened or older file may have no style.
      return { label, shape, size: style?.lineWidth, color };
    }
    if (type === 'group') {
      const { label = 'Group' } = model;
      return { label };
    }
    return { label: model.label };
  }

  handleFieldChange = (values) => {
    const {
      propsAPI: { getSelected, executeCommand, update },
    } = this.props;

    const item = getSelected()[0];
    if (!item) return;

    executeCommand(() => update(item, { ...values }));
  };

  // Colors of the edges in the diagram, topmost edge first. save() lists items
  // in drawing order, so that is the most recently added edge unless To Front
  // or To Back moved one.
  get usedEdgeColors() {
    const { edges = [] } = this.props.propsAPI.save();
    const colors = edges
      .map(({ color }) => color?.toLowerCase())
      .filter(Boolean)
      .reverse();
    return [...new Set(colors)];
  }

  // Fires when a drag ends or an arrow key is released, so dragging the slider
  // adds a single undo step (and pressing an arrow key at the limit none).
  handleSizeChangeComplete = (lineWidth) => {
    if (lineWidth === this.values.size) return;

    this.handleFieldChange({ style: { lineWidth } });
  };

  // Fires when a drag across the palette or hue bar ends, so a drag adds a
  // single undo step. Other changes fire it at once: a preset click, a complete
  // hex value, and each RGB/HSB keystroke.
  handleColorChangeComplete = (value) => {
    const color = toEdgeColor(value);
    if (color === this.item.getModel().color?.toLowerCase()) return;

    this.handleFieldChange({ color });
  };

  handleInputBlur = (type) => (e) => {
    e.preventDefault();

    // Leaving a field unchanged must not add an empty undo step: that would
    // also throw away whatever Redo could bring back.
    const { value } = e.currentTarget;
    if (!this.item || value === this.values[type]) return;

    this.handleFieldChange({ [type]: value });
  };

  handleNodeShortcut = (e) => {
    const { ctrlKey, key } = e;

    // Typing in the AI chat must not toggle the selected node's header.
    if (e.target.closest?.('.ai-panel')) return;

    if (ctrlKey && key === 'h') {
      this.handleFieldChange({
        shape: 'node-image-without-header',
        size: [96, 78],
      });
    }

    if (ctrlKey && key === 'k') {
      this.handleFieldChange({
        shape: 'node-image-header',
        size: [96, 88],
      });
    }
  };

  renderNodeDetail = () => {
    return (
      <>
        <Form ref={this.form} initialValues={this.values}>
          <Item label='Label' name='label' {...inlineFormItemLayout}>
            <Input name='title' onBlur={this.handleInputBlur('label')} />
          </Item>
        </Form>
        <Descriptions
          column={1}
          layout='horizontal'
          bordered
          title='Keyboard Shortcuts'
          items={nodeShortcuts}
        />
      </>
    );
  };

  renderEdgeDetail = () => {
    return (
      <>
        <Form ref={this.form} initialValues={this.values}>
          <Item label='Label' name='label' {...inlineFormItemLayout}>
            <Input onBlur={this.handleInputBlur('label')} />
          </Item>

          <Item label='Shape' name='shape' {...inlineFormItemLayout}>
            <Select
              options={edgeShapeOptions}
              onChange={(value) => this.handleFieldChange({ shape: value })}
            />
          </Item>

          <Item label='Size' name='size' {...inlineFormItemLayout}>
            <Slider
              min={1}
              max={10}
              onChangeComplete={this.handleSizeChangeComplete}
            />
          </Item>

          <Item
            label='Color'
            name='color'
            getValueFromEvent={toEdgeColor}
            {...inlineFormItemLayout}
          >
            <ColorPicker
              showText
              disabledAlpha
              placement='bottomRight'
              presets={[
                { key: 'palette', label: 'Palette', colors: edgeColorPalette },
                {
                  key: 'used',
                  label: 'In this diagram',
                  colors: this.usedEdgeColors,
                },
              ]}
              onChangeComplete={this.handleColorChangeComplete}
            />
          </Item>
        </Form>
        <Descriptions
          column={1}
          layout='horizontal'
          bordered
          title='Keyboard Shortcuts'
          items={edgeShortcuts}
        />
      </>
    );
  };

  renderGroupDetail = () => {
    return (
      <Form ref={this.form} initialValues={this.values}>
        <Item label='Label' name='label' {...inlineFormItemLayout}>
          <Input onBlur={this.handleInputBlur('label')} />
        </Item>
      </Form>
    );
  };

  render() {
    const { type } = this.props;
    if (!this.item) return null;

    return (
      <Card
        key={this.item.id}
        type='inner'
        size='small'
        title={upperFirst(type)}
        className='details__card'
        variant='borderless'
      >
        {type === 'node' && this.renderNodeDetail()}
        {type === 'edge' && this.renderEdgeDetail()}
        {type === 'group' && this.renderGroupDetail()}
      </Card>
    );
  }
}

export default withPropsAPI(DetailForm);
