/*
 * @Author: Ranvir Gorai
 * @Date: 2018-01-30 15:04:08
 * @Last Modified by: Ranvir Gorai
 * @Last Modified time: 2018-01-30 15:04:08
 */
import React from 'react';
import {
  View,
  PanResponder,
  Modal,
  Easing,
  Animated,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import PropTypes from 'prop-types';

import _ from 'lodash'

global.Easing = Easing;

const allOrientations = [
  'portrait', 'portrait-upside-down',
  'landscape', 'landscape-left', 'landscape-right'
];

class DragModal extends React.Component {
  render() {
    let {startPosition} = this.props.content;
    return (
      <Modal transparent={true} supportedOrientations={allOrientations}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 84,
            overflow: 'hidden',
          }}
        >
          <TouchableWithoutFeedback onPressIn={this.props.drop}>
            <Animated.View style={{ transform: this.props.location.getTranslateTransform() }}>
              {this.props.content.children}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    )
  }
}


class DragContainer extends React.Component {
    constructor(props) {
        super(props);
        this.displayName = 'DragContainer';
        this.containerLayout;

        let location = props.animatedValue || new Animated.ValueXY();

        this.finger = new Animated.ValueXY()

        this.state = {
          location
        }
        this.dropZones = [];
        this.draggables = [];
        this.onDrag = this.onDrag.bind(this);
        this._handleDragging = this._handleDragging.bind(this);
        this._handleDrop = this._handleDrop.bind(this);
        this._listener = location.addListener(this._handleDragging);
        this.updateZone = this.updateZone.bind(this);
        this.removeZone = this.removeZone.bind(this);
    }

    static propTypes = {
      onDragStart: PropTypes.func,
      onDragEnd: PropTypes.func,
    }

    componentWillUnmount() {
      if (this._listener) this.state.location.removeListener(this._listener);
    }

    getDragContext() {
      return {
        dropZones: this.dropZones,
        onDrag: this.onDrag,
        container: this.containerLayout,
        dragging: this.state.draggingComponent,
        updateZone: this.updateZone,
        removeZone: this.removeZone
      }
    }

    getChildContext() {
      return {dragContext: this.getDragContext()}
    }

    static childContextTypes = {
      dragContext: PropTypes.any
    }


    updateZone(details) {
      let zone = this.dropZones.find(x => x.ref === details.ref);
      if (!zone) {
        this.dropZones.push(details);
      } else {
        let i = this.dropZones.indexOf(zone);
        this.dropZones.splice(i, 1, details);
      }
    }

    removeZone(ref) {
      let i = this.dropZones.find(x => x.ref === ref);
      if (i !== -1) {
        this.dropZones.splice(i, 1);
      }
    }

    inZone({x, y}, zone) {
      // return zone.x <= x && (zone.width + zone.x) >= x && zone.y <= y && (zone.height + zone.y) >= y;
      return zone.y <= y && (zone.height + zone.y) >= y;
    }

    _addLocationOffset(point) {
      if (!this.state.draggingComponent) return point;
      return {
        x: 0,//point.x + (this.state.draggingComponent.startPosition.width / 2),
        y: point.y + (this.state.draggingComponent.startPosition.height / 2),
      }
    }

    _handleDragging = (point) => {
      requestAnimationFrame(() => {
        this._point = point;
        if (this._locked || !point) return;

        const data = this.state.draggingComponent ? this.state.draggingComponent.data : null
        this.dropZones.forEach((zone) => {
          if (this.inZone(point, zone)) {
            zone.onEnter(point, data);
          } else {
            zone.onLeave(point, data);
          }
        })
      })
    }

    _handleDrop() {
      let hitZones = []
      this.dropZones.forEach((zone) => {
        if (!this._point) return;
        if (this.inZone(this._point, zone)) {
          hitZones.push(zone);
          zone.onDrop(this.state.draggingComponent.data);
        }
      })
      if (this.props.onDragEnd) this.props.onDragEnd(this.state.draggingComponent, hitZones);
      if (!hitZones.length && this.state.draggingComponent && this.state.draggingComponent.ref) {
        this._locked = true;
        return Animated
          .timing(this.state.location, {
            duration: 400,
            easing:Easing.elastic(1),
            toValue: {
              x: 0, //this._offset.x - x,
              y: 0 //his._offset.y - y
            }
          }).start(() => {
              this._locked = false;
              this._handleDragging({x: -100000, y: -100000});
              this.setState({
                draggingComponent: null
              })
          })

      }
      this._handleDragging({x: -100000, y: -100000});
      this.setState({
        draggingComponent: null
      })
    }

    componentWillMount() {
      this._panResponder = PanResponder.create({
        // Ask to be the responder:
        onStartShouldSetPanResponder: () => {
          if (this.state.draggingComponent) {
            this._handleDrop();
          }
          return false
        },
        onMoveShouldSetPanResponder: (evt, gestureState) => !!this.state.draggingComponent,
//        onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,
        onPanResponderMove: (...args) => {
          // if (this.state.location.y._value >= 200) return null

          Animated.event([null, {
            moveX: this.finger.x,
            moveY: this.finger.y,
            dx: 0, // this.state.location.x, // x,y are Animated.Value
            dy: this.state.location.y,
          }])(...args)
        },
        // onPanResponderTerminationRequest: (evt, gestureState) => true,
        onPanResponderTerminationRequest: (evt, gestureState) => false,
        onPanResponderRelease: (evt, gestureState) => {
          if (!this.state.draggingComponent) return;
          //Ensures we exit all of the active drop zones
          this._handleDrop();
        }
      });
  }

    onDrag(ref, children, data) {
      ref.measure((...args) => {
        if (this._listener) this.state.location.removeListener(this._listener);
        let location = this.props.animatedValue || new Animated.ValueXY();
        this._listener = location.addListener(args => this._handleDragging(this._addLocationOffset(args)));
        this._offset = {x: 0, y: args[5]};
        location.setOffset(this._offset);

        this.setState({
          location,
          draggingComponent: {
          ref,
          data,
          children: React.Children.map(children, child => {
            return React.cloneElement(child, {dragging: true})
          }),
          startPosition: {
            x: 0,
            y: args[5],
            width: args[2],
            height: args[3]
          }
        }}, () => {
          if (this.props.onDragStart) this.props.onDragStart(this.state.draggingComponent);
        })
      });
    }

    render() {
        return (
          <View
            style={[{flex: 1}, this.props.style]}
            onLayout={e => this.containerLayout = e.nativeEvent.layout}
            {...this._panResponder.panHandlers}
            {...this.props}
          >
            {this.props.children}
            {this.state.draggingComponent ? <DragModal content={this.state.draggingComponent} location={this.state.location} drop={this._handleDrop} /> : null}
          </View>
        )
    }
}

export default DragContainer;
