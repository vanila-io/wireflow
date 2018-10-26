import React from 'react';
import { Meteor } from 'meteor/meteor';
import { chai } from 'meteor/practicalmeteor:chai';
import Enzyme, { mount } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

Enzyme.configure({ adapter: new Adapter() });
const expect = chai.expect;

const TestComponent = () => {
  return (
    <div>
      <p>Hello World!</p>
    </div>
  );
};

describe('Client', function() {
  it('should be able to run tests on client', function() {
    const res = Meteor.isClient;
    expect(res).to.be.ok;

    const wrapper = mount(<TestComponent />);
    expect(wrapper.find('p').text()).to.equal('Hello World!');
  });
});
