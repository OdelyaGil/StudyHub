import React, { useRef } from 'react';
import { Animated, Dimensions, I18nManager, PanResponder, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTabHistory } from '../context/TabHistoryContext';

const EDGE_WIDTH = 20;
const MOVE_THRESHOLD = 6;
const COMMIT_RATIO = 0.3;
const COMMIT_VELOCITY = 0.8;

// Device/OS reading direction — deliberately not the app's own (Hebrew-only) content
// direction, since the gesture should match whichever edge the user's phone already
// uses for "back" everywhere else.
function isDeviceRTL(): boolean {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const lang = navigator.language || (navigator as any).userLanguage || '';
    return /^(he|ar|fa|ur)/i.test(lang);
  }
  return I18nManager.isRTL;
}

// Wraps one tab's screen content with an iOS-style edge-swipe-back gesture.
// Only the true screen edge (left for LTR, right for RTL) arms the gesture, so
// normal taps/scrolls/inputs anywhere else on the screen are completely unaffected.
const SwipeBackEdge = ({ children }: { children: React.ReactNode }) => {
  const { canGoBack, goBack } = useTabHistory();
  const { width: windowWidth } = useWindowDimensions();
  // Desktop web keeps every tab one click away in the always-visible sidebar, and
  // dragging near the browser edge there risks fighting the browser's own
  // back/forward trackpad gesture — so the edge gesture is mobile-only.
  const isWide = Platform.OS === 'web' && windowWidth >= 720;
  const translateX = useRef(new Animated.Value(0)).current;
  const rtl = useRef(isDeviceRTL()).current;
  // dir > 0: back-swipe drags the finger rightward (edge is on the left).
  // dir < 0: back-swipe drags the finger leftward (edge is on the right).
  const dir = rtl ? -1 : 1;

  // PanResponder.create runs once on mount, so its callbacks close over whatever
  // canGoBack/isWide/goBack were at that instant. Route every read through this
  // ref (updated on every render) instead of the closed-over variables directly,
  // so the gesture always sees the current values.
  const live = useRef({ canGoBack, isWide, goBack });
  live.current = { canGoBack, isWide, goBack };

  const resetSpring = () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        if (!live.current.canGoBack || live.current.isWide) return false;
        const { width } = Dimensions.get('window');
        const startedAtEdge = rtl ? gesture.x0 > width - EDGE_WIDTH : gesture.x0 < EDGE_WIDTH;
        if (!startedAtEdge) return false;
        return Math.abs(gesture.dx) > MOVE_THRESHOLD && Math.abs(gesture.dx) > Math.abs(gesture.dy);
      },
      onPanResponderMove: (_evt, gesture) => {
        const clamped = dir > 0 ? Math.max(0, gesture.dx) : Math.min(0, gesture.dx);
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const { width } = Dimensions.get('window');
        const inBackDirection = dir > 0 ? gesture.dx > 0 : gesture.dx < 0;
        const passedThreshold = Math.abs(gesture.dx) > width * COMMIT_RATIO || Math.abs(gesture.vx) > COMMIT_VELOCITY;
        if (inBackDirection && passedThreshold) {
          Animated.timing(translateX, {
            toValue: dir > 0 ? width : -width,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            live.current.goBack();
          });
        } else {
          resetSpring();
        }
      },
      onPanResponderTerminate: resetSpring,
    })
  ).current;

  return (
    <View style={styles.fill} {...panResponder.panHandlers}>
      <Animated.View style={[styles.fill, { transform: [{ translateX }] }]}>
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });

// HOC form for use with React Navigation's `component=` prop, which requires a
// stable component reference — wrapping inline in a render/children prop would
// recreate the function every render and defeat Tab.Navigator's memoization.
export function withSwipeBack<P extends object>(Comp: React.ComponentType<P>) {
  const Wrapped = (props: P) => (
    <SwipeBackEdge>
      <Comp {...props} />
    </SwipeBackEdge>
  );
  Wrapped.displayName = `withSwipeBack(${Comp.displayName || Comp.name || 'Component'})`;
  return Wrapped;
}

export default SwipeBackEdge;
