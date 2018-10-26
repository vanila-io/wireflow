import { Meteor } from 'meteor/meteor';
import { FabricAPI } from './fabric_api.js';
import { Streamy } from 'meteor/yuukan:streamy';
import { insertDesign } from '../api/wires/methods.js';
import $ from 'jquery';

Meteor._debug = (function(super_meteor_debug) {
  return function(error, info) {
    if (!(info && _.has(info, 'msg'))) super_meteor_debug(error, info);
  };
})(Meteor._debug);

let chartApp;

export const handleMount = options => {
  const wireid = options.c.props.routeParams.id;
  const wire = options.wire;
  chartApp = new FabricAPI(options.c.refs.mainCanvas, wireid);
  canvasSize(
    'mainCanvas',
    parseInt($('#rightSection').width()),
    parseInt($('#rightSection').height())
  );
  contextMenu.init();

  if (wire && wire.wire_settings) {
    chartApp.importJSON(JSON.parse(wire.wire_settings));
  } else {
    // create a new wire
    insertDesign.call({
      wire_settings: '',
      _id: wireid,
      userId: Meteor.userId() || 'guest'
    });
  }
  Streamy.on('modified_' + wireid, data => {
    if (data.sid === Streamy.id()) return;
    chartApp.receiveStreaming('modified', data);
  });
  Streamy.on('delete_' + wireid, data => {
    if (data.sid === Streamy.id()) return;
    chartApp.receiveStreaming('delete', data);
  });
  Streamy.on('add_' + wireid, data => {
    if (data.sid === Streamy.id()) return;
    chartApp.receiveStreaming('add', data);
  });
  $(document).delegate('body', 'click', function(e) {
    var clickedOn = $(e.target);
    if (
      !clickedOn
        .parents()
        .addBack()
        .is('#moveCanvas, #connector, canvas')
    ) {
      $('#connector, #moveCanvas').removeClass('active');
      chartApp.stopConnecting();
      chartApp.stopCanvasMove();
    }
    if (
      !clickedOn
        .parents()
        .addBack()
        .is('#rightclick') &&
      !chartApp.connectingStatus()
    ) {
      contextMenu.hide();
    }
  });
  $(document).delegate('#importCanvas', 'change', function(e) {
    var file;
    if ($(this).get(0).files) {
      file = $(this).get(0).files[0];
      var _n = file.name.split('.');
      ext = _n[_n.length - 1];
      if (ext == 'json') {
        $.getJSON(URL.createObjectURL(file), function(data) {
          data = JSON.parse(data);
          chartApp.importJSON(data);
        });
      }
    }
  });
  $(document).delegate('#exportCanvas', 'click', function(event) {
    var json = chartApp.exportJSON();
    var data = JSON.stringify(json),
      fileName = 'exportjson.json';
    saveData(data, fileName);
  });
  $(document).delegate('#connectingStart', 'click', function(e) {
    var id = $(this).attr('data-id');
    if ($(this).hasClass('active')) {
      $(this).removeClass('active');
      chartApp.stopConnectingStart();
    } else {
      chartApp.stopConnecting();
      chartApp.stopCanvasMove();
      $(this).addClass('active');
      chartApp.startConnectingStart(id);
    }
  });
  $(document).delegate('img.graphicItem', 'click', function(e) {
    var src = $(this).attr('src');
    chartApp.addSvg(src);
  });
  $(document).delegate('#exportImage', 'click', function(e) {
    chartApp.stopConnecting();
    chartApp.stopCanvasMove();
    var base64 = chartApp.exportImage();
    var a = document.createElement('a');
    a.style = 'display: none';
    a.href = base64;
    a.download = 'wireflow.jpg';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(base64);
    }, 150);
  });
  $(document).delegate('#connector', 'click', function(e) {
    if (chartApp.connectingStatus()) {
      $(this).removeClass('active');
      chartApp.stopConnecting();
    } else {
      $('#moveCanvas').removeClass('active');
      $('#chartsSide').removeClass('chartsSidebar-open');
      $('#mainWrap').removeClass('mainPush');
      chartApp.stopCanvasMove();
      $(this).addClass('active');
      chartApp.startConnecting();
    }
  });
  $(document).delegate('#moveCanvas', 'click', function(e) {
    //console.log('move called');
    if ($(this).hasClass('active')) {
      $(this).removeClass('active');
      chartApp.stopCanvasMove();
    } else {
      $('#connector').removeClass('active');
      $('#chartsSide').removeClass('chartsSidebar-open');
      $('#mainWrap').removeClass('mainPush');
      chartApp.stopConnecting();
      $(this).addClass('active');
      chartApp.startCanvasMove();
    }
  });
  $(document).delegate('#removeConnector', 'click', function(e) {
    if ($(this).attr('data-id')) {
      chartApp.removeConnector($(this).attr('data-id'));
      $(this)
        .attr('data-id', '')
        .hide();
    }
  });
  $(document).delegate('li#addLabel,button#addLabel', 'click', function(e) {
    var id = $(this).attr('data-id');
    var label = prompt('Please enter label for connector');
    if (label != null && id) {
      chartApp.editLabel(id, label);
      contextMenu.hide();
    }
  });
  $(document).delegate('li#clearCanvas, button#clearCanvas', 'click', function(
    e
  ) {
    var result = confirm('Want to clear Canvas?');
    if (result) {
      chartApp.stopConnecting();
      chartApp.stopCanvasMove();
      chartApp.clearCanvas();
      contextMenu.hide();
    }
  });
  $(document).delegate('li#undo, button#undo', 'click', function(e) {
    chartApp.stopConnecting();
    chartApp.stopCanvasMove();
    chartApp.undo();
    contextMenu.hide();
  });
  $(document).delegate('li#redo, button#redo', 'click', function(e) {
    chartApp.stopConnecting();
    chartApp.stopCanvasMove();
    chartApp.redo();
    contextMenu.hide();
  });
  $(document).delegate('li#zoomIn, button#zoomIn', 'click', function(e) {
    chartApp.stopConnecting();
    chartApp.stopCanvasMove();
    chartApp.zoomIn();
    contextMenu.hide();
  });
  $(document).delegate('li#zoomOut, button#zoomOut', 'click', function(e) {
    chartApp.stopConnecting();
    chartApp.stopCanvasMove();
    chartApp.zoomOut();
    contextMenu.hide();
  });
  $(document).delegate('li#bringFront,button#bringFront', 'click', function(e) {
    chartApp.stopConnecting();
    chartApp.stopCanvasMove();
    chartApp.bringForward();
    contextMenu.hide();
  });
  $(document).delegate('li#sendBack,button#sendBack', 'click', function(e) {
    chartApp.stopConnecting();
    chartApp.stopCanvasMove();
    chartApp.sendBackward();
    contextMenu.hide();
  });
  $(document).delegate('li#removeSvg,button#removeSvg', 'click', function(e) {
    chartApp.removeSVG();
    $('#removeSvg').hide();
    contextMenu.hide();
  });
  $(document).delegate('li#headerToggle,button#headerToggle', 'click', function(
    e
  ) {
    chartApp.headerToggle();
    contextMenu.hide();
  });
  $(document).delegate('li#editTitle,button#editTitle', 'click', function(e) {
    var person = prompt('Please enter new Title for Header');
    if (person != null) {
      chartApp.editTitle(person);
      contextMenu.hide();
    }
  });
  $(document).delegate('#addsvg', 'change', function(e) {
    var file;
    if ($(this).get(0).files) {
      chartApp.stopConnecting();
      chartApp.stopCanvasMove();
      file = $(this).get(0).files[0];
      var _n = file.name.split('.');
      ext = _n[_n.length - 1];
      if (ext == 'svg') {
        chartApp.addSvg(URL.createObjectURL(file));
      }
    }
  });
  $(document).delegate('body', 'keydown', function(e) {
    if (e.target.tagName == 'INPUT' || e.target.tagName == 'TEXTAREA') {
      return;
    }
    var keycode = e.keyCode;
    if (keycode == 37) {
      //left arrow
      e.preventDefault();
      chartApp.moveObject(keycode, e.ctrlKey);
    } else if (!e.shiftKey && keycode == 38) {
      //up arrow
      e.preventDefault();
      chartApp.moveObject(keycode, e.ctrlKey);
    } else if (keycode == 39) {
      //right arrow
      e.preventDefault();
      chartApp.moveObject(keycode, e.ctrlKey);
    } else if (!e.shiftKey && keycode == 40) {
      //down arrow
      e.preventDefault();
      chartApp.moveObject(keycode, e.ctrlKey);
    } else if (keycode == 46) {
      //delete
      e.preventDefault();
      chartApp.removeSVG();
    } else if (e.shiftKey && keycode == 38) {
      //Crtl + up arrow
      e.preventDefault();
      chartApp.bringForward();
    } else if (e.shiftKey && keycode == 40) {
      //Crtl + down arrow
      e.preventDefault();
      chartApp.sendBackward();
    } else if (e.ctrlKey && keycode == 90) {
      //Crtl + z
      e.preventDefault();
      chartApp.undo();
    } else if (e.ctrlKey && keycode == 89) {
      //Crtl + y
      e.preventDefault();
      chartApp.redo();
    } else if (e.ctrlKey && keycode == 107) {
      //Crtl +
      e.preventDefault();
      chartApp.zoomIn();
    } else if (e.ctrlKey && keycode == 109) {
      //Crtl -
      e.preventDefault();
      chartApp.zoomOut();
    } else if (e.ctrlKey && keycode == 96) {
      //Crtl 0
      e.preventDefault();
      chartApp.zoomReset();
    } else if (keycode == 86) {
      //v
      e.preventDefault();
      $('#moveCanvas').trigger('click');
    } else if (keycode == 67) {
      //c
      e.preventDefault();
      $('#connector').trigger('click');
    } else if (keycode == 72) {
      //h
      e.preventDefault();
      $('#headerToggle').trigger('click');
    } else if (keycode == 84) {
      //t
      e.preventDefault();
      $('#editTitle').trigger('click');
    } else if (keycode == 83) {
      //s
      e.preventDefault();
      $('#connector, #moveCanvas').removeClass('active');
      chartApp.stopConnecting();
      chartApp.stopCanvasMove();
      contextMenu.hide();
    }
  });
  $(document).delegate('#zoomReset', 'click', function(e) {
    chartApp.stopConnecting();
    chartApp.stopCanvasMove();
    chartApp.zoomReset();
    contextMenu.hide();
  });
  $(document).delegate('#help', 'click', function(e) {
    $('#helpModal').openModal();
  });
  $('canvas').on('contextmenu', function(e) {
    e.preventDefault();
    contextMenu.setPosition();
    contextMenu.hide();
    object = chartApp.findTargetAt(e);
    if (object && object.class == 'svg') {
      chartApp.setObjectActive(object);
      contextMenu.data([
        { text: 'Edit Title', id: 'editTitle' },
        { text: 'Header On/Off', id: 'headerToggle' },
        { text: 'Bring To Front', id: 'bringFront' },
        { text: 'Send To Back', id: 'sendBack' },
        { text: 'Remove', id: 'removeSvg', divider: true }
      ]);
      contextMenu.show();
    } else {
      chartApp.discardCanvas();
      chartApp.fireCanvasEvent('before:selection:cleared');
      contextMenu.data([
        { text: 'Zoom In', id: 'zoomIn' },
        { text: 'Zoom Out', id: 'zoomOut' },
        { text: 'Reset Zoom', id: 'zoomReset' },
        { text: 'Undo', id: 'undo' },
        { text: 'Redo', id: 'redo' }
      ]);
      contextMenu.show();
    }
    return false;
  });
};
export const dataURItoBlob = (dataURI, filename) => {
  var binary = atob(dataURI.split(',')[1]);
  var array = [];
  for (var i = 0; i < binary.length; i++) {
    array.push(binary.charCodeAt(i));
  }
  return new Blob([new Uint8Array(array)], {
    type: 'image/jpeg',
    name: filename
  });
};
canvasSize = function(id, w, h) {
  var _marginLeft = ($('.rightSection').width() - w) / 2,
    _marginTop = ($('.rightSection').height() - h) / 2;
  $('#' + id)
    .parents('.absoluteCenter')
    .css({
      width: w,
      height: h,
      marginLeft: _marginLeft > 0 ? _marginLeft : 0,
      marginTop: _marginTop > 0 ? _marginTop : 0
    });
  chartApp.canvasDimension(id, w, h);
};
saveData = function(data, fileName) {
  var a = document.createElement('a');
  a.style = 'display: none';
  var json = JSON.stringify(data),
    blob = new Blob([json], { type: 'octet/stream' }),
    url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 150);
};
