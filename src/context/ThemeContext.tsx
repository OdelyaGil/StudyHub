import { createContext, useContext } from 'react';

const ThemeContext = createContext('#D58EAC');
export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
