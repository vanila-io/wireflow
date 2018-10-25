import { Streamy } from 'meteor/yuukan:streamy';
import './accounts/email-templates';
import './browser-policy';
import './fixtures';
import './Slingshot';
import './api';

import { Wires } from '../../api/wires/wires';
import { insertDesign, updateDesignSettings } from '../../api/wires/methods.js';

Meteor.methods({
  isAdmin: userId => {
    check(userId, String);
    return Roles.userIsInRole(userId, ['admin']);
  }
});

Streamy.on('modified', (data, from) => {
  const wireid = data.wireid;
  Streamy.broadcast(`modified_${wireid}`, {
    sid: Streamy.id(from),
    data: data.data
  });
});

Streamy.on('delete', (data, from) => {
  const wireid = data.wireid;
  Streamy.broadcast(`delete_${wireid}`, {
    sid: Streamy.id(from),
    data: data.data
  });
});

Streamy.on('add', (data, from) => {
  const wireid = data.wireid;
  Streamy.broadcast(`add_${wireid}`, {
    sid: Streamy.id(from),
    data: data.data
  });
});

Streamy.on('savetodb', (data, from) => {
  //console.log("savetodb");
  const wireid = data.wireid;
  const exists = Wires.findOne({
    _id: wireid
  });
  const user = Streamy.userId(from) || 'guest';
  if (exists) {
    updateDesignSettings.call({
      _id: wireid,
      modifier: {
        wire_settings: data.data
      }
    });
  } else {
    insertDesign.call({
      wire_settings: data.data,
      name: 'new Design',
      description: 'Description',
      _id: wireid,
      userId: user
    });
  }
});

let usersList = [];
let cuurentConnectionId;

Meteor.onConnection(connection => {
  let currentuserId;
  let user, lastUser;
  cuurentConnectionId = connection.id;
  let wireid,
    getusername,
    userfullname,
    wire,
    exist,
    colorexist,
    letters,
    color;

  Streamy.on('getwire', (data, from) => {
    //console.log("getwire");
    wireid = data.id;
  });

  Streamy.on('getusername', async (data, from) => {
    getusername = data.user;
    user = data.conuser;
    lastUser = data.lastuser;

    // If wire.id is not defined yet, then don't proceed.
    //
    if (!wireid) return;

    if (!user || user === undefined) {
      //console.log("here");
      currentuserId = 'undefined';
      userfullname = getusername;
    } else {
      //console.log("here2");
      currentuserId = data.conuser._id;
      userfullname = user.profile.name.first + ' ' + user.profile.name.last;
    }
    wire = Wires.findOne({
      _id: wireid
    });

    let wireguestsUsers = [];
    if (wire && wire.guestsUsers !== undefined) {
      wireguestsUsers = wire.guestsUsers;
    }
    exist = 0;
    wireguestsUsers.forEach((currentValue, index, arr) => {
      if (
        currentValue.userId === currentuserId &&
        currentValue.userfullname === userfullname
      ) {
        exist = 1;
      }
    });
    let clientAddress = connection.clientAddress;
    let clientAgent = connection.httpHeaders['user-agent'];

    wireguestsUsers.forEach((currentValue, index, arr) => {
      if (
        currentValue.clientAddress === clientAddress &&
        currentValue.clientAgent === clientAgent
      ) {
        if (lastUser === currentValue.userfullname) {
          wireguestsUsers.splice(index, 1);
        }
      }
    });

    colorexist = 0;
    letters = '0123456789ABCDEF';
    color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }

    wireguestsUsers.forEach((currentValue, index, arr) => {
      if (currentValue.userColor === color) {
        colorexist = 1;
      }
    });

    if (colorexist == 1) {
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
    }

    if (exist === 0) {
      wireguestsUsers.push({
        userId: currentuserId,
        userfullname: userfullname,
        userColor: color,
        clientAddress: clientAddress,
        clientAgent: clientAgent
      });

      Wires.update(wireid, {
        $set: {
          guestsUsers: wireguestsUsers
        }
      });
    }

    usersList.push({
      userId: currentuserId,
      wireId: wireid,
      userfullname: userfullname,
      connection: cuurentConnectionId,
      clientAddress: clientAddress,
      clientAgent: clientAgent
    });
  });

  connection.onClose(function() {
    cuurentConnectionId = connection.id;
    let clientAddress = connection.clientAddress;
    let clientAgent = connection.httpHeaders['user-agent'];
    let wireid2;
    usersList.forEach(function(currentValue, index, arr) {
      if (currentValue.connection === cuurentConnectionId) {
        currentuserId = currentValue.userId;
        wireid2 = currentValue.wireId;
        userfullname = currentValue.userfullname;
        usersList.splice(index, 1);
      }
    });
    let userexist = 0;

    usersList.forEach(function(currentValue, index, arr) {
      const matchesWireID = currentValue.wireId === wireid2;
      const matchesUserID = currentValue.userId === currentuserId;
      const matchesFullName = currentValue.userfullname === userfullname;
      const matchesConnectionID =
        currentValue.connection !== cuurentConnectionId;
      if (
        matchesWireID &&
        matchesUserID &&
        matchesFullName &&
        matchesConnectionID
      ) {
        userexist = 1;
      }
    });

    usersList.forEach(function(currentValue, index, arr) {
      const sameWireID = currentValue.wireId === wireid2;
      const sameClientAddress = currentValue.clientAddress === clientAddress;
      const sameClientAgent = currentValue.clientAgent === clientAgent;
      const lastUserMatch = lastUser !== currentValue.userfullname;

      if (sameWireID && sameClientAddress && sameClientAgent && lastUserMatch) {
        userexist = 1;
      }
    });

    //console.log("userexist");
    //console.log(userexist);
    if (userexist === 0) {
      wire = Wires.findOne({
        _id: wireid2
      });
      let wireguestsUsers2 = [];
      if (wire && wire != undefined) {
        wireguestsUsers2 = wire.guestsUsers;
      }
      if (currentuserId === undefined) {
        currentuserId = 'undefined';
      } else {
        currentuserId = currentuserId;
      }
      wireguestsUsers2.forEach(function(currentValue, index, arr) {
        if (currentValue.userId === currentuserId) {
          //console.log("currentValue.userId === currentuserId");
          //console.log(currentValue.userId === currentuserId);
          if (currentValue.userfullname === userfullname) {
            //console.log("currentValue.userfullname === userfullname");
            //console.log(currentValue.userfullname === userfullname);
            wireguestsUsers2.splice(index, 1);
          }
        }
      });
      let x = Wires.update(wireid2, {
        $set: {
          guestsUsers: wireguestsUsers2
        }
      });
    }
  });
});
