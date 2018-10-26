import React from 'react';
import PropTypes from 'prop-types';
import EditUser from '../admin/edit-user.js';
import { browserHistory } from 'react-router';

const Information = ({ state, update }) => (
  <div>
    <button className="btn btn-link pull-right" onClick={update.bind(this)}>
      Update
    </button>
    <h3>
      {state.user.profile.name.first} {state.user.profile.name.last}
    </h3>
    <p>{state.user.emails[0].address}</p>
    <p>{state.user.profile.address}</p>
    <p>
      {state.user.profile.city}, {state.user.profile.country}
    </p>
    <p>{state.user.profile.postal_code}</p>
    <hr />
    <p>Facebook: {state.user.profile.facebook}</p>
    <p>Twitter: {state.user.profile.twitter}</p>
  </div>
);

Information.propTypes = {
  state: PropTypes.object,
  update: PropTypes.func
};

export class UserInfo extends React.Component {
  componentWillMount() {
    this.state = {
      user: this.props.user,
      edit: false
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      user: nextProps.user
    });
  }

  editHandler() {
    this.setState({
      edit: true
    });
  }

  onUpdated() {
    this.setState({
      edit: false
    });
  }

  onCancelled() {
    this.setState({
      edit: false
    });
  }

  renderBody() {
    const state = this.state;
    if (state.edit) {
      return (
        <EditUser
          routeParams={{ id: state.user._id }}
          showResetPassword={false}
          showCancelButton={true}
          onSubmitted={this.onUpdated.bind(this)}
          onCancelled={this.onCancelled.bind(this)}
        />
      );
    }
    return <Information state={state} update={this.editHandler.bind(this)} />;
  }

  render() {
    return <div>{this.renderBody()}</div>;
  }
}

UserInfo.propTypes = {
  user: PropTypes.object
};
