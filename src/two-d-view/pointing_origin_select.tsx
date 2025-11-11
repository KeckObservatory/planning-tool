import { Autocomplete, TextField, Tooltip } from "@mui/material"
import { StringParam, useQueryParam, withDefault } from "use-query-params"


interface POSelectProps {
    pointing_origins: GeoJSON.FeatureCollection<GeoJSON.Point>
    instrument: string
}

export const POSelect = (props: POSelectProps) => {
    const { pointing_origins, instrument } = props
    const [ pointingOrigin, setPointingOrigin ] = useQueryParam<string>('pointing_origin', withDefault(StringParam, ''))

    const onPointingOriginChange = (value?: string ) => {
        if (value) {
            setPointingOrigin(value)
        }
    }

    let options = pointing_origins.features.filter((feature) => feature.properties?.instrument === instrument)
    .map((feature) => feature.properties?.name ?? '')
    .filter((name) => name !== '') as string[] // filter out any features without a name

    return (
        <Tooltip placement="top" title="Select pointing origin">
            <Autocomplete
                disablePortal
                id="pointing-origin-selection"
                value={{ label: pointingOrigin }}
                onChange={(_, value) => onPointingOriginChange(value?.label)}
                options={options.map((name) => ({ label: name }))}
                sx={{ width: '200px', paddingTop: '9px', margin: '6px' }}
                renderInput={(params) => <TextField {...params} label="PO" />}
            />
        </Tooltip>
    )
}