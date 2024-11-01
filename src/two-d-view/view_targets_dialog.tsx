import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import MultilineChartIcon from '@mui/icons-material/MultilineChart';
import IconButton from '@mui/material/IconButton';
import DialogContent from '@mui/material/DialogContent';
import Tooltip from '@mui/material/Tooltip';
import { Target } from '../App';
import TwoDView from './two_d_view';


export interface VTDProps {
  open: boolean;
  handleClose: Function;
  targets: Target[];
}

function ViewTargetsDialog(props: VTDProps) {
  const { open, handleClose, targets } = props;

  return (
    <Dialog
      onClose={() => handleClose()}
      open={open}
      sx={{ padding: '0px'}}
      maxWidth="xl"
    >
      {/* <DialogTitle sx={{padding: '12px'}}>Selected Target Charts</DialogTitle> */}
      <DialogContent>
        <TwoDView targets={targets} />
      </DialogContent>
    </Dialog>
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