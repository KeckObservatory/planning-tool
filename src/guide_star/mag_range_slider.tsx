import * as React from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import { Typography } from '@mui/material';
import { MAG_RANGE } from '../two-d-view/constants';

function valuetext(value: number) {
    return `${value}°C`;
}

interface Props {
    range: [string, string]
    setRange: (newValue: string[]) => void
}

export const MagRangeSlider = (props: Props) => {

    const [value, setValue] = React.useState(props.range.map(Number))

    const handleChangeCommitted = (_: Event | React.SyntheticEvent<Element, Event>, newValue: number | number[]) => {
        if (Array.isArray(newValue)) {
            props.setRange(newValue.map(String));
        }
    };

    const handleChange = (_: Event, newValue: number | number[]) => {
        if (Array.isArray(newValue)) {
            setValue(newValue.map(Number))
        }
    }

    return (
        <Box sx={{ width: 300 }}>
            <Typography id="input-slider" gutterBottom>
                Guide Star Magnitude Range
            </Typography>
            <Slider
                getAriaLabel={() => 'Temperature range'}
                value={value}
                min={MAG_RANGE[0]}
                step={.2}
                max={MAG_RANGE[1]}
                onChange={handleChange}
                onChangeCommitted={handleChangeCommitted}
                valueLabelDisplay="auto"
                getAriaValueText={valuetext}
            />
        </Box>
    );
}