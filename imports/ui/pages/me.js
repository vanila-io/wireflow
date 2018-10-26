import React from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';

import { Loading } from '../components/loading.js';
import { UserAvatar } from '../components/user/avatar.js';
import { UserInfo } from '../components/user/info.js';

import { googleAnalytics } from '../../modules/ganalytics.js';

const styles = {
  firstRow: {
    marginBottom: '5%'
  }
};

class Me extends React.Component {
  componentDidMount() {
    googleAnalytics(document.location.pathname);
  }

  render() {
    if (this.props.user) {
      return (
        <div className="container">
          <div className="row" style={styles.firstRow}>
            <div className="col-md-4">
              <UserAvatar user={this.props.user} />
            </div>
            <div className="col-md-8">
              <UserInfo user={this.props.user} />
            </div>
          </div>
        </div>
      );
    } else {
      return <Loading />;
    }
  }
}

Me.propTypes = {
  user: PropTypes.object
};

export default withTracker(() => {
  Meteor.subscribe('userInfo', Meteor.userId());

  return {
    user: Meteor.users.findOne(Meteor.userId())
  };
})(Me);
