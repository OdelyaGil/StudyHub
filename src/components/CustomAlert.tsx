import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

type Button = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  buttons: Button[];
  theme?: string;
};

const CustomAlert = ({ visible, title, message, buttons, theme = '#D58EAC' }: Props) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {!!message && <Text style={styles.message}>{message}</Text>}
        <View style={[styles.buttonRow, buttons.length > 2 && styles.buttonCol]}>
          {buttons.map((btn, i) => {
            const isCancel      = btn.style === 'cancel';
            const isDestructive = btn.style === 'destructive';
            return (
              <Pressable
                key={i}
                style={[
                  styles.btn,
                  buttons.length > 2 && styles.btnFull,
                  isCancel      && styles.btnCancel,
                  isDestructive && styles.btnDestructive,
                  !isCancel && !isDestructive && { backgroundColor: theme },
                ]}
                onPress={btn.onPress}
              >
                <Text style={[
                  styles.btnText,
                  isCancel && styles.btnTextCancel,
                  isDestructive && styles.btnTextDestructive,
                ]}>
                  {btn.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  buttonCol: {
    flexDirection: 'column',
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnFull: {
    flex: 0,
  },
  btnCancel: {
    backgroundColor: '#f0f0f0',
  },
  btnDestructive: {
    backgroundColor: '#ff4757',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  btnTextCancel: {
    color: '#555',
  },
  btnTextDestructive: {
    color: '#fff',
  },
});

export default CustomAlert;
