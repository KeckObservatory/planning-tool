
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';
import { DialogComponent } from './dialog_component';

export interface CatalogDialogProps {
    open: boolean
    handleClose: Function
    targetName?: string
    onConfirm: (magnitudeOnly: boolean) => void
}

export default function CatalogDialog(props: CatalogDialogProps) {
    const { open, handleClose, targetName, onConfirm } = props
    const [magnitudeOnly, setMagnitudeOnly] = useState(false)

    const onMagnitudeResolverChange = (event: React.SyntheticEvent<Element, Event>) => {
        const value = (event.target as HTMLInputElement).checked
        setMagnitudeOnly(value)
    }

    const handleConfirm = () => {
        onConfirm(magnitudeOnly)
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
                    label="Magnitude resolver" />
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
