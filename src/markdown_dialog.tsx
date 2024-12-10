import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ReactMarkdown from 'react-markdown';
import { DialogComponent } from './dialog_component';


export interface MarkdownDialogProps {
  open: boolean;
  header: string;
  msg: string;
  handleClose: Function;
}

function MarkdownDialog(props: MarkdownDialogProps) {
  const { open, handleClose } = props;

  const dialogContent = (
    <ReactMarkdown>{props.msg}</ReactMarkdown>
  );

  const titleContent = (
    <div>
      {props.header}
    </div>
  )

  return (
      <DialogComponent
          maxWidth={'xl'}
          handleClose={handleClose}
          open={open}
          titleContent={titleContent}
          children={dialogContent}
      />
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