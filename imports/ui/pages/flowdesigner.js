import { Meteor } from 'meteor/meteor';
import { Wires } from '../../../imports/api/wires/wires';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';

import { Streamy } from 'meteor/yuukan:streamy';

import { Chats } from '../../../imports/api/chat/chat';
import { withTracker } from 'meteor/react-meteor-data';
import { Loading } from '../components/loading.js';
import { Graphics } from '../../../imports/api/graphics/graphics';
import { Categories } from '../../../imports/api/categories/categories';

import $ from 'jquery';
import 'hammerjs';

import 'materialize-css/dist/css/materialize.css';
import 'materialize-css/dist/js/materialize.js';
import '../../../imports/lib/css/style.css';
import 'jquery-mousewheel';
import '../../../imports/lib/contextMenu.js';

import { handleMount } from '../../../imports/lib/main.js';
import ChatBox from '../components/chat-box.js';

import { openChat } from '../../../imports/lib/sidebars.js';

import { googleAnalytics } from '../../modules/ganalytics.js';
import {
  Grid,
  Row,
  Col,
  FormGroup,
  ControlLabel,
  FormControl,
  Button
} from 'react-bootstrap';
import InlineEdit from 'react-edit-inline';

export class FlowDesigner extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      chatOpen: false,
      laststate: false,
      graphics: false
    };
  }
  componentDidMount() {
    const props = this.props;
    handleMount({ c: this, wire: props.wire });
    $('ul.tabs').tabs();
    $('.collapsible').collapsible({
      accordion: false // A setting that changes the collapsible behavior to expandable instead of the default accordion style
    });
    $('.tooltipped').tooltip({ delay: 50 });
    openChat();

    $('.dropdown-button').dropdown({
      inDuration: 300,
      outDuration: 225,
      constrain_width: false, // Does not change width of dropdown to that of the activator
      hover: true, // Activate on hover
      gutter: 0, // Spacing from edge
      belowOrigin: false, // Displays dropdown below the button
      alignment: 'left' // Displays dropdown with edge aligned to the left of button
    });

    if (props.wire)
      document.title = props.wire.name + ' | ' + props.wire.description;
    googleAnalytics(document.location.pathname);

    if (props.wire) Streamy.emit('getwire', { id: props.wire._id });
  }

  editMode(id) {
    let mode = ReactDOM.findDOMNode(this.refs.edit).value;
    Meteor.call('changeWireMode', id, mode, (err, res) => {
      //console.log(res);
      //console.log(err);
    });
  }
  readonlyMode(id) {
    let mode = ReactDOM.findDOMNode(this.refs.readonly).value;
    Meteor.call('changeWireMode', id, mode, (err, res) => {
      //console.log(res);
      //console.log(err);
    });
  }

  changeUsertoReadonly(id, wireId) {
    //console.log(this);
    Meteor.call('changeusertoreadonly', id, wireId, (err, res) => {
      //console.log(res);
      //console.log(err);
    });
  }
  addUsertoEdit(wireId) {
    //console.log("added");
    let userid = ReactDOM.findDOMNode(this.refs.selectUser).value;
    Meteor.call('addUsertoEdit', userid, wireId, (err, res) => {
      //console.log(res);
      //console.log(err);
    });
  }
  changeUsertoEdit(id, wireId) {
    Meteor.call('changeusertoedit', id, wireId, (err, res) => {
      //console.log(res);
      //console.log(err);
    });
  }
  deleteUser(id, wireId) {
    Meteor.call('removeUser', id, wireId, (err, res) => {
      //console.log(res);
      //console.log(err);
    });
  }
  openChat() {
    /* Open/close right sidebar room chat */
    if ($('#rsmRoomChat').hasClass('rsmRoomChat-open')) {
      $('#rsmRoomChat').removeClass('rsmRoomChat-open');
      this.setState({
        chatOpen: false,
        laststate: true
      });
    } else {
      $('#rsmRoomChat').addClass('rsmRoomChat-open');
      this.setState({
        chatOpen: true,
        laststate: false
      });
    }
  }

  openUsers() {
    /* Open/close right sidebar room Users */
    if ($('#rsmRoomUsers').hasClass('rsmRoomUsers-open')) {
      $('#rsmRoomUsers').removeClass('rsmRoomUsers-open');
    } else {
      $('#rsmRoomUsers').addClass('rsmRoomUsers-open');
    }
  }

  openInfo() {
    /* Open/close right sidebar room info */
    if ($('#rsmRoomInfo').hasClass('rsmRoomInfo-open')) {
      $('#rsmRoomInfo').removeClass('rsmRoomInfo-open');
    } else {
      $('#rsmRoomInfo').addClass('rsmRoomInfo-open');
    }
  }
  openPermission() {
    /* Open/close right sidebar room permissions */
  }
  ChangeLastState() {
    //console.log( "Im here2222");
    let lastState = this.state.laststate;
    let j = Number(Meteor._localStorage.getItem('counter'));
    j = j - 1;
    Meteor._localStorage.setItem('counter', j);
    if (lastState) {
      this.setState({
        chatOpen: false,
        laststate: false
      });
    }
  }
  states() {
    let lastState = this.state.laststate;
    if (lastState) {
      setTimeout(function() {
        $('#changeState')
          .eq(0)
          .trigger('click');
      }, 50);
    }
  }
  LoadGraphics() {
    //console.log("here")
    let name = ReactDOM.findDOMNode(this.refs.searchByName).value;
    let categories = ReactDOM.findDOMNode(this.refs.Selectcate).value;

    if (!name || name === '') {
      name = 'none';
    }
    if (!categories || categories === '') categories = 'none';

    Meteor.call('getGraphics', name, categories, (err, res) => {
      //console.log(err);
      //console.log(res);
      if (!err) {
        this.setState({
          chatOpen: this.state.chatOpen,
          laststate: this.state.laststate,
          graphics: res
        });
      }
    });
  }
  changeWirename(data) {
    //console.log(document.this)
    Meteor.call('changeWirename', data.message, this.wireId, function(
      error,
      result
    ) {
      //console.log(arguments)
      if (!error) {
        let pageTitle = document.title.split(' | ');
        pageTitle[0] = data.message;
        document.title = pageTitle.join(' | ');
      }
    });
  }

  changeWiredescription(data) {
    Meteor.call('changeWiredescription', data.message, this.wireId, function(
      error,
      result
    ) {
      //console.log(arguments)
      if (!error) {
        let pageTitle = document.title.split(' | ');
        pageTitle[1] = data.message;
        document.title = pageTitle.join(' | ');
      }
    });
  }

  render() {
    let self = this;
    let lastState = this.state.laststate;
    let chats = this.props.chats;
    let i = this.props.i;
    let oldChat;
    let graphics;
    let isAdmin = this.props.isAdmin;
    let categories = this.props.categories;
    if (this.state.graphics) {
      graphics = this.state.graphics;
    } else {
      graphics = this.props.graphics;
    }

    let c = Number(Meteor._localStorage.getItem('counter'));

    if (!this.props.oldChat) {
      oldChat = chats;
    } else {
      oldChat = this.props.oldChat;
    }

    if (lastState || c !== i) {
      oldChat = chats;
    }
    return (
      <div className="had-container">
        <div className="row">
          <div id="tabsMenu" className="col s12 tabWrapper">
            <ul className="tabs">
              <li className="tab col s2">
                <a href="#test3">User flow</a>
              </li>
              <li className="tab col s2">
                <a className="active" href="#test1">
                  Wireframes
                </a>
              </li>
              <li className="tab col s2">
                <a href="/mycharts">My charts</a>
              </li>
              <li className="tab col s2">
                <a target="_self" href="/">
                  Homepage
                </a>
              </li>
            </ul>
          </div>
          <div id="test1" className="col s12 mainCont">
            <div id="chartsSide" className="col s1 chartsSidebar">
              <div key="svgList" className="itemsList" id="svgList">
                <input
                  type="text"
                  ref="searchByName"
                  onChange={self.LoadGraphics.bind(self)}
                  placeholder="Search"
                />
                {categories ? (
                  <select
                    ref="Selectcate"
                    onChange={self.LoadGraphics.bind(self)}
                    value="Please select a category"
                  >
                    <option disabled value="Please select a category">
                      Please select a category
                    </option>
                    {categories.map(function(category) {
                      return (
                        <option key={category._id} value={category._id}>
                          {category.name}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <select
                    ref="Selectcate"
                    onChange={self.LoadGraphics.bind(self)}
                    value="No Category"
                  >
                    <option disabled value="No Category">
                      No Category
                    </option>
                  </select>
                )}

                {graphics ? (
                  graphics.map(function(graphic, index) {
                    return (
                      <div key={graphic._id}>
                        <img
                          className="graphicItem"
                          src={graphic.link}
                          id={graphic._id}
                          ref={graphic._id}
                          key={graphic._id}
                        />{' '}
                        <span>{graphic.name}</span>
                      </div>
                    );
                  })
                ) : (
                  <div />
                )}
              </div>
            </div>
            <div className="row" id="mainWrap">
              <div className="col s1 optionSidebar">
                <ul id="sideCollection" className="collection">
                  <li className="collection-item">
                    <button id="openTabs" className="logoImage">
                      <img src="/images/icons/logo.svg" />
                    </button>
                  </li>
                  <li className="collection-item">
                    <button
                      className="white openCharts tooltipped"
                      id="openCharts"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="See charts"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white tooltipped"
                      id="moveCanvas"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Move canvas"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white tooltipped"
                      id="connector"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Add connector"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white tooltipped s24"
                      id="zoomIn"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Zoom in"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white tooltipped s24"
                      id="zoomOut"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Zoom out"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white tooltipped s24"
                      id="undo"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Undo"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white tooltipped s24"
                      id="redo"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Redo"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white tooltipped s24"
                      id="exportImage"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Export Image"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white tooltipped s24"
                      id="clearCanvas"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Clear All Items"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white none tooltipped s24"
                      id="removeSvg"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Remove chart (DEL)"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white none tooltipped"
                      id="editTitle"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Edit title (t)"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white none tooltipped s24"
                      id="headerToggle"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Header on/off (h)"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white none tooltipped s24"
                      id="bringFront"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Bring to front"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white none tooltipped s24"
                      id="sendBack"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Send to back"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white none tooltipped"
                      id="removeConnector"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Remove connector"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white none tooltipped"
                      id="connectingStart"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Reposition Connector"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      className="white none tooltipped"
                      id="addLabel"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Add/Edit Label"
                    />
                  </li>
                  <li className="collection-item">
                    <button
                      id="help"
                      className="helpIcon modal-trigger white tooltipped"
                      data-target="helpModal"
                      data-position="right"
                      data-delay="30"
                      data-tooltip="Keyboard shortcuts"
                    />
                  </li>
                </ul>
              </div>
              <div className="col s11 canvasBg">
                <div className="rightSection" id="rightSection">
                  <div className="absoluteCenter" id="mainCanvasDiv">
                    <canvas id="mainCanvas" ref="mainCanvas" />
                  </div>
                </div>
                <div id="rsmRoomInfo" className="rsmRoomInfo">
                  <h2>
                    {self.props.me && self.props.wire ? (
                      self.props.me === self.props.wire.userId || isAdmin ? (
                        <InlineEdit
                          validate={this.customValidateText}
                          activeClassName="editing"
                          text={self.props.wire.name}
                          paramName="message"
                          wireId={self.props.wire._id}
                          change={this.changeWirename}
                        />
                      ) : (
                        <span>{self.props.wire.name}</span>
                      )
                    ) : (
                      isAdmin
                    )}
                  </h2>
                  <div className="rsmDesc">
                    {self.props.me && self.props.wire ? (
                      self.props.me === self.props.wire.userId || isAdmin ? (
                        <InlineEdit
                          validate={this.customValidateText}
                          activeClassName="editing"
                          text={self.props.wire.description}
                          paramName="message"
                          wireId={self.props.wire._id}
                          change={this.changeWiredescription}
                        />
                      ) : (
                        <span>{self.props.wire.description}</span>
                      )
                    ) : (
                      <div />
                    )}
                  </div>
                  <p className="rsmDesc">
                    <b>{self.props.username}</b>
                  </p>
                </div>
                <div id="rsmRoomUsers" className="rsmRoomUsers">
                  <h2>Users</h2>
                  <p className="rsmDesc">
                    Number of users in this room:{' '}
                    {self.props.wire && self.props.wire.guestsUsers ? (
                      self.props.wire.guestsUsers.length
                    ) : (
                      <span>loading</span>
                    )}{' '}
                  </p>
                  <hr />
                  {self.props.wire && self.props.wire.guestsUsers ? (
                    self.props.wire.guestsUsers.map(function(user, index) {
                      return (
                        <div key={user.userfullname}>
                          <p>
                            <span
                              className="roundedcolor"
                              style={{ background: user.userColor }}
                            />
                            {user.userfullname}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div>loading</div>
                  )}
                  <div />
                </div>
                <div id="rsmRoomChat" className="rsmRoomChat">
                  {self.props.wire ? (
                    <ChatBox wireid={self.props.wire._id} />
                  ) : (
                    undefined
                  )}
                </div>
              </div>
              <div className="rightSidebarMenu">
                <button id="openInfoBtn" onClick={self.openInfo.bind(self)}>
                  <i className="material-icons">info_outline</i>
                </button>
                <button id="openUsersBtn" onClick={self.openUsers.bind(self)}>
                  <i className="material-icons">supervisor_account</i>
                </button>
                <button id="openChatBtn" onClick={self.openChat.bind(self)}>
                  <i className="material-icons">chat</i>
                </button>
              </div>
            </div>
            <div className="col s2 rightDiv" id="toggleChat">
              {self.state.chatOpen ? (
                <span />
              ) : self.state.laststate ? (
                this.states()
              ) : chats.length - oldChat.length !== 0 ? (
                <span>You have New Messages </span>
              ) : (
                <span />
              )}
              <button
                id="changeState"
                onClick={self.ChangeLastState.bind(self)}
                hidden
              />
            </div>
          </div>
          <div id="test2" className="col s12">
            test
          </div>
          <div id="test3" className="col s12" />
          <div id="test4" className="col s12" />
        </div>

        <div id="helpModal" className="modal">
          <div className="modal-content">
            <div className="modalHeader">
              <h2 className="modal-title">Keyboard shortcuts and help</h2>
              <a href="#!" className="modal-action modal-close">
                X
              </a>
            </div>
            <div className="row">
              <div className="col-md-4">
                <h4>Key combinations</h4>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyM">Shift</code>
                    <span className="plus">+</span>
                    <code className="keyS">
                      <i className="fa fa-arrow-up" />
                    </code>
                  </div>
                  <div className="helpCol des">Bring up object</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyM">Shift</code>
                    <span className="plus">+</span>
                    <code className="keyS">
                      <i className="fa fa-arrow-down" />
                    </code>
                  </div>
                  <div className="helpCol des">Bring down object</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyM">Ctrl</code>
                    <span className="plus">+</span>
                    <code className="keyS">z</code>
                  </div>
                  <div className="helpCol des">Undo actions</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyM">Ctrl</code>
                    <span className="plus">+</span>
                    <code className="keyS">y</code>
                  </div>
                  <div className="helpCol des">Redo actions</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyM">Ctrl</code>
                    <span className="plus">+</span>
                    <code className="keyS">+</code>
                  </div>
                  <div className="helpCol des">Zoom in canvas</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyM">Ctrl</code>
                    <span className="plus">+</span>
                    <code className="keyS">-</code>
                  </div>
                  <div className="helpCol des">Zoom out canvas</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyM">Ctrl</code>
                    <span className="plus">+</span>
                    <code className="keyS">0</code>
                  </div>
                  <div className="helpCol des">Reset canvas zoom</div>
                </div>
              </div>
              <div className="col-md-4">
                <h4>Single keys</h4>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyS">v</code>
                  </div>
                  <div className="helpCol des">Move canvas</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyS">c</code>
                  </div>
                  <div className="helpCol des">Start connecting object</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyS">h</code>
                  </div>
                  <div className="helpCol des">Show/Hide header</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyS">t</code>
                  </div>
                  <div className="helpCol des">Edit header text</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyS">s</code>
                  </div>
                  <div className="helpCol des">Active selection</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyS">DEL</code>
                  </div>
                  <div className="helpCol des">Delete object</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyCtrl">Ctrl</code>
                  </div>
                  <div className="helpCol des">Hold it to move 3x faster</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyShift">Shift</code>
                  </div>
                  <div className="helpCol des">
                    Hold it to select multiple objects
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <h4>Arrow keys</h4>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyS">
                      <i className="fa fa-arrow-left" />
                    </code>
                  </div>
                  <div className="helpCol des">
                    Move object left respectively
                  </div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyS">
                      <i className="fa fa-arrow-right" />
                    </code>
                  </div>
                  <div className="helpCol des">
                    Move object right respectively
                  </div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyS">
                      <i className="fa fa-arrow-up" />
                    </code>
                  </div>
                  <div className="helpCol des">Move object up respectively</div>
                </div>
                <div className="helpRow">
                  <div className="helpCol key">
                    <code className="keyS">
                      <i className="fa fa-arrow-down" />
                    </code>
                  </div>
                  <div className="helpCol des">
                    Move object down respectively
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

FlowDesigner.propTypes = {
  wire: PropTypes.object
};

let oldChat,
  i = 0;

export default withTracker(props => {
  Meteor.subscribe('wireInfo', props.routeParams.id);
  // Meteor.subscribe('usersInfo');
  Meteor.subscribe('allGraphics');
  Meteor.subscribe('allCategories');
  Meteor.subscribe('wireMessages', props.routeParams.id);

  const wire = Wires.findOne({ _id: props.routeParams.id });
  const users = Meteor.users.find();
  let userId = Meteor.userId();

  if (!userId || userId === undefined) {
    if (!Meteor._localStorage.getItem('wfg')) {
      Meteor._localStorage.setItem('wfg', `guest${Random.id(4)}`);
    }
    userId = Meteor._localStorage.getItem('wfg');
  }

  let userMode = 'readonly';
  let chats = Chats.find(
    { wireId: props.routeParams.id },
    { sort: { createdAt: -1 } }
  ).fetch();
  Meteor.call('checkUserMode', userId, props.routeParams.id, (err, res) => {
    if (!err) {
      userMode = res;
    }
    setTimeout(function() {
      oldChat = chats;
    }, 300);
  });

  let graphics = Graphics.find().fetch();
  let categories = Categories.find().fetch();

  let isAdmin = false;
  if (Roles.userIsInRole(userId, ['admin'])) {
    isAdmin = true;
  }

  let username;
  if (wire && wire.userId) {
    Meteor.subscribe('userInfo', wire.userId);
    let user = Meteor.users.findOne({ _id: wire.userId });

    if (user) {
      username = user.profile.name.first + ' ' + user.profile.name.last;
    } else {
      username = wire.userId;
    }
  }

  i = i + 1;
  Meteor._localStorage.setItem('counter', i);
  userId = Meteor._localStorage.getItem('wfg');

  return {
    wire,
    users,
    me: userId,
    userMode,
    chats,
    oldChat,
    i,
    graphics,
    categories,
    isAdmin,
    username
  };
})(FlowDesigner);
