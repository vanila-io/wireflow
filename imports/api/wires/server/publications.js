import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Wires } from '../wires.js';

Meteor.publish('wires', () => Wires.find({}));

Meteor.publish('wireInfo', (_id) => {
  check(_id, String);
  return Wires.find({ _id });
});
Meteor.publish('myWire', (_id) => {
  check(_id, String);
  return Wires.find({$or: [{userId: _id },{'editUsers.userId': _id},{'readonlyUsers.userId': _id}]});
//
});
