import { Meteor } from 'meteor/meteor';
import { Wires } from '../../../imports/api/wires/wires';
import React from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, IndexRoute, browserHistory } from 'react-router';
import { composeWithTracker } from 'react-komposer';
import { Loading } from '../components/loading.js';
import { Bert } from 'meteor/themeteorchef:bert';
import $ from 'jquery';
import 'materialize-css/dist/css/materialize.css';
import 'hammerjs';import 'materialize-css/dist/js/materialize.js';
import '../../../imports/lib/css/style.css';
import 'jquery-mousewheel';
import '../../../imports/lib/contextMenu.js';


export class MyCharts extends React.Component {
  componentDidMount() {
    const props = this.props;
  }
  deletewire(id){
    Meteor.call('DeleteWire', id, (err, res) => {
      if(!err){
        Bert.alert('Deleted', 'success');
      }else{
        Bert.alert(err.reason, 'warning');
      }
    });
  }
  render() {
    let self=this;
    let minewires =self.props.minewires;
    let wireseditable =self.props.wireseditable;
    let wiresreadonly =self.props.wiresreadonly;
    return (
      <div className="container">
        <h1>Mine</h1>
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Description</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {
              minewires? ( minewires.map(function (wire) {
                return(
                  <tr>
                    <td className="lhUp"><a href={`/wire/${wire._id}`} target="_blank">{wire._id}</a></td>
                    <td className="lhUp"><a href={`/wire/${wire._id}`} target="_blank">{wire.name}</a></td>
                    <td className="lhUp"><a href={`/wire/${wire._id}`} target="_blank">{wire.description}</a></td>
                    <td className="lhUp">{wire.createdAt.toISOString().substring(0, 10).split('-').reverse().join('-')}</td>

                    <td>
                      <button className="btn btn-danger" onClick={self.deletewire.bind(self,wire._id)}>Delete</button>
                    </td>
                  </tr>
                );
              })) : (
                <tr><td>loading</td></tr>
              )
            }
          </tbody>
        </table>
        <h1>I'm Editable</h1>
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Description</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            {
              wireseditable? ( wireseditable.map(function (wire) {
                return(
                  <tr>
                    <td className="lhUp"><a href={`/wire/${wire._id}`} target="_blank">{wire._id}</a></td>
                    <td className="lhUp"><a href={`/wire/${wire._id}`} target="_blank">{wire.name}</a></td>
                    <td className="lhUp"><a href={`/wire/${wire._id}`} target="_blank">{wire.description}</a></td>
                    <td className="lhUp">{wire.createdAt.toISOString().substring(0, 10).split('-').reverse().join('-')}</td>


                  </tr>
                );
              })) : (
                <tr><td>loading</td></tr>
              )
            }
          </tbody>
        </table>
        <h1>I'm ReadOnly</h1>
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Description</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            {
              wiresreadonly? ( wiresreadonly.map(function (wire) {
                return(
                  <tr>
                    <td className="lhUp"><a href={`/wire/${wire._id}`} target="_blank">{wire._id}</a></td>
                    <td className="lhUp"><a href={`/wire/${wire._id}`} target="_blank">{wire.name}</a></td>
                    <td className="lhUp"><a href={`/wire/${wire._id}`} target="_blank">{wire.description}</a></td>
                    <td className="lhUp">{wire.createdAt.toISOString().substring(0, 10).split('-').reverse().join('-')}</td>


                  </tr>
                );
              })) : (
                <tr><td>loading</td></tr>
              )
            }
          </tbody>
        </table>
      </div>
    );
  }
}


MyCharts.propTypes = {
  minewires: React.PropTypes.object
};

export const composer = (props, onData) => {
  let userId=Meteor.userId();
  if(!userId){
    userId='guest';
  }
  //console.log("userId");
  //console.log(userId);
  const subscription = Meteor.subscribe('myWire', userId);
  if (subscription.ready()) {
    const minewires = Wires.find({userId:userId}).fetch();
    const wiresreadonly = Wires.find({'readonlyUsers.userId':userId}).fetch();
    const wireseditable = Wires.find({'editUsers.userId':userId}).fetch();
    //console.log(wiresreadonly);
    //console.log(wireseditable);
    onData(null, {
      minewires,
      wiresreadonly,
      wireseditable
    });
  }
};

export default composeWithTracker(composer, Loading)(MyCharts);
