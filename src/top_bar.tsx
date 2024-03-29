import AppBar from '@mui/material/AppBar';
import Switch from "@mui/material/Switch"
import Tooltip from '@mui/material/Tooltip';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography'
import LogoutIcon from '@mui/icons-material/Logout';
import IconButton from '@mui/material/IconButton';
import HelpDialogButton from './help_dialog.tsx';

interface Props {
  username?: string,
  darkState: boolean,
  handleThemeChange: () => void
}

export function TopBar(props: Props) {


  return (
    <AppBar
      position='sticky'
    >
      <Toolbar
        sx={{
          paddingRight: '8px',
          paddingLeft: '20px'
        }}
      >

        <Typography
          component="h1"
          variant="h6"
          color="inherit"
          noWrap
          sx={{
            marginLeft: '12px',
            flexGrow: 1,
          }}
        >
          Planning Tool 
        </Typography>
        <Typography
          component="h3"
          variant="h6"
          color="inherit"
          noWrap
          sx={{
            marginLeft: '12px',
            flexGrow: 1,
          }}
        >
          Welcome {props.username}
        </Typography>
        <Tooltip title="Select to logout via observer portal">
          <IconButton aria-label="logout" color="primary">
            <LogoutIcon />
          </IconButton>
        </Tooltip>
          <HelpDialogButton />
        <Tooltip title="Toggle on for dark mode">
          <Switch
            checked={props.darkState}
            onChange={props.handleThemeChange} />
        </Tooltip>
      </Toolbar>
    </AppBar>
  )
}