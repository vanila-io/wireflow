import React from 'react';
import PropTypes from 'prop-types';
import { withPropsAPI } from 'gg-editor';
import Card from 'antd/es/card';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Form from 'antd/es/form';
import Slider from 'antd/es/slider';
import Descriptions from 'antd/es/descriptions';
import { HexColorPicker as ColorPicker } from 'react-colorful';

import 'antd/es/card/style/css';
import 'antd/es/input/style/css';
import 'antd/es/select/style/css';
import 'antd/es/form/style/css';
import 'antd/es/slider/style/css';
import 'react-colorful/dist/index.css';
import 'antd/es/descriptions/style/css';

import { upperFirst } from '../../../utils';

const { Item } = Form;

const inlineFormItemLayout = {
  labelCol: {
    sm: { span: 6 },
  },
  wrapperCol: {
    sm: { span: 18 },
  },
};

class DetailForm extends React.Component {
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
        >
          <Descriptions.Item label='Hide Header'>
            <code>Ctrl</code> + <code>h</code>
          </Descriptions.Item>
          <Descriptions.Item label='Show Header'>
            <code>Ctrl</code> + <code>k</code>
          </Descriptions.Item>
          <Descriptions.Item label='Delete Node'>
            <code>delete</code> / <code>backspace</code>
          </Descriptions.Item>
        </Descriptions>
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
        <Form initialValues={{ label, shape }}>
          <Item label='Label' name='label' {...inlineFormItemLayout}>
            <Input onBlur={this.handleInputBlur('label')} />
          </Item>

          <Item label='Shape' name='shape' {...inlineFormItemLayout}>
            <Select
              onChange={(value) => this.handleFieldChange({ shape: value })}
            >
              <Select.Option value='flow-smooth'>Smooth</Select.Option>
              <Select.Option value='flow-polyline'>Polyline</Select.Option>
              <Select.Option value='flow-polyline-round'>
                Polyline Round
              </Select.Option>
            </Select>
          </Item>

          <Item label='Size' name='size' {...inlineFormItemLayout}>
            <Slider
              min={1}
              max={10}
              defaultValue={lineWidth}
              onChange={(lineWidth) =>
                this.handleFieldChange({ style: { lineWidth } })
              }
            />
          </Item>

          <Item label='Color' name='color' {...inlineFormItemLayout}>
            <ColorPicker
              color={color}
              onChange={(color) => this.handleFieldChange({ color })}
            />
          </Item>
        </Form>
        <Descriptions
          column={1}
          layout='horizontal'
          bordered
          title='Keyboard Shortcuts'
        >
          <Descriptions.Item label='Delete Edge'>
            <code>delete</code> / <code>backspace</code>
          </Descriptions.Item>
        </Descriptions>
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
        type='inner'
        size='small'
        title={upperFirst(type)}
        className='details__card'
        bordered={false}
      >
        {type === 'node' && this.renderNodeDetail()}
        {type === 'edge' && this.renderEdgeDetail()}
        {type === 'group' && this.renderGroupDetail()}
      </Card>
    );
  }
}

DetailForm.propTypes = { 
  type: PropTypes.string.isRequired
};

export default withPropsAPI(DetailForm);
