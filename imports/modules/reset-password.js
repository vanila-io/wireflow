import $ from 'jquery';
import 'jquery-validation';
import { browserHistory } from 'react-router';
import { Accounts } from 'meteor/accounts-base';
import { Bert } from 'meteor/themeteorchef:bert';
import { getInputValue } from './get-input-value';

let component;
let token;

const handleReset = () => {
  const password = getInputValue(component.refs.newPassword);
  Accounts.resetPassword(token, password, (error) => {
    if (error) {
      Bert.alert(error.reason, 'danger');
    } else {
      browserHistory.push('/');
      Bert.alert('Password reset!', 'success');
    }
  });
};

const validate = () => {
  $(component.refs.resetPassword).validate({
    rules: {
      newPassword: {
        required: true,
        minlength: 6,
      },
      repeatNewPassword: {
        required: true,
        minlength: 6,
        equalTo: '[name="newPassword"]',
      },
    },
    messages: {
      newPassword: {
        required: 'Enter a new password, please.',
        minlength: 'Use at least six characters, please.',
      },
      repeatNewPassword: {
        required: 'Repeat your new password, please.',
        equalTo: 'Hmm, your passwords don\'t match. Try again?',
      },
    },
    submitHandler() { handleReset(); },
  });
};

export const handleResetPassword = (options) => {
  component = options.component;
  token = options.token;
  validate();
};
