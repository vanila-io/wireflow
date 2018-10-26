import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

Meteor.publish('usersList', () => Meteor.users.find({}));

Meteor.publish('userInfo', _id => {
  check(_id, String);
  return Meteor.users.find({ _id });
});
// Meteor.publish('usersInfo', () => {
//   return Meteor.users.find();
// });
