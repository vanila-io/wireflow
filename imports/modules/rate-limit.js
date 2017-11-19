import { Meteor } from 'meteor/meteor';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import { _ } from 'meteor/underscore';

const fetchMethodNames = (methods) => _.pluck(methods, 'name');

const assignLimits = ({ methods, limit, timeRange }) => {
  const methodNames = fetchMethodNames(methods);

  if (Meteor.isServer) {
    DDPRateLimiter.addRule({
      name(name) { return _.contains(methodNames, name); },
      connectionId() { return true; },
    }, limit, timeRange);
  }
};

export const rateLimit = (options) => assignLimits(options);
