import { Meteor } from 'meteor/meteor';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { rateLimit } from '../../modules/rate-limit.js';
import { Accounts } from 'meteor/accounts-base';

export const updateUser = new ValidatedMethod({
  name: 'users.update',
  validate: new SimpleSchema({
    _id: { type: String },
    email: { type: String },
    'update.profile.name.first': { type: String },
    'update.profile.name.last': { type: String },
    'update.profile.address': { type: String, optional: true },
    'update.profile.country': { type: String, optional: true },
    'update.profile.city': { type: String, optional: true },
    'update.profile.postal_code': { type: String, optional: true },
    'update.profile.facebook': { type: String, optional: true },
    'update.profile.twitter': { type: String, optional: true }
  }).validator(),
  run({ _id, update, email }) {
    const emailExists = Meteor.users.findOne({
      'emails.0.address': email,
      _id: { $ne: _id }
    });
    if (emailExists)
      throw new Meteor.Error('invalid-data', 'Email already used.');
    Meteor.users.update(_id, { $set: update });
  }
});

export const updateUserBillingInfo = new ValidatedMethod({
  name: 'users.updateBillingInfo',
  validate: new SimpleSchema({
    _id: { type: String },
    'update.billing_info.address': { type: String, optional: true },
    'update.billing_info.country': { type: String, optional: true },
    'update.billing_info.city': { type: String, optional: true },
    'update.billing_info.postal_code': { type: String, optional: true },
    'update.billing_info.use_profile_address': { type: Boolean, optional: true }
  }).validator(),
  run({ _id, update }) {
    Meteor.users.update(_id, { $set: update });
  }
});

export const removeUser = new ValidatedMethod({
  name: 'users.remove',
  validate: new SimpleSchema({
    _id: { type: String }
  }).validator(),
  run({ _id }) {
    if (_id === Meteor.userId())
      throw new Meteor.Error('own-user', 'Can not delete current user.');
    Meteor.users.remove(_id);
  }
});

export const createUser = new ValidatedMethod({
  name: 'users.create',
  validate: null,
  run(newUser) {
    return Accounts.createUser(newUser);
  }
});

export const updateAvatar = new ValidatedMethod({
  name: 'user.upload.avatar',
  validate: null,
  run({ _id, url }) {
    Meteor.users.update({ _id }, { $set: { 'profile.avatar': url } });
  }
});

rateLimit({
  methods: [updateUser, removeUser],
  limit: 1,
  timeRange: 1000
});
