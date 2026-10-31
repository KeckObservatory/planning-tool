
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';
import { DialogComponent } from './dialog_component';
import { useQueryParam, withDefault } from 'use-query-params';
import { ViewMode } from './App';
import { ViewParam } from './target_table';

export interface CatalogDialogProps {
    open: boolean
    handleClose: Function
    targetName?: string
    onConfirm: (magnitudeOnly: boolean, includeProperMotion: boolean) => void
}

export default function CatalogDialog(props: CatalogDialogProps) {
    const { open, handleClose, targetName, onConfirm } = props
    const [magnitudeOnly, setMagnitudeOnly] = useState(false)
    const [viewMode] = useQueryParam<ViewMode>('view_mode', withDefault(ViewParam, 'non_ao' as ViewMode))
    const [includeProperMotion, setIncludeProperMotion] = useState(viewMode === 'non_ao')

    const onMagnitudeResolverChange = (event: React.SyntheticEvent<Element, Event>) => {
        const value = (event.target as HTMLInputElement).checked
        setMagnitudeOnly(value)
    }

    const onIncludeProperMotion= (event: React.SyntheticEvent<Element, Event>) => {
        const value = (event.target as HTMLInputElement).checked
        setIncludeProperMotion(value)
    }

    const handleConfirm = () => {
        onConfirm(magnitudeOnly, includeProperMotion)
        handleClose()
    }

    const dialogTitle = (<div>Fill Target from Catalog</div>)

    const dialogContent = (
        <FormGroup>
            <Alert severity="warning" sx={{ marginBottom: 2 }}>
                This will overwrite the current values for target {targetName ? `"${targetName}"` : 'this row'} with data from Simbad and Gaia.
            </Alert>
            <Tooltip title="Only overwrite magnitude fields, leaving position and other catalog data untouched" placement="right">
                <FormControlLabel onChange={onMagnitudeResolverChange} control={<Switch checked={magnitudeOnly} />}
                    label="Only overwrite Magnitude" />
            </Tooltip>
            <Tooltip title="Include proper motion fields" placement="right">
                <FormControlLabel onChange={onIncludeProperMotion} control={<Switch checked={includeProperMotion} />}
                    label="Include Proper Motion resolver" />
            </Tooltip>
        </FormGroup>
    )

    const dialogActions = (
        <>
            <Button onClick={() => handleClose()}>Cancel</Button>
            <Button onClick={handleConfirm} variant="contained">Confirm</Button>
        </>
    )

    return (
        <DialogComponent open={open} handleClose={handleClose}
            titleContent={dialogTitle} children={dialogContent} actions={dialogActions} maxWidth="sm" />
    )
}
