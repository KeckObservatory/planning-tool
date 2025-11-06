import React, { useState, useEffect } from 'react'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import AladinViewer from '../aladin';

import { Target } from '../App';
import { Autocomplete, Stack, TextField } from '@mui/material';
import { DialogComponent } from '../dialog_component';
import GuideStarTable from './guide_star_table';
import { SimbadTargetData } from '../catalog_button';

export interface GuideStarTarget extends SimbadTargetData {
    target_name: string;
}

export const guidestartargets: GuideStarTarget[] = [
    {
        "dec": "+30:39:36.630403128",
        "dec_deg": 30.960175112,
        "epoch": "J2000",
        "equinox": "2000",
        "g_mag": 15.113876,
        "j_mag": 5.039,
        "pm_dec": 0.827,
        "pm_ra": 0.707,
        "ra": "01:33:50.8965749232",
        "ra_deg": 23.3620690622,
        "systemic_velocity": -179.2,
        "target_name": "M33 buddy"
    },
    {
        "dec": "+30:39:36.630403128",
        "dec_deg": 30.660175112,
        "epoch": "J2000",
        "equinox": "2000",
        "g_mag": 15.113876,
        "j_mag": 5.039,
        "pm_dec": 0.827,
        "pm_ra": 0.707,
        "ra": "01:33:50.8965749232",
        "ra_deg": 23.1620690622,
        "target_name": "M33 buddy 4"
    },
    {
        "dec": "+30:39:36.630403128",
        "dec_deg": 30.560175112,
        "epoch": "J2000",
        "equinox": "2000",
        "g_mag": 15.113876,
        "j_mag": 5.039,
        "pm_dec": 0.827,
        "pm_ra": 0.707,
        "ra": "01:33:50.8965749232",
        "ra_deg": 23.4620690622,
        "target_name": "M33 buddy 2"
    },
    {
        "dec": "+30:39:36.630403128",
        "dec_deg": 30.560175112,
        "epoch": "J2000",
        "equinox": "2000",
        "g_mag": 15.113876,
        "j_mag": 5.039,
        "pm_dec": 0.827,
        "pm_ra": 0.707,
        "ra": "01:33:50.8965749232",
        "ra_deg": 23.5620690622,
        "target_name": "M33 buddy 3"
    }
]


interface ButtonProps {
    targets: Target[]
}

export interface TargetViz extends Target {
}

const height = 500
const width = 500

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
    const [guideStarName, setGuideStarName] = useState<string>('')

    const onGuideStarNameSelect = (name: string) => {
        console.log("setting guidestar name to:", name)
        setGuideStarName(name)
    }

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
            <Stack direction='row' spacing={2} sx={{ marginTop: '16px' }}>
                <AladinViewer
                    targets={[target]}
                    guideStars={guidestartargets as Target[]}
                    positionAngle={target.rotator_pa ?? 0}
                    fovAngle={0}
                    instrumentFOV={''}
                    height={height}
                    width={width}
                    selectCallback={onGuideStarNameSelect}
                    selectedGuideStarName={guideStarName}
                />
                <GuideStarTable 
                    selectedGuideStarName={guideStarName} 
                    setSelectedGuideStarName={setGuideStarName} 
                    targets={guidestartargets} 
                    science_target_name={target.target_name ?? target._id}
                />
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
