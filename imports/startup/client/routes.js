import React from 'react';
import { render } from 'react-dom';
import { Router, Route, IndexRoute, browserHistory } from 'react-router';
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

import { App } from '../../ui/layouts/app';
import { AdminLayout } from '../../ui/layouts/admin.js';

import AdminUsers from '../../ui/pages/admin/users';
import EditUser from '../../ui/components/admin/edit-user';
import CreateUser from '../../ui/components/admin/create-user';
import AdminWires from '../../ui/pages/admin/wires';

import { Index } from '../../ui/pages/index';
import { Login } from '../../ui/pages/login';
import { NotFound } from '../../ui/pages/not-found';
import { RecoverPassword } from '../../ui/pages/recover-password';
import { ResetPassword } from '../../ui/pages/reset-password';
import { Signup } from '../../ui/pages/signup';
import FlowDesigner from '../../ui/pages/flowdesigner';
import MyCharts from '../../ui/pages/mycharts';
import Me from '../../ui/pages/me.js';

/**
 * Quick Patch Admin role
 */

const isAdmin = () => {
  return new Promise((resolve, reject) => {
    const userId = Meteor.userId();
    Meteor.call('isAdmin', userId, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

const requireAuth = (nextState, replace, cb) => {
  // If no user, redirect to login
  if (!Meteor.loggingIn() && !Meteor.userId()) {
    return replace({
      pathname: '/login',
      state: { nextPathname: nextState.location.pathname }
    });
  }
  isAdmin().then(userIsAdmin => {
    if (!userIsAdmin) {
      console.log('User is not admin');
      replace({
        pathname: '/me'
      });
      cb();
    } else {
      cb();
    }
  });
};

const routes = () => (
  <Router history={browserHistory}>
    <Route path="/" component={App}>
      <IndexRoute name="index" component={Index} showJumbotron={true} />
      <Route name="login" path="/login" component={Login} />
      <Route
        name="recover-password"
        path="/recover-password"
        component={RecoverPassword}
      />
      <Route
        name="reset-password"
        path="/reset-password/:token"
        component={ResetPassword}
      />
      <Route name="signup" path="/signup" component={Signup} />

      <Route name="room" path="/wire/:id" component={FlowDesigner} />
      <Route name="charts" path="/mycharts" component={MyCharts} />
      <Route name="me" path="/me" component={Me} />

      <Route
        name="admin"
        path="admin"
        component={AdminLayout}
        onEnter={requireAuth}
      >
        <IndexRoute name="index" component={AdminWires} />
        <Route name="admin-users" path="users" component={AdminUsers} />
        <Route
          name="admin-users-edit"
          path="users/:id/edit"
          component={EditUser}
        />
        <Route
          name="admin-users-create"
          path="users/create"
          component={CreateUser}
        />
        <Route name="admin-wires" path="wires" component={AdminWires} />
      </Route>

      <Route path="*" component={NotFound} />
    </Route>
  </Router>
);
Meteor.startup(() => {
  render(routes(), document.getElementById('react-root'));
});
