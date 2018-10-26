import React from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { Bert } from 'meteor/themeteorchef:bert';
import { withTracker } from 'meteor/react-meteor-data';

import { Loading } from '../loading.js';
import { updateUser } from '../../../api/users/methods.js';
import { browserHistory } from 'react-router';
import { Accounts } from 'meteor/accounts-base';

const CityCountry = require('country-city');
const Countries = CityCountry.getCountries();

class EditUser extends React.Component {
  componentWillMount() {
    const user = this.props.user;
    const showResetPassword =
      typeof this.props.showResetPassword === 'undefined'
        ? true
        : this.props.showResetPassword;
    const showCancelButton =
      typeof this.props.showCancelButton === 'undefined'
        ? true
        : this.props.showCancelButton;
    this.state = {
      _id: user._id,
      firstname: user.profile.name.first,
      lastname: user.profile.name.last,
      email_address: user.emails[0].address,
      address: user.profile.address || '',
      country: user.profile.country || '',
      city: user.profile.city || '',
      facebook: user.profile.facebook || '',
      twitter: user.profile.twitter || '',
      postal_code: user.profile.postal_code || '',
      cities: user.profile.city
        ? CityCountry.getCities(user.profile.country)
        : [],
      showResetPassword,
      showCancelButton
    };
  }

  handleResetPassword() {
    Accounts.forgotPassword(
      {
        email: this.state.email_address
      },
      error => {
        if (error) {
          Bert.alert(error.reason, 'warning');
        } else {
          Bert.alert('Email was sent to users email address.!', 'success');
        }
      }
    );
  }

  handleSubmit(event) {
    const update = {
      'profile.name.first': this.state.firstname,
      'profile.name.last': this.state.lastname,
      'profile.address': this.state.address,
      'profile.country': this.state.country,
      'profile.city': this.state.city,
      'profile.postal_code': this.state.postal_code,
      'profile.facebook': this.state.facebook,
      'profile.twitter': this.state.twitter
    };
    updateUser.call(
      {
        _id: this.state._id,
        update,
        email: this.state.email_address
      },
      error => {
        if (error) {
          Bert.alert(error.reason, 'danger');
        } else {
          if (this.props.onSubmitted) {
            this.props.onSubmitted.call();
          } else {
            Bert.alert('User updated!', 'success');
            browserHistory.goBack();
          }
        }
      }
    );
    event.preventDefault();
  }

  handleCancel(event) {
    this.props.onCancelled.call();
    event.preventDefault();
  }

  handleChange(event) {
    let value =
      event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.value;
    value = event.target.type === 'number' ? +value : value;
    this.setState({
      [event.target.name]: value
    });
  }

  handleCountryChange(event) {
    const value = event.target.value;
    const cities = CityCountry.getCities(value);
    this.setState({
      [event.target.name]: value,
      cities,
      city: cities[0]
    });
  }

  render() {
    return (
      <div className="row">
        {this.state.showResetPassword ? (
          <div className="col-md-12">
            <button
              className="pull-right btn btn-primary"
              onClick={this.handleResetPassword.bind(this)}
            >
              Reset Password
            </button>
          </div>
        ) : (
          ''
        )}
        <div className="col-md-12">
          <form>
            <div className="form-group">
              <label className="control-label">First Name</label>
              <input
                type="text"
                name="firstname"
                className="form-control"
                value={this.state.firstname}
                onChange={this.handleChange.bind(this)}
              />
            </div>
            <div className="form-group">
              <label className="control-label">Last Name</label>
              <input
                type="text"
                name="lastname"
                className="form-control"
                value={this.state.lastname}
                onChange={this.handleChange.bind(this)}
              />
            </div>
            <div className="form-group">
              <label className="control-label">Email</label>
              <input
                type="text"
                name="email_address"
                className="form-control"
                value={this.state.email_address}
                onChange={this.handleChange.bind(this)}
              />
            </div>
            <div className="form-group">
              <label className="control-label">Address</label>
              <textarea
                name="address"
                className="form-control"
                value={this.state.address}
                onChange={this.handleChange.bind(this)}
              />
            </div>
            <div className="form-group">
              <label className="control-label">Country</label>
              <select
                className="selectpicker form-control"
                name="country"
                onChange={this.handleCountryChange.bind(this)}
                value={this.state.country}
              >
                <option value="">Select Country</option>
                {Countries.map((country, index) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="control-label">City</label>
              <select
                className="selectpicker form-control"
                name="city"
                onChange={this.handleChange.bind(this)}
                value={this.state.city}
              >
                {this.state.cities.map((city, index) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="control-label">Postal Code</label>
              <input
                type="text"
                name="postal_code"
                className="form-control"
                value={this.state.postal_code}
                onChange={this.handleChange.bind(this)}
              />
            </div>
            <div className="form-group">
              <hr />
            </div>
            <div className="form-group">
              <label className="control-label">Facebook Profile</label>
              <input
                type="text"
                name="facebook"
                className="form-control"
                value={this.state.facebook}
                onChange={this.handleChange.bind(this)}
              />
            </div>
            <div className="form-group">
              <label className="control-label">Twitter</label>
              <input
                type="text"
                name="twitter"
                className="form-control"
                value={this.state.twitter}
                onChange={this.handleChange.bind(this)}
              />
            </div>
            <div className="form-group">
              <button
                className="btn btn-primary"
                onClick={this.handleSubmit.bind(this)}
              >
                Update
              </button>
              {this.renderCancelButton()}
            </div>
          </form>
        </div>
      </div>
    );
  }

  renderCancelButton() {
    if (this.state.showCancelButton) {
      return (
        <button
          className="btn btn-secondary"
          onClick={this.handleCancel.bind(this)}
        >
          Cancel
        </button>
      );
    }
    return '';
  }
}

EditUser.propTypes = {
  user: PropTypes.object,
  countries: PropTypes.array,
  showResetPassword: PropTypes.bool,
  showCancelButton: PropTypes.bool,
  onCancelled: PropTypes.func,
  onSubmitted: PropTypes.func
};

export default withTracker(props => {
  Meteor.subscribe('usersList');

  return {
    user: Meteor.users.findOne(props.routeParams.id)
  };
})(EditUser);
