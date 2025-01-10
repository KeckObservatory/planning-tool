import * as React from 'react';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Target, useStateContext } from './App';
import { DialogComponent } from './dialog_component';
import { Button, Typography } from '@mui/material';
import { delete_target } from './api/api_root';



export interface VTDProps {
  open: boolean;
  handleClose: Function;
  targets: Target[];
}

interface Props {
  targets: Target[];
  color?: 'inherit' | 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

function DeleteTargets(props: { targets: Target[] }) {
  const { targets } = props;
  const context = useStateContext()

  const onClick = async () => {
    const ids = targets.map((target) => target._id);
    const resp = await delete_target(ids)
    if (!resp) {
      console.error('error submitting target')
      return
    }
    context.setTargets((oldTargets) => {
      const newTgts = oldTargets.filter((row) => !ids.includes(row._id))
      console.log('newTgts:', newTgts)
      console.log('oldTgts:', oldTargets)
      return newTgts
    })
  }

  const targetList = targets.map((target, index) => {
    return (
      <div key={index}>
        {target.target_name}
      </div>
    );
  });

  return (
    <div>
      <Button onClick={onClick}>Confirm Delete?</Button>
      <Typography>Targets to be deleted:</Typography>
      {targetList}
    </div>
  );
}

function DeleteTargetsDialog(props: VTDProps) {
  const { open, handleClose, targets } = props;

  const dialogTitle = (
    <div>Delete Targets</div>
  );

  const dialogContent = (
    <DeleteTargets targets={targets} />
  )

  return (
    <DialogComponent
      open={open}
      handleClose={handleClose}
      titleContent={dialogTitle}
      children={dialogContent}
      maxWidth="sm"
    />
  );
}

export default function DeleteDialogButton(props: Props) {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Tooltip title="Delete selected target(s)">
        <IconButton aria-label="help" color={props.color ?? 'default'} onClick={handleClickOpen}>
          <DeleteIcon />
        </IconButton>
      </Tooltip>
      <DeleteTargetsDialog
        open={open}
        targets={props.targets}
        handleClose={handleClose}
      />
    </>
  );
}