import { Chats } from './chat';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { rateLimit } from '../../modules/rate-limit.js';

export const insertChat = new ValidatedMethod({
  name: 'chat.insert',
  validate: new SimpleSchema({
    userId: { type: String },
    user: { type: String },
    wireId: { type: String },
    message: { type: String }
  }).validator(),
  run(chat) {
    return Chats.insert(chat);
  }
});

rateLimit({
  methods: [insertChat],
  limit: 5,
  timeRange: 1000
});
