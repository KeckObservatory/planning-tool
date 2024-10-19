import * as React from 'react';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import DialogContent from '@mui/material/DialogContent';
import Tooltip from '@mui/material/Tooltip';
import ReactMarkdown from 'react-markdown';


export interface MarkdownDialogProps {
  open: boolean;
  header: string;
  msg: string;
  handleClose: Function;
}

function MarkdownDialog(props: MarkdownDialogProps) {
  const { open, handleClose } = props;

  return (
    <Dialog 
    maxWidth='xl'
    onClose={() => handleClose()} open={open}>
      <DialogTitle>{props.header}</DialogTitle>
      <DialogContent dividers>
        <ReactMarkdown>{props.msg}</ReactMarkdown>
        </DialogContent>
    </Dialog>
  );
}

interface Props {
  header: string,
  tooltipMsg: string,
  icon: JSX.Element,
  msg: string
}

export default function MarkdownDialogButton(props: Props) {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
        <Tooltip title={props.tooltipMsg}>
        <IconButton aria-label="help" color="primary" onClick={handleClickOpen}>
          {props.icon}
        </IconButton>
        </Tooltip>
      <MarkdownDialog
        open={open}
        msg={props.msg}
        header={props.header}
        handleClose={handleClose}
      />
    </>
  );
}