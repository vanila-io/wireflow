import $ from 'jquery';
import 'jquery-validation';
import { Accounts } from 'meteor/accounts-base';
import { Bert } from 'meteor/themeteorchef:bert';
import { getInputValue } from './get-input-value';

let component;

const handleRecovery = () => {
  Accounts.forgotPassword({
    email: getInputValue(component.refs.emailAddress),
  }, (error) => {
    if (error) {
      Bert.alert(error.reason, 'warning');
    } else {
      Bert.alert('Check your inbox for a reset link!', 'success');
    }
  });
};

const validate = () => {
  $(component.refs.recoverPassword).validate({
    rules: {
      emailAddress: {
        required: true,
        email: true,
      },
    },
    messages: {
      emailAddress: {
        required: 'Need an email address here.',
        email: 'Is this email address legit?',
      },
    },
    submitHandler() { handleRecovery(); },
  });
};

export const handleRecoverPassword = (options) => {
  component = options.component;
  validate();
};
