import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#006241',
    },
    secondary: {
      main: '#d4e9e2', 
    },
  },
  typography: {
    fontFamily: 'SoDoSans, Helvetica, Arial, sans-serif',
  },
});

export default theme;