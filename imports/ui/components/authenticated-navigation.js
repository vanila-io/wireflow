import React from 'react';
import PropTypes from 'prop-types';
import { browserHistory } from 'react-router';
import { IndexLinkContainer, LinkContainer } from 'react-router-bootstrap';
import { Nav, NavItem, NavDropdown, MenuItem } from 'react-bootstrap';
import { Meteor } from 'meteor/meteor';

const handleLogout = () => Meteor.logout(() => browserHistory.push('/login'));
const handleViewProfile = () => browserHistory.push('/me');

const userName = () => {
  const user = Meteor.user();
  const name = user && user.profile ? user.profile.name : '';
  return user ? `${name.first} ${name.last}` : '';
};

export const AuthenticatedNavigation = () => (
  <div>
    <Nav pullRight>
      <NavDropdown eventKey={3} title={userName()} id="basic-nav-dropdown">
        <MenuItem eventKey={3.1} onClick={handleViewProfile}>
          Profile
        </MenuItem>
        <MenuItem eventKey={3.2} onClick={handleLogout}>
          Logout
        </MenuItem>
      </NavDropdown>
    </Nav>
  </div>
);
