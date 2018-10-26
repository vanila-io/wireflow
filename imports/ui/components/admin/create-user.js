import React from 'react';
import PropTypes from 'prop-types';
import {
  Grid,
  Row,
  Col,
  FormGroup,
  ControlLabel,
  FormControl,
  Button
} from 'react-bootstrap';
import { handleSignup } from '../../../modules/create-user-admin';

const CityCountry = require('country-city');
const Countries = CityCountry.getCountries();

export default class CreateUser extends React.Component {
  componentWillMount() {
    this.state = {
      cities: []
    };
  }

  componentDidMount() {
    handleSignup({ component: this });
  }

  handleSubmit(event) {
    event.preventDefault();
  }

  handleCountryChange(event) {
    this.setState({
      cities: CityCountry.getCities(event.target.value)
    });
  }

  render() {
    return (
      <Grid fluid={true}>
        <Row>
          <Col md={12}>
            <h4 className="page-header">Account Info</h4>
            <form ref="signup" className="signup" onSubmit={this.handleSubmit}>
              <Row>
                <Col xs={6} sm={6}>
                  <FormGroup>
                    <ControlLabel>First Name</ControlLabel>
                    <FormControl
                      type="text"
                      ref="firstName"
                      name="firstName"
                      placeholder="First Name"
                    />
                  </FormGroup>
                </Col>
                <Col xs={6} sm={6}>
                  <FormGroup>
                    <ControlLabel>Last Name</ControlLabel>
                    <FormControl
                      type="text"
                      ref="lastName"
                      name="lastName"
                      placeholder="Last Name"
                    />
                  </FormGroup>
                </Col>
              </Row>
              <FormGroup>
                <ControlLabel>Email Address</ControlLabel>
                <FormControl
                  type="text"
                  ref="emailAddress"
                  name="emailAddress"
                  placeholder="Email Address"
                />
              </FormGroup>
              <FormGroup>
                <ControlLabel>Password</ControlLabel>
                <FormControl
                  type="password"
                  ref="password"
                  name="password"
                  placeholder="Password"
                />
              </FormGroup>
              <h4 className="page-header">Personal Details</h4>
              <FormGroup>
                <ControlLabel>Address</ControlLabel>
                <textarea
                  className="form-control"
                  ref="address"
                  name="address"
                  placeholder="123 Main St."
                />
              </FormGroup>
              <FormGroup>
                <ControlLabel>Country</ControlLabel>
                <select
                  className="form-control"
                  type="select"
                  ref="country"
                  name="country"
                  onChange={this.handleCountryChange.bind(this)}
                >
                  <option value="">Select Country</option>
                  {Countries.map((country, index) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup>
                <ControlLabel>City</ControlLabel>
                <select className="form-control" ref="city" name="city">
                  <option value="">Select City</option>
                  {this.state.cities.map((city, index) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup>
                <ControlLabel>Postal Code</ControlLabel>
                <FormControl
                  className="form-control"
                  type="text"
                  ref="postal_code"
                  name="postal_code"
                  placeholder="1234"
                />
              </FormGroup>
              <Button type="submit" bsStyle="success">
                Create User
              </Button>
            </form>
          </Col>
        </Row>
      </Grid>
    );
  }
}
