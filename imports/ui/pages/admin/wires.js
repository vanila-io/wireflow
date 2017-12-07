import React from 'react';
import { Meteor } from 'meteor/meteor';
import { composeWithTracker } from 'react-komposer';
import { LinkContainer } from 'react-router-bootstrap';
import { Alert } from 'react-bootstrap';
import { Loading } from '../../components/loading.js';
import { Wires } from '../../../api/wires/wires.js';
import { removeWire } from '../../../api/wires/methods.js';
import { Bert } from 'meteor/themeteorchef:bert';

class AdminWires extends React.Component {
  constructor() {
    super();
    this.state = {
      limit: 50,
      searchText: '',
      searchStatus: 'all',
    };
  }

  handleLoadMore() {
    this.setState({
      limit: this.state.limit + 50,
    });
  }

  handleSearch(text, status = 'all') {
    this.setState({
      searchText: text,
      searchStatus: status,
    });
  }

  handleRemove(_id) {
    removeWire.call({
      _id,
    }, (error) => {
      if (error) {
        Bert.alert(error.reason, 'danger');
      } else {
        Bert.alert('Wire removed!', 'success');
      }
    });
  }
 
  wireOwner(id){

    const subscription = Meteor.subscribe('userInfo',id);
    if (subscription.ready()) {
      let user=Meteor.users.findOne({_id:id});
      if(user){
        return user.profile.name.first+' '+user.profile.name.last;

      }else{
        return id;
      }
    }
      
  }
  render() {
    return (<div>
      {this.props.wires ?
        <table className="table table-inbox table-hover" ref="productsPage">
          <tbody>
            {this.props.wires.map((wire) =>
              <tr key={wire._id}>
                <td><a href={`/wire/${wire._id}`} target="_blank">{wire.name}</a></td>
                <td><a href={`/wire/${wire._id}`} target="_blank">{wire.description}</a></td>
                <td>{wire.createdAt.toISOString().substring(0, 10).split('-').reverse().join('-')}</td>
                <td>{this.wireOwner(wire.userId)}</td>
                <td>
                  <button className="btn btn-danger"
                    onClick={this.handleRemove.bind(this, wire._id)}>Delete</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        :
        <Alert bsStyle="warning">No wires yet.</Alert>
      }
    </div>);
  }
}

AdminWires.propTypes = {
  wires: React.PropTypes.array,
  limit: React.PropTypes.number,
};

const composer = (params, onData) => {
  const subscription = Meteor.subscribe('wires');
  if (subscription.ready()) {
    const wires = Wires.find({}).fetch();
    onData(null, { wires });
  }
};

export default composeWithTracker(composer, Loading)(AdminWires);
