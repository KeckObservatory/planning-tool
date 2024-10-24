import Plot from "react-plotly.js";
import * as util from './sky_view_util.tsx'
import { Dome, hidate, TargetView } from "./two_d_view";
import { useStateContext } from "../App";
import { reason_to_color_mapping, VizRow } from "./viz_chart.tsx";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
dayjs.extend(utc)
dayjs.extend(timezone)

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

const get_chart_datum = (ra: number, dec: number, viz: VizRow, chartType: SkyChart, lngLatEl: util.LngLatEl): number => {
    let val;
    switch (chartType) {
        case 'Elevation': {
            val = viz.alt 
            break;
        }
        case 'Airmass': {
            val = viz.air_mass
            break;
        }
        case 'Parallactic': {
            val = util.parallatic_angle(ra, dec, viz.datetime, lngLatEl)
            break;
        }
        case 'Lunar Angle': {
            val = util.lunar_angle(ra, dec, viz.datetime, lngLatEl)
            break;
        }
        default: {
            val = viz.alt 
        }
    }
    return val
}


export const SkyChart = (props: Props) => {
    //const { targetView, chartType, showMoon, showCurrLoc, times, time, dome } = props
    const { targetView, chartType, time, showCurrLoc } = props
    const context = useStateContext()

    const lngLatEl: util.LngLatEl = {
        lng: context.config.keck_longitude, 
        lat: context.config.keck_latitude, 
        el: context.config.keck_elevation
    }

    let traces = targetView.map((tgtv: TargetView) => {


        let texts: string[] = []
        let y: number[] = []
        let color: string[] = []
        tgtv.visibility.forEach((viz: VizRow) => {
            let txt = ""
            txt += `Az: ${viz.az.toFixed(2)}<br>`
            txt += `El: ${viz.alt.toFixed(2)}<br>`
            txt += `Airmass: ${viz.air_mass.toFixed(2)}<br>`
            txt += `HT: ${dayjs(viz.datetime).format(context.config.date_time_format)}<br>`
            txt += `Visible for: ${tgtv.visibilitySum.toFixed(2)} hours<br>`
            txt += viz.observable ? '' : `<br>Not Observable: ${viz.reasons.join(', ')}`
            texts.push(txt)
            color.push(reason_to_color_mapping(viz.reasons))
            const datum = get_chart_datum(tgtv.ra_deg, tgtv.dec_deg, viz, chartType, lngLatEl)
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
                opacity: 0,
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

    //get curr marker
    if (showCurrLoc) {
        targetView.forEach((tgtv: TargetView) => { //add current location trace
            const ra = tgtv.ra_deg as number
            const dec = tgtv.dec_deg as number
            const azEl = util.ra_dec_to_az_alt(ra, dec, time, lngLatEl)
            const viz = { az: azEl[0], alt: azEl[1], datetime: time, air_mass: util.air_mass(azEl[1]) }
            const datum = get_chart_datum(ra, dec, viz as VizRow, chartType, lngLatEl)
            const currTime = hidate(time, context.config.timezone)
            let text = ""
            text += `Az: ${azEl[0].toFixed(2)}<br>`
            text += `El: ${azEl[1].toFixed(2)}<br>`
            //text += `Airmass: ${util.air_mass(azEl[1], lngLatEl.el).toFixed(2)}<br>`
            text += `Airmass: ${util.air_mass(azEl[1]).toFixed(2)}<br>`
            text += `HT: ${currTime.format(context.config.date_time_format)}`

            const trace: Plotly.Data = {
                x: [currTime.toDate()],
                y: [datum],
                text: [text],
                // hovorinfo: 'text',
                hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
                marker: {
                    color: 'red',
                    size: 8 
                },
                textposition: 'top left',
                type: 'scatter',
                mode: 'markers',
                name: tgtv.target_name
            }
            traces.push(trace)
            })
    }

    const layout: Partial<Plotly.Layout> = {
        width: 900,
        height: 800,
        title: `Target ${chartType} vs Time`,
        hovermode: "closest",
        margin: {
            l: 40,
            r: 40,
            b: 40,
            t: 40,
            pad: 4
        },
    } 

    return (
        <Plot
            data={traces}
            layout={layout}
        />
    )
}