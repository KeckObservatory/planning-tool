import { GeoModel, useStateContext } from "../App";
import {
    MARKER_SIZE,
    XAXIS_DTICK,
    MOON_MARKER_LINE_WIDTH,
    MOON_MARKER_SIZE
} from "./constants";
import Plot from "react-plotly.js";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { BlockReason, DayViz, TargetViz, VizRow } from "./viz_dialog";
import { air_mass } from "./sky_view_util";
dayjs.extend(utc)
dayjs.extend(timezone)


interface Props{ 
    targetViz: TargetViz,
}


export const alt_az_observable = (alt: number, az: number, KG: GeoModel) => {
    const minDeckAz = KG.t2
    const maxDeckAz = KG.t3
    const minAlt = KG.r1
    const deckAlt = KG.r3
    const trackLimit = KG.trackLimit

    const reasons: Array<BlockReason> = []
    //nasdeck is blocking the target?
    const targetOverlapsDeck = az >= minDeckAz && az <= maxDeckAz
    const targetBelowDeck = alt >= minAlt && alt <= deckAlt
    const deckBlocking = targetOverlapsDeck && targetBelowDeck
    deckBlocking && reasons.push('Deck Blocking')

    //target is below telescope horizon?
    const targetBelowHorizon = alt < minAlt
    targetBelowHorizon && reasons.push('Below Horizon')

    //target is above tracking limits?
    const targetAboveTrackingLimits = alt > trackLimit
    targetAboveTrackingLimits && reasons.push('Above Tracking Limits')

    const observable = !deckBlocking && !targetBelowHorizon && !targetAboveTrackingLimits
    return { observable, reasons }
}

export const date_normalize = (date: Date, utctz = false) => {
    //if date is before semester date set to next day
    let out = dayjs(date).set('year', 2000).set('month', 0).set('date', 1)
    out = out.get('hours') < 12 ? out.add(1, 'day') : out
    if (utctz) {
        return out.utc(true).toDate()
    }
    return out.toDate()
}

const colors = {
    'Deck Blocking': '#7570b3',
    'Below Horizon': '#e7298a',
    'Above Tracking Limits': '#d95f02'
}

export const reason_to_color_mapping = (reasons: string[]) => {
    const cols = reasons.map((reason: string) => colors[reason as keyof typeof colors])
    return cols.length ? cols[0] : '#1b9e77'
}

const create_dawn_dusk_text = (date: Date, date_time_format: string) => {
    let txt = ""
    txt += "HT: " + dayjs(date).format(date_time_format) + "<br>"
    txt += "UT: " + dayjs(date).utc(false).format(date_time_format)
    return txt
}

export const get_browser_name = () => {
    const userAgent = navigator.userAgent;
  
    if (userAgent.includes("Chrome")) {
      return "Chrome";
    } else if (userAgent.includes("Firefox")) {
      return "Firefox";
    } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
      return "Safari";
    } else if (userAgent.includes("Edg")) {
      return "Microsoft Edge";
    } else if (userAgent.includes("Opera") || userAgent.includes("Opr")) {
      return "Opera";
    } else {
      return "Unknown Browser";
    }
  }
  

export const create_dawn_dusk_traces = (targetViz: TargetViz, date_time_format: string) => {

    const browserName = get_browser_name();
    // scattergl is a hack which is needed to overlap markers
    // Safari disables WebGL by default, so just let it be scatter.
    const chart_type = browserName === "Safari" ? 'scatter' : 'scattergl'
    const trace = {
        yaxis: 'y2',
        textposition: 'top left',
        mode: 'lines+markers',
        showlegend: false,
        type: chart_type,
        marker: {
            size: MOON_MARKER_SIZE,
            symbol: 'square',
        },
        line: {
            width: MOON_MARKER_LINE_WIDTH 
        }
    }
    let dawn_dusk_traces: { [key: string]: any } = {
        dusk: {
            ...trace,
            x: [],
            y: [],
            text: [],
            name: 'Nautical Dusk (6 deg)',
            marker: {
                ...trace.marker,
                color: '#eeeeee',
            },
            line: {
                ...trace.line,
                color: '#eeeeee',
            }
        },
        amateur_dusk: {
            ...trace,
            x: [],
            y: [],
            text: [],
            name: 'Amateur Dusk (12 deg)',
            marker: {
                ...trace.marker,
                color: '#dddddd',
            },
            line: {
                ...trace.line,
                color: '#dddddd',
            }
        },
        astronomical_dusk: {
            ...trace,
            x: [],
            y: [],
            text: [],
            name: 'Astronomical Dusk (18 deg)',
            marker: {
                ...trace.marker,
                color: '#cccccc',
            },
            line: {
                ...trace.line,
                color: '#cccccc',
            }
        },
        astronomical_dawn: {
            ...trace,
            x: [],
            y: [],
            text: [],
            name: 'Astronomical Dawn (18 deg)',
            marker: {
                ...trace.marker,
                color: '#cccccc',
            },
            line: {
                ...trace.line,
                color: '#cccccc',
            }
        },
        amateur_dawn: {
            ...trace,
            x: [],
            y: [],
            text: [],
            name: 'Amateur Dawn (12 deg)',
            marker: {
                ...trace.marker,
                color: '#dddddd',
            },
            line: {
                ...trace.line,
                color: '#dddddd',
            }
        },
        dawn: {
            ...trace,
            x: [],
            y: [],
            text: [],
            name: 'Nautical Dawn (6 deg)',
            marker: {
                ...trace.marker,
                color: '#eeeeee',
            },
            line: {
                ...trace.line,
                color: '#eeeeee',
            }
        }
    }

    targetViz.semester_visibility.forEach((dayViz: DayViz) => {
        const xdate = new Date(dayjs(dayViz.date).format('YYYY-MM-DD'))
        dawn_dusk_traces.amateur_dawn.x.push(xdate)
        dawn_dusk_traces.amateur_dusk.x.push(xdate)
        dawn_dusk_traces.dawn.x.push(xdate)
        dawn_dusk_traces.dusk.x.push(xdate)
        dawn_dusk_traces.astronomical_dawn.x.push(xdate)
        dawn_dusk_traces.astronomical_dusk.x.push(xdate)

        dawn_dusk_traces.amateur_dawn.y.push(date_normalize(dayViz.amateurDawn, true))
        dawn_dusk_traces.amateur_dusk.y.push(date_normalize(dayViz.amateurDusk, true))
        dawn_dusk_traces.dawn.y.push(date_normalize(dayViz.dawn, true))
        dawn_dusk_traces.dusk.y.push(date_normalize(dayViz.dusk, true))
        dawn_dusk_traces.astronomical_dawn.y.push(date_normalize(dayViz.astronomicalDawn, true))
        dawn_dusk_traces.astronomical_dusk.y.push(date_normalize(dayViz.astronomicalDusk, true))

        dawn_dusk_traces.amateur_dawn.text.push(create_dawn_dusk_text(dayViz.amateurDawn, date_time_format))
        dawn_dusk_traces.amateur_dusk.text.push(create_dawn_dusk_text(dayViz.amateurDusk, date_time_format))
        dawn_dusk_traces.dawn.text.push(create_dawn_dusk_text(dayViz.amateurDusk, date_time_format))
        dawn_dusk_traces.dusk.text.push(create_dawn_dusk_text(dayViz.amateurDusk, date_time_format))
        dawn_dusk_traces.astronomical_dawn.text.push(create_dawn_dusk_text(dayViz.amateurDusk, date_time_format))
        dawn_dusk_traces.astronomical_dusk.text.push(create_dawn_dusk_text(dayViz.amateurDusk, date_time_format))
    })
    return dawn_dusk_traces
}

