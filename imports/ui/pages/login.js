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
import { handleLogin } from '../../modules/login';

import { googleAnalytics } from '../../modules/ganalytics.js';

export class Login extends React.Component {
  componentDidMount() {
    handleLogin({ component: this });

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
            <h4 className="page-header">Login</h4>
            <form ref="login" className="login" onSubmit={this.handleSubmit}>
              <FormGroup>
                <ControlLabel>Email Address</ControlLabel>
                <FormControl
                  type="email"
                  ref="emailAddress"
                  name="emailAddress"
                  placeholder="Email Address"
                />
              </FormGroup>
              <FormGroup>
                <ControlLabel>
                  <span className="pull-left">Password</span>
                  <Link className="pull-right" to="/recover-password">
                    Forgot Password?
                  </Link>
                </ControlLabel>
                <FormControl
                  type="password"
                  ref="password"
                  name="password"
                  placeholder="Password"
                />
              </FormGroup>
              <Button type="submit" bsStyle="success">
                Login
              </Button>
            </form>
          </Col>
        </Row>
      </Grid>
    );
  }
}
