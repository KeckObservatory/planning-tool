import * as React from 'react';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import {
    Autocomplete,
    Box,
    Typography
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit';
import SimbadButton from './simbad_button';
import target_schema from './target_schema.json'
import { Target } from './App';

interface Props {
    target: Target
    setTarget: Function
}

interface TargetEditProps extends Props {
    handleClose: Function
    open: boolean
}

export interface PropertyProps {
    description: string,
    type: string | string[],
    short_description?: string,
    default?: unknown,
    pattern?: string,
    not_editable_by_user?: boolean,
    enum?: string[]
}

export interface TargetProps {
    [key: string]: PropertyProps
}

const targetProps = target_schema.properties as TargetProps

export const raDecFormat = (input: string) => {
    // Strip all characters from the input digits and keep pos/neg sign
    const sign = input.length > 0 ? input[0].replace(/[^+-]/, "") : ""
    input = input.replace(/[^0-9]+/g, "");

    // Based upon the length of the string, we add formatting as necessary
    var size = input.length;
    if (size < 2) {
        input = input;
    }
    else if (size < 3) {
        input = input + ':';
    } else if (size < 5) {
        input = input.substring(0, 2) + ':' + input.substring(2, 4) + ':';
    } else if (size < 6) {
        input = input.substring(0, 2) + ':' + input.substring(2, 4) + ':' + input.substring(4, 6);
    } else if (size < 7) {
        input = input.substring(0, 2) + ':' + input.substring(2, 4) + ':' + input.substring(4, 6) + '.';
    } else {
        input = input.substring(0, 2) + ':' + input.substring(2, 4) + ':' + input.substring(4, 6) + '.' + input.substring(6);
    }
    return sign + input;
}

export const rowSetter = (tgt: Target, key: string, value?: string | number | boolean) => {
    tgt = { ...tgt, [key]: value, status: 'EDITED' }
    return tgt
}


export const TargetEditDialog = (props: TargetEditProps) => {

    const { target, setTarget } = props
    const [hasSimbad, setHasSimbad] = React.useState(target.tic_id || target.gaia_id ? true : false)

    React.useEffect(() => {
        setHasSimbad(target.tic_id || target.gaia_id ? true : false)
    }, [target.tic_id, target.gaia_id])

    const handleTextChange = (key: string, value?: string | number, isNumber = false) => {
        //add trailing zero if string ends in a decimal 
        //value = isNumber ? String(value).replace(/(\d+)\.$/, "$1.0") : value
        if (isNumber) {
          //const pattern = targetProps[key].pattern ?? "\\d+"
          const pattern = "[\\d\\.\\+\\-]*"
          value = String(value).replace("(" + pattern + ")", "$1")
          console.log('value', value, 'pattern', pattern)
        }
        if (value && (key === 'ra' || key === 'dec')) {
            key === 'ra' && String(value).replace(/[^+-]/, "")
            value = raDecFormat(value as string)
        }
        setTarget((prev: Target) => {
            return rowSetter(prev, key, isNumber ? Number(value) : value)
        })
    }

    const input_label = (param: keyof Target, tooltip = false): string => {
        return tooltip ?
            targetProps[param].description
            :
            targetProps[param].short_description ?? targetProps[param].description
    }

    const handleSimbadChange = (tgt: Target) => {
        setTarget((prev: Target) => {
            tgt = { ...prev, ...tgt, status: 'EDITED' }
            return tgt
        })
        setHasSimbad(tgt.tic_id || tgt.gaia_id ? true : false)
        handleTextChange('ra', tgt.ra)
    }


    const rotOptions = targetProps.rotator_mode?.enum?.map((s) => { return { label: s } })
    const wrapOptions = targetProps.telescope_wrap?.enum?.map((s) => { return { label: s } })

    return (
        <Dialog
            maxWidth="lg"
            onClose={() => props.handleClose()}
            open={props.open}

        >
            <DialogTitle>
                <>
                    <span>TargetEdit</span>
                    <SimbadButton target={target} setTarget={handleSimbadChange} hasSimbad={hasSimbad} />
                </>
            </DialogTitle>
            <DialogContent >
                <Stack sx={{
                    paddingTop: '16px',
                    display: 'flex',
                    flexWrap: 'wrap',
                }}
                    justifyContent='center'
                    maxWidth='100%'
                >
                    <Paper
                        sx={{
                            padding: '12px',
                            margin: '6px',
                        }}
                        elevation={3}
                    >
                        <Box>
                            <Typography
                                component="h1"
                                variant="h6"
                                color="inherit"
                                align='center'
                                noWrap
                            >
                                Target Information
                            </Typography>
                            <Stack sx={{ marginBottom: '24px' }} width="100%" direction="row" justifyContent='center' spacing={2}>
                                <Tooltip title={input_label('target_name', true)}>
                                    <TextField
                                        label={input_label('target_name')}
                                        id="target-name"
                                        value={target.target_name}
                                        onChange={(event) => handleTextChange('target_name', event.target.value)}
                                    />
                                </Tooltip>
                            </Stack>
                            <Stack sx={{ marginBottom: '24px' }} width="100%" direction="row" justifyContent='center' spacing={2}>
                                <Tooltip title={input_label('ra', true)}>
                                    <TextField
                                        label={input_label('ra')}
                                        InputLabelProps={{ shrink: hasSimbad || 'ra' in target }}
                                        id="ra"
                                        value={target.ra}
                                        onChange={(event) => handleTextChange('ra', event.target.value)}
                                    />
                                </Tooltip>
                                <Tooltip title={input_label('dec', true)}>
                                    <TextField
                                        label={input_label('dec')}
                                        InputLabelProps={{ shrink: hasSimbad || 'dec' in target }}
                                        id="dec"
                                        value={target.dec}
                                        onChange={(event) => handleTextChange('dec', event.target.value)}
                                    />
                                </Tooltip>
                                <Tooltip title={input_label('j_mag', true)}>
                                    <TextField
                                        label={input_label('j_mag')}
                                        InputLabelProps={{ shrink: hasSimbad || 'j_mag' in target }}
                                        id="j-magnitude"
                                        value={target.j_mag}
                                        onChange={(event) => handleTextChange('j_mag', event.target.value, true)}
                                    />
                                </Tooltip>
                                <Tooltip title={input_label('g_mag', true)}>
                                    <TextField
                                        label={input_label('g_mag')}
                                        InputLabelProps={{ shrink: hasSimbad || 'g_mag' in target }}
                                        id="g-magnitude"
                                        value={target.g_mag}
                                        onChange={(event) => handleTextChange('g_mag', event.target.value, true)}
                                    />
                                </Tooltip>
                            </Stack>
                            <Stack sx={{ marginBottom: '24px' }} width="100%" direction="row" justifyContent='center' spacing={2}>
                                <Tooltip title={input_label('ra_offset', true)}>
                                    <TextField
                                        label={input_label('ra_offset')}
                                        InputLabelProps={{ shrink: hasSimbad || 'ra_offset' in target }}
                                        id="ra_offset"
                                        value={target.ra_offset}
                                        onChange={(event) => handleTextChange('ra_offset', event.target.value, true)}
                                    />
                                </Tooltip>
                                <Tooltip title={input_label('dec_offset', true)}>
                                    <TextField
                                        label={input_label('dec_offset')}
                                        InputLabelProps={{ shrink: hasSimbad || 'dec_offset' in target }}
                                        id="dec_offset"
                                        value={target.dec_offset}
                                        onChange={(event) => handleTextChange('dec_offset', event.target.value, true)}
                                    />
                                </Tooltip>
                                <Tooltip title={input_label('rotator_mode', true)}>
                                    <Autocomplete
                                        disablePortal
                                        id="rotator-mode"
                                        value={target.rotator_mode ? { label: target.rotator_mode } : null}
                                        onChange={(_, value) => handleTextChange('rotator_mode', value?.label)}
                                        options={rotOptions ?? []}
                                        sx={{ width: 250 }}
                                        renderInput={(params) => <TextField {...params} label={input_label('rotator_mode')} />}
                                    />
                                </Tooltip>
                                <Tooltip title={input_label('telescope_wrap', true)}>
                                    <Autocomplete
                                        disablePortal
                                        id="telescope-wrap"
                                        value={target.telescope_wrap ? { label: target.telescope_wrap } : null}
                                        onChange={(_, value) => handleTextChange('telescope_wrap', value?.label)}
                                        options={wrapOptions ?? []}
                                        sx={{ width: 150 }}
                                        renderInput={(params) => <TextField {...params} label={input_label('telescope_wrap')} />}
                                    />
                                </Tooltip>
                            </Stack>
                            <Stack sx={{ marginBottom: '24px' }} width="100%" direction="row" justifyContent='center' spacing={2}>
                                <Tooltip title={input_label('d_ra', true)}>
                                    <TextField
                                        label={input_label('d_ra')}
                                        InputLabelProps={{ shrink: hasSimbad || target.d_ra!== undefined }}
                                        id="dra"
                                        value={target.d_ra}
                                        onChange={(event) => handleTextChange('d_ra', event.target.value, true)}
                                    />
                                </Tooltip>
                                <Tooltip title={input_label('d_dec', true)}>
                                    <TextField
                                        label={input_label('d_dec')}
                                        InputLabelProps={{ shrink: hasSimbad || target.d_dec !== undefined }}
                                        id="d_dec"
                                        value={target.d_dec}
                                        onChange={(event) => handleTextChange('d_dec', event.target.value, true)}
                                    />
                                </Tooltip>
                                <Tooltip title={input_label('gaia_id', true)}>
                                    <TextField
                                        label={input_label('gaia_id')}
                                        InputLabelProps={{ shrink: hasSimbad || target.gaia_id !== undefined }}
                                        id="gaia-id"
                                        value={target.gaia_id}
                                        onChange={(event) => handleTextChange('gaia_id', event.target.value)}
                                    />
                                </Tooltip>
                                <Tooltip title={input_label('tic_id', true)}>
                                    <TextField
                                        label={input_label('tic_id')}
                                        InputLabelProps={{ shrink: hasSimbad || target.tic !== undefined }}
                                        id="tic"
                                        value={target.tic}
                                        onChange={(event) => handleTextChange('tic_id', event.target.value)}
                                    />
                                </Tooltip>
                            </Stack>
                            <Stack sx={{ marginBottom: '24px' }} width="100%" direction="row" justifyContent='center' spacing={2}>
                                <Tooltip title={input_label('pm_ra', true)}>
                                    <TextField
                                        label={input_label('pm_ra')}
                                        InputLabelProps={{ shrink: hasSimbad || 'pm_ra' in target }}
                                        id="pm-ra"
                                        value={target.pm_ra}
                                        onChange={(event) => handleTextChange('pm_ra', event.target.value, true)}
                                    />
                                </Tooltip>
                                <Tooltip title={input_label('pm_dec', true)}>
                                    <TextField
                                        label={input_label('pm_dec')}
                                        InputLabelProps={{ shrink: hasSimbad || 'pm_dec' in target }}
                                        id="pm-dec"
                                        value={target.pm_dec}
                                        onChange={(event) => handleTextChange('pm_dec', event.target.value, true)}
                                    />
                                </Tooltip>
                                <Tooltip title={input_label('epoch', true)}>
                                    <TextField
                                        label={input_label('epoch')}
                                        InputLabelProps={{ shrink: hasSimbad || 'epoch' in target }}
                                        id="epoch"
                                        value={target.epoch}
                                        onChange={(event) => handleTextChange('epoch', event.target.value)}
                                    />
                                </Tooltip>
                            </Stack>
                            <Stack sx={{ marginBottom: '24px' }} width="100%" direction="row" justifyContent='center' spacing={2}>
                                <Tooltip title={input_label('comment', true)}>
                                    <TextField
                                        label={input_label('comment')}
                                        InputLabelProps={{ shrink: hasSimbad || 'comment' in target }}
                                        id="comments"
                                        value={target.comment}
                                        onChange={(event) => handleTextChange('comment', event.target.value)}
                                    />
                                </Tooltip>
                            </Stack>
                        </Box>
                    </Paper>
                </Stack>
            </DialogContent >
        </Dialog >
    )

}

export default function TargetEditDialogButton(props: Props) {
    const [open, setOpen] = React.useState(false);
    const { target, setTarget } = props

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            <Tooltip title="Select to edit target in dialog window">
                <IconButton onClick={handleClickOpen}>
                    <EditIcon />
                </IconButton>
            </Tooltip>
            <TargetEditDialog
                open={open}
                target={target}
                setTarget={setTarget}
                handleClose={handleClose}
            />
        </>
    );
}