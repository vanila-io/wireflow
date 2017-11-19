import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.min.js';
import 'react-select/dist/react-select.css';

import React from 'react';
import AppNavigation from '../containers/app-navigation';

export const AppBootstrap = React.createClass({
  propTypes: {
    children: React.PropTypes.element.isRequired,
    location: React.PropTypes.object,
  },
  render() {
    return <div>
      <AppNavigation />
      {this.props.children}
    </div>;
  },
});
