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
    const [options, setOptions] = React.useState<(POPointFeature | undefined | 'SELECT_ALL')[]>([])
    const [filteredFeatures, setFilteredFeatures] = React.useState<POPointFeature[]>([])

    const onPointingOriginChange = (value: (POPointFeature | undefined | 'SELECT_ALL')[]) => {
        // Check if "Select All" was clicked
        if (value?.includes('SELECT_ALL')) {
            // If "Select All" is in the new value, select all filtered options
            if (!selPointingOrigins || selPointingOrigins.length !== filteredFeatures.length) {
                setSelPointingOrigins(filteredFeatures)
            } else {
                // If all are already selected, deselect all
                setSelPointingOrigins([])
            }
        }
        else if (value?.includes(undefined)) {
            setSelPointingOrigins([])
        }
        else {
            setSelPointingOrigins(value as POPointFeature[])
        }
    }

    useEffect(() => {
        if (!pointing_origins) {
            setOptions([])
            setFilteredFeatures([])
            return
        }
        const filtered = pointing_origins.features
            .filter((feature) => instrument.includes(feature.properties?.instrument))

        setFilteredFeatures(filtered)
        setOptions([undefined, 'SELECT_ALL', ...filtered])
    }, [pointing_origins, instrument])

    useEffect(() => {
        if (selPointingOrigins.length > 0) {
            setFilteredFeatures([])
        }
    }, [instrument])

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
                getOptionLabel={(option) => {
                    if (option === 'SELECT_ALL') return 'Select All';
                    return option?.properties?.name || 'None';
                }}
                renderOption={(props, option, { selected }) => {
                    const { key, ...optionProps } = props;
                    
                    if (option === 'SELECT_ALL') {
                        const allSelected = selPointingOrigins.length === filteredFeatures.length && filteredFeatures.length > 0;
                        return (
                            <li key={key} {...optionProps}>
                                <Checkbox
                                    icon={icon}
                                    checkedIcon={checkedIcon}
                                    style={{ marginRight: 8 }}
                                    checked={allSelected}
                                    indeterminate={selPointingOrigins.length > 0 && selPointingOrigins.length < filteredFeatures.length}
                                />
                                <strong>Select All</strong>
                            </li>
                        );
                    }
                    
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