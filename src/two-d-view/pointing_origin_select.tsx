import { Autocomplete, TextField, Tooltip } from "@mui/material"
import React from "react"
import { useEffect } from "react"
import { StringParam, useQueryParam, withDefault } from "use-query-params"


interface POSelectProps {
    pointing_origins?: GeoJSON.FeatureCollection<GeoJSON.Point>
    instrument: string
}

export const POSelect = (props: POSelectProps) => {
    const { pointing_origins, instrument } = props
    const [ pointingOrigin, setPointingOrigin ] = useQueryParam<string>('pointing_origin', withDefault(StringParam, ''))
    const [ options, setOptions ] = React.useState<string[]>([])

    const onPointingOriginChange = (value?: string ) => {
        if (value) {
            setPointingOrigin(value)
        }
    }

    useEffect(() => {
        console.log('pointing origins', pointing_origins)
        if (!pointing_origins) {
            setOptions([])
            return
        }
        const filteredOptions = pointing_origins.features.filter((feature) => feature.properties?.instrument === instrument)
            .map((feature) => feature.properties?.name ?? '')
        setOptions(filteredOptions)
    }, [pointing_origins, instrument])


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