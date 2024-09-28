import './App.css'
import { handleTheme } from './theme.tsx';
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { TopBar } from './top_bar.tsx';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import React, { useEffect, useState } from 'react';
import { BooleanParam, useQueryParam, withDefault } from 'use-query-params';
import TargetTable from './target_table.tsx';
import { SimbadTargetData } from './simbad_button.tsx';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

export interface Target extends SimbadTargetData {
  _id?: string,
  target_name?: string,
  j_mag?: number,
  t_eff?: number,
  comment?: string,
}

export interface SnackbarMessage {
  message: string;
  severity?: 'success' | 'error' | 'warning' | 'info'; 
}

export interface SnackbarContextProps {
  snackbarOpen: boolean;
  setSnackbarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  snackbarMessage: SnackbarMessage;
  setSnackbarMessage: React.Dispatch<React.SetStateAction<SnackbarMessage>>;
}

const init_snackbar_context: SnackbarContextProps = {
  snackbarOpen: false,
  setSnackbarOpen: () => { },
  snackbarMessage: {severity: 'success', message: 'defaultMessage'},
  setSnackbarMessage: () => { },
}

const SnackbarContext = React.createContext<SnackbarContextProps>(init_snackbar_context);
export const useSnackbarContext = () => React.useContext(SnackbarContext);

interface State {
  username: string;
}

function App() {
  const [darkState, setDarkState] = useQueryParam('darkState', withDefault(BooleanParam, true));
  const [openSnackbar, setOpenSnackbar] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarMessage>({message: 'default message'})
  const [state, setState] = useState<State>({} as State);
  const theme = handleTheme(darkState)


  useEffect(() => {
    const username = 'user'
    setState({ username })
  }, [])

  const handleThemeChange = () => {
    setDarkState(!darkState)
  }

  return (
    <ThemeProvider theme={theme} >
      <CssBaseline />
      <SnackbarContext.Provider value={{
        snackbarOpen: openSnackbar,
        setSnackbarOpen: setOpenSnackbar,
        snackbarMessage, setSnackbarMessage
      }}>
        <TopBar darkState={darkState} handleThemeChange={handleThemeChange} username={state.username} />
        <Snackbar
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          autoHideDuration={3000}
          open={openSnackbar}
          onClose={() => setOpenSnackbar(false)}
        >
          <Alert
            onClose={() => setOpenSnackbar(false)}
            severity={snackbarMessage.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbarMessage.message} 
          </Alert>
        </Snackbar>
        <Stack sx={{ marginBottom: '4px', marginTop: '12px' }} width="100%" direction="row" justifyContent='center' spacing={2}>
          <Paper
            sx={{
              marginTop: '12px',
              padding: '6px',
              maxWidth: '2000px',
              minWidth: '1500px',
              flexDirection: 'column',
            }}
          >
            <TargetTable />
            {/* <Skeleton variant="rectangular" width="100%" height={500} /> */}
          </Paper>
        </Stack>
      </SnackbarContext.Provider>
    </ThemeProvider >
  )
}

export default App
