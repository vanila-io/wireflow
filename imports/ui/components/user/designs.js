import React from 'react';
import { Meteor } from 'meteor/meteor';
import { composeWithTracker } from 'react-komposer';
import { Alert } from 'react-bootstrap';
import { Bert } from 'meteor/themeteorchef:bert';
import { Loading } from '../loading.js';
import { Designs } from '../../../api/user-designs/user-designs.js';
import { removeDesign } from '../../../api/user-designs/methods.js';
import { LinkContainer } from 'react-router-bootstrap';

const style = {
  padding5: {
    padding: '15px',
  },
};

class UserDesigns extends React.Component {
  handleDelete(_id, event) {
    removeDesign.call({ _id }, (error) => {
      if (error) {
        Bert.alert(error.reason, 'danger');
      } else {
        Bert.alert('Design removed', 'success');
      }
    });
    event.preventDefault();
  }

  render() {
    return (<div>
      {this.props.designs.length ?
        <div>
          {this.props.designs.map((design) =>
            <div className="row" key={design._id} style={style.padding5}>
              <div className="col-md-8">
                <img src={design.design_url} className="img-responsive" />
              </div>
              <div className="col-md-4 text-center">
                <LinkContainer to={`/me/designs/${design._id}/edit`}>
                  <button className="btn btn-primary">Edit</button>
                </LinkContainer>
                <button className="btn btn-primary"
                  onClick={this.handleDelete.bind(this, design._id)}>Delete</button>
              </div>
            </div>
          )}
        </div>
        :
        <Alert bsStyle="warning">No designs yet.</Alert>
      }
    </div>);
  }
}

UserDesigns.propTypes = {
  designs: React.PropTypes.array,
};

export const composer = (props, onData) => {
  const options = {
    limit: props.all ? 1000 : 5,
    sort: { createdAt: -1 },
  };

  const filter = {
    userId: Meteor.userId(),
  };

  const subscription = Meteor.subscribe('userDesigns', { filter, options });
  if (subscription.ready()) {
    const designs = Designs.find(filter, { sort: { createdAt: -1 } }).fetch();
    onData(null, { designs });
  }
};

export default composeWithTracker(composer, Loading)(UserDesigns);
