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
import { AIRMASS_LIMIT, AMATEUR_TWILIGHT_SHADE, ASTRONOMICAL_TWILIGHT_SHADE, DEFAULT_OPACITY, NON_OBSERVABLE_OPACITY, TWILIGHT_SHADE } from "./constants.tsx";
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

interface Datum {
    x: Date
    y: number
    text: string
    opacity: string
    marker_color: string
    line_color: string
}

export const generateData = (tgtv: TargetView,
    chartType: SkyChart,
    dtFormat: string,
    lngLatEl: LngLatEl,
    idx: number): Datum[] => {
    let data: Datum[] = []
    const color = colors[idx % colors.length]
    tgtv.visibility.forEach((viz: VizRow) => {
        let txt = ""
        txt += `Az: ${viz.az.toFixed(2)}<br>`
        txt += `El: ${viz.alt.toFixed(2)}<br>`
        txt += `Airmass: ${viz.air_mass.toFixed(2)}<br>`
        txt += `HT: ${dayjs(viz.datetime).format(dtFormat)}<br>`
        chartType.includes('Lunar Angle') && (txt += `Moon Fraction: ${viz.moon_illumination.fraction.toFixed(2)}<br>`)
        txt += `Visible for: ${tgtv.visibilitySum.toFixed(2)} hours<br>`
        txt += viz.observable ? '' : `<br>Not Observable: ${viz.reasons.join(', ')}`
        const datum = viz.moon_position ? get_chart_datum(tgtv.ra_deg, tgtv.dec_deg, viz, chartType, lngLatEl) : null
        data.push({
            x: viz.datetime,
            y: datum as number,
            text: txt,
            marker_color: reason_to_color_mapping(viz.reasons),
            line_color: color,
            opacity: viz.observable ? DEFAULT_OPACITY : NON_OBSERVABLE_OPACITY
        })
    })
    return data
}

export const make_trace = (data: Datum[], target_name: string, lineColor?: string): Plotly.Data => {
    //line color is same for all data points
    if (lineColor === undefined && data.length > 0) {
        lineColor = data[0].line_color + data[0].opacity
    }

    const showlegend = data.at(0) ? data[0].opacity === DEFAULT_OPACITY: false
    const trace: Plotly.Data = {
        x: data.map((datum: Datum) => datum.x),
        y: data.map((datum: Datum) => datum.y),
        text: data.map((datum: Datum) => datum.text),
        hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
        marker: {
            opacity: 0,
            size: 4,
            color: data.map((datum: Datum) => datum.marker_color + datum.opacity),
        },
        line: {
            width: 5,
            color: lineColor,
        },
        textposition: 'top left',
        type: 'scatter',
        mode: 'lines+markers',
        showlegend,
        name: target_name
    }
    return trace
}

export const split_into_segments = (data: Datum[]): Array<Datum[]> => {
    if (data.length < 2) { //no data to split
        return [data]
    }
    let prevDatum = data[0]
    let segment = [prevDatum]
    for (let idx = 1; idx < data.length; idx++) {
        const datum = data[idx]
        segment.push(datum)
        if (datum.opacity !== prevDatum.opacity) { //time for a new segment
            const rightData = data.slice(idx)
            return [segment, ...split_into_segments(rightData)]
        }
        prevDatum = datum
    }
    return [segment]  //no change in opacity means there is only one segment
}

