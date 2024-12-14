import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

interface Props {
    vizType: VizChart
    setVizType: Function
}

export type VizChart = "Moon visibility" | "Target Visibility" | "Moon Brightness" | "Lunar Angle" | "Lunar Phase" | string

export const visibility_chart_options: VizChart[] = [
    "Target Visibility",
    "Moon Brightness",
    "Lunar Angle",
    "Lunar Phase",
    // "rayleigh_scattering",
    // "mei_scattering",
    // "scattering_equation",
    // "moon_illuminance",
    // "target_pathlength",
    // "moon_pathlength",
    // "dvd_moon",
    // "dvd_object"
]

export const VizSelectMenu = (props: Props) => {

    const handleChange = (event: SelectChangeEvent) => {
        props.setVizType(event.target.value as VizChart);
    }

    return (
        <FormControl sx={{ m: 0, minWidth: 200 }}>
            <InputLabel id="viz-select-label">Chart Type</InputLabel>
            <Select
                id="viz-select-menu"
                defaultValue={props.vizType}
                onChange={handleChange}
            >
                {visibility_chart_options.map((option: VizChart) => {
                    return <MenuItem value={option}>{option}</MenuItem>
                })}
            </Select>
        </FormControl>
    );
}