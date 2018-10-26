import { Meteor } from 'meteor/meteor';
import { Graphics } from './graphics';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { rateLimit } from '../../modules/rate-limit.js';

export const insertGraphic = new ValidatedMethod({
  name: 'graphic.insert',
  validate: new SimpleSchema({
    name: { type: String },
    link: { type: String },
    cat: { type: String }
  }).validator(),
  run(graphic) {
    return Graphics.insert(graphic);
  }
});

rateLimit({
  methods: [insertGraphic],
  limit: 5,
  timeRange: 1000
});

Meteor.methods({
  getGraphics: (name, categories) => {
    check(name, String);

    check(categories, String);

    // check(categories, [Object]);
    if (name === 'none' && categories === 'none') {
      return Graphics.find().fetch();
      // return Graphics.find({cat:{ $in: categories }}).fetch();
    } else if (categories === 'none') {
      return Graphics.find({
        name: {
          $regex: name,
          $options: 'i'
        }
      }).fetch();
    } else if (name === 'none') {
      return Graphics.find({ cat: categories }).fetch();
    } else {
      return Graphics.find({
        name: {
          $regex: name,
          $options: 'i'
        },
        cat: categories
      }).fetch();
    }
  }
});
