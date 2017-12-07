import { Mongo } from 'meteor/mongo';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';

export const Wires = new Mongo.Collection('wires');

Wires.allow({
  insert: () => false,
  update: () => false,
  remove: () => false,
});

Wires.deny({
  insert: () => true,
  update: () => true,
  remove: () => true,
});
let userandgests = new SimpleSchema({
  userId: {
    type: String,
    optional: true,
  },
  userfullname: {
    type: String,
    optional: true,
  },
  userColor: {
    type: String,
    optional: true,
  },
  clientAddress: {
    type: String,
    optional: true,
  },
  clientAgent: {
    type: String,
    optional: true,
  }
});
let usersList = new SimpleSchema({
  userId: {
    type: String,
    optional: true,
  },
  userfullname: {
    type: String,
    optional: true,
  },
  email: {
    type: String,
    optional: true,
  }
});
Wires.schema = new SimpleSchema({
  name: {
    type: String,
    optional: true,
  },
  description: {
    type: String,
    optional: true,
  },
  userId: {
    type: String,
    optional: true,
  },
  wire_settings: {
    type: String,
    optional: true,
  },
  createdAt: {
    type: Date,
    optional: true,
    autoValue() {
      return new Date();
    },
  },
  editUsers: {
    type: [usersList],
    optional: true,
  },
  room_mode: {
    type: String,
    optional: true,
    defaultValue: 'edit'
  },
  readonlyUsers: {
    type: [usersList],
    optional: true,
  },
  guestsUsers: {
    type: [userandgests],
    optional: true,
  }
});

Wires.attachSchema(Wires.schema);