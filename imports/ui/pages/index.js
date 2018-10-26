import React from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { Grid } from 'react-bootstrap';
import { insertDesign } from '../../api/wires/methods.js';
import { Bert } from 'meteor/themeteorchef:bert';
import { browserHistory } from 'react-router';

import $ from 'jquery';
import 'hammerjs';
import 'materialize-css/dist/css/materialize.css';
import 'materialize-css/dist/js/materialize.js';

export class Index extends React.Component {
  componentWillReceiveProps(nextProps) {
    const query = nextProps.location.query;
    this.setState({
      category: query.category,
      search: query.search
    });
  }

  componentWillMount() {
    const query = this.props.location.query;
    this.state = {
      category: query.category,
      search: query.search,
      rerender: false
    };
  }

  createDesign() {
    insertDesign.call(
      {
        wire_settings: '{}',
        name: 'new Design',
        description: 'Description',
        userId: Meteor.userId() || Meteor._localStorage.getItem('wfg')
      },
      (error, success) => {
        if (error) {
          Bert.alert(error.reason, 'danger');
        } else {
          browserHistory.push(`/wire/${success}`);
        }
      }
    );
  }

  renderCart() {
    this.setState({
      rerender: Random.id()
    });
  }

  render() {
    if (!Meteor.user()) {
      if (!Meteor._localStorage.getItem('wfg')) {
        Meteor._localStorage.setItem('wfg', `guest${Random.id(4)}`);
      }
    }
    return (
      <div>
        <div className="row homeCont">
          <div className="col-md-6 colImg">
            <img src="/images/icons/homeImg.png" />
          </div>
          <div className="col-md-6 colTxt">
            <h1>Easiest flowchart tool</h1>
            <p>
              Wireflow is free online tool for creating beautiful wireframes &
              user flows. NO Photoshop skills required!
            </p>
            <button className="white" onClick={this.createDesign.bind(this)}>
              Start Designing
            </button>
          </div>
        </div>
        <div className="row homeContBottom">
          <div className="col-md-4">
            <img src="/images/icons/Optimnetwork.svg" />
            <h3>Create beautiful flow charts</h3>
            <p>
              Wireflow is free online tool for creating beautiful wireframes &
              user flows.
            </p>
          </div>
          <div className="col-md-4">
            <img src="/images/icons/No.svg" />
            <h3>No Photoshop skills required</h3>
            <p>
              Very easy to use and you don't need any prior knowledge of
              Photoshop or any other software skills!
            </p>
          </div>
          <div className="col-md-4">
            <img src="/images/icons/Chat.svg" />
            <h3>Live fast communication</h3>
            <p>Easy communication with your team mates trough live chat.</p>
          </div>
        </div>
      </div>
    );
  }
}

Index.propTypes = {
  location: PropTypes.object,
  route: PropTypes.object
};
