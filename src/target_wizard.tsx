import * as React from 'react';
import UploadIcon from '@mui/icons-material/Upload';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import { UploadComponent } from './upload_targets_dialog';
import { get_simbad_data } from './simbad_button.tsx';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import { useStateContext } from './App.tsx';
// import { save_target } from './api/api_root';
import LinearProgress, { LinearProgressProps } from '@mui/material/LinearProgress';
import { Target } from './App.tsx'
import { useTargetContext } from './target_table.tsx';
import { v4 as randomId } from 'uuid';
import { submit_target } from './api/api_root.tsx';
import { FormControlLabel, FormGroup, Switch } from '@mui/material';


interface Props {
    setOpen: Function
    open: boolean
}


function LinearProgressWithLabel(props: LinearProgressProps &
{
    targets: Target[]
    setTargets: Function,
    open: boolean
}
) {

    const [targetName, setTargetName] = React.useState('')
    const [useSimbad, setUseSimbad] = React.useState(true)
    const [label, setLabel] = React.useState('Create Targets')
    const context = useStateContext()

    const { targets, setTargets, open } = props
    const [progress, setProgress] = React.useState(0)
    const generate_targets_from_list = async () => {
        setLabel('Loading Targets')
        const tgts: Target[] = []
        for (let idx = 0; idx < targets.length; idx++) {
            let tgt = targets[idx]
            const tgtName = tgt.target_name as string
            setTargetName(`on row ${idx} target: ${tgtName}`)
            if (!tgtName) continue
            if (!open) break
            
            const simbadData = useSimbad ? await get_simbad_data(tgtName) ?? {} : {}
            tgt = { ...simbadData, ...tgt, obsid: context.obsid } as Target
            tgts.push(tgt)
            setProgress(((idx + 1) / targets.length) * 100)
        }

        setProgress(100)
        setTargets(tgts)
        console.log('tgts', tgts)
        setLabel('Targets Created')
    }
    const onSimbadSwitchChange = (event: React.SyntheticEvent<Element, Event>) => {
        const value = (event.target as HTMLInputElement).checked
        setUseSimbad(value)
    }
    return (
        <>
            <Tooltip 
            title={'Simbad is used to fill in missing target data for a given name (I.E. M31)'}
            placement="right"
            >
                <FormGroup>
                    <FormControlLabel
                        onChange={onSimbadSwitchChange}
                        control={<Switch checked={useSimbad} />}
                        label={'Use Simbad target resolver'} />
                </FormGroup>
            </Tooltip>
            <Button
                disabled={label.includes('Loading')}
                onClick={generate_targets_from_list}>{label}</Button>
            {targetName && (
                <Typography variant="body2" color="text.secondary">
                    {targetName}
                </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ width: '100%', mr: 1 }}>
                    <LinearProgress variant="determinate" value={progress} {...props} />
                </Box>
                <Box sx={{ minWidth: 35 }}>
                    <Typography variant="body2" color="text.secondary">{`${Math.round(
                        progress,
                    )}%`}</Typography>
                </Box>
            </Box>
        </>
    );
}


const TargetStepper = (props: Props) => {

    const [activeStep, setActiveStep] = React.useState(0);
    const [label, setLabel] = React.useState("Load Target Names");
    const [targets, setTargets] = React.useState([] as Target[])
    const [canContinue, setCanContinue] = React.useState(false)
    const [saveMessage, setSaveMessage] = React.useState('All steps completed - Targets are ready to be saved')
    const targetContext = useTargetContext()
    const context = useStateContext()

    React.useEffect(() => {
        if (activeStep === 1) {
            setSaveMessage('All steps completed - Targets are ready to be saved')
        }
    }, [targets, activeStep])

    const save_targets = async () => {
        console.log('saving targets')
        const tgts = targets.map((tgt) => {
            return { ...tgt, _id: randomId(), obsid: context.obsid } as Target
        })

        const resp = await submit_target(tgts)
        if (resp.errors) {
            console.error('errors', resp.errors)
        }

        targetContext.setTargets((curTgts) => [...tgts, ...curTgts])
        props.setOpen(false)
    }

    const setTargetsAndContinue = (targets: Target[]) => {
        setTargets(targets)
        setCanContinue(true)
    }

    const stepComponents = [
        {
            label: 'Select File',
            component: <UploadComponent
                setLabel={setLabel}
                label={label}
                setTargets={setTargetsAndContinue} />
        },
        {
            label: 'Create Targets',
            component: <LinearProgressWithLabel
                targets={targets}
                setTargets={setTargetsAndContinue}
                open={props.open} />
        },
    ]

    const handleNext = () => {
        setCanContinue(false)
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    return (
        <Box sx={{ maxWidth: 1200, minWidth: 600 }}>
            <Stepper activeStep={activeStep} orientation="vertical">
                {stepComponents.map((step, index) => (
                    <Step key={step.label}>
                        <StepLabel
                            optional={
                                index === 2 ? (
                                    <Typography variant="caption">Last step</Typography>
                                ) : null
                            }
                        >
                            {step.label}
                        </StepLabel>
                        <StepContent>
                            <Box sx={{ mb: 2 }}>
                                <Stack>
                                    {step.component}
                                    <>
                                        <Button
                                            disabled={!canContinue}
                                            variant="contained"
                                            onClick={handleNext}
                                            sx={{ mt: 1, mr: 1 }}
                                        >
                                            {index === stepComponents.length - 1 ? 'Finish' : 'Continue'}
                                        </Button>
                                        <Button
                                            disabled={index === 0}
                                            onClick={handleBack}
                                            sx={{ mt: 1, mr: 1 }}
                                        >
                                            Back
                                        </Button>
                                    </>
                                </Stack>
                            </Box>
                        </StepContent>
                    </Step>
                ))}
            </Stepper>
            {activeStep === stepComponents.length && (
                <Paper square elevation={0} sx={{ p: 3 }}>
                    <Typography>{saveMessage}</Typography>
                    <Button onClick={save_targets} sx={{ mt: 1, mr: 1 }}>
                        Save Targets
                    </Button>
                    <Button
                        onClick={handleBack}
                        sx={{ mt: 1, mr: 1 }}
                    >
                        Back
                    </Button>
                </Paper>
            )}
        </Box>
    );
}

interface DialogProps {
    open: boolean
    onClose: Function
    setOpen: Function
}

export const TargetWizardDialog = (props: DialogProps) => {

    const { onClose, open, setOpen } = props;

    const handleClose = () => {
        onClose();
    };

    return (
        <Dialog onClose={handleClose} open={open}>
            <DialogTitle>Target Wizard</DialogTitle>
            <TargetStepper open={open} setOpen={setOpen} />
        </Dialog>
    )
}

export const TargetWizardButton = () => {

    const [open, setOpen] = React.useState(false);
    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };
    return (
        <div>
            <Tooltip title="Upload Targets from .csv file">
                <Button onClick={handleClickOpen} startIcon={<UploadIcon />}>
                    Upload Targets
                </Button>
            </Tooltip>
            <TargetWizardDialog
                open={open}
                setOpen={setOpen}
                onClose={handleClose}
            />
        </div>
    )
}