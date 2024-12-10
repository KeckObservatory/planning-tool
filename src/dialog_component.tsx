import Button from "@mui/material/Button"
import DialogContent from "@mui/material/DialogContent"
import DialogTitle from "@mui/material/DialogTitle"
import Stack from "@mui/material/Stack"
import CloseIcon from '@mui/icons-material/Close';
import Dialog from "@mui/material/Dialog";
import { Breakpoint, DialogActions } from "@mui/material";

interface Props {
    maxWidth?: Breakpoint
    open: boolean
    handleClose: Function
    titleContent: JSX.Element
    children: JSX.Element
    actions?: JSX.Element
}

export const DialogComponent = (props: Props) => {

    return (
        <Dialog
            maxWidth={props.maxWidth ?? 'md'}
            onClose={() => props.handleClose()}
            open={props.open}
            sx={{ padding: '0px' }}
        >
            <DialogTitle>
                <Stack direction='row' justifyContent='space-between' spacing={0}>
                    {props.titleContent}
                    <Button
                        onClick={() => props.handleClose()}
                        variant='contained'
                        startIcon={<CloseIcon />}>
                        Close
                    </Button>
                </Stack>
            </DialogTitle>
            <DialogContent >
                {props.children}
            </DialogContent>
            {props.actions && (<DialogActions>{props.actions}</DialogActions>)}
        </Dialog>
    )
}
