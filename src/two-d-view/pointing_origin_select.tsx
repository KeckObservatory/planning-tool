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
    pointing_origins: POPointingOriginCollection
    selPointingOrigins: POPointFeature[]
    setSelPointingOrigins: React.Dispatch<React.SetStateAction<POPointFeature[]>>
    instrument: string
}

export const POSelect = (props: POSelectProps) => {
    const { pointing_origins, instrument, selPointingOrigins, setSelPointingOrigins } = props
    const [options, setOptions] = React.useState<(POPointFeature | undefined | 'SELECT_ALL')[]>([])

    const onPointingOriginChange = (value: (POPointFeature | undefined | 'SELECT_ALL')[]) => {
        // Check if "Select All" was clicked
        if (value?.includes('SELECT_ALL')) {
            const instFeatures = pointing_origins?.features
                .filter((feature) => instrument.includes(feature.properties?.instrument))
            if (instFeatures) {
                setSelPointingOrigins(instFeatures)
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
            return
        }
        const instFeatures = pointing_origins.features
            .filter((feature) => instrument.includes(feature.properties?.instrument))

        setSelPointingOrigins([]) //reset to empty when instrument changes
        setOptions([undefined, 'SELECT_ALL', ...instFeatures])
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
                getOptionLabel={(option) => {
                    if (option === 'SELECT_ALL') return 'Select All';
                    return option?.properties?.name || 'None';
                }}
                renderOption={(props, option, { selected }) => {
                    const { key, ...optionProps } = props;
                    
                    if (option === 'SELECT_ALL') {
                        const instFeatures = pointing_origins?.features
                            .filter((feature) => instrument.includes(feature.properties?.instrument))
                        const allSelected = selPointingOrigins.length === instFeatures?.length && instFeatures.length > 0;
                        return (
                            <li key={key} {...optionProps}>
                                <Checkbox
                                    icon={icon}
                                    checkedIcon={checkedIcon}
                                    style={{ marginRight: 8 }}
                                    checked={allSelected}
                                    indeterminate={selPointingOrigins.length > 0 && selPointingOrigins.length < instFeatures?.length}
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