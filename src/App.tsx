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
import { LicenseInfo } from '@mui/x-license';
import licenseKey from './license.json'
import Skeleton from '@mui/material/Skeleton';

const CONFIG_PATH = './config.json'

LicenseInfo.setLicenseKey(
  licenseKey.license_key
)


export const get_config = async () => {
  const resp = await fetch(
    CONFIG_PATH
  )
  const json = await resp.json()
  return json
}

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
  snackbarMessage: { severity: 'success', message: 'defaultMessage' },
  setSnackbarMessage: () => { },
}

const SnackbarContext = React.createContext<SnackbarContextProps>(init_snackbar_context);
export const useSnackbarContext = () => React.useContext(SnackbarContext);

interface ConfigFile {
  default_table_columns: string[];
  csv_order: string[];
  pinned_table_columns: { 'left': string[], 'right': string[] };
}

interface State {
  username: string;
  obsid: number;
  is_admin: boolean;
  targets: Target[];
  config: ConfigFile; 
}

export interface UserInfo {
  status: string;
  Id: number;
  Title: string;
  FirstName: string;
  MiddleName: string;
  LastName: string;
  Email: string;
  Affiliation: string;
  WorkArea: string;
  Interests: string;
  Street: string;
  City: string;
  State: string;
  Country: string;
  Zip: string;
  Phone: string;
  Fax: string;
  URL: string;
  ModDate: string;
  Exposed: string;
  username: string;
  resetcode: number;
  AllocInst: string;
  BadEmail: string;
  Category: string;
  is_admin: boolean; //added by backend
}

const StateContext = React.createContext<State>({} as State)
export const useStateContext = () => React.useContext(StateContext)

function App() {
  const [darkState, setDarkState] = useQueryParam('darkState', withDefault(BooleanParam, true));
  const [openSnackbar, setOpenSnackbar] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarMessage>({ message: 'default message' })
  const [state, setState] = useState<State>({} as State);
  const theme = handleTheme(darkState)

  const get_userinfo = async (): Promise<UserInfo> => {
    // const url = "/userinfo"
    // const response = await fetch(url); //TODO: enable when ready to release
    //Mock response for development
    const response = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        "status": "success",
        "Id": 1234,
        "Title": "Dr.",
        "FirstName": "Observer",
        "LastName": "Observerson",
        "Email": ""
      } as UserInfo)
    }
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    const json = await response.json();
    return json
  }

  const get_targets = async (): Promise<Target[]> => {
    // const url = "/get_targets"
    // const response = await fetch(url); //TODO: enable when ready to release
    //Mock response for development
    let initTargets = localStorage.getItem('targets') ? JSON.parse(localStorage.getItem('targets') as string) : []
    const response = {
      ok: true,
      status: 200,
      json: () => Promise.resolve(initTargets as Target[])
    }
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    const json = await response.json();
    return json
  }


  useEffect(() => {
    const fetch_data = async () => {
      const userinfo = await get_userinfo();
      const targets = await get_targets()
      const config = await get_config()
      const title = userinfo.Title ? userinfo.Title + ' ' : ''
      const username = `${title}${userinfo.FirstName} ${userinfo.LastName}`;
      console.log('setting state', userinfo, targets)
      setState({ config, username, obsid: userinfo.Id, is_admin: userinfo.is_admin, targets })
    }
    fetch_data()
    console.log('App mounted')
  }, [])

  const handleThemeChange = () => {
    setDarkState(!darkState)
  }

  return (
    <ThemeProvider theme={theme} >
      <CssBaseline />
      <StateContext.Provider value={state}>
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
              {Object.keys(state).length > 0 ? (<TargetTable />):
              (<Skeleton variant="rectangular" width="100%" height={500} />)}
            </Paper>
          </Stack>
        </SnackbarContext.Provider>
      </StateContext.Provider>
    </ThemeProvider >
  )
}

export default App
