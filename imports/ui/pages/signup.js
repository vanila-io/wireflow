import React from 'react';
import { Link } from 'react-router';
import {
  Grid,
  Row,
  Col,
  FormGroup,
  ControlLabel,
  FormControl,
  Button
} from 'react-bootstrap';
import { handleSignup } from '../../modules/signup';
import { googleAnalytics } from '../../modules/ganalytics.js';

export class Signup extends React.Component {
  componentDidMount() {
    handleSignup({ component: this });
    googleAnalytics(document.location.pathname);
  }

  handleSubmit(event) {
    event.preventDefault();
  }

  render() {
    return (
      <Grid>
        <Row>
          <Col xs={12} sm={6} md={4}>
            <h4 className="page-header">Sign Up</h4>
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
              <Button type="submit" bsStyle="success">
                Sign Up
              </Button>
            </form>
            <p>
              Already have an account? <Link to="/login">Log In</Link>.
            </p>
          </Col>
        </Row>
      </Grid>
    );
  }
}
