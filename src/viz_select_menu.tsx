import * as React from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

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
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <div>
            <Button
                id="basic-button"
                aria-controls={open ? 'basic-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleClick}
            >
                {props.vizType} 
            </Button>
            <Menu
                id="basic-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                    'aria-labelledby': 'basic-button',
                }}
            >
                {visibility_chart_options.map((option: VizChart) => {
                    return <MenuItem onClick={() => {props.setVizType(option); handleClose()}}>{option}</MenuItem>
                })}
            </Menu>
        </div>
    );
}