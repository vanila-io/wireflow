/* global fabric,$ */
import 'fabric';
import $ from 'jquery';
import 'jquery-mousewheel';
import { Streamy } from 'meteor/yuukan:streamy';
import { initAligningGuidelines } from './aligning_guidelines.js';
import { Wires } from '../api/wires/wires';

fabric.util.object.extend(fabric.StaticCanvas.prototype, {
  FX_DURATION: 3
});

const THEME = {
  connectorLabelBackground: '#fff',
  connectorLabelColor: '#666',
  connectorColor: '#666',
  connectorWidth: 2,
  connectorCirleBackground: '#fff',
  selectedConnectorColor: '#ff1e1e',
  graphicTitleColor: '#333'
};

var canvas_state = new Array(),
  current_state = 0;
export const FabricAPI = function(mainCanvas, wireid) {
  var canvas = new fabric.Canvas(mainCanvas, {
      backgroundColor: '#fff',
      preserveObjectStacking: true,
      perPixelTargetFind: true
    }),
    self = this;
  var viewportLeft = 0,
    lastObjectId,
    viewportTop = 0,
    mouseLeft,
    mouseTop,
    _drawSelection = canvas._drawSelection,
    isDown = false,
    inConnectingMode = false,
    connectingState = 'ended',
    isStroked = false,
    tempLine,
    _previousLine,
    canvasMoveMode = false,
    connectingStartMode = false,
    connectingStartID,
    allStartLines,
    modifiedCheck = true,
    modifiedType = '',
    prevObject,
    isGroupMoved = false,
    isObjectMoving = false;
  var customeProperties = [
    '_objects',
    'src',
    'id',
    'strokeWidth',
    'class',
    'stroke',
    'index',
    'alignment',
    'line',
    'lineType',
    'connectors',
    'circle',
    'arrow',
    'start',
    'end',
    'lineDifference',
    'lineID',
    'clabel'
  ];

  canvas.on('mouse:down', function(options) {
    isDown = true;
    viewportLeft = canvas.viewportTransform[4];
    viewportTop = canvas.viewportTransform[5];
    mouseLeft = options.e.x;
    mouseTop = options.e.y;
    self.renderVieportBorders();
    contextMenu.hide();

    object = options.target;
    _mouseDownPosition = canvas.getPointer(options.e);
    if (object && object.class == 'svg' && inConnectingMode) {
      if (connectingState == 'starting') {
        tempLine
          .set({
            x1: _mouseDownPosition.x,
            y1: _mouseDownPosition.y,
            x2: _mouseDownPosition.x,
            y2: _mouseDownPosition.y,
            start: object.id
          })
          .setCoords();
        var _t = self._calculateConectorStart(object, tempLine);
        tempLine.lineID.push({
          type: 'start',
          id: object.id,
          lineDifference: _t
        });
        object.connectors.push({
          id: tempLine.id,
          type: 'start',
          lineDifference: _t
        });
        object.line = tempLine;
        object.lineType = 'start';
        connectingState = 'moving';
        canvas.add(tempLine, tempLine.circle, tempLine.arrow).renderAll();
        tempLine.set({
          index: canvas.getObjects().indexOf(tempLine),
          lineDifference: _t
        });
        _previousLine = object;
        allStartLines = [];
        $.each(object.connectors, function(i, el) {
          if (el.type == 'start') {
            allStartLines.push(el.id);
          }
        });
      } else if (connectingState == 'moving') {
        _previousLine.line
          .set({
            x2: _mouseDownPosition.x,
            y2: _mouseDownPosition.y,
            end: object.id
          })
          .setCoords();
        var a = false;
        $.each(object.connectors, function(i, el) {
          if (allStartLines.indexOf(el.id) > -1) {
            a = true;
          }
        });
        if (a) return;
        object.line = _previousLine.line;
        object.lineType = 'end';
        object.line.lineID.push({
          type: 'end',
          id: object.id
        });
        object.connectors.push({
          id: _previousLine.line.id,
          type: 'end'
        });
        connectingState = 'ended';
        _previousLine = null;
        //console.log('circle', object.line);
        self.savestate('add', object.line.toJSON(customeProperties));
        $('#connector').removeClass('active');
        self.stopConnecting();
        self.makeConnectorsAlign();
        var canvasDATA = {
          json: object.line.toJSON(customeProperties),
          type: 'addConnector'
        };
        Streamy.emit('add', {
          data: JSON.stringify(canvasDATA),
          wireid: wireid
        });
        Streamy.emit('savetodb', {
          data: JSON.stringify(self.exportJSON()),
          wireid: wireid
        });
      }
    }
    $('#removeConnector, #connectingStart, #addLabel').hide();
    if (!object) {
      canvas.forEachObject(function(obj) {
        if (obj.class == 'connector') {
          var pont = obj.containsPoint({
            x: _mouseDownPosition.x,
            y: _mouseDownPosition.y
          });
          if (pont) {
            //console.log(obj);
            $('#removeConnector, #connectingStart, #addLabel')
              .attr('data-id', obj.id)
              .show();
            connectingStartID = obj.id;
            obj.set({
              stroke: THEME.selectedConnectorColor
            });
            obj.circle.set({
              stroke: THEME.selectedConnectorColor
            });
            obj.arrow.set({
              fill: THEME.selectedConnectorColor
            });
          } else {
            obj.set({
              stroke: THEME.connectorColor
            });
            obj.circle.set({
              stroke: THEME.connectorColor
            });
            obj.arrow.set({
              fill: THEME.connectorColor
            });
          }
        }
      });
    }
  });
  canvas.on('mouse:move', function(options) {
    var object = options.target;
    var pointer = canvas.getPointer(options.e);
    if (options.e.altKey && isDown) {
      var currentMouseLeft = options.e.x;
      var currentMouseTop = options.e.y;
      var deltaLeft = currentMouseLeft - mouseLeft,
        deltaTop = currentMouseTop - mouseTop;
      canvas.viewportTransform[4] = viewportLeft + deltaLeft;
      canvas.viewportTransform[5] = viewportTop + deltaTop;
      canvas.renderAll();
      self.renderVieportBorders();
    }
    if (connectingState == 'moving') {
      tempLine
        .set({
          x2: Math.abs(pointer.x) + 15,
          y2: Math.abs(pointer.y) + 15
        })
        .setCoords();
      canvas.renderAll();
    }
    if (canvasMoveMode && isDown) {
      var currentMouseLeft = options.e.x;
      var currentMouseTop = options.e.y;
      if (typeof currentMouseLeft === 'undefined') {
        if (typeof options.e.touches !== 'undefined') {
          currentMouseLeft = options.e.touches[0].clientX;
          currentMouseTop = options.e.touches[0].clientY;
        } else {
          currentMouseLeft = options.e.clientX;
          currentMouseTop = options.e.clientY;
        }
      }
      var deltaLeft = currentMouseLeft - mouseLeft,
        deltaTop = currentMouseTop - mouseTop;
      canvas.viewportTransform[4] = viewportLeft + deltaLeft;
      canvas.viewportTransform[5] = viewportTop + deltaTop;
      canvas.renderAll();
      self.renderVieportBorders();
    }
  });
  canvas.on('mouse:up', function(options) {
    (canvas._drawSelection = _drawSelection), (isDown = false);
    var object = options.target;
    if (object && modifiedType != '') {
      modifiedCheck = true;
      modifiedType = '';
      self.savestate('modified', prevObject, object.toJSON(customeProperties));
      //console.log(prevObject);
    }
    if (isGroupMoved) {
      isGroupMoved = false;
      self.groupConnectorsAlign();
      var canvasDATA = {
        json: object.toJSON(customeProperties),
        type: 'groupMoving'
      };
      Streamy.emit('modified', {
        data: JSON.stringify(canvasDATA),
        wireid: wireid
      });
    }
    if (connectingStartMode) {
      self.stopConnectingStart();
      var _notSelf = true;
      if (!object) return;
      if (object.connectors) {
        $.each(object.connectors, function(index, val) {
          if (val.id == connectingStartID && val.type == 'end') {
            _notSelf = false;
          }
        });
      }
      if (_notSelf) {
        pointer = canvas.getPointer(options.e);
        canvas.forEachObject(function(obj) {
          if (obj.connectors) {
            $.each(obj.connectors, function(index, val) {
              if (val.id == connectingStartID && val.type == 'start') {
                obj.connectors.splice(index, 1);
              }
            });
          }
        });
        var _t = self._calculateConectorStart(object, {
          x1: pointer.x,
          y1: pointer.y
        });
        object.connectors.push({
          id: connectingStartID,
          type: 'start',
          lineDifference: _t
        });
        self.makeConnectorsAlign();
        setTimeout(self.makeConnectorsAlign, 350);
      }
    }
    if (isObjectMoving) {
      isObjectMoving = false;
      var canvasDATA = {
        json: object.toJSON(customeProperties),
        type: 'moving'
      };
      Streamy.emit('modified', {
        data: JSON.stringify(canvasDATA),
        wireid: wireid
      });
    }
  });
  canvas.on('before:selection:cleared', function(options) {
    var object = options.target;
    $(
      '#removeSvg, #bringFront, #sendBack, #editTitle, #headerToggle, #addLabel'
    ).hide();
    isGroupMoved = false;
  });
  canvas.on('selection:created', function(options) {
    if (!options) return;
    var objects = options.target;
    //console.log(objects._objects);
    if (objects._objects) {
      objects.set({
        left: objects.left + objects.width / 2,
        top: objects.top + objects.height / 2,
        originX: 'center',
        originY: 'center'
      });

      objects._objects.forEach(function(obj) {
        //console.log(obj.class);
        if (obj.class == 'connectors') {
          objects.removeWithUpdate(obj);
        } else if (obj.class == 'line-arrow') {
          objects.removeWithUpdate(obj);
        } else if (obj.class == 'line-circle') {
          objects.removeWithUpdate(obj);
        }
      });
    }
  });
  canvas.on('object:modified', function(options) {
    var objects = options.target;
    //console.log('xyzzz', object);
    if (object && object.class === 'svg') {
      self.alignIndex();
      Streamy.emit('savetodb', {
        data: JSON.stringify(self.exportJSON()),
        wireid: wireid
      });
    }
  });

  canvas.on('object:selected', function(options) {
    var object = options.target;
    if (object && object.class == 'svg') {
      $('#removeSvg, #bringFront, #sendBack, #editTitle, #headerToggle').show();
    } else if (object && object._objects && object.class !== 'svg') {
      $('#removeSvg, #bringFront, #sendBack').show();
    }

    canvas.forEachObject(function(obj) {
      if (obj.class == 'connector') {
        obj.set({
          stroke: THEME.connectorColor
        });
        obj.circle.set({
          stroke: THEME.connectorColor
        });
        obj.arrow.set({
          fill: THEME.connectorColor
        });
      }
    });
  });

  canvas.on('object:scaling', function(options) {
    var object = options.target;
    var pointer = canvas.getPointer(options.e);
    if (object && object.connectors && object.connectors.length > 0) {
      self.makeConnectorsAlign();
    }
    if (modifiedCheck) {
      prevObject = object.toJSON(customeProperties);
      modifiedCheck = false;
      modifiedType = 'scale';
    }
    if (object && object._objects && object.class !== 'svg') {
      isGroupMoving = true;
    }
    if (object && object.class === 'svg') {
      var canvasDATA = {
        json: object.toJSON(customeProperties),
        type: 'scaling'
      };
      Streamy.emit('modified', {
        data: JSON.stringify(canvasDATA),
        wireid: wireid
      });
    }
  });
  canvas.on('object:moving', function(options) {
    var object = options.target;
    if (modifiedCheck) {
      prevObject = object.toJSON(customeProperties);
      modifiedCheck = false;
      modifiedType = 'move';
    }
    if (object && object.class == 'svg') {
      self.makeConnectorsAlign();
      isObjectMoving = true;
      canvas.calcOffset();
      var canvasDATA = {
        json: object.toJSON(customeProperties),
        type: 'moving'
      };
      Streamy.emit('modified', {
        data: JSON.stringify(canvasDATA),
        wireid: wireid
      });
    } else if (object && object._objects && object.class != 'svg') {
      isGroupMoved = true;
      self.groupConnectorsAlign();
    }
  });
  $(canvas.getElement().parentNode).on('mousewheel', function(e) {
    if (e.originalEvent.wheelDelta > 0) {
      var newZoom = canvas.getZoom() + 1 / 40;
    } else {
      var newZoom = canvas.getZoom() - 1 / 40;
    }
    canvas.zoomToPoint(
      {
        x: e.offsetX,
        y: e.offsetY
      },
      newZoom
    );
    self.renderVieportBorders();
    contextMenu.hide();
    return false;
  });
  //canvas.selection = false;
  canvas.zoomToPoint(
    {
      x: 0,
      y: 0
    },
    1
  );

  this.receiveStreaming = function(action, data) {
    //Fabric actions on receiving data from stream.
    var data = JSON.parse(data.data);
    //console.log(action, data);
    if (action == 'modified') {
      var object = data.json;
      if (data.type == 'groupMoving') {
        canvas.discardActiveGroup();
        $.each(object.objects, function(i, e) {
          canvas.forEachObject(function(temp) {
            if (temp.id == e.id) {
              self.updateGroupObject(temp, e, object);
            }
          });
        });
        return;
      } else if (
        data.type == 'groupSendBack' ||
        data.type == 'groupBringFront'
      ) {
        $.each(object.objects, function(i, e) {
          canvas.forEachObject(function(temp) {
            if (temp.id == e.id) {
              canvas.moveTo(temp, e.index).renderAll();
            }
          });
        });
        return;
      } else if (data.type == 'clearCanvas') {
        self.discardCanvas();
        canvas.clear();
        return;
      } else if (data.type == 'editLabel') {
        canvas.forEachObject(function(obj) {
          if (obj.id == object.id && obj.class == 'connector') {
            if (obj.clabel) {
              obj.clabel.set({
                text: object.clabel.text
              });
            } else {
              //console.log(obj, object);
              obj.clabel = new fabric.IText(object.clabel.text, {
                fontSize: 16,
                fill: THEME.connectorLabelColor,
                textBackgroundColor: THEME.connectorLabelBackground,
                hasBorders: false,
                hasControls: false,
                selectable: false,
                evented: false,
                id: obj.id,
                class: 'clabel',
                originX: 'center',
                originY: 'top',
                stroke: null,
                strokeWidth: 0
              });
              canvas.add(obj.clabel).renderAll();
              self.makeConnectorsAlign();
            }
          }
        });
        return;
      }
      canvas.forEachObject(function(temp) {
        if (temp.id == object.id) {
          if (data.type == 'moving') {
            self.updateObject(temp, object);
          } else if (data.type == 'scaling') {
            self.updateObject(temp, object);
          } else if (data.type == 'headerToggle') {
            $.each(temp._objects, function(index, el) {
              if (el && el.id == 'Header') {
                el.opacity = el.opacity == 0 ? 1 : 0;
              }
            });
            canvas.calcOffset();
            canvas.renderAll();
          } else if (data.type == 'editTitle') {
            //console.log(temp, object);
            $.each(temp._objects, function(index, el) {
              if (el.id == 'Header' && el.text) {
                el.set({
                  text: object._objects[index].text
                });
                canvas.renderAll();
              }
            });
          } else if (data.type == 'sendBack') {
            canvas.sendBackwards(temp, true).renderAll();
          } else if (data.type == 'bringFront') {
            canvas.bringForward(temp, true).renderAll();
          } else {
            canvas.fxRemove(temp);
            removed = true;
            setTimeout(function() {
              self.addObject(object, 0, 0, 1, 1);
            }, 10);
          }
        }
      });
    } else if (action == 'delete') {
      var object = data.json;
      canvas.forEachObject(function(temp) {
        if (temp.id == object.id) {
          canvas.fxRemove(temp);
          canvas.renderAll();
          canvas.fire('before:selection:cleared');
        }
      });
    } else if (action == 'add') {
      var object = data.json;
      if (data.type == 'addConnector') {
        canvas.forEachObject(function(temp) {
          if (temp.id == object.start) {
            $.each(temp.connectors, function(i, el) {
              if (el.id == object.id && type == 'start') {
                temp.connectors.splice(i, 1);
              }
            });
            temp.connectors.push({
              id: object.id,
              type: 'start',
              lineDifference: object.lineDifference
            });
          } else if (temp.id == object.end) {
            $.each(temp.connectors, function(i, el) {
              if (el.id == object.id && type == 'end') {
                temp.connectors.splice(i, 1);
              }
            });
            temp.connectors.push({
              id: object.id,
              type: 'end'
            });
          }
        });
      }
      self.addObject(object, 0, 0, 1, 1);
      self.makeConnectorsAlign();
    }
  };
  this.updateGroupObject = function(obj, _obj, group) {
    obj
      .set({
        left: _obj.left + group.left,
        top: _obj.top + group.top,
        width: _obj.width,
        height: _obj.height,
        scaleX: _obj.scaleX * group.scaleX,
        scaleY: _obj.scaleY * group.scaleY
      })
      .setCoords();
    canvas.renderAll();
    self.makeConnectorsAlign();
  };
  this.updateObject = function(obj, _obj) {
    //console.log("obj, _obj");
    //console.log(obj, _obj);
    obj
      .set({
        left: _obj.left,
        top: _obj.top,
        width: _obj.width,
        height: _obj.height,
        scaleX: _obj.scaleX,
        scaleY: _obj.scaleY,
        stroke: _obj.stroke,
        strokeWidth: _obj.strokeWidth
      })
      .setCoords();
    canvas.renderAll();
    self.makeConnectorsAlign();
  };

  this._calculateConectorStart = function(obj, line) {
    return {
      top: line.y1 - obj.top,
      left: line.x1 - obj.left
    };
  };
  this._calcArrowAngle = function(x1, y1, x2, y2) {
    var angle = 0,
      x,
      y;

    x = x2 - x1;
    y = y2 - y1;

    if (x === 0) {
      angle = y === 0 ? 0 : y > 0 ? Math.PI / 2 : (Math.PI * 3) / 2;
    } else if (y === 0) {
      angle = x > 0 ? 0 : Math.PI;
    } else {
      angle =
        x < 0
          ? Math.atan(y / x) + Math.PI
          : y < 0
            ? Math.atan(y / x) + 2 * Math.PI
            : Math.atan(y / x);
    }

    return (angle * 180) / Math.PI;
  };
  this.renderVieportBorders = function() {
    var ctx = canvas.getContext();
    ctx.save();
    ctx.restore();
  };
  this.canvas = function() {
    return canvas;
  };
  this.clearCanvas = function() {
    self.discardCanvas();
    canvas.clear();
    Streamy.emit('modified', {
      data: JSON.stringify({
        json: '',
        type: 'clearCanvas'
      }),
      wireid: wireid
    });
    Streamy.emit('savetodb', {
      data: JSON.stringify(self.exportJSON()),
      wireid: wireid
    });
  };
  this.discardCanvas = function() {
    canvas.discardActiveObject();
    canvas.discardActiveGroup();
    canvas.fire('before:selection:cleared');
  };
  this.fireCanvasEvent = function(evt) {
    canvas.fire(evt);
  };
  this.startConnectingStart = function(id) {
    connectingStartMode = true;
    connectingStartID = id;
  };
  this.stopConnectingStart = function() {
    connectingStartMode = false;
    $('#connectingStart').removeClass('active');
  };
  this.getCurrentObject = function() {
    return canvas.getActiveObject();
  };
  this.setObjectActive = function(o) {
    canvas.setActiveObject(o);
  };
  this.findTargetAt = function(o) {
    var obj = canvas.findTarget(o);
    if (obj && obj.selectable) {
      return obj;
    }
    return false;
  };
  this.alignIndex = function() {
    canvas.forEachObject(function(o) {
      if (o.class == 'svg') {
        o.index = canvas.getObjects().indexOf(o);
      }
    });
  };
  this.sendBackward = function() {
    var obj = canvas.getActiveObject();
    if (obj && obj.class == 'svg') {
      canvas
        .sendBackwards(obj, true)
        .renderAll()
        .fire('object:modified', {
          target: obj
        });
      self.alignIndex();
      var canvasDATA = {
        json: obj.toJSON(customeProperties),
        type: 'sendBack'
      };
      Streamy.emit('modified', {
        data: JSON.stringify(canvasDATA),
        wireid: wireid
      });
      self.bringConnectorsTop();
    } else {
      var objs = canvas.getActiveGroup();
      if (objs) {
        //console.log(objs);
        $.each(objs._objects, function(i, e) {
          if (e && e.index != 0) {
            canvas.moveTo(e, e.index - 1).renderAll();
          }
        });
        //canvas.sendBackwards(objs, true).renderAll();
        self.alignIndex();
        var canvasDATA = {
          json: objs.toJSON(customeProperties),
          type: 'groupSendBack'
        };
        Streamy.emit('modified', {
          data: JSON.stringify(canvasDATA),
          wireid: wireid
        });
        self.bringConnectorsTop();
      }
    }
  };
  this.bringForward = function() {
    var obj = canvas.getActiveObject();
    if (obj && obj.class == 'svg') {
      canvas
        .bringForward(obj, true)
        .renderAll()
        .fire('object:modified', {
          target: obj
        });
      self.alignIndex();
      var canvasDATA = {
        json: obj.toJSON(customeProperties),
        type: 'bringFront'
      };
      Streamy.emit('modified', {
        data: JSON.stringify(canvasDATA),
        wireid: wireid
      });
      self.bringConnectorsTop();
    } else {
      var objs = canvas.getActiveGroup();
      if (objs) {
        $.each(objs._objects, function(i, e) {
          if (e && e.index <= canvas.getObjects().length) {
            canvas.moveTo(e, e.index + 1).renderAll();
          }
        });
        //canvas.bringForward(objs, true).renderAll();
        self.alignIndex();
        var canvasDATA = {
          json: objs.toJSON(customeProperties),
          type: 'groupBringFront'
        };
        Streamy.emit('modified', {
          data: JSON.stringify(canvasDATA),
          wireid: wireid
        });
        self.bringConnectorsTop();
      }
    }
  };
  this.connectingStatus = function() {
    return inConnectingMode;
  };
  this.startCanvasMove = function() {
    self.discardCanvas();
    canvasMoveMode = true;
    canvas.selection = false;
    canvas.forEachObject(function(element) {
      element.selectable = false;
    });
    canvas.defaultCursor = 'move';
    canvas.renderAll();
  };
  this.stopCanvasMove = function() {
    canvasMoveMode = false;
    canvas.defaultCursor = 'default';
    canvas.selection = true;
    canvas.hoverCursor = 'move';
    canvas.forEachObject(function(element) {
      element.selectable = element.class == 'connector' ? false : true;
      element.setCoords();
    });
    canvas.calcOffset();
    canvas.renderAll();
  };
  this.startConnecting = function() {
    inConnectingMode = true;
    connectingState = 'starting';
    canvas.discardActiveObject() || canvas.discardActiveGroup();
    canvas.fire('before:selection:cleared');
    canvas.selection = false;
    canvas.forEachObject(function(element) {
      element.selectable = false;
    });
    canvas.renderAll();
    var _id = 'line' + new Date().getTime();
    var _arrow = new fabric.Triangle({
      originX: 'center',
      originY: 'center',
      width: 8,
      height: 8,
      fill: THEME.connectorColor,
      selectable: false,
      hasBorders: false,
      hasControls: false,
      evented: false,
      class: 'line-arrow',
      id: _id,
      top: 1 - 10000,
      left: 1 - 10000
    });
    var _circle = new fabric.Circle({
      radius: 4,
      stroke: THEME.connectorColor,
      strokeWidth: THEME.connectorWidth,
      fill: THEME.connectorCirleBackground,
      originX: 'center',
      originY: 'center',
      selectable: false,
      hasBorders: false,
      hasControls: false,
      evented: false,
      class: 'line-circle',
      id: _id,
      top: 1 - 10000,
      left: 1 - 10000
    });
    tempLine = new fabric.Line([0, 0, 0, 0], {
      stroke: THEME.connectorColor,
      strokeWidth: THEME.connectorWidth,
      hasBorders: false,
      hasControls: false,
      selectable: false,
      evented: false,
      originX: 'center',
      originY: 'center',
      circle: _circle,
      arrow: _arrow,
      class: 'connector',
      id: _id,
      lineID: []
    });
  };
  this.stopConnecting = function() {
    if (connectingState == 'moving') {
      _previousLine.remove();
      $.each(_previousLine.connectors, function(i, v) {
        if (_previousLine.line.id == v.id) {
          _previousLine.connectors.splice(i, 1);
        }
      });
      canvas.fxRemove(tempLine.arrow);
      canvas.fxRemove(tempLine.circle);
      if (tempLine.clabel) {
        canvas.fxRemove(tempLine.clabel);
      }
      canvas.fxRemove(tempLine);
    }
    inConnectingMode = false;
    canvas.selection = true;
    connectingState = 'ended';
    canvas.forEachObject(function(element) {
      element.selectable = element.class == 'connector' ? false : true;
    });
    canvas.renderAll();
    tempLine = null;
  };
  this._findPointPosition = function(start, end) {
    if (!start || !end) return;
    var _x1, _y1, _x2, _y2;
    if (start.left >= end.left && start.top >= end.top) {
      //console.log("section a");
      _x1 =
        start.originX == 'center'
          ? start.left
          : start.left + (start.width * start.scaleX) / 2;
      _y1 =
        (start.originY == 'center'
          ? start.top - (start.height * start.scaleY) / 2
          : start.top) + 10;
      _x2 =
        (end.originX == 'center'
          ? end.left + (end.width * end.scaleX) / 2
          : end.left + end.width * end.scaleX) + 10;
      _y2 =
        end.originY == 'center'
          ? end.top
          : end.top + (end.height * end.scaleY) / 2;
      if (end.left > start.left - start.width * start.scaleX) {
        _x2 =
          end.originX == 'center'
            ? end.left
            : end.left + (end.width * end.scaleX) / 2;
        _y2 =
          (end.originY == 'center'
            ? end.top + (end.height * end.scaleY) / 2
            : end.top) + 10;
      } else if (end.top > start.top - start.height * start.scaleY) {
        _x1 =
          (start.originX == 'center'
            ? start.left - (start.width * start.scaleX) / 2
            : start.left) - 10;
        _y1 =
          start.originY == 'center'
            ? start.top
            : start.top + (start.height * start.scaleY) / 2;
      }
    } else if (start.left <= end.left && start.top <= end.top) {
      //console.log("section b");
      _x1 =
        start.originX == 'center'
          ? start.left
          : start.left + (start.width * start.scaleX) / 2;
      _y1 =
        (start.originY == 'center'
          ? start.top + (start.height * start.scaleY) / 2
          : start.top) - 10;
      _x2 =
        (end.originX == 'center'
          ? end.left - (end.width * end.scaleX) / 2
          : end.left) - 10;
      _y2 =
        end.originY == 'center'
          ? end.top
          : end.top + (end.height * end.scaleY) / 2;
      if (end.left < start.left + start.width * start.scaleX) {
        _x2 =
          end.originX == 'center'
            ? end.left
            : end.left - (end.width * end.scaleX) / 2;
        _y2 =
          (end.originY == 'center'
            ? end.top - (end.height * end.scaleY) / 2
            : end.top) - 10;
      } else if (end.top < start.top + start.height * start.scaleY) {
        _x1 =
          (start.originX == 'center'
            ? start.left + (start.width * start.scaleX) / 2
            : start.left) - 10;
        _y1 =
          start.originY == 'center'
            ? start.top
            : start.top + (start.height * start.scaleY) / 2;
      }
    } else if (start.left >= end.left && start.top <= end.top) {
      //console.log("section c");
      _x1 =
        start.originX == 'center'
          ? start.left
          : start.left + (start.width * start.scaleX) / 2;
      _y1 =
        (start.originY == 'center'
          ? start.top + (start.height * start.scaleY) / 2
          : start.top) - 10;
      _x2 =
        (end.originX == 'center'
          ? end.left + (end.width * end.scaleX) / 2
          : end.left) + 10;
      _y2 =
        end.originY == 'center'
          ? end.top
          : end.top + (end.height * end.scaleY) / 2;
      if (end.left > start.left - start.width * start.scaleX) {
        _x2 =
          end.originX == 'center'
            ? end.left
            : end.left - (end.width * end.scaleX) / 2;
        _y2 =
          (end.originY == 'center'
            ? end.top - (end.height * end.scaleY) / 2
            : end.top) - 10;
      } else if (end.top < start.top + start.height * start.scaleY) {
        _x1 =
          (start.originX == 'center'
            ? start.left - (start.width * start.scaleX) / 2
            : start.left) + 10;
        _y1 =
          start.originY == 'center'
            ? start.top
            : start.top + (start.height * start.scaleY) / 2;
      }
    } else if (start.left <= end.left && start.top >= end.top) {
      //console.log("section d");
      _x1 =
        start.originX == 'center'
          ? start.left
          : start.left + (start.width * start.scaleX) / 2;
      _y1 =
        (start.originY == 'center'
          ? start.top - (start.height * start.scaleY) / 2
          : start.top) + 10;
      _x2 =
        (end.originX == 'center'
          ? end.left - (end.width * end.scaleX) / 2
          : end.left) - 10;
      _y2 =
        end.originY == 'center'
          ? end.top
          : end.top + (end.height * end.scaleY) / 2;
      if (end.left < start.left + start.width * start.scaleX) {
        //console.log('asdf');
        _x2 =
          end.originX == 'center'
            ? end.left
            : end.left - (end.width * end.scaleX) / 2;
        _y2 =
          (end.originY == 'center'
            ? end.top + (end.height * end.scaleY) / 2
            : end.top) + 10;
      } else if (end.top > start.top - start.height * start.scaleY) {
        //console.log('2343');
        _x1 =
          (start.originX == 'center'
            ? start.left + (start.width * start.scaleX) / 2
            : start.left) - 10;
        _y1 =
          start.originY == 'center'
            ? start.top
            : start.top + (start.height * start.scaleY) / 2;
      }
    }
    return {
      x1: _x1,
      y1: _y1,
      x2: _x2,
      y2: _y2
    };
  };
  this.makeConnectorsAlign = function() {
    canvas.forEachObject(function(line) {
      if (line.class == 'connector') {
        var _startElement, _endElement, _lineDifference;
        canvas.forEachObject(function(element) {
          if (element.connectors) {
            $.each(element.connectors, function(i, v) {
              if (line.id == v.id) {
                if (v.type == 'start') {
                  _startElement = element;
                  _lineDifference = v.lineDifference;
                } else if (v.type == 'end') {
                  _endElement = element;
                }
              }
            });
          }
        });
        var returnPoints = self._findPointPosition(_startElement, _endElement);
        if (!returnPoints) return;
        self.lineAlignWithObject(
          returnPoints,
          line,
          _startElement,
          _lineDifference
        );
      }
    });
    canvas.renderAll();
  };
  this.groupConnectorsAlign = function() {
    var group = canvas.getActiveGroup();
    canvas.forEachObject(function(line) {
      if (line.class == 'connector') {
        var _startElement, _endElement, _lineDifference;
        canvas.forEachObject(function(element) {
          if (element.connectors) {
            $.each(element.connectors, function(i, v) {
              if (line.id == v.id) {
                if (v.type == 'start') {
                  _startElement = element;
                  _lineDifference = v.lineDifference;
                } else if (v.type == 'end') {
                  _endElement = element;
                }
              }
            });
          }
        });
        if (
          group._objects.filter(function(e) {
            return e.id == _startElement.id;
          }).length > 0
        ) {
          _startElement = {
            left: _startElement.left + group.left,
            top: _startElement.top + group.top,
            width: _startElement.width,
            height: _startElement.height,
            originY: _startElement.originY,
            originX: _startElement.originX,
            scaleY: _startElement.scaleY,
            scaleX: _startElement.scaleX
          };
        }
        if (
          group._objects.filter(function(e) {
            return e.id == _endElement.id;
          }).length > 0
        ) {
          _endElement = {
            left: _endElement.left + group.left,
            top: _endElement.top + group.top,
            width: _endElement.width,
            height: _endElement.height,
            originY: _endElement.originY,
            originX: _endElement.originX,
            scaleY: _endElement.scaleY,
            scaleX: _endElement.scaleX
          };
        }
        var returnPoints = self._findPointPosition(_startElement, _endElement);
        if (!returnPoints) return;
        self.lineAlignWithObject(
          returnPoints,
          line,
          _startElement,
          _lineDifference
        );
      }
    });
  };
  this.lineAlignWithObject = function(
    returnPoints,
    line,
    _startElement,
    _lineDifference
  ) {
    var oldCenterX = (line.x1 + line.x2) / 2,
      oldCenterY = (line.y1 + line.y2) / 2,
      deltaX = line.left - oldCenterX,
      deltaY = line.top - oldCenterY;
    line
      .set({
        x1: _startElement.left + _lineDifference.left,
        y1: _startElement.top + _lineDifference.top,
        x2: returnPoints.x2,
        y2: returnPoints.y2
      })
      .setCoords();

    _x1 = line.get('x1');
    _y1 = line.get('y1');
    _x2 = line.get('x2');
    _y2 = line.get('y2');
    var _angle = self._calcArrowAngle(_x1, _y1, _x2, _y2);
    line.arrow
      .set({
        left: returnPoints.x2 + deltaX,
        top: returnPoints.y2 + deltaY,
        angle: _angle + 90
      })
      .setCoords();
    line.circle
      .set({
        left: _x1,
        top: _y1
      })
      .setCoords();
    if (line.clabel) {
      var centerX = (_x1 + _x2) / 2;
      var centerY = (_y1 + _y2) / 2 - line.clabel.height / 2;
      line.clabel
        .set({
          left: centerX,
          top: centerY,
          textBackgroundColor: THEME.connectorLabelBackground,
          padding: 5
        })
        .setCoords();
    }
  };
  this.bringConnectorsTop = function() {
    canvas
      .forEachObject(function(connector) {
        if (connector.class == 'connector') {
          canvas.bringToFront(connector);
          canvas.bringToFront(connector.arrow);
          canvas.bringToFront(connector.circle);
          if (connector.clabel) {
            canvas.bringToFront(connector.clabel);
          }
        }
      })
      .renderAll();
  };
  this.backgroundColor = function(option) {
    canvas.setBackgroundColor(
      {
        source: option,
        repeat: 'repeat'
      },
      function() {
        canvas.renderAll();
      }
    );
    canvas.renderAll();
  };
  this.canvasDimension = function(id, w, h) {
    canvas.setWidth(w);
    canvas.setHeight(h);
    canvas.renderAll();
    initAligningGuidelines(canvas);
  };
  this.removeConnector = function(id) {
    if (!id) return;
    canvas.forEachObject(function(obj) {
      if (obj.id == id && obj.class == 'connector') {
        canvas.fxRemove(obj.arrow);
        canvas.fxRemove(obj.circle);
        if (obj.clabel) {
          canvas.fxRemove(obj.clabel);
        }
        canvas.fxRemove(obj);
        canvas.renderAll();
        self.stopConnecting();
        self._removeAnotherEnd(obj.id);
        self.savestate('delete', obj.toJSON(customeProperties));
        setTimeout(function() {
          canvas.fire('mouse:down');
          var canvasDATA = {
            json: obj.toJSON(customeProperties),
            type: 'delete'
          };
          Streamy.emit('delete', {
            data: JSON.stringify(canvasDATA),
            wireid: wireid
          });
          Streamy.emit('savetodb', {
            data: JSON.stringify(self.exportJSON()),
            wireid: wireid
          });
        }, 100);
      }
    });
  };
  this._removeAnotherEnd = function(id) {
    canvas.forEachObject(function(obj) {
      if (obj.connectors) {
        $.each(obj.connectors, function(index, val) {
          if (val && val.id == id) {
            obj.connectors.splice(index, 1);
          }
        });
      }
    });
  };
  this.headerToggle = function() {
    var obj = canvas.getActiveObject();
    if (obj && obj.class == 'svg') {
      $.each(obj._objects, function(index, el) {
        if (el && el.id == 'Header') {
          el.opacity = el.opacity == 0 ? 1 : 0;
        }
      });
      canvas.calcOffset();
      canvas.renderAll();
      var canvasDATA = {
        json: obj.toJSON(customeProperties),
        type: 'headerToggle'
      };
      Streamy.emit('modified', {
        data: JSON.stringify(canvasDATA),
        wireid: wireid
      });
      Streamy.emit('savetodb', {
        data: JSON.stringify(self.exportJSON()),
        wireid: wireid
      });
    }
  };
  this.editTitle = function(_text) {
    var obj = canvas.getActiveObject();
    if (obj && obj.class == 'svg') {
      $.each(obj._objects, function(index, el) {
        if (el.id == 'Header' && el.text) {
          el.set({
            text: el.maxWords ? _text.substring(0, el.maxWords) : _text
          });
          canvas.renderAll();
          var canvasDATA = {
            json: obj.toJSON(customeProperties),
            type: 'editTitle'
          };
          Streamy.emit('modified', {
            data: JSON.stringify(canvasDATA),
            wireid: wireid
          });
          Streamy.emit('savetodb', {
            data: JSON.stringify(self.exportJSON()),
            wireid: wireid
          });
        }
      });
    }
  };
  this.editLabel = function(id, _text) {
    if (!id) return;
    canvas.forEachObject(function(obj) {
      if (obj.id == id && obj.class == 'connector') {
        if (obj.clabel) {
          obj.clabel.set({
            text: _text
          });
        } else {
          text = new fabric.IText(_text, {
            fontSize: 16,
            fill: THEME.connectorLabelColor,
            textBackgroundColor: THEME.connectorLabelBackground,
            lockScalingX: true,
            lockScalingY: true,
            hasBorders: false,
            hasControls: false,
            selectable: false,
            evented: false,
            hasRotatingPoint: true,
            id: obj.id,
            class: 'clabel',
            originX: 'center',
            originY: 'top',
            padding: 3
          });
          obj.clabel = text;
          canvas.add(obj.clabel).renderAll();
          self.makeConnectorsAlign();
        }
        Streamy.emit('modified', {
          data: JSON.stringify({
            json: obj.toJSON(customeProperties),
            type: 'editLabel'
          }),
          wireid: wireid
        });
        Streamy.emit('savetodb', {
          data: JSON.stringify(self.exportJSON()),
          wireid: wireid
        });
      }
    });
  };
  this.addSvg = function(src) {
    if (inConnectingMode) return;
    var _header = new Array(),
      _body = new Array(),
      _footer = new Array();
    fabric.loadSVGFromURL(
      src,
      function(objects, options) {
        var group = new fabric.Group(objects, {
          id: 'svg' + new Date().getTime(),
          originX: 'center',
          originY: 'center',
          class: 'svg',
          src: src,
          top: 150,
          left: 150,
          hasRotatingPoint: false,
          lockUniScaling: true,
          selectable: true,
          line: '',
          lineType: '',
          connectors: new Array()
        });
        h = group.height;
        w = group.width;
        var r = h > w ? w / h : h / w;
        nh = h > w ? 128 : 128 * r;
        nw = h > w ? 128 * r : 128;
        group.set({
          scaleX: nw / w,
          scaleY: nh / h
        });
        canvas
          .add(group)
          .setActiveObject(group)
          .renderAll();
        group.set({
          index: canvas.getObjects().indexOf(group)
        });
        self.bringConnectorsTop();
        self.savestate('add', group.toJSON(customeProperties));
        var canvasDATA = {
          json: group.toJSON(customeProperties),
          type: 'addSvg'
        };
        Streamy.emit('add', {
          data: JSON.stringify(canvasDATA),
          wireid: wireid
        });
        Streamy.emit('savetodb', {
          data: JSON.stringify(self.exportJSON()),
          wireid: wireid
        });
      },
      function(item, object) {
        var dataMax = item.getAttribute('data-max');
        if (object.text) {
          object.set('maxWords', dataMax ? dataMax : 16);
        }
      }
    );
  };
  this.removeSVG = function() {
    var obj = canvas.getActiveObject();
    if (obj && obj.class == 'svg') {
      $.each(obj.connectors, function(index, val) {
        if (val) {
          self.removeConnector(val.id);
          self._removeAnotherEnd(val.id);
        }
      });
      canvas
        .fxRemove(obj)
        .calcOffset()
        .renderAll();
      self.savestate('delete', obj.toJSON(customeProperties));
      setTimeout(function() {
        self.makeConnectorsAlign();
        var canvasDATA = {
          json: obj.toJSON(customeProperties),
          type: 'removeSVG'
        };
        Streamy.emit('delete', {
          data: JSON.stringify(canvasDATA),
          wireid: wireid
        });
        Streamy.emit('savetodb', {
          data: JSON.stringify(self.exportJSON()),
          wireid: wireid
        });
      }, 500);
    } else {
      var objs = canvas.getActiveGroup();
      if (objs) {
        self.discardCanvas();
        var newGroup = {
          _objects: []
        };
        $.each(objs._objects, function(index, val) {
          if (val && val.class == 'svg') {
            newGroup._objects.push(val.toJSON(customeProperties));
            $.each(val.connectors, function(i, v) {
              if (v) {
                canvas.forEachObject(function(obj) {
                  if (
                    obj.id == v.id &&
                    obj.class == 'connector' &&
                    newGroup._objects.indexOf(obj) <= -1
                  ) {
                    newGroup._objects.push(obj.toJSON(customeProperties));
                    canvas.fxRemove(obj.arrow);
                    canvas.fxRemove(obj.circle);
                    if (obj.clabel) {
                      canvas.fxRemove(obj.clabel);
                    }
                    canvas.fxRemove(obj);
                    canvas.renderAll();
                  }
                });
              }
            });
            canvas
              .fxRemove(val)
              .calcOffset()
              .renderAll();
            setTimeout(function() {
              self.makeConnectorsAlign();
              var canvasDATA = {
                json: val.toJSON(customeProperties),
                type: 'removeSVG'
              };
              Streamy.emit('delete', {
                data: JSON.stringify(canvasDATA),
                wireid: wireid
              });
            }, 500);
          }
        });
        self.savestate('groupDelete', newGroup);
      }
    }
  };
  this.moveObject = function(keycode, crtl) {
    var obj = canvas.getActiveObject() || canvas.getActiveGroup();
    if (!obj) return;
    var effect = 5;
    if (crtl) effect = effect * 3;
    if (keycode == 37) {
      obj
        .set({
          left: obj.left - effect
        })
        .setCoords();
    } else if (keycode == 38) {
      obj
        .set({
          top: obj.top - effect
        })
        .setCoords();
    } else if (keycode == 39) {
      obj
        .set({
          left: obj.left + effect
        })
        .setCoords();
    } else if (keycode == 40) {
      obj
        .set({
          top: obj.top + effect
        })
        .setCoords();
    }
    canvas
      .fire('object:moving', {
        target: obj
      })
      .renderAll();
  };
  this.zoomIn = function() {
    var newZoom = canvas.getZoom() + 1 / 40;
    canvas.zoomToPoint(
      {
        x: canvas.getCenter().top,
        y: canvas.getCenter().top
      },
      newZoom
    );
    self.renderVieportBorders();
    canvas.renderAll();
  };
  this.zoomOut = function() {
    var newZoom = canvas.getZoom() - 1 / 40;
    canvas.zoomToPoint(
      {
        x: canvas.getCenter().top,
        y: canvas.getCenter().top
      },
      newZoom
    );
    self.renderVieportBorders();
    canvas.renderAll();
  };
  this.zoomReset = function() {
    var newZoom = 1;
    canvas.zoomToPoint(
      {
        x: 0,
        y: 0
      },
      newZoom
    );
    canvas.viewportTransform[4] = 0;
    canvas.viewportTransform[5] = 0;
    self.renderVieportBorders();
    canvas.renderAll();
  };
  this.deleteObjectByID = function(id) {
    canvas.forEachObject(function(element) {
      if (element.id) {
        canvas.fxRemove(element);
      }
    });
    canvas.renderAll();
  };
  this.undo = function() {
    this.discardCanvas();
    if (current_state > 0) {
      current_state--;
      var state = canvas_state;
      obj = state[current_state];
      var action = obj.action;
      //console.log(action, obj);
      if (action == 'modified') {
        var object = obj.before;
        canvas.forEachObject(function(temp) {
          if (temp.id == object.id) {
            canvas.fxRemove(temp);
            setTimeout(function() {
              self.addObject(object, 0, 0, 1, 1);
              var canvasDATA = {
                json: new fabric.Object(object).toJSON(customeProperties),
                type: 'modified'
              };
              Streamy.emit('modified', {
                data: JSON.stringify(canvasDATA),
                wireid: wireid
              });
              Streamy.emit('savetodb', {
                data: JSON.stringify(self.exportJSON()),
                wireid: wireid
              });
            }, 10);
          }
        });
      } else if (action == 'add') {
        var object = obj.object;
        canvas.forEachObject(function(temp) {
          if (temp.id == object.id) {
            canvas.fxRemove(temp);
            canvas.renderAll();
            canvas.fire('before:selection:cleared');
            var canvasDATA = {
              json: temp.toJSON(customeProperties),
              type: 'delete'
            };
            Streamy.emit('delete', {
              data: JSON.stringify(canvasDATA),
              wireid: wireid
            });
            Streamy.emit('savetodb', {
              data: JSON.stringify(self.exportJSON()),
              wireid: wireid
            });
          }
        });
      } else if (action == 'delete') {
        var object = obj.object;
        self.addObject(object, 0, 0, 1, 1);
        var canvasDATA = {
          json: new fabric.Object(object).toJSON(customeProperties),
          type: 'add'
        };
        Streamy.emit('add', {
          data: JSON.stringify(canvasDATA),
          wireid: wireid
        });
        Streamy.emit('savetodb', {
          data: JSON.stringify(self.exportJSON()),
          wireid: wireid
        });
      } else if (action == 'groupDelete') {
        var objects = obj.object._objects;
        $.each(objects, function(i, o) {
          var object = o;
          self.addObject(object, 0, 0, 1, 1);
          var canvasDATA = {
            json: new fabric.Object(object).toJSON(customeProperties),
            type: 'add'
          };
          Streamy.emit('add', {
            data: JSON.stringify(canvasDATA),
            wireid: wireid
          });
        });
        self.bringConnectorsTop();
        Streamy.emit('savetodb', {
          data: JSON.stringify(self.exportJSON()),
          wireid: wireid
        });
      }
      canvas.renderAll();
    } else {
      current_state = 0;
    }
    //Streamy.emit('undoRedo', {data: JSON.stringify({canvasState:canvas_state, currentState:current_state}), wireid: wireid});
  };
  this.redo = function() {
    this.discardCanvas();
    if (current_state < canvas_state.length) {
      var state = canvas_state;
      var obj = state[current_state];
      var action = obj.action;
      //console.log(action, obj);
      if (action == 'modified') {
        //console.log('redo modified');
        var object = obj.after;
        canvas.forEachObject(function(temp) {
          if (temp.id == object.id) {
            canvas.fxRemove(temp);
            self.addObject(object, 0, 0, 1, 1);
            setTimeout(function() {
              var canvasDATA = {
                json: new fabric.Object(object).toJSON(customeProperties),
                type: 'modified'
              };
              Streamy.emit('modified', {
                data: JSON.stringify(canvasDATA),
                wireid: wireid
              });
              Streamy.emit('savetodb', {
                data: JSON.stringify(self.exportJSON()),
                wireid: wireid
              });
            }, 1000);
          }
        });
      } else if (action == 'add') {
        var object = obj.object;
        self.addObject(object, 0, 0, 1, 1);
        var canvasDATA = {
          json: new fabric.Object(object).toJSON(customeProperties),
          type: 'add'
        };
        Streamy.emit('add', {
          data: JSON.stringify(canvasDATA),
          wireid: wireid
        });
        Streamy.emit('savetodb', {
          data: JSON.stringify(self.exportJSON()),
          wireid: wireid
        });
      } else if (action == 'delete') {
        var object = obj.object;
        canvas.forEachObject(function(temp) {
          if (temp.id == object.id) {
            canvas.fxRemove(temp);
            var canvasDATA = {
              json: temp.toJSON(customeProperties),
              type: 'delete'
            };
            Streamy.emit('delete', {
              data: JSON.stringify(canvasDATA),
              wireid: wireid
            });
            Streamy.emit('savetodb', {
              data: JSON.stringify(self.exportJSON()),
              wireid: wireid
            });
          }
        });
      } else if (action == 'groupDelete') {
        var objects = obj.object._objects;
        $.each(objects, function(i, o) {
          var object = o;
          self.deleteObjectByID(object.id);
          var canvasDATA = {
            json: new fabric.Object(object).toJSON(customeProperties),
            type: 'delete'
          };
          Streamy.emit('delete', {
            data: JSON.stringify(canvasDATA),
            wireid: wireid
          });
        });
        Streamy.emit('savetodb', {
          data: JSON.stringify(self.exportJSON()),
          wireid: wireid
        });
      }
      canvas.renderAll();
      current_state++;
    }
    //Streamy.emit('undoRedo', {data: JSON.stringify({canvasState:canvas_state, currentState:current_state}), wireid: wireid});
  };
  this.savestate = function(type, object, object1) {
    var obj = {
      action: type,
      object: object,
      before: object,
      after: object1
    };
    canvas_state.splice(current_state, 0, obj);
    current_state++;
  };
  this.addObject = function(obj, offsetLeft, offsetTop, scaleX, scaleY) {
    if (!obj) return;
    canvas.fire('before:selection:cleared');
    //console.log('addObject', obj);
    if (obj.class == 'svg') {
      //console.log(obj);
      fabric.loadSVGFromURL(
        obj.src,
        function(objects, options) {
          var group = new fabric.Group(objects, {
            src: obj.src,
            id: obj.id,
            originX: 'center',
            originY: 'center',
            class: 'svg',
            top: obj.top,
            left: obj.left,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            hasRotatingPoint: false,
            lockUniScaling: true,
            line: obj.line,
            lineType: obj.lineType,
            connectors: obj.connectors,
            index: obj.index,
            selectable: true
          });
          canvas
            .add(group)
            .moveTo(group, obj.index)
            .renderAll()
            .calcOffset();
          setTimeout(self.makeConnectorsAlign, 400);
        },
        function(item, object) {
          if (item.getAttribute('data-max')) {
            object.set('maxWords', item.getAttribute('data-max'));
          }
        }
      );
    }
    if (obj.class == 'connector') {
      fabric.util.enlivenObjects([obj], function(objects) {
        canvas.renderOnAddRemove = false;
        objects.forEach(function(o) {
          var _arrow = new fabric.Triangle({
            originX: 'center',
            originY: 'center',
            width: 8,
            height: 8,
            fill: THEME.connectorColor,
            hasBorders: false,
            hasControls: false,
            selectable: false,
            class: 'line-arrow',
            id: obj.id
          });
          var _circle = new fabric.Circle({
            radius: 4,
            originX: 'center',
            originY: 'center',
            selectable: false,
            hasBorders: false,
            hasControls: false,
            class: 'line-circle',
            stroke: THEME.connectorColor,
            strokeWidth: THEME.connectorWidth,
            fill: THEME.connectorCirleBackground,
            id: obj.id
          });
          if (o.clabel) {
            _clabel = new fabric.IText(_text, {
              fontSize: 16,
              fill: THEME.connectorLabelColor,
              textBackgroundColor: THEME.connectorLabelBackground,
              lockScalingX: true,
              lockScalingY: true,
              hasBorders: false,
              hasControls: false,
              selectable: false,
              evented: false,
              hasRotatingPoint: true,
              id: obj.id,
              class: 'clabel',
              originX: 'center',
              originY: 'top'
            });
            o.set({
              clabel: _clabel
            });
          }
          o.set({
            stroke: THEME.connectorColor,
            strokeWidth: THEME.connectorWidth,
            hasBorders: false,
            hasControls: false,
            selectable: false,
            originX: 'center',
            originY: 'center',
            circle: _circle,
            arrow: _arrow,
            class: 'connector',
            id: obj.id
          });
          canvas
            .add(o, _circle, _arrow)
            .moveTo(o, obj.index)
            .renderAll()
            .calcOffset();
          if (obj.lineID) {
            $.each(obj.lineID, function(i, v) {
              canvas.forEachObject(function(t) {
                if (t.id == v.id) {
                  var objct = {
                    id: obj.id,
                    type: v.type
                  };
                  if (v.type == 'start') {
                    objct.lineDifference = v.lineDifference;
                  }
                  t.connectors.push(objct);
                }
              });
            });
          }
          setTimeout(function() {
            canvas.forEachObject(function(t) {
              if (t.id == obj.id) {
                self.makeConnectorsAlign();
                canvas.fire('object:moving', {
                  target: t
                });
                canvas.renderAll();
              }
            });
          }, 10);
        });
        canvas.renderOnAddRemove = true;
      });
    }
  };
  this.exportJSON = function() {
    self.alignIndex();
    return {
      json: canvas.toJSON([
        'src',
        'id',
        'class',
        'index',
        'line',
        'lineType',
        'connectors',
        'circle',
        'arrow',
        'start',
        'end'
      ]),
      zoom: canvas.getZoom()
    };
  };
  this.exportImage = function() {
    self.calculateZoomLevel();
    return canvas.toDataURL({
      format: 'jpg',
      quality: 1
    });
  };
  this.calculateZoomLevel = function() {
    self.discardCanvas();
    var minLeft = 1000000,
      minTop = 1000000,
      maxLeft = -100000,
      maxTop = -100000,
      zoom = canvas.getZoom();
    canvas.forEachObject(function(object) {
      if (object.class == 'svg') {
        var bound = object.getBoundingRect();
        objectLeft =
          object.originX == 'center'
            ? object.left - bound.width / 2
            : object.left;
        objectTop =
          object.originY == 'center'
            ? object.top - bound.height / 2
            : object.top;
        objectWdith = bound.width;
        objectHeight = bound.height;
        minLeft = Math.min(objectLeft, minLeft);
        minTop = Math.min(objectTop, minTop);
        maxLeft = Math.max(objectLeft + objectWdith, maxLeft);
        maxTop = Math.max(objectTop + objectHeight, maxTop);
      }
    });
    var canvasHeight = maxTop - minTop;
    var canvasWidth = maxLeft - minLeft;
    var offsetLeft = 0;
    var padding = 20;
    var zoom = (canvas.height - padding) / canvasHeight;
    if (zoom > (canvas.width - Math.abs(offsetLeft) - padding) / canvasWidth) {
      zoom = (canvas.width - Math.abs(offsetLeft) - padding) / canvasWidth;
    }
    var left =
      (minLeft + canvasWidth / 2) * zoom - (canvas.width + offsetLeft) / 2;
    var top = (minTop + canvasHeight / 2) * zoom - canvas.height / 2;
    canvas.zoomToPoint(
      {
        x: 0,
        y: 0
      },
      zoom
    );
    canvas.viewportTransform[4] = -left;
    canvas.viewportTransform[5] = -top;
    canvas.calcOffset();
    canvas.renderAll();
  };
  this.importJSON = function(j) {
    var self = this;
    canvas.loadFromJSON(j.json, function(o, object) {
      canvas.forEachObject(function(obj) {
        if (obj.class == 'connector') {
          canvas.forEachObject(function(o) {
            if (o.id == obj.id && o.class == 'line-circle') {
              o.set({
                hasBorders: false,
                hasControls: false,
                selectable: false,
                evented: false
              });
              obj.circle = o;
            }
            if (o.id == obj.id && o.class == 'line-arrow') {
              o.set({
                hasBorders: false,
                hasControls: false,
                selectable: false,
                evented: false
              });
              obj.arrow = o;
            }
            if (o.id == obj.id && o.class == 'clabel') {
              o.set({
                hasBorders: false,
                hasControls: false,
                selectable: false,
                evented: false
              });
              obj.clabel = o;
            }
          });
          obj.set({
            hasBorders: false,
            hasControls: false,
            selectable: false,
            evented: false
          });
        }
        if (obj.class == 'svg') {
          obj.set({
            hasRotatingPoint: false,
            lockUniScaling: true
          });
        }
      });
      canvas.renderAll.bind(canvas);
      self.alignIndex();
      //setTimeout(self.makeConnectorsAlign, 1000);
    });
  };
};
