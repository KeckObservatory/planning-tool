import { Autocomplete, Checkbox, TextField, Tooltip } from "@mui/material"
import React from "react"
import { useEffect } from "react"
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

interface POSelectProps {
    pointing_origins?: GeoJSON.FeatureCollection<GeoJSON.Point>
    instrument: string
}

export const POSelect = (props: POSelectProps) => {
    const { pointing_origins, instrument } = props
    const [pointingOrigin, setPointingOrigin] = React.useState<GeoJSON.Feature<GeoJSON.Point>[]>([])
    const [options, setOptions] = React.useState<(GeoJSON.Feature<GeoJSON.Point> | undefined)[]>([])

    const onPointingOriginChange = (value: (GeoJSON.Feature<GeoJSON.Point> | undefined)[]) => {
        if (value?.includes(undefined)) {
            setPointingOrigin([])
        }
        else {
            setPointingOrigin(value as GeoJSON.Feature<GeoJSON.Point>[])
        }
    }

    useEffect(() => {
        console.log('pointing origins', pointing_origins)
        if (!pointing_origins) {
            setOptions([])
            return
        }
        const filteredOptions = pointing_origins.features
            .filter((feature) => instrument.includes(feature.properties?.instrument))

        setOptions([undefined, ...filteredOptions])
    }, [pointing_origins, instrument])

    return (
        <Tooltip placement="top" title="Select pointing origin">
            <Autocomplete
                disablePortal
                id="pointing-origin-selection"
                value={pointingOrigin}
                onChange={(_, value) => onPointingOriginChange(value)}
                options={options}
                sx={{ width: '200px', paddingTop: '9px', margin: '6px' }}
                renderInput={(params) => <TextField {...params} label="PO" />}
                multiple
                disableCloseOnSelect
                getOptionLabel={(option) => option?.properties?.name || 'None'}
                renderOption={(props, option, { selected }) => {
                    const { key, ...optionProps } = props;
                    return (
                        <li key={key} {...optionProps}>
                            <Checkbox
                                icon={icon}
                                checkedIcon={checkedIcon}
                                style={{ marginRight: 8 }}
                                checked={selected}
                            />
                            {option?.properties?.name || 'None'}
                        </li>
                    );
                }}
                style={{ width: 500 }}
            />
        </Tooltip>
    )
}