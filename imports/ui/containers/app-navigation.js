import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import { AppNavigation } from '../components/app-navigation';

export default withTracker(() => {
  return {
    hasUser: Meteor.user()
  };
})(AppNavigation);
