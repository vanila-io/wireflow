import React from 'react';
import { Meteor } from 'meteor/meteor';
import { LinkContainer } from 'react-router-bootstrap';
import { browserHistory } from 'react-router';
import { composeWithTracker } from 'react-komposer';
import { Loading } from '../components/loading.js';

import { UserAvatar } from '../components/user/avatar.js';
import { UserInfo } from '../components/user/info.js';
import { BillingInfo } from '../components/user/billing-info.js';

import { googleAnalytics } from '../../modules/ganalytics.js';

const styles = {
  firstRow: {
    marginBottom: '5%',
  },
};

class Me extends React.Component {
  componentDidMount() {
    googleAnalytics(document.location.pathname);
  }

  componentWillMount() {
    this.state = {
      user: this.props.user,
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      user: nextProps.user,
    });
  }

  render() {
    return (<div className="container">
      <div className="row" style={styles.firstRow}>
        <div className="col-md-4">
          <UserAvatar user={this.state.user} />
        </div>
        <div className="col-md-8">
          <UserInfo user={this.state.user} />
        </div>
      </div>
    </div>);
  }
}

Me.propTypes = {
  user: React.PropTypes.object,
};

export const composer = (props, onData) => {
  const subscription = Meteor.subscribe('userInfo', Meteor.userId());
  if (subscription.ready()) {
    const user = Meteor.users.findOne(Meteor.userId());
    onData(null, { user });
  }
};

export default composeWithTracker(composer, Loading)(Me);
