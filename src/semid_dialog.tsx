import * as React from 'react';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Tooltip from '@mui/material/Tooltip';
import { Target, useSnackbarContext } from './App';
import { Button, Stack } from '@mui/material';
import { submit_target } from './api/api_root';
import { useRowsContext } from './target_table';
import { ProgramChipsInput } from './program_select';


export interface SemidDialogProps {
    open: boolean;
    handleClose: Function;
    targets?: Target[]
}

export interface Props {
    targets: Target[]
}

function SemidDialog(props: SemidDialogProps) {
    const { open, handleClose, targets } = props;
    const [semids, setSemids] = React.useState<string[]>([]);

    const RowsContext = useRowsContext()
    const snackbarContext = useSnackbarContext()

    const handleArrayChange = (value: any) => {
        setSemids(value)
    }

    const handleSubmit = async () => {
        // Here you would typically handle the submission, e.g., send to an API or update state
        const tgts = targets?.map(tgt => {
            let newTarget = { ...tgt, semids: semids }
            return newTarget
        }) ?? []

        const resp = await submit_target(tgts)
        if (resp.errors && resp.errors.length > 0) {
            console.error('errors', resp.errors)
            snackbarContext.setSnackbarMessage({ severity: 'error', message: `Error saving targets ${resp.errors}` })
            snackbarContext.setSnackbarOpen(true);
        }
        else {
            snackbarContext.setSnackbarMessage({ severity: 'success', message: `Successfully saved ${resp.targets.length} targets` })
            snackbarContext.setSnackbarOpen(true);
            RowsContext.setRows((tgts) => {
                return ( //update targets 
                    tgts.map(tgt => {
                        const updatedTgt = resp.targets.find(rt => rt._id === tgt._id);
                        return updatedTgt ? { ...tgt, ...updatedTgt } : tgt;
                    }))
            });
        }
    }


    return (
        <Dialog maxWidth="lg" onClose={() => handleClose()} open={open}>
            <DialogTitle>Semid Assignment</DialogTitle>
            <DialogContent dividers>
                <Stack direction="row" spacing={2} sx={{ width: 500, maxWidth: '100%' }}>
                    <ProgramChipsInput
                        semids={semids}
                        onChange={(value) => handleArrayChange(value)}
                    />
                    <Button onClick={() => {
                        handleSubmit();
                        handleClose();
                    }}>
                        Submit
                    </Button>
                </Stack>
            </DialogContent>
        </Dialog>
    );
}


export default function SemidDialogButton(props: Props) {
    const [open, setOpen] = React.useState(false);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            <Tooltip
                placement='top'
                title="Assign semid(s) to selected targets. Targets with these semids will be visible to other users who share these semids."
            >
                <Button color="primary" disabled={props.targets.length === 0} onClick={handleClickOpen}>
                    Assign Semid(s)
                </Button>
            </Tooltip>
            <SemidDialog
                open={open}
                handleClose={handleClose}
                targets={props.targets}
            />
        </>
    );
}