import { Meteor } from 'meteor/meteor';
import { Wires } from './wires';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { rateLimit } from '../../modules/rate-limit.js';

export const insertDesign = new ValidatedMethod({
  name: 'wire.insert',
  validate: new SimpleSchema({
    name: { type: String, optional: true },
    description: { type: String, optional: true },
    _id: { type: String, optional: true },
    userId: { type: String },
    wire_settings: { type: String },
  }).validator(),
  run(design) {
    let wire = Wires.findOne({
      _id: design._id
    });

    if (!wire)  return Wires.insert(design);
  },
});

export const updateDesignSettings = new ValidatedMethod({
  name: 'design.update.settings',
  validate: new SimpleSchema({
    _id: { type: String },
    'modifier.wire_settings': { type: String },
  }).validator(),
  run({ _id, modifier }) {
    Wires.update({ _id }, { $set: modifier });
  },
});

export const removeWire = new ValidatedMethod({
  name: 'design.remove',
  validate: new SimpleSchema({
    _id: { type: String }
  }).validator(),
  run({ _id }) {
    Wires.remove({ _id });
  },
});

rateLimit({
  methods: [
    insertDesign,
  ],
  limit: 5,
  timeRange: 1000,
});
Meteor.methods({
  changeWireMode: (id, room_mode) => {
    check(id, String);
    check(room_mode, String);
    return Wires.update(id, {
      $set: {
        room_mode: room_mode
      }
    });
  },
  changeusertoreadonly: (id, wireId) => {
    check(id, String);
    check(wireId, String);
    let wire = Wires.findOne({
      _id: wireId
    });
    let editUsers;
    let readonlyUsers;
    if (wire && wire !== undefined) {
      editUsers = wire.editUsers;
      readonlyUsers = wire.readonlyUsers;
    }
    if (editUsers && editUsers !== undefined) {
      editUsers.forEach((currentValue, index, arr) => {
        if (currentValue.userId === id) {
          editUsers.splice(index, 1);
        }
      });
    }
    let user=Meteor.users.findOne(id);

    readonlyUsers.push({userId:id,userfullname:user.profile.name.first+' '+user.profile.name.last,email:user.emails[0].address});
    return Wires.update(wireId, {
      $set: {
        editUsers: editUsers,
        readonlyUsers: readonlyUsers
      }
    });

  },
  changeusertoedit: (id, wireId) => {
    check(id, String);
    check(wireId, String);

    let wire = Wires.findOne({
      _id: wireId
    });
    if (wire && wire !== undefined) {
      editUsers = wire.editUsers;
      readonlyUsers = wire.readonlyUsers;
    }
    if (readonlyUsers && readonlyUsers !== undefined) {
      readonlyUsers.forEach((currentValue, index, arr) => {
        if (currentValue.userId === id) {
          readonlyUsers.splice(index, 1);
        }
      });
    }
    let user=Meteor.users.findOne(id);

    editUsers.push({userId:id,userfullname:user.profile.name.first+' '+user.profile.name.last,email:user.emails[0].address});
    return Wires.update(wireId, {
      $set: {
        editUsers: editUsers,
        readonlyUsers: readonlyUsers
      }
    });

  },
  removeUser: (id, wireId) => {
    check(id, String);
    check(wireId, String);

    let wire = Wires.findOne({
      _id: wireId
    });
    let editUsers;
    let readonlyUsers;
    if (wire && wire !== undefined) {
      editUsers = wire.editUsers;
      readonlyUsers = wire.readonlyUsers;
    }
    if (editUsers && editUsers !== undefined) {
      editUsers.forEach((currentValue, index, arr) => {
        if (currentValue.userId === id) {
          editUsers.splice(index, 1);
        }
      });
    }
    if (readonlyUsers && readonlyUsers !== undefined) {
      readonlyUsers.forEach((currentValue, index, arr) => {
        if (currentValue.userId === id) {
          readonlyUsers.splice(index, 1);
        }
      });
    }
    return Wires.update(wireId, {
      $set: {
        editUsers: editUsers,
        readonlyUsers: readonlyUsers
      }
    });

  },
  addUsertoEdit(id, wireId) {
    check(id, String);
    check(wireId, String);

    let wire = Wires.findOne({
      _id: wireId
    });
    let editUsers;
    let readonlyUsers;
    if (wire && wire !== undefined) {
      editUsers = wire.editUsers;
      readonlyUsers = wire.readonlyUsers;
    }
    let exist = 0;
    if (editUsers && editUsers !== undefined) {
      editUsers.forEach((currentValue, index, arr) => {
        if (currentValue.userId === id) {
          exist = 1;
        }
      });
    } else {
      editUsers = [];
    }
    if (exist === 0) {
      if (readonlyUsers && readonlyUsers !== undefined) {
        readonlyUsers.forEach((currentValue, index, arr) => {
          if (currentValue.userId === id) {
            exist = 1;
          }
        });
      } else {
        readonlyUsers = [];
      }
    }
    let user=Meteor.users.findOne(id);

    editUsers.push({userId:id,userfullname:user.profile.name.first+' '+user.profile.name.last,email:user.emails[0].address});
    if (exist === 0) {
      return Wires.update(wireId, {
        $set: {
          editUsers: editUsers,
          readonlyUsers: readonlyUsers
        }
      });
    } else {
      return 'user exist';
    }
  },
  checkUserMode(id,wireId) {
    check(id, String);
    check(wireId, String);
    let userMode='readonly';
    let wire = Wires.findOne({
      _id: wireId
    });
    let editUsers;
    let readonlyUsers;
    if (wire && wire !== undefined) {
      editUsers = wire.editUsers;
      readonlyUsers = wire.readonlyUsers;
    }
    let exist = 0;
    if (editUsers && editUsers !== undefined) {
      editUsers.forEach((currentValue, index, arr) => {
        if (currentValue.userId === id) {
          exist = 1;
          userMode='edit';
        }
      });
    }
    if (exist === 0) {
      if (readonlyUsers && readonlyUsers !== undefined) {
        readonlyUsers.forEach((currentValue, index, arr) => {
          if (currentValue.userId === id) {
            exist = 1;
            userMode='readonly';
          }
        });
      }
    }
    return userMode;
  },
  DeleteWire(wireId) {
    check(wireId, String);

    return Wires.remove(wireId);
  },
  changeWirename(newname,wireId){
    check(newname, String);
    check(wireId, String);
    Wires.update(wireId,{$set:{
      name:newname
    }});
    return 'succes';
  } ,

  changeWiredescription(newdesc,wireId){
    check(newdesc, String);
    check(wireId, String);
    Wires.update(wireId,{$set:{
      description:newdesc
    }});
    return 'succes';
  }
});
