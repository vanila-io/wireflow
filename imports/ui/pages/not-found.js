import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'react-bootstrap';

export const NotFound = () => (
  <Alert bsStyle="danger">
    <p>
      <strong>Error [404]</strong>: {window.location.pathname} does not exist.
    </p>
  </Alert>
);
