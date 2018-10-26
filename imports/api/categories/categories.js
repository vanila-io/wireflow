import { Mongo } from 'meteor/mongo';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';

export const Categories = new Mongo.Collection('categories');

Categories.allow({
  insert: () => false,
  update: () => false,
  remove: () => false
});

Categories.deny({
  insert: () => true,
  update: () => true,
  remove: () => true
});

Categories.schema = new SimpleSchema({
  name: {
    type: String
  }
});

Categories.attachSchema(Categories.schema);