export const SkyChart = (props: Props) => {
    const { targetView, chartType, time, showCurrLoc, showLimits, width, height, dome, suncalcTimes } = props
    const context = useStateContext()
    const isAirmass = chartType.includes('Airmass')
    let traces: Plotly.Data[] = []
    const lngLatEl = context.config.tel_lat_lng_el.keck
    let deckBlocking = false
    targetView.forEach((tgtv: TargetView, idx: number) => {
        const data = generateData(tgtv,
            chartType, context.config.date_time_format,
            lngLatEl, idx)
            if (tgtv.visibility.find((viz) => viz.reasons.includes('Deck Blocking'))) {
                deckBlocking = true
            }
        const segmentedData = split_into_segments(data)
        let tgtTraces = segmentedData.map(segment => make_trace(segment, tgtv.target_name ?? "Target"))
        //TODO: debug this.
        tgtTraces = tgtTraces.map((trace, idx) => {//allow only one legend per target
            if (idx > 0) {
                //@ts-ignore
                trace.showLegend = false
            }
            return trace
        })
        traces = [...traces, ...tgtTraces]
    })

    //add elevation axis for airmass charts only
    if (isAirmass && targetView.length > 0) {
        const data = generateData(targetView[0], 'Elevation', context.config.date_time_format, lngLatEl, 0)
        const newTrace = make_trace(data, 'Elevation axis for airmass', '#00000000')
        //@ts-ignore
        newTrace.yaxis = 'y2'
        //@ts-ignore
        newTrace.showlegend = false
        traces.push(newTrace)
    }

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
            const { observable, reasons } = alt_az_observable(azEl[1], azEl[0], KG)
            const viz: VizRow = {
                az: azEl[0],
                alt: azEl[1],
                datetime: time,
                moon_illumination,
                moon_position,
                observable,
                reasons,
                air_mass: util.air_mass(azEl[1], lngLatEl.el)
            }
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
            fillcolor: TWILIGHT_SHADE,
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
            fillcolor: AMATEUR_TWILIGHT_SHADE,
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
            fillcolor: ASTRONOMICAL_TWILIGHT_SHADE,
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
            fillcolor: AMATEUR_TWILIGHT_SHADE,
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
            fillcolor: TWILIGHT_SHADE,
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
                text: 'Bottom Shutter Limit',
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

    const nasdeck_shapes: Partial<Plotly.Shape>[] = [{
        type: 'rect',
        xref: 'paper',
        yref: 'y',
        x0: 0,
        label: {
            text: 'Nasmuth Limit',
            textposition: 'top center',
        },
        y0: context.config.tel_geometry.keck[dome].r3,
        x1: 1,
        y1: context.config.tel_geometry.keck[dome].r3,
        fillcolor: '#eeeeee',
        layer: 'above',
        opacity: 0.5,
        line: {
            width: 1
        }
    }]

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
        if (deckBlocking) {
            shapes.push(...nasdeck_shapes)
        }
    }

    //set yRange for airmass charts. order to reverse axis
    const yRange = isAirmass ? [Math.min(AIRMASS_LIMIT, maxAirmass), 0] : undefined
    const y2Axis: Partial<Plotly.LayoutAxis> = {
        title: 'Altitude [deg]',
        gridwidth: 0,
        overlaying: 'y',
        side: 'right',
        layer: 'above traces',
    }

    //creates ticvals and ticktext for xaxis. 
    // to take into account timezones HST and UT
    let t0 = suncalcTimes.dusk
    t0.setMinutes(0)
    t0.setSeconds(0)
    t0.setMilliseconds(0)
    const tick0 = t0.getTime()
    const dtick = 2 * 3600000
    const tickVals = [tick0, tick0 + dtick, tick0 + 2 * dtick, tick0 + 3 * dtick, tick0 + 4 * dtick, tick0 + 5 * dtick, tick0 + 6 * dtick, tick0 + 7 * dtick]
    const tickText = tickVals.map((val) => {
        const hst = dayjs(val).tz(context.config.timezone).format('HH:mm') 
        const ut = dayjs(val).utc().format('HH:mm')
        return `${hst}[HST]<br>${ut}[UT]`
    })


    const scyaxis: Partial<Plotly.LayoutAxis> = {
        title: isAirmass ? 'Airmass' : 'Degrees',
        range: yRange,
    }

    let sclayout: Partial<Plotly.Layout> = {
        width,
        height,
        shapes,
        title: `Target ${chartType} vs Time`,
        hovermode: "closest",
        yaxis: scyaxis,
        xaxis: {
            type: 'date',
            tickfont: {
                size: 8 
            },
            tickvals: tickVals,
            ticktext: tickText,
            // dtick: 2 * 3600000, //milliseconds in an hour
            // range: [suncalcTimes.dusk.getTime(), suncalcTimes.dawn.getTime()],
        },
        xaxis2: {
            title: 'UT [Hr:Min]',
            type: 'date',
            tickformat: '%H:%M',
            dtick: 3600000, //milliseconds in an hour
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

    if (isAirmass) {
        sclayout.yaxis2 = y2Axis
    }

    return (
        <Plot
            data={traces}
            layout={sclayout}
        />
    )
}