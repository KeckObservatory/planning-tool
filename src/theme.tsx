// @ts-nocheck
import { createTheme } from '@mui/material/styles';
import { ThemeOptions } from '@material-ui/core/styles/createMuiTheme';


export const handleTheme = (darkState: boolean | null | undefined): Theme => {
  const palletType = darkState ? "dark" : "light"
  const themeOptions: ThemeOptions = {
    palette: {
      mode: palletType,
      primary: {
        main: '#9b35bd',
      },
      secondary: {
        main: '#ffd600',
      },
     },
   };
  const theme = createTheme(themeOptions)
  return theme
}