import React from 'react';
import PropTypes from 'prop-types';
import createClass from 'create-react-class';

export const AppMaterialize = createClass({
  propTypes: {
    children: PropTypes.element.isRequired,
    location: PropTypes.object
  },
  render() {
    return <div>{this.props.children}</div>;
  }
});
