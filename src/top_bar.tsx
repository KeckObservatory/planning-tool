import AppBar from '@mui/material/AppBar';
import HelpIcon from '@mui/icons-material/Help';
import Switch from "@mui/material/Switch"
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography'
import DoorFrontIcon from '@mui/icons-material/DoorFront';
import IconButton from '@mui/material/IconButton';
import MarkdownDialogButton from './markdown_dialog.tsx';
import React from 'react';
import { get_config } from './App.tsx';

interface Props {
  username?: string,
  darkState: boolean,
  handleThemeChange: () => void
}

export function TopBar(props: Props) {

  const [helpMsg, setHelpMsg] = React.useState('')
  const [piPortal, setPiPortal] = React.useState('')

  React.useEffect(() => {
    const init_msgs = async () => {

      const config = await get_config()
      const welcomeResp = await fetch(config.help_msg_filename)
      const wtxt = await welcomeResp.text()
      setHelpMsg(wtxt)
      setPiPortal(config.pi_portal_url)
    }

    init_msgs()
  }, [])

  //TODO: Implement logout when observer portal is ready
  // const handleLogout = async () => {
  //   console.log('logging out')
  //   const resp = await observer_logout()
  //   console.log('resp', resp)
  //   window.location.reload()
  // }

  const handlePortalClick = () => {
    window.open(piPortal, "_self")
  }

  const handleSurveyClick = () => {

    window.open('https://docs.google.com/forms/d/e/1FAIpQLSduMTA4YBCa2zrO7736u8BpztXqsUu2W9zkdTuLx8UJ8Ry4dA/viewform?usp=dialog', '_blank')
  }

  const color = props.darkState ? 'primary' : 'secondary'


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
        {/* <Tooltip title="Select to logout via observer portal">
          <IconButton color={color} onClick={handleLogout} aria-label="logout">
            <LogoutIcon />
          </IconButton>
        </Tooltip> */}
        <Button
          variant='contained'
          onClick={handleSurveyClick}>
          Submit Survey
        </Button>
        <Tooltip title="Return to Observer Portal">
          <IconButton
            aria-label="open drawer"
            onClick={handlePortalClick}
          >
            <DoorFrontIcon id="observer-portal-icon" />
          </IconButton>
        </Tooltip>
        <MarkdownDialogButton
          header='Help'
          icon={<HelpIcon color={color} />}
          msg={helpMsg}
          tooltipMsg='Select to view help message'
        />
        <Tooltip title="Toggle on for dark mode">
          <Switch
            checked={props.darkState}
            onChange={props.handleThemeChange} />
        </Tooltip>
      </Toolbar>
    </AppBar>
  )
}