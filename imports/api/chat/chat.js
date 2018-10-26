import { Mongo } from 'meteor/mongo';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';

export const Chats = new Mongo.Collection('chats');

Chats.allow({
  insert: () => false,
  update: () => false,
  remove: () => false
});

Chats.deny({
  insert: () => true,
  update: () => true,
  remove: () => true
});

Chats.schema = new SimpleSchema({
  userId: {
    type: String
  },
  wireId: {
    type: String
  },
  message: {
    type: String
  },
  user: {
    type: String
  },
  createdAt: {
    type: Date,
    optional: true,
    autoValue() {
      return new Date();
    }
  }
});

Chats.attachSchema(Chats.schema);
