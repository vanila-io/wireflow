import { Slingshot } from 'meteor/edgee:slingshot';
import { Random } from 'meteor/random';
import { Meteor } from 'meteor/meteor';

if (Meteor.settings.S3bucket === undefined) {
  
  // eslint-disable-next-line no-console
  console.log('AWS credentials for saving to S3 are not defined at settings.json, so saving does not work.');

} else {

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

}
