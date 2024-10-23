import Plot from "react-plotly.js";
import * as util from './sky_view_util.tsx'
import { Dome, TargetViz } from "./two_d_view";
import { useStateContext } from "../App";

export type SkyChart = "Airmass" | "Elevation" | "Parallactic" | "Lunar Angle"

interface Props {
    targetViz: TargetViz[]
    chartType: SkyChart 
    showMoon: boolean
    showCurrLoc: boolean
    times: Date[]
    time: Date
    dome: Dome
}

const get_chart_data = (targetViz: TargetViz, times: Date[], chartType: SkyChart, lngLatEl: util.LngLatEl): number[] => {
    let val;
    const ra = targetViz.ra_deg as number
    const dec = targetViz.dec_deg as number
    switch (chartType) {
        case 'Elevation': {
            val = util.get_target_traj(ra, dec, times, lngLatEl)
            val = val.map((azAlt: any) => azAlt[1]) as number[]
            break;
        }
        case 'Airmass': {
            val = util.get_air_mass(ra, dec, times, lngLatEl)
            break;
        }
        case 'Parallactic': {
            val = util.get_parallactic_angle(ra, dec, times, lngLatEl)
            break;
        }
        case 'Lunar Angle': {
            val = util.get_lunar_angle(ra, dec, times, lngLatEl)
            break;
        }
        default: {
            val = util.get_target_traj(ra, dec, times, lngLatEl)
            val = val.map((azAlt: any) => azAlt[1]) as number[]
        }
    }
    return val
}


export const SkyChart = (props: Props) => {
    //const { targetViz, chartType, showMoon, showCurrLoc, times, time, dome } = props
    const { targetViz, chartType } = props
    const context = useStateContext()

    const lngLatEl: util.LngLatEl = {
        lng: context.config.keck_long, 
        lat: context.config.keck_lat, 
        el: context.config.keck_elevation
    }

    let traces = targetViz.map((tgtv: TargetViz) => {

        const y = get_chart_data(tgtv, tgtv.times, chartType, lngLatEl)
        const texts = undefined

        const trace: Plotly.Data = {
            x: tgtv.times,
            y: y,
            text: texts,
            // hovorinfo: 'text',
            hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
            marker: {
                color: 'rgb(142, 124, 195)',
                size: 12
              },
            line: {
                width: 10
            },
            textposition: 'top left',
            type: 'scatter',
            mode: 'lines+markers',
            name: tgtv.target_name
        }
        return trace
    })
    const layout = {} 

    


    return (
        <Plot
            data={traces}
            layout={layout}
        />
    )
}