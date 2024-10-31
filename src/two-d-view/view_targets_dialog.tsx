import * as React from 'react';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import MultilineChartIcon from '@mui/icons-material/MultilineChart';
import IconButton from '@mui/material/IconButton';
import DialogContent from '@mui/material/DialogContent';
import Tooltip from '@mui/material/Tooltip';
import { Target } from '../App';
import TwoDView from './two_d_view';
import AladinViewer from '../aladin';
import Stack from '@mui/material/Stack';


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
      maxWidth="lg"
    >
      <DialogTitle>Selected Target Charts</DialogTitle>
      <DialogContent>
        <Stack sx={{}} width="100%" direction="row" justifyContent='center' spacing={2}>
          <TwoDView targets={targets} />
          <AladinViewer targets={targets} />
        </Stack>
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