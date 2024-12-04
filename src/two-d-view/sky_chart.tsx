import Plot from "react-plotly.js";
import * as util from './sky_view_util.tsx'
import { Dome, hidate, TargetView } from "./two_d_view";
import { useStateContext } from "../App";
import { alt_az_observable, reason_to_color_mapping } from "./target_viz_chart.tsx";
import { DayViz, VizRow } from "./viz_dialog.tsx";
import { LngLatEl } from "../App";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import * as SunCalc from "suncalc";
dayjs.extend(utc)
dayjs.extend(timezone)

export type SkyChart = "Airmass" | "Elevation" | "Parallactic" | "Lunar Angle" | "Azimuth"

interface Props {
    targetView: TargetView[]
    chartType: SkyChart 
    showMoon: boolean
    showCurrLoc: boolean
    showLimits: boolean
    times: Date[]
    time: Date
    dome: Dome
    width: number
    height: number
    suncalcTimes: DayViz
}

const get_chart_datum = (ra: number, dec: number, viz: VizRow, chartType: SkyChart, lngLatEl: LngLatEl): number => {
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
            val = util.lunar_angle(ra, dec, viz.datetime, lngLatEl, viz.moon_position)
            break;
        }
        case 'Azimuth': {
            val = viz.az
            break;
        }
        default: {
            val = viz.alt 
        }
    }
    return val
}

export const colors = [
    '#1f77b4',  // muted blue
    '#ff7f0e',  // safety orange
    '#2ca02c',  // cooked asparagus green
    '#d62728',  // brick 
    '#9467bd',  // muted purple
    '#8c564b',  // chestnut brown
    '#e377c2',  // raspberry yogurt pink
    '#7f7f7f',  // middle gray
    '#bcbd22',  // curry yellow-green
    '#17becf'   // blue-teal
];

