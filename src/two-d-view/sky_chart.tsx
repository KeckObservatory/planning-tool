import Plot, { Figure } from "react-plotly.js";
import { useEffect, useState } from "react";
import * as util from './sky_view_util.tsx'
import { Dome, TargetView } from "./two_d_view";
import { useStateContext } from "../App";
import { reason_to_color_mapping } from "./target_viz_chart.tsx";
import { DayViz, VizRow } from "./viz_dialog.tsx";
import { LngLatEl } from "../App";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { AIRMASS_LIMIT, DEFAULT_OPACITY, NON_OBSERVABLE_OPACITY } from "./constants.tsx";
import { useRef } from "react";
import { useDebounceCallback } from "../use_debounce_callback.tsx";
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
    const color = util.colors[idx % util.colors.length]
    tgtv.visibility.forEach((viz: VizRow) => {
        let txt = ""
        txt += `Az: ${viz.az.toFixed(2)}<br>`
        txt += `El: ${viz.alt.toFixed(2)}<br>`
        txt += `Airmass: ${viz.air_mass.toFixed(2)}<br>`
        txt += `HT: ${dayjs(viz.datetime).format(dtFormat)}<br>`
        chartType.includes('Lunar Angle') && (txt += `Moon Fraction: ${viz.moon_illumination.fraction.toFixed(2)}<br>`)
        txt += `Visible for: ${tgtv.visibilitySum.toFixed(2)} hours<br>`
        txt += viz.observable ? '' : `<br>Not Observable: ${viz.reasons.join(', ')}`
        const datum = viz.moon_position ? util.get_chart_datum(tgtv.ra_deg, tgtv.dec_deg, viz, chartType, lngLatEl) : null
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

    const showlegend = data.at(0) ? data[0].opacity === DEFAULT_OPACITY : false
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

const make_layout = (chartType: SkyChart,
    width: number, height: number,
    shapes: Partial<Plotly.Shape>[],
    maxAirmass: number,
    suncalcTimes: DayViz,
    timezone: string
): [Plotly.Layout, Plotly.LayoutAxis] => {

    const isAirmass = chartType.includes('Airmass')

    //set yRange for airmass charts. order to reverse axis
    const yLower = Math.min(AIRMASS_LIMIT, maxAirmass)
    const yRange = isAirmass ? [yLower, .9] : undefined
    const y2Axis: Partial<Plotly.LayoutAxis> = {
        title: { text: 'Altitude [deg]' },
        gridwidth: 0,
        overlaying: 'y',
        side: 'right',
        layer: 'above traces',
        autorange: false,
        range: yRange,
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
        const hst = dayjs(val).tz(timezone).format('HH:mm')
        const ut = dayjs(val).utc().format('HH:mm')
        return `${hst}[HST]<br>${ut}[UT]`
    })

    const scyaxis: Partial<Plotly.LayoutAxis> = {
        title: { text: isAirmass ? 'Airmass' : 'Degrees' },
        range: yRange,
    }

    let sclayout: Partial<Plotly.Layout> = {
        width,
        height,
        shapes,
        title: { text: `Target ${chartType} vs Time` },
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
            title: { text: 'UT [Hr:Min]' },
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
    return [sclayout as Plotly.Layout, y2Axis as Plotly.LayoutAxis];
}

interface State {
    layout: Plotly.Layout
    y2Axis: Plotly.LayoutAxis
}

export const SkyChart = (props: Props) => {
    const { targetView, chartType, time, showCurrLoc, showLimits, width, height, dome, suncalcTimes } = props

    const context = useStateContext()
    const isAirmass = chartType.includes('Airmass')
    const plotRef = useRef<any>(null);
    //set layout for plotly. need to render after initialization for y2 axis
    const shapes = util.get_shapes(suncalcTimes,
        chartType,
        context.config.tel_geometry.keck[dome],
        false,
        showLimits,)

    const [scLayout, y2Axis] = make_layout(chartType, width, height, shapes, 5, suncalcTimes, context.config.timezone);
    const [state, setState] = useState({ layout: scLayout, y2Axis: y2Axis } as State);


    useEffect(() => {
        const shapes = util.get_shapes(suncalcTimes,
            chartType,
            context.config.tel_geometry.keck[dome],
            deckBlocking,
            showLimits,)

        console.log('chartType', chartType, dome)

        const [scLayout, y2Axis] = make_layout(chartType, width, height, shapes, maxAirmass, suncalcTimes, context.config.timezone);
        setState({
            layout: scLayout,
            y2Axis,
        });
    }, [chartType, dome, targetView, time, showLimits, suncalcTimes])

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

    // add elevation axis for airmass charts only
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
    let minAirmass = 1;
    if (showCurrLoc) {
        const currLocTraces = util.get_curr_loc_trace(targetView,
            minAirmass, maxAirmass,
            time,
            lngLatEl, chartType, context.config.tel_geometry.keck[dome], context.config.timezone, context.config.date_time_format)
        if (currLocTraces) {
            traces = [...traces, ...currLocTraces]
        }
    }

    const debounced_draw = useDebounceCallback(
        () => {
            if (plotRef.current && isAirmass) {
                // Get the tickvals and ticktext from yaxis
                const plotlyFigure = plotRef.current;
                const leftTicks = plotlyFigure.props.layout.yaxis.tickvals as number[];

                // If not set, try to get from the actual plotly instance
                // (Plotly stores the latest tickvals in the fullLayout)
                const gd = plotlyFigure?.el;
                let otickvals = leftTicks;
                if (gd && gd._fullLayout?.yaxis._vals) {
                    otickvals = gd._fullLayout.yaxis._vals.map((val: any) => {
                        return val.x
                    });
                }

                const tickvals = otickvals.map(val => util.alt_from_air_mass(val));
                const ticktext = tickvals.map(val => val.toFixed(1));
                // 3. Update yaxis2 to match yaxis
                const newY2Axis = {
                    ...state.y2Axis,
                    tickvals: otickvals,
                    ticktext: ticktext,
                    position: 0.95, // Adjust position to the right side
                };

                if (tickvals) {
                    setState(
                        {
                            layout: {
                                ...(state.layout),
                                yaxis2: newY2Axis
                            },
                            y2Axis: newY2Axis
                        }
                    );
                }
            }
        }
        , 100)


    const draw_elevation_axis = () => {
        console.log('drawing elevation axis')
        debounced_draw()
    }



    return (
        <Plot
            data={traces}
            ref={plotRef}
            layout={state.layout}
            // onUpdate={draw_elevation_axis} //updates too often
            // onRelayout={draw_elevation_axis}
            // onAfterPlot={() => { console.log('onAfterPlot invoked'); debounced_draw(); }} // calls after any plot updates
            onRedraw={() => { console.log('onRedraw invoked'); debounced_draw(); }} //not called at all
            onInitialized={() => { console.log('onInitialized invoked'); draw_elevation_axis(); }}
        />
    )
}