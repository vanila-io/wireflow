import { Slingshot } from 'meteor/edgee:slingshot';
import { Random } from 'meteor/random';
import { Meteor } from 'meteor/meteor';

/* Commented out, because got this error from code below:
 * Error: Match error: Expected string, got undefined in field bucket
 * at check (packages/check/match.js:36:17)
 * at new Slingshot.Directive (packages/edgee_slingshot.js:325:3)
 * at Object.Slingshot.createDirective (packages/edgee_slingshot.js:295:5)
 * at Slingshot.js (imports/startup/server/Slingshot.js:5:11)
 * at fileEvaluate (packages/modules-runtime.js:336:7)
 * at Module.require (packages/modules-runtime.js:238:14)
 * at Module.moduleLink [as link] (/home/user/.meteor/packages/modules/.0.13.0.60cbwj.yyusx++os+web.browser+web.browser.legacy+web.cordova/npm/node_modules/reify/lib/runtime/index.js:38:38)

Slingshot.createDirective('uploadTemplate', Slingshot.S3Storage, {
  bucket: Meteor.settings.S3bucket,
  acl: 'public-read',
  allowedFileTypes: ['image/svg+xml', 'image/png', 'image/jpeg'],
  // allowedFileTypes: ['image/png', 'image/jpeg', 'image/gif'],
  // maxSize: 10 * 1024 * 1024, // 10 MB (use null for unlimited)
  maxSize: null, // 10 MB (use null for unlimited)

  authorize() {
    // if (!Roles.userIsInRole(this.userId, 'admin')) {
    //   throw new Meteor.Error('permission-denied', 'Permission denied');
    // }

    return true;
  },

  key(file) {
    const fileName = file.name || 'noname';
    return `mockups/${Random.id()}${fileName}`;
  }
});

Slingshot.createDirective('uploadJSON', Slingshot.S3Storage, {
  bucket: Meteor.settings.S3bucket,
  acl: 'public-read',
  allowedFileTypes: ['application/json'],
  // allowedFileTypes: ['image/png', 'image/jpeg', 'image/gif'],
  // maxSize: 10 * 1024 * 1024, // 10 MB (use null for unlimited)
  maxSize: null, // 10 MB (use null for unlimited)

  authorize() {
    // if (!Roles.userIsInRole(this.userId, 'admin')) {
    //   throw new Meteor.Error('permission-denied', 'Permission denied');
    // }

    return true;
  },

  key(file) {
    const fileName = file.name || 'noname';
    return `mockups/${Random.id()}${fileName}`;
  }
});

*/
