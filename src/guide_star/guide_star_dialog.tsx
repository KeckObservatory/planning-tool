import React, { useState, useEffect } from 'react'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

import { StringParam, useQueryParam, withDefault } from 'use-query-params';
import { Target, useStateContext } from '../App';
import { Autocomplete, Stack, TextField, Typography } from '@mui/material';
import { DialogComponent } from '../dialog_component';

interface ButtonProps {
    targets: Target[]
}

export interface TargetViz extends Target {
}

interface VizDialogProps {
    open: boolean,
    target: Target,
    setTarget: (t: Target) => void
    targets: Target[]
    handleClose: () => void
}

interface SemesterSelectProps {
    semester: string
    setSemester: (semester: string) => void
}

export const GuideStarButton = (props: ButtonProps) => {
    const { targets } = props
    let initTarget = targets.at(0) ?? {} as Target
    const [target, setTarget] = useState<Target>(initTarget)
    const [open, setOpen] = React.useState(false);

    useEffect(() => {
        if (targets.length > 0) {
            const target = targets.at(0) ?? {} as Target
            setTarget(target)
        }
    }, [targets])

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            <Tooltip title={`Click to find and add guide stars for ${target.target_name ?? target._id}`}>
                <IconButton color="primary" onClick={handleClickOpen}>
                    <AutoAwesomeIcon />
                </IconButton>
            </Tooltip>
            {open &&
                <GuideStarDialog
                    open={open}
                    target={target}
                    setTarget={setTarget}
                    targets={targets}
                    handleClose={handleClose}
                />
            }
        </>
    );
}

export const SemesterSelect = (props: SemesterSelectProps) => {
    const { semester, setSemester } = props
    const handleSemesterChange = (semester?: string) => {
        if (semester) setSemester(semester)
    }
    return (
        <Tooltip title="Select Semester visibility Range.">
            <TextField
                // focused
                label={'Semester Select'}
                id="target-name"
                value={semester}
                onChange={(event) => handleSemesterChange(event.target.value)}
            />
        </Tooltip>
    )
}


export const GuideStarDialog = (props: VizDialogProps) => {
    // target must have ra dec and be defined
    const { target, setTarget, targets, open } = props

    const onTargetNameSelect = (name: string) => {
        const targetName = target.target_name ?? target._id
        if (name !== targetName) {
            let newTarget = targets.find((t: Target) => t.target_name === name || t._id === name)
            newTarget = (newTarget && newTarget.ra && newTarget.dec) ? newTarget : {} as Target
            setTarget(newTarget)
        }
    }

    const dialogTitle = (
        <span>Guide Star Selection</span>
    )

    const dialogContent = (
        <Stack
            sx={{
                paddingTop: '16px',
                display: 'flex',
                flexWrap: 'wrap',
            }}
            direction='column'>
            <Stack direction='row' spacing={1}>
                <Tooltip title={'Target'}>
                    <Autocomplete
                        disablePortal
                        id="selected-target"
                        value={target.target_name ?? target._id}
                        onChange={(_, value) => value && onTargetNameSelect(value)}
                        options={targets.map(target => target.target_name ?? target._id)}
                        sx={{ width: 250 }}
                        renderInput={(params) => <TextField {...params} label={'Selected Target'} />}
                    />
                </Tooltip>
            </Stack>
            <Stack direction='column' spacing={2} sx={{ marginTop: '16px' }}>
                <Typography variant="h6">Guide Star Selection chart goes here</Typography>
                <Typography variant="h6">Guide Star Table goes here</Typography>
            </Stack>
        </Stack>
    )

    return (
        <DialogComponent
            open={open}
            handleClose={props.handleClose}
            titleContent={dialogTitle}
            children={dialogContent}
            maxWidth="xl"
        />
    )
}
