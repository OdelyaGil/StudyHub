import React, { useState } from 'react';
import CustomAlert from '../components/CustomAlert';

type Button = { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };

type AlertState = { visible: boolean; title: string; message: string; buttons: Button[] };

const HIDDEN: AlertState = { visible: false, title: '', message: '', buttons: [] };

export const useCustomAlert = (theme = '#FF8C42') => {
  const [state, setState] = useState<AlertState>(HIDDEN);

  const hide = () => setState(HIDDEN);

  const showAlert = (title: string, message: string) =>
    setState({ visible: true, title, message, buttons: [{ text: 'אישור', onPress: hide }] });

  const showConfirm = (title: string, message: string, onConfirm: () => void) =>
    setState({
      visible: true, title, message,
      buttons: [
        { text: 'ביטול',  onPress: hide, style: 'cancel' },
        { text: 'אישור',  onPress: () => { hide(); onConfirm(); } },
      ],
    });

  const showDestructiveConfirm = (title: string, message: string, confirmText: string, onConfirm: () => void) =>
    setState({
      visible: true, title, message,
      buttons: [
        { text: 'ביטול',      onPress: hide, style: 'cancel' },
        { text: confirmText,  onPress: () => { hide(); onConfirm(); }, style: 'destructive' },
      ],
    });

  const alertNode = <CustomAlert {...state} theme={theme} />;

  return { showAlert, showConfirm, showDestructiveConfirm, alertNode };
};
