import React from "react";
import * as SunCalc from "suncalc";
import { useTheme } from "@emotion/react";

interface Props {
    datetime: Date,
    moonInfo: SunCalc.GetMoonIlluminationResult
    width: number
    height: number
}


export const MoonMarker = (props: Props) => {

    const deg = 360 - Math.floor(props.moonInfo.phase * 360)
    // const deg = 180 - Math.floor(moonInfo.fraction * 360)
    const width = '30px'
    const height = '30px'
    const theme = useTheme()
    console.log('deg', deg, theme)
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
        transform: `rotate3d(0,1,0, ${deg}deg)`
    }

    const dividerAfterStyle: React.CSSProperties = { //back face of moon
        ...dividerStyle,
        content: '',
        backgroundColor: '#F4F6F0',
        transform: 'rotateY(180deg)',
    }

    return (
        <div style={sphereStyle}>
            <div id={deg < 180 ? 'light-hemisphere' : 'dark-hemisphere'}
                style={deg < 180 ? lightStyle : darkStyle}></div>
            <div id={deg < 180 ? 'dark-hemisphere' : 'light-hemisphere'}
                style={deg < 180 ? darkStyle : lightStyle}></div>
            <div style={dividerStyle}>
                <div style={dividerAfterStyle}></div>
            </div>
        </div>
    )
}