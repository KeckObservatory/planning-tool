import './App.css'
import { handleTheme } from './theme.tsx';
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { TopBar } from './top_bar.tsx';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { useEffect, useState } from 'react';
import { BooleanParam, useQueryParam, withDefault } from 'use-query-params';
import TargetTable from './target_table.tsx';
import { SimbadTargetData } from './simbad_button.tsx';

export interface Target extends SimbadTargetData{
  _id?: string,
  target_name?: string,
  j_mag?: number,
  t_eff?: number,
  comment?: string,
}


interface State {
  username: string;
}

function App() {
  const [darkState, setDarkState] = useQueryParam('darkState', withDefault(BooleanParam, true));
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
      <TopBar darkState={darkState} handleThemeChange={handleThemeChange} username={state.username} />
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
    </ThemeProvider >
  )
}

export default App
