import { Autocomplete, TextField, Tooltip } from "@mui/material"
import { StringParam, useQueryParam, withDefault } from "use-query-params"


interface FOVSelectProps {
    fovs: string[]
}

export const FOVSelect = (props: FOVSelectProps) => {
    const { fovs } = props
    const [instrumentFOV, setInstrumentFOV] = useQueryParam('instrument_fov', withDefault(StringParam, 'NIRC2'))

    const onInstrumentFOVChange = (value: string | undefined | null) => {
        if (value) {
            setInstrumentFOV(value)
        }
    }

    return (
        <Tooltip placement="top" title="Select instrument field of view">
            <Autocomplete
                disablePortal
                id="fov-selection"
                value={{ label: instrumentFOV }}
                onChange={(_, value) => onInstrumentFOVChange(value?.label)}
                options={fovs.map((instr) => { return { label: instr } })}
                sx={{ width: '200px', paddingTop: '9px', margin: '6px' }}
                renderInput={(params) => <TextField {...params} label="Instrument FOV" />}
            />
        </Tooltip>
    )
}