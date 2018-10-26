import React from 'react';
import PropTypes from 'prop-types';
import createClass from 'create-react-class';
import { AppBootstrap } from './app-bootstrap.js';
import { AppMaterialize } from './app-materialize.js';
export const App = createClass({
  propTypes: {
    children: PropTypes.element.isRequired,
    location: PropTypes.object
    //    user: PropTypes.object,
  },
  render() {
    if (this.props.location.pathname.includes('/wire/')) {
      return (
        <div>
          <AppMaterialize>{this.props.children}</AppMaterialize>
        </div>
      );
    }
    return (
      <div>
        <AppBootstrap>{this.props.children}</AppBootstrap>
      </div>
    );
  }
});

export default App;
