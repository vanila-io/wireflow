import React from 'react';
// import 'meteor/ryanswapp:fabricjs';
// import 'materialize-css/bin/materialize.css';
// import 'materialize-css/bin/materialize.js';
// import '../../../imports/lib/css/style.css';
// // import '../../../imports/lib/jquery.mousewheel.min.js';
// import '../../../imports/lib/fabric.min.js';
// import '../../../imports/lib/contextMenu.js';
// import '../../../imports/lib/fabric_api.js';
// import '../../../imports/lib/main.js';

export const AppMaterialize = React.createClass({
  propTypes: {
    children: React.PropTypes.element.isRequired,
    location: React.PropTypes.object,
  },
  render() {
    return <div>
      {this.props.children}
    </div>;
  },
});
