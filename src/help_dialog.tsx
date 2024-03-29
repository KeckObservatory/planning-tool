import * as React from 'react';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import HelpIcon from '@mui/icons-material/Help';
import IconButton from '@mui/material/IconButton';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';


export interface SimpleDialogProps {
  open: boolean;
  handleClose: Function;
}

function HelpDialog(props: SimpleDialogProps) {
  const { open, handleClose } = props;



  return (
    <Dialog onClose={() => handleClose()} open={open}>
      <DialogTitle>Motivation</DialogTitle>
      <DialogContent dividers>
          <Typography gutterBottom>
            Cras mattis consectetur purus sit amet fermentum. Cras justo odio,
            dapibus ac facilisis in, egestas eget quam. Morbi leo risus, porta ac
            consectetur ac, vestibulum at eros.
          </Typography>
          <Typography gutterBottom>
            Praesent commodo cursus magna, vel scelerisque nisl consectetur et.
            Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor.
          </Typography>
          <Typography gutterBottom>
            Aenean lacinia bibendum nulla sed consectetur. Praesent commodo cursus
            magna, vel scelerisque nisl consectetur et. Donec sed odio dui. Donec
            ullamcorper nulla non metus auctor fringilla.
          </Typography>
        </DialogContent>
    </Dialog>
  );
}

export default function HelpDialogButton() {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
        <Tooltip title="Select for a big wall of text">
        <IconButton aria-label="help" color="primary" onClick={handleClickOpen}>
          <HelpIcon/>
        </IconButton>
        </Tooltip>
      <HelpDialog
        open={open}
        handleClose={handleClose}
      />
    </>
  );
}