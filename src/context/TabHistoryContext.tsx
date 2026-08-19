import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const HISTORY_LIMIT = 20;

type Ctx = { canGoBack: boolean; goBack: () => void };
const TabHistoryContext = createContext<Ctx>({ canGoBack: false, goBack: () => {} });

type ProviderProps = {
  // Owner (DashboardScreen) feeds the active tab name in via screenListeners — kept
  // out of this component so it has no dependency on where it sits relative to the
  // tab navigator's own React Navigation context.
  activeName: string | undefined;
  navigate: (name: string) => void;
  children: React.ReactNode;
};

// Tracks the order in which tabs were actually visited (sidebar taps or swipe-back),
// so swipe-back can pop to whatever tab the user was previously on — like browser
// back — rather than a fixed "home" target.
export const TabHistoryProvider = ({ activeName, navigate, children }: ProviderProps) => {
  const [history, setHistory] = useState<string[]>(activeName ? [activeName] : []);
  const goingBackRef = useRef(false);

  useEffect(() => {
    if (!activeName) return;
    if (goingBackRef.current) { goingBackRef.current = false; return; }
    setHistory(h => (h[h.length - 1] === activeName ? h : [...h, activeName].slice(-HISTORY_LIMIT)));
  }, [activeName]);

  const goBack = useCallback(() => {
    setHistory(h => {
      if (h.length < 2) return h;
      const next = h.slice(0, -1);
      goingBackRef.current = true;
      navigate(next[next.length - 1]);
      return next;
    });
  }, [navigate]);

  return (
    <TabHistoryContext.Provider value={{ canGoBack: history.length > 1, goBack }}>
      {children}
    </TabHistoryContext.Provider>
  );
};

export const useTabHistory = () => useContext(TabHistoryContext);
