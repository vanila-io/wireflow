import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.min.js';
import 'react-select/dist/react-select.css';

import React from 'react';
import PropTypes from 'prop-types';
import createClass from 'create-react-class';
import AppNavigation from '../containers/app-navigation';

export const AppBootstrap = createClass({
  propTypes: {
    children: PropTypes.element.isRequired,
    location: PropTypes.object
  },
  render() {
    return (
      <div>
        <AppNavigation />
        {this.props.children}
      </div>
    );
  }
});
