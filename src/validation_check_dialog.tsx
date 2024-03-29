import * as React from 'react';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import ApprovalIcon from '@mui/icons-material/Approval';
import VerifiedIcon from '@mui/icons-material/Verified';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import target_schema from './target_schema.json'
import AJV2019, { ErrorObject } from 'ajv/dist/2019'
import { Target } from './App';
import { IconButton } from '@mui/material';


export interface SimpleDialogProps {
  open: boolean;
  handleClose: Function;
  errors: ErrorObject<string, Record<string, any>, unknown>[];
}

export interface Props {
  errors : ErrorObject<string, Record<string, any>, unknown>[];
  target : Target
}

const ajv = new AJV2019({allErrors:true})
let ts = target_schema as any
delete ts["$schema"]
export const validate = ajv.compile(ts)

function ValidationDialog(props: SimpleDialogProps) {
  const { open, handleClose } = props;
  return (
    <Dialog maxWidth="lg" onClose={() => handleClose()} open={open}>
      <DialogTitle>Target Validation Errors</DialogTitle>
      <DialogContent dividers>
        {
          props.errors.map((err) => {
            let msg = err.message
            if (err.keyword === 'required') {
              msg = `${err.params.missingProperty}: ${err.message}`
            }
            if (err.keyword === 'type') {
            msg = `${err.instancePath.substring(1)}: ${err.message}`
            }
            return (
              <Typography gutterBottom>
                {msg}
              </Typography>)
          })
      }
      </DialogContent>
    </Dialog>
  );
}


export default function ValidationDialogButton(props: Props) {
  const [open, setOpen] = React.useState(false);
  const [icon, setIcon] = React.useState(<ApprovalIcon />)

  React.useEffect(() => {
    if (props.errors.length > 0) {
      setIcon(<LocalFireDepartmentIcon color="warning" />)
    }
    else {
      setIcon(<VerifiedIcon color="success" />)
    }
  }, [props.target, props.errors])


  const handleClickOpen = () => {
    if (props.errors.length > 0) {
      console.log(props.errors)
      setOpen(true);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Tooltip title="Select to see target validation errors (if any)">
        <IconButton onClick={handleClickOpen}>
          {icon}
        </IconButton>
      </Tooltip>
      <ValidationDialog
        open={open}
        handleClose={handleClose}
        errors={props.errors}
      />
    </>
  );
}