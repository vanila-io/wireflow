import { Meteor } from 'meteor/meteor';
import { Categories } from '../categories.js';

Meteor.publish('allCategories', () => {
  return Categories.find();
});
