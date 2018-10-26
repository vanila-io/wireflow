import React from 'react';
import PropTypes from 'prop-types';
import { Navbar } from 'react-bootstrap';
import { Link } from 'react-router';
import { PublicNavigation } from './public-navigation';
import { AuthenticatedNavigation } from './authenticated-navigation';

export class AppNavigation extends React.Component {
  renderNavigation(hasUser) {
    return hasUser ? <AuthenticatedNavigation /> : <PublicNavigation />;
  }

  render() {
    return (
      <Navbar>
        <Navbar.Header>
          <Navbar.Brand>
            <Link to="/">
              <img className="homeLogo" src="/images/icons/logo.svg" />
            </Link>
          </Navbar.Brand>
          <Navbar.Toggle />
        </Navbar.Header>
        <Navbar.Collapse>
          {this.renderNavigation(this.props.hasUser)}
        </Navbar.Collapse>
      </Navbar>
    );
  }
}

AppNavigation.propTypes = {
  hasUser: PropTypes.object
};
