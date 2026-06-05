import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface State { hasError: boolean; }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State { return { hasError: true }; }

  componentDidCatch(error: Error) { console.error('ErrorBoundary:', error); }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.wrap}>
        <Text style={s.title}>משהו השתבש</Text>
        <Text style={s.body}>נתקלנו בשגיאה בלתי צפויה.</Text>
        <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false })}>
          <Text style={s.btnText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  wrap:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D1A', padding: 32 },
  title:   { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  body:    { color: '#9299B8', fontSize: 15, textAlign: 'center', marginBottom: 32 },
  btn:     { backgroundColor: '#00FFFF', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  btnText: { color: '#0D0D1A', fontWeight: '700', fontSize: 16 },
});
