import React from 'react';
import PropTypes from 'prop-types';
import { updateUserBillingInfo } from '../../../api/users/methods.js';
import { Bert } from 'meteor/themeteorchef:bert';

const CityCountry = require('country-city');
const Countries = CityCountry.getCountries();

export class BillingInfo extends React.Component {
  setComponentStates(props) {
    const user = props.user;
    const billingInfo = user && user.billing_info;
    const theSameWithProfile = !billingInfo;

    let cities = [];
    if (!theSameWithProfile) {
      cities = billingInfo.city && CityCountry.getCities(billingInfo.country);
    } else {
      cities = user.profile.city && CityCountry.getCities(user.profile.country);
    }

    this.state = {
      _id: user._id,
      address: !theSameWithProfile
        ? billingInfo.address
        : user.profile.address || '',
      country: !theSameWithProfile
        ? billingInfo.country
        : user.profile.country || '',
      city: !theSameWithProfile ? billingInfo.city : user.profile.city || '',
      postal_code: !theSameWithProfile
        ? billingInfo.postal_code
        : user.profile.postal_code || '',
      cities,
      is_same_with_user: billingInfo.use_profile_address,
      edit: false,
      change: false
    };
  }

  componentWillMount() {
    this.setComponentStates(this.props);
  }

  componentWillReceiveProps(nextProps) {
    this.setComponentStates(nextProps);
  }

  handleChange(event) {
    const value =
      event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.value;
    this.setState({
      [event.target.name]: value
    });
    if (event.target.type === 'checkbox') {
      this.setState({
        edit: !value
      });
    }
  }

  handleCancel() {
    this.setState({
      edit: false,
      change: false
    });
  }

  handleNewAddress(event) {
    this.setState({
      change: true
    });
    event.preventDefault();
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

  handleSave(event) {
    updateUserBillingInfo.call(
      {
        _id: this.state._id,
        update: {
          'billing_info.address': this.state.address,
          'billing_info.city': this.state.city,
          'billing_info.country': this.state.country,
          'billing_info.postal_code': this.state.postal_code,
          'billing_info.use_profile_address': false
        }
      },
      error => {
        if (error) {
          Bert.alert(error.reason, 'danger');
        } else {
          Bert.alert('Billing information updated!', 'success');
        }
      }
    );
    event.preventDefault();
  }

  handleUseProfileAddress(event) {
    updateUserBillingInfo.call(
      {
        _id: this.state._id,
        update: {
          'billing_info.use_profile_address': true
        }
      },
      error => {
        if (error) {
          Bert.alert(error.reason, 'danger');
        } else {
          Bert.alert('Billing information updated!', 'success');
          this.setState({
            edit: false,
            change: false
          });
        }
      }
    );
    event.preventDefault();
  }

  renderInfoOrCheckbox() {
    if (this.state.is_same_with_user) {
      return (
        <div className="checkbox">
          <label>
            <input
              type="checkbox"
              name="is_same_with_user"
              value={this.state.is_same_with_user}
              onChange={this.handleChange.bind(this)}
              checked={this.state.is_same_with_user ? 'checked' : false}
            />
            Use my profile address
          </label>
          <p>
            <button
              className="btn btn-sm"
              onClick={this.handleNewAddress.bind(this)}
            >
              Use another address
            </button>
          </p>
        </div>
      );
    }
    return (
      <div>
        <button
          className="btn btn-sm"
          onClick={this.handleNewAddress.bind(this)}
        >
          Use another address
        </button>
        <p>{this.state.address}</p>
        <p>
          {this.state.city}, {this.state.country}
        </p>
        <p>{this.state.postal_code}</p>
      </div>
    );
  }

  renderForm() {
    return (
      <div>
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
        <button
          className="btn btn-primary"
          onClick={this.handleSave.bind(this)}
        >
          Save
        </button>
        <button
          className="btn btn-secondary"
          onClick={this.handleUseProfileAddress.bind(this)}
        >
          Use my profile address
        </button>
        <button className="btn btn-link" onClick={this.handleCancel.bind(this)}>
          Cancel
        </button>
      </div>
    );
  }

  renderBody() {
    if (this.state.edit || this.state.change) {
      return this.renderForm();
    }
    return this.renderInfoOrCheckbox();
  }

  render() {
    return <div>{this.renderBody()}</div>;
  }
}

BillingInfo.propTypes = {
  user: PropTypes.object
};
