import { Meteor } from 'meteor/meteor';
import { Graphics } from '../graphics.js';

Meteor.publish('allGraphics', () => {
  return Graphics.find();
});
