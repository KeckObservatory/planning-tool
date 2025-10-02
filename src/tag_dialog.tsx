import * as React from 'react';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Tooltip from '@mui/material/Tooltip';
import TagIcon from '@mui/icons-material/Tag';
import { Target, useSnackbarContext } from './App';
import { Button, IconButton, Stack } from '@mui/material';
import { MuiChipsInput } from 'mui-chips-input';
import { submit_target } from './api/api_root';
import { useRowsContext } from './target_table';
import { ProgramChipsInput } from './program_select';


export interface TagDialogProps {
    open: boolean;
    handleClose: Function;
    targets?: Target[]
}

export interface Props {
    targets: Target[]
}

function TagDialog(props: TagDialogProps) {
    const { open, handleClose, targets } = props;
    const [tags, setTags] = React.useState<string[]>([]);
    const [semids, setSemids] = React.useState<string[]>([]);

    const RowsContext = useRowsContext()
    const snackbarContext = useSnackbarContext()

    const handleArrayChange = (value: any, type: 'tags' | 'semids') => {
        if (type === 'tags') {
            setTags(value)
        } else if (type === 'semids') {
            setSemids(value)
        }
    }

    const handleSubmit = async () => {
        console.log("Submitting tags:", tags);
        // Here you would typically handle the submission, e.g., send to an API or update state
        const tgts = targets?.map(t => {
            let newTags = t.tags ? [...t.tags] : []
            tags.forEach(tag => {
                if (!newTags.includes(tag)) {
                    newTags.push(tag)
                }
            })
            return { ...t, tags: newTags }
        }) ?? []
        console.log('tgts with new tags', tgts)

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
            <DialogTitle>Target Validation Errors</DialogTitle>
            <DialogContent dividers>
                <Stack direction="column" spacing={2} sx={{ width: 500, maxWidth: '100%' }}>
                <MuiChipsInput
                    value={tags}
                    onChange={(value) => handleArrayChange(value, 'tags')}
                    label={tags.length === 0 ? "Add Tags" : "Edit Tags"}
                    id="tags"
                />
                <ProgramChipsInput
                    onChange={(value) => handleArrayChange(value, 'semids')}
                />
                <Button onClick={() => {
                    console.log("Tags submitted:", tags);
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


export default function TagDialogButton(props: Props) {
    console.log('TagDialogButton props', props)
    const [open, setOpen] = React.useState(false);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            <Tooltip title="Select to add tags to selected targets">
                <IconButton color="primary" disabled={props.targets.length === 0} onClick={handleClickOpen}>
                    <TagIcon />
                </IconButton>
            </Tooltip>
            <TagDialog
                open={open}
                handleClose={handleClose}
                targets={props.targets}
            />
        </>
    );
}