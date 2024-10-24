import Plot from "react-plotly.js";
import * as util from './sky_view_util.tsx'
import { Dome, TargetView } from "./two_d_view";
import { useStateContext } from "../App";
import { alt_az_observable, reason_to_color_mapping, VizRow } from "./viz_chart.tsx";
import dayjs from "dayjs";

export type SkyChart = "Airmass" | "Elevation" | "Parallactic" | "Lunar Angle"

interface Props {
    targetView: TargetView[]
    chartType: SkyChart 
    showMoon: boolean
    showCurrLoc: boolean
    times: Date[]
    time: Date
    dome: Dome
}

const get_chart_datum = (ra: number, dec: number, alt: number, time: Date, chartType: SkyChart, lngLatEl: util.LngLatEl): number => {
    let val;
    switch (chartType) {
        case 'Elevation': {
            val = alt 
            break;
        }
        case 'Airmass': {
            val = util.air_mass(alt, lngLatEl.el)
            break;
        }
        case 'Parallactic': {
            val = util.parallatic_angle(ra, dec, time, lngLatEl)
            break;
        }
        case 'Lunar Angle': {
            val = util.lunar_angle(ra, dec, time, lngLatEl)
            break;
        }
        default: {
            val = alt 
        }
    }
    return val
}


export const SkyChart = (props: Props) => {
    //const { targetView, chartType, showMoon, showCurrLoc, times, time, dome } = props
    const { targetView, chartType, dome } = props
    const context = useStateContext()

    const lngLatEl: util.LngLatEl = {
        lng: context.config.keck_longitude, 
        lat: context.config.keck_latitude, 
        el: context.config.keck_elevation
    }
    const KG = context.config.keck_geometry[dome as Dome]

    let traces = targetView.map((tgtv: TargetView) => {



        const visibility = tgtv.times.map((time: Date) => {
            const [az, alt] = util.ra_dec_to_az_alt(tgtv.ra_deg, tgtv.dec_deg, time, lngLatEl)
            const vis: VizRow = { az, alt, ...alt_az_observable(alt, az, KG), datetime: time }
            return vis
        })

        const vizSum = visibility.reduce((sum: number, viz: VizRow) => {
            return viz.observable ? sum + 1 : sum
        }, 0)

        const visible_hours = vizSum * util.ROUND_MINUTES / 60

        let texts: string[] = []
        let y: number[] = []
        let color: string[] = []
        visibility.forEach((viz: VizRow) => {
            let txt = ""
            txt += `Az: ${viz.az.toFixed(2)}<br>`
            txt += `El: ${viz.alt.toFixed(2)}<br>`
            txt += `Airmass: ${util.air_mass(viz.alt, lngLatEl.el).toFixed(2)}<br>`
            txt += `HT: ${dayjs(viz.datetime).format(context.config.date_time_format)}<br>`
            txt += `Visible for: ${visible_hours.toFixed(2)} hours<br>`
            txt += viz.observable ? '' : `<br>Not Observable: ${viz.reasons.join(', ')}`
            texts.push(txt)
            color.push(reason_to_color_mapping(viz.reasons))
            const datum = get_chart_datum(tgtv.ra_deg, tgtv.dec_deg, viz.alt, viz.datetime, chartType, lngLatEl)
            y.push(datum)
            return txt
        })


        const trace: Plotly.Data = {
            x: tgtv.times,
            y: y,
            text: texts,
            // hovorinfo: 'text',
            hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
            marker: {
                color: color,
                size: 4 
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