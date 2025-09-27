import React from "react";
import * as SunCalc from "suncalc";
import { useTheme } from "@emotion/react";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import Typography from "@mui/material/Typography";

interface Props {
    datetime: Date,
    moonInfo: SunCalc.GetMoonIlluminationResult
    width: number
    height: number
}


export const MoonMarker = (props: Props) => {

    // const deg = Math.floor(props.moonInfo.angle) 
    //0 rotate -90 degrees
    //0.5 rotate 0 degrees
    //1 rotate 90 degrees
    const deg = 360 - Math.floor((props.moonInfo.phase) * 360)
    const width = '30px'
    const height = '30px'
    const theme = useTheme()
    //@ts-ignore
    const outline = theme.palette.mode === 'dark' ? 'none' : '1px solid black'

    const sphereStyle: React.CSSProperties = {
        borderRadius: '100%', //makes a circle
        width,
        height,
        outline: outline,
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
        alignItems: 'center',
    }

    const hemisphereStyle: React.CSSProperties = {
        width: '50%',
        height: '100%',
    }

    const lightStyle: React.CSSProperties = { //light side takes up half the circle
        ...hemisphereStyle,
        backgroundColor: '#F4F6F0'
    }
    const darkStyle: React.CSSProperties = { //dark side takes up half the circle
        ...hemisphereStyle,
        backgroundColor: '#575851'
    }

    const dividerStyle: React.CSSProperties = { //front face of moon
        top: 0,
        left: 0,
        width,
        height,
        position: 'absolute',
        borderRadius: '100%',
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        backgroundColor: '#575851', //dark
        transform: `rotate3d(0,1,0, ${deg}deg)`,
    }

    const dividerAfterStyle: React.CSSProperties = { //back face of moon
        ...dividerStyle,
        content: '',
        backgroundColor: '#F4F6F0', //light
        transform: 'rotateY(180deg)',
    }

    return (

        <Stack direction='column'>
            <FormControl sx={{ display: 'inlineBlock' }}>
                <FormLabel sx={{ marginRight: '6px', paddingTop: '9px' }}
                    id="moon-phase-group-label">Moon Fraction: </FormLabel>
            </FormControl>
            <Stack direction='row' spacing={1}>
                <div style={sphereStyle}>
                    <div id={deg > 180 ? 'light-hemisphere' : 'dark-hemisphere'}
                        style={deg > 180 ? lightStyle : darkStyle}></div>
                    <div id={deg > 180 ? 'dark-hemisphere' : 'light-hemisphere'}
                        style={deg > 180 ? darkStyle : lightStyle}></div>
                    <div style={dividerStyle}>
                        <div style={dividerAfterStyle}></div>
                    </div>
                </div>
                <Typography>{Math.floor(props.moonInfo.fraction * 100)}%</Typography>
            </Stack>
        </Stack>
    )
}