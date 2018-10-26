import { Categories } from './categories';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { rateLimit } from '../../modules/rate-limit.js';

export const insertCategory = new ValidatedMethod({
  name: 'category.insert',
  validate: new SimpleSchema({
    name: { type: String }
  }).validator(),
  run(category) {
    return Categories.insert(category);
  }
});

rateLimit({
  methods: [insertCategory],
  limit: 5,
  timeRange: 1000
});
