import { Autocomplete, Checkbox, TextField, Tooltip } from "@mui/material"
import React from "react"
import { useEffect } from "react"
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

export interface POPointingOriginProperties {
        name: string;
        instrument: string;
        xpos:  number;
        ypos: number;
        units: string;
        source_file: string;
}

export interface POPointFeature extends GeoJSON.Feature<GeoJSON.Point, POPointingOriginProperties> {}
export interface POPointingOriginCollection extends GeoJSON.FeatureCollection<GeoJSON.Point, POPointingOriginProperties> {}


interface POSelectProps {
    pointing_origins?: POPointingOriginCollection
    selPointingOrigins: POPointFeature[]
    setSelPointingOrigins: React.Dispatch<React.SetStateAction<POPointFeature[]>>
    instrument: string
}

export const POSelect = (props: POSelectProps) => {
    const { pointing_origins, instrument, selPointingOrigins, setSelPointingOrigins } = props
    const [options, setOptions] = React.useState<(POPointFeature | undefined)[]>([])

    const onPointingOriginChange = (value: (POPointFeature | undefined)[]) => {
        if (value?.includes(undefined)) {
            setSelPointingOrigins([])
        }
        else {
            setSelPointingOrigins(value as POPointFeature[])
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
                value={selPointingOrigins}
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