import React from "react";
import { DayViz, TargetViz, VizRow } from "./viz_dialog";
import Plot from "react-plotly.js";
import { useStateContext } from "../App";
import { air_mass } from "./sky_view_util";
import dayjs from "dayjs";
import { lunar_angle } from "./sky_view_util";  
import { reason_to_color_mapping, create_dawn_dusk_traces, date_normalize } from "./target_viz_chart";


interface Props {
    targetViz: TargetViz 
}

export const MoonVizChart = (props: Props) => {
    const { targetViz } = props

    const context = useStateContext()
    let text: string[] = []
    let y: Date[] = []
    let z: number[] = []
    let x: Date[] = []
    let color: string[] = []
    targetViz.semester_visibility.forEach((dayViz: DayViz) => {
        //let color: number[] = []
        dayViz.visibility.forEach((viz: VizRow) => {
            const lunarAngle = lunar_angle(targetViz.ra_deg as number,
                 targetViz.dec_deg as number,
                 viz.datetime,
                 context.config.tel_lat_lng_el.keck)

            let txt = ""
            txt += `Az: ${viz.az.toFixed(2)}<br>`
            txt += `El: ${viz.alt.toFixed(2)}<br>`
            txt += `HT: ${dayjs(viz.datetime).format(context.config.date_time_format)}<br>`
            txt += `UT: ${dayjs(viz.datetime).utc(false).format(context.config.date_time_format)}<br>`
            txt += `Moon Fraction: ${viz.moon_illumination.fraction.toFixed(2)}<br>`
            txt += `Lunar Angle: ${lunarAngle.toFixed(2)}<br>`
            txt += viz.observable ? '' : `<br>Not Observable: ${viz.reasons.join(', ')}`

            color.push(reason_to_color_mapping(viz.reasons))
            const daytime = date_normalize(viz.datetime)
            y.push(daytime)
            z.push(lunarAngle)
            text.push(txt)
        })
        const ydate = new Date(dayjs(dayViz.date).format('YYYY-MM-DD'))
        const xvals = Array.from({ length: dayViz.visibility.length}, () => ydate)
        x = [...x, ...xvals]

    })
    const trace: Partial<Plotly.PlotData> = {
        x,
        y,
        z,
        text,
        hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
        textposition: 'top left',
        type: 'contour',
        showlegend: false,
        name: targetViz.target_name ?? 'Target' + ' Lunar Angle Contour Chart'
    }
    let traces = [trace]

    const lightTraces = Object.values(create_dawn_dusk_traces(targetViz, context.config.date_time_format)) as Plotly.PlotData[]
    //@ts-ignore
    traces = [...traces, ...lightTraces]
    console.log('lunar traces', traces)

    const layout: Partial<Plotly.Layout> = {
        width: 1200,
        height: 400,
        title: `${targetViz.target_name ?? 'Target'} Visibility`,
        plot_bgcolor: 'black',
        yaxis2: {
            title: 'Time [HT]',
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
            dtick: 15 * 24 * 60 * 60 * 1000, // milliseconds
            tickformat: '%Y-%m-%d',
            tickmode: 'auto',
            //nticks: 0
        },
        // hovermode: "closest",
    }

    return (
        <Plot
            data={traces}
            layout={layout}
        ></Plot>
    )
}