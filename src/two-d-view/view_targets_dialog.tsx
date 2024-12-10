import * as React from 'react';
import MultilineChartIcon from '@mui/icons-material/MultilineChart';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Target } from '../App';
import TwoDView from './two_d_view';
import { DialogComponent } from '../dialog_component';


export interface VTDProps {
  open: boolean;
  handleClose: Function;
  targets: Target[];
}

function ViewTargetsDialog(props: VTDProps) {
  const { open, handleClose, targets } = props;

  const dialogTitle = (
    <div>Selected Target Charts</div>
  );

  const dialogContent = (
    <TwoDView targets={targets} />
  )

  return (
    <DialogComponent 
      open={open}
      handleClose={handleClose}
      titleContent={dialogTitle}
      children={dialogContent}
      maxWidth="xl"
    />
  );
}

interface Props {
  targets: Target[];
}

export default function ViewTargetsDialogButton(props: Props) {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Tooltip title="Display charts of selected target">
        <IconButton aria-label="help" color="primary" onClick={handleClickOpen}>
          <MultilineChartIcon />
        </IconButton>
      </Tooltip>
      <ViewTargetsDialog
        open={open}
        targets={props.targets}
        handleClose={handleClose}
      />
    </>
  );
}