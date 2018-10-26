/* eslint no-param-reassign: ["error", { "props": false }] */
import { Accounts } from 'meteor/accounts-base';

const name = 'Application Name';
const email = '<support@application.com>';
const from = `${name} ${email}`;
const emailTemplates = Accounts.emailTemplates;

emailTemplates.siteName = name;
emailTemplates.from = from;

emailTemplates.resetPassword = {
  subject() {
    return `[${name}] Reset Your Password`;
  },
  text(user, url) {
    const userEmail = user.emails[0].address;
    const urlWithoutHash = url.replace('#/', '');

    return `A password reset has been requested for the account related to this
    address (${userEmail}). To reset the password, visit the following link:
    \n\n${urlWithoutHash}\n\n If you did not request this reset, please ignore
    this email. If you feel something is wrong, please contact our support team:
    ${email}.`;
  }
};

Accounts.onCreateUser((options, user) => {
  user.billing_info = {
    use_profile_address: true
  };
  if (options.profile) {
    user.profile = options.profile;
  }
  return user;
});