export const TargetVizChart = (props: Props) => {
    const { targetViz } = props
    const context = useStateContext()
    let traces = targetViz.semester_visibility.map((dayViz: DayViz) => {
        let text: string[] = []
        let y: Date[] = []
        let color: string[] = []
        //let color: number[] = []
        dayViz.visibility.forEach((viz: VizRow) => {
            let txt = ""
            txt += `Az: ${viz.az.toFixed(2)}<br>`
            txt += `El: ${viz.alt.toFixed(2)}<br>`
            txt += `Airmass: ${air_mass(viz.alt, context.config.tel_lat_lng_el.keck.el).toFixed(2)}<br>`
            // txt += `Airmass: ${air_mass(viz.alt).toFixed(2)}<br>`
            txt += `HT: ${dayjs(viz.datetime).format(context.config.date_time_format)}<br>`
            txt += `UT: ${dayjs(viz.datetime).utc(false).format(context.config.date_time_format)}<br>`
            txt += `Moon Fraction: ${viz.moon_illumination.fraction.toFixed(2)}<br>`
            txt += `Visible for: ${dayViz.visible_hours.toFixed(2)} hours<br>`
            txt += viz.observable ? '' : `<br>Not Observable: ${viz.reasons.join(', ')}`


            color.push(reason_to_color_mapping(viz.reasons))
            const daytime = date_normalize(viz.datetime)
            y.push(daytime)
            text.push(txt)
        })
        const ydate = new Date(dayjs(dayViz.date).format('YYYY-MM-DD'))
        const x = Array.from({ length: y.length }, () => ydate)

        const trace: Partial<Plotly.PlotData> = {
            x,
            y,
            text,
            marker: {
                color,
                size: MARKER_SIZE,
                symbol: 'square',
                opacity: 1 // too dense to see ticks
            },
            hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
            line: {
                width: 0,
            },
            textposition: 'top left',
            type: 'scattergl',
            mode: 'lines+markers',
            showlegend: false,
            name: targetViz.target_name ?? 'Target'
        }
        return trace
    })

    const lightTraces = Object.values(create_dawn_dusk_traces(targetViz, context.config.date_time_format)) as Plotly.PlotData[]
    //@ts-ignore
    traces = [...traces, ...lightTraces]

    const layout: Partial<Plotly.Layout> = {
        width: 1200,
        height: 400,
        title: `${targetViz.target_name ?? 'Target'} Visibility`,
        plot_bgcolor: 'black',
        yaxis2: {
            title: 'Time [UT]',
            type: 'date',
            gridwidth: 0,
            overlaying: 'y',
            // scaleanchor: 'y',
            side: 'right',
            layer: 'above traces',
            autorange: 'reversed',
            // tickmode: 'auto',
            tickformat: '%H:%M',
        },
        yaxis: {
            title: 'Time [HT]',
            type: 'date',
            gridwidth: 2,
            gridcolor: 'white',
            // scaleanchor: 'y2',
            autorange: 'reversed',
            layer: 'above traces',
            // tickmode: 'auto',
            tickformat: '%H:%M',
        },
        xaxis: {
            title: 'Date',
            type: 'date',
            gridwidth: 2,
            gridcolor: 'white',
            layer: 'above traces',
            dtick: XAXIS_DTICK, 
            tickformat: '%Y-%m-%d',
            tickmode: 'auto',
            //nticks: 0
        },
        // hovermode: "closest",
    }

    return (
        <Plot
            data={traces}
            divId='target-viz-chart'
            layout={layout}
        />
    )
}