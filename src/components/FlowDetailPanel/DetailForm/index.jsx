import { Component } from 'react';
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
  // React 18+ batches gg-editor's "deselect old, select new" status updates into
  // one render, so switching straight from one node (or edge) to another no
  // longer remounts this form. Re-render on every selection; the Card below is
  // keyed by item id so its Form starts from the new item's values.
  componentDidMount() {
    this.page = this.props.propsAPI.currentPage;
    this.page.on('afteritemselected', this.refresh);
  }

  componentWillUnmount() {
    this.page.off('afteritemselected', this.refresh);
  }

  refresh = () => this.forceUpdate();

  get item() {
    const { propsAPI } = this.props;
    return propsAPI.getSelected()[0];
  }

  handleFieldChange = (values) => {
    const {
      propsAPI: { getSelected, executeCommand, update },
    } = this.props;

    const item = getSelected()[0];
    if (!item) return;

    executeCommand(() => update(item, { ...values }));
  };

  // Colors of the edges in the diagram, most recently added edge first.
  get usedEdgeColors() {
    const { edges = [] } = this.props.propsAPI.save();
    const colors = edges
      .map(({ color }) => color?.toLowerCase())
      .filter(Boolean)
      .reverse();
    return [...new Set(colors)];
  }

  // Fires once per pick (hex/RGB input, preset click or the end of a drag),
  // so dragging across the palette adds a single undo step.
  handleColorChangeComplete = (value) => {
    const color = value.toHexString();
    if (color === this.item.getModel().color?.toLowerCase()) return;

    this.handleFieldChange({ color });
    this.forceUpdate(); // refresh the "In this diagram" presets
  };

  handleInputBlur = (type) => (e) => {
    e.preventDefault();

    this.handleFieldChange({
      [type]: e.currentTarget.value,
    });
  };

  renderNodeDetail = () => {
    const { label } = this.item.getModel();

    document.addEventListener(
      'keydown',
      (e) => {
        const { ctrlKey, key } = e;

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
      },
      true
    );

    return (
      <>
        <Form initialValues={{ label }}>
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
    const {
      label = '',
      shape = 'flow-polyline-round',
      color,
      style: { lineWidth },
    } = this.item.getModel();

    return (
      <>
        <Form initialValues={{ label, shape, size: lineWidth, color }}>
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
              onChange={(lineWidth) =>
                this.handleFieldChange({ style: { lineWidth } })
              }
            />
          </Item>

          <Item label='Color' name='color' {...inlineFormItemLayout}>
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
    const { label = 'Group' } = this.item.getModel();

    return (
      <Form initialValues={{ label }}>
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
