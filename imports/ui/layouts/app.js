import React from 'react';
import { AppBootstrap } from './app-bootstrap.js';
import { AppMaterialize } from './app-materialize.js';

export const App = React.createClass({
  propTypes: {
    children: React.PropTypes.element.isRequired,
    location: React.PropTypes.object,
  },
  render() {
    if (this.props.location.pathname.includes('/wire/')) {
      return <div>
        <AppMaterialize>
          {this.props.children}
        </AppMaterialize>
      </div>;
    }
    return <div>
      <AppBootstrap>
        {this.props.children}
      </AppBootstrap>
    </div>;
  },
});
