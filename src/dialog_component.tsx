import Button from "@mui/material/Button"
import DialogContent from "@mui/material/DialogContent"
import DialogTitle from "@mui/material/DialogTitle"
import Stack from "@mui/material/Stack"
import CloseIcon from '@mui/icons-material/Close';
import Dialog from "@mui/material/Dialog";
import { Breakpoint, DialogActions } from "@mui/material";

interface Props {
    maxWidth?: Breakpoint
    minWidth?: number | string 
    open: boolean
    handleClose: Function
    titleContent: JSX.Element
    children: JSX.Element
    actions?: JSX.Element
    fullScreen?: boolean
}

export const DialogComponent = (props: Props) => {

    let maxWidth = props.maxWidth ?? 'md';
    props.minWidth && (maxWidth = false as unknown as Breakpoint) // if minWidth is set, disable maxWidth to allow for custom minWidth

    return (
        <Dialog
            maxWidth={maxWidth}
            onClose={() => props.handleClose()}
            open={props.open}
            fullScreen={props.fullScreen}
            sx={{ padding: '0px' }}
        >
            <DialogTitle>
                <Stack direction='row' minWidth={props.minWidth} justifyContent='space-between' spacing={0}>
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
