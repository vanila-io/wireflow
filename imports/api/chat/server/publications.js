import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Chats } from '../chat.js';

Meteor.publish('wireMessages', wireId => {
  check(wireId, String);
  return Chats.find(
    { wireId },
    {
      sort: { createdAt: -1 },
      limit: 50
    }
  );
});