export const SkyChart = (props: Props) => {
    const { targetView, chartType, time, showCurrLoc, showLimits, width, height, dome, suncalcTimes } = props
    const context = useStateContext()

    const lngLatEl = context.config.tel_lat_lng_el.keck

    let traces = targetView.map((tgtv: TargetView, idx: number) => {
        let texts: string[] = []
        let y: number[] = []
        let color: string[] = []
        tgtv.visibility.forEach((viz: VizRow) => {
            let txt = ""
            txt += `Az: ${viz.az.toFixed(2)}<br>`
            txt += `El: ${viz.alt.toFixed(2)}<br>`
            txt += `Airmass: ${viz.air_mass.toFixed(2)}<br>`
            txt += `HT: ${dayjs(viz.datetime).format(context.config.date_time_format)}<br>`
            chartType.includes('Lunar Angle') && (txt += `Moon Fraction: ${viz.moon_illumination.fraction.toFixed(2)}<br>`)
            txt += `Visible for: ${tgtv.visibilitySum.toFixed(2)} hours<br>`
            txt += viz.observable ? '' : `<br>Not Observable: ${viz.reasons.join(', ')}`
            texts.push(txt)
            color.push(reason_to_color_mapping(viz.reasons))
            const datum = viz.moon_position ? get_chart_datum(tgtv.ra_deg, tgtv.dec_deg, viz, chartType, lngLatEl): null
            y.push(datum as number)
            return txt
        })


        const trace: Plotly.Data = {
            x: tgtv.visibility.map((viz: VizRow) => viz.datetime),
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
                width: 5,
                color: colors[idx % colors.length] 
            },
            textposition: 'top left',
            type: 'scatter',
            mode: 'lines+markers',
            name: tgtv.target_name
        }
        return trace
    })

    //get curr marker
    let maxAirmass = 10;
    if (showCurrLoc) {
        targetView.forEach((tgtv: TargetView, idx: number) => { //add current location trace
            const ra = tgtv.ra_deg as number
            const dec = tgtv.dec_deg as number
            const azEl = util.ra_dec_to_az_alt(ra, dec, time, lngLatEl)
            const moon_illumination = SunCalc.getMoonIllumination(time)
            let moon_position = util.get_moon_position(time, lngLatEl)
            const KG = context.config.tel_geometry.keck[dome]
            const {observable, reasons} = alt_az_observable(azEl[1], azEl[0], KG)
            const viz: VizRow = { 
                az: azEl[0], 
                alt: azEl[1], 
                datetime: time, 
                moon_illumination,
                moon_position,
                observable,
                reasons,
                air_mass: util.air_mass(azEl[1], lngLatEl.el) }
            const datum = get_chart_datum(ra, dec, viz, chartType, lngLatEl)
            const currTime = hidate(time, context.config.timezone)
            const airmass = util.air_mass(azEl[1], lngLatEl.el)
            maxAirmass = Math.max(maxAirmass, airmass)
            let text = ""
            text += `Az: ${azEl[0].toFixed(2)}<br>`
            text += `El: ${azEl[1].toFixed(2)}<br>`
            text += `Airmass: ${airmass.toFixed(2)}<br>`
            chartType.includes('Lunar Angle') && (text += `Moon Fraction: ${viz.moon_illumination.fraction.toFixed(2)}<br>`)
            // text += `Airmass: ${util.air_mass(azEl[1]).toFixed(2)}<br>`
            text += `HT: ${currTime.format(context.config.date_time_format)}`

            const trace: Plotly.Data = {
                x: [currTime.toDate()],
                y: [datum],
                text: [text],
                // hovorinfo: 'text',
                hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
                showlegend: false,
                marker: { 
                    size: 12,
                    // color: 'red',
                    color: colors[idx % colors.length], 
                    line: {
                        color: 'black',
                        width: 3
                    }
                },
                textposition: 'top left',
                type: 'scatter',
                mode: 'markers',
                name: tgtv.target_name
            }
            traces.push(trace)
            })
    }

    const shapes: Partial<Plotly.Shape>[] = [
        {
             type: 'rect',
             xref: 'x',
             yref: 'paper',
             x0: suncalcTimes.dusk.getTime(),
             y0: 0,
             x1: suncalcTimes.amateurDusk.getTime(),
             y1: 1,
             fillcolor: '#eeeeee',
             layer: 'below',
             opacity: 0.5,
             line: {
                width: 0
             }
        },
        {
             type: 'rect',
             xref: 'x',
             yref: 'paper',
             x0: suncalcTimes.amateurDusk.getTime(),
             y0: 0,
             x1: suncalcTimes.astronomicalDusk.getTime(),
             y1: 1,
             fillcolor: '#dddddd',
             layer: 'below',
             opacity: 0.5,
             line: {
                width: 0
             }
        },
        {
             type: 'rect',
             xref: 'x',
             yref: 'paper',
             x0: suncalcTimes.astronomicalDusk.getTime(),
             y0: 0,
             x1: suncalcTimes.astronomicalDawn.getTime(),
             y1: 1,
             fillcolor: '#cccccc',
             layer: 'below',
             opacity: 0.5,
             line: {
                width: 0
             }
        },
        {
             type: 'rect',
             xref: 'x',
             yref: 'paper',
             x0: suncalcTimes.astronomicalDawn.getTime(),
             y0: 0,
             x1: suncalcTimes.amateurDawn.getTime(),
             y1: 1,
             fillcolor: '#dddddd',
             layer: 'below',
             opacity: 0.5,
             line: {
                width: 0
             }
        },
        {
             type: 'rect',
             xref: 'x',
             yref: 'paper',
             x0: suncalcTimes.amateurDawn.getTime(),
             y0: 0,
             x1: suncalcTimes.dawn.getTime(),
             y1: 1,
             fillcolor: '#eeeeee',
             layer: 'below',
             opacity: 0.5,
             line: {
                width: 0
             }
        },
    ]

    
    const el_shapes: Partial<Plotly.Shape>[] = [
        {
             type: 'rect',
             xref: 'paper',
             yref: 'y',
             x0: 0,
             label: {
                text: 'Elevation Limit',
                textposition: 'top center',
            },
             y0: context.config.tel_geometry.keck[dome].r1,
             x1: 1,
             y1: context.config.tel_geometry.keck[dome].r1,
             fillcolor: '#eeeeee',
             layer: 'above',
             opacity: 0.5,
             line: {
                width: 1
             }
        },
    ]

    const az_shapes: Partial<Plotly.Shape>[] = [
        {
             type: 'rect',
             xref: 'paper',
             yref: 'y',
             x0: 0,
             label: {
                text: 'Left/North Wrap limit',
                textposition: 'top center',
            },
             y0: context.config.tel_geometry.keck[dome].left_north_wrap,
             x1: 1,
             y1: context.config.tel_geometry.keck[dome].left_north_wrap,
             fillcolor: '#eeeeee',
             layer: 'above',
             opacity: 0.5,
             line: {
                width: 1
             }
        },
        {
             type: 'rect',
             xref: 'paper',
             yref: 'y',
             x0: 0,
             label: {
                text: 'Right/South Wrap limit',
                textposition: 'top center',
            },
             y0: context.config.tel_geometry.keck[dome].right_south_wrap,
             x1: 1,
             y1: context.config.tel_geometry.keck[dome].right_south_wrap,
             fillcolor: '#eeeeee',
             layer: 'above',
             opacity: 0.5,
             line: {
                width: 1
             }
        },
    ]

    if (chartType === 'Azimuth' && showLimits) {
        shapes.push(...az_shapes)
    }
    else if (chartType === 'Elevation' && showLimits) {
        shapes.push(...el_shapes)
    }

    const yRange = chartType.includes('Airmass') ? [0, Math.min(30, maxAirmass)] : undefined

    const layout: Partial<Plotly.Layout> = {
        width,
        height,
        shapes,
        title: `Target ${chartType} vs Time`,
        hovermode: "closest",
        yaxis: {
            title: chartType.includes('Airmass') ? 'Airmass' : 'Degrees',
            range: yRange,
            autorange: !chartType.includes('Airmass')
        },
        xaxis: {
            title: 'Time [Hr:Min]',
            type: 'date',
            tickformat: '%H:%M',
            dtick: 2 * 3600000, //milliseconds in an hour
            range: [suncalcTimes.dusk.getTime(), suncalcTimes.dawn.getTime()],
        },
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