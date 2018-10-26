import { Meteor } from 'meteor/meteor';
import { chai } from 'meteor/practicalmeteor:chai';

const expect = chai.expect;

describe('Server', function() {
  it('should be able to run tests on server', function() {
    const res = Meteor.isServer;
    expect(res).to.be.ok;
  });
});
