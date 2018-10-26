import React from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import { LinkContainer } from 'react-router-bootstrap';
import { Alert } from 'react-bootstrap';

import { Loading } from '../../components/loading.js';
import { removeUser } from '../../../api/users/methods.js';
import { Bert } from 'meteor/themeteorchef:bert';

class AdminUsers extends React.Component {
  constructor() {
    super();
    this.state = {
      limit: 50,
      searchText: '',
      searchStatus: 'all'
    };
  }

  handleLoadMore() {
    this.setState({
      limit: this.state.limit + 50
    });
  }

  handleSearch(text, status = 'all') {
    this.setState({
      searchText: text,
      searchStatus: status
    });
  }

  handleRemove(_id) {
    removeUser.call(
      {
        _id
      },
      error => {
        if (error) {
          Bert.alert(error.reason, 'danger');
        } else {
          Bert.alert('User removed!', 'success');
        }
      }
    );
  }

  render() {
    return (
      <div>
        {this.props.users.length ? (
          <table className="table table-inbox table-hover" ref="productsPage">
            <tbody>
              {this.props.users.map(user => (
                <tr key={user._id}>
                  <td>
                    {user.profile.name.first} {user.profile.name.last}
                  </td>
                  <td>{user.emails[0].address}</td>
                  <td>{user.profile.address}</td>
                  <td>{user.profile.city}</td>
                  <td>{user.profile.country}</td>
                  <td>{user.profile.postal_code}</td>
                  <td>
                    <LinkContainer to={`/admin/users/${user._id}/edit`}>
                      <button className="btn btn-primary">Edit</button>
                    </LinkContainer>
                    <button
                      className="btn btn-danger"
                      onClick={this.handleRemove.bind(this, user._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Alert bsStyle="warning">No users yet.</Alert>
        )}
      </div>
    );
  }
}

AdminUsers.propTypes = {
  users: PropTypes.array,
  limit: PropTypes.number
};

export default withTracker(() => {
  Meteor.subscribe('usersList');

  return {
    users: Meteor.users.find({}).fetch()
  };
})(AdminUsers);
