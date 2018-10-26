import React from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { Bert } from 'meteor/themeteorchef:bert';
import { withTracker } from 'meteor/react-meteor-data';

import { Loading } from '../components/loading.js';
import { Chats } from '../../../imports/api/chat/chat';
import { insertChat } from '../../../imports/api/chat/methods';

let user = null;

class ChatBox extends React.Component {
  componentDidMount() {
    let user2;

    if (!Meteor.user()) {
      if (!Meteor._localStorage.getItem('wfg')) {
        Meteor._localStorage.setItem('wfg', `guest${Random.id(4)}`);
        user = Meteor._localStorage.getItem('wfg');
        Meteor._localStorage.setItem('wfg2', user);
      } else {
        user = Meteor._localStorage.getItem('wfg');
      }
    } else {
      user = Meteor.user();
    }
    user2 = Meteor._localStorage.getItem('wfg2');
    if (Meteor.user()) {
      Meteor._localStorage.setItem(
        'wfg2',
        Meteor.user().profile.name.first + ' ' + Meteor.user().profile.name.last
      );
    } else {
      Meteor._localStorage.setItem('wfg2', user);
    }
    //console.log("user2");
    //console.log(user2);
    Streamy.emit('getusername', {
      user: user,
      conuser: Meteor.user(),
      lastuser: user2
    });
  }

  send() {
    const message = this.refs.message.value.trim();
    if (!message) return;
    const chat = {
      message: this.refs.message.value,
      userId: Meteor.userId() || user,
      user: Meteor.user() ? Meteor.user().profile.name.first : user,
      wireId: this.props.wireid
    };
    insertChat.call(chat, error => {
      if (error) {
        Bert.alert(error.reason, 'danger');
      } else {
        const textbox = this.refs.message;
        textbox.value = '';
        $(textbox).focus();
      }
    });
  }

  handleReturn(event) {
    if (event.key === 'Enter') this.send();
  }

  renderMessages() {
    const chats = this.props.chats;
    if (chats && chats.length) {
      return (
        <div className="row chatMessages">
          {chats.map(chat => (
            <div className="col s12" key={chat._id}>
              <span className="chatUser">{chat.user}:</span>{' '}
              <span className="chatMsg">{chat.message}</span>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="row rowNoMsgs">
        <div className="col s12">
          <center>No Messages yet.</center>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div>
        {this.renderMessages()}
        <div className="row rowChatInput">
          <div className="col s9">
            <input
              type="text"
              ref="message"
              placeholder="Enter message"
              onKeyUp={this.handleReturn.bind(this)}
            />
          </div>
          <div className="col s3">
            <button
              className="white msgSend waves-effect waves-light"
              onClick={this.send.bind(this)}
            >
              <i className="fa fa-check" />
            </button>
          </div>
        </div>
      </div>
    );
  }
}

ChatBox.propTypes = {
  chats: PropTypes.array,
  routeParams: PropTypes.string,
  wireid: PropTypes.string
};

export default withTracker(props => {
  Meteor.subscribe('wireMessages', props.wireid);

  return {
    chats: Chats.find(
      { wireId: props.wireid },
      { sort: { createdAt: -1 } }
    ).fetch()
  };
})(ChatBox);
