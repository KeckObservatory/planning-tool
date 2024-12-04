import { DayViz, TargetViz, VizRow } from "./viz_dialog";
import Plot from "react-plotly.js";
import { useStateContext } from "../App";
import dayjs from "dayjs";
import { cosd, lunar_angle, sind } from "./sky_view_util";
import { reason_to_color_mapping, create_dawn_dusk_traces, date_normalize } from "./target_viz_chart";


interface Props {
    targetViz: TargetViz
}

const scattering_equation = (rho: number) => {
    // Krisciunas and Schaefer 1991 eq 18, 19
    const reyleigh_constant = Math.pow(10, 5.36) // ~2.27e5
    const rayleigh_scattering =  reyleigh_constant * (1.06 + cosd(rho) ** 2)
    const mei_constant = 6.2e7 //used for small separation angles
    const mei_scattering = rho > 10 ? Math.pow(10, 6.15 - rho / 40) : mei_constant * Math.pow(rho, -2)
    return  rayleigh_scattering + mei_scattering
}

const moon_illuminance = (phase_angle_moon: number) => {
    // Krisciunas and Schaefer 1991 eq 20
    const exponent = -0.4 * (3.84 + 0.026 * Math.abs(phase_angle_moon) + 4e-9 * Math.pow(phase_angle_moon, 4))
    return Math.pow(10, exponent)
}

// const moon_illuminance_bak = (mag: number) => {
//     // Krisciunas and Schaefer 1991 eq 8 
//     return Math.pow(10, -0.4 * mag + 16.57)
// }

// const moon_mag = (phase_angle_moon: number) => {
//     // Krisciunas and Schaefer 1991 eq 9 
//     return -12.73 + 0.026 * Math.abs(phase_angle_moon)  + 4e-9 * Math.pow(phase_angle_moon, 4)
// }

const optical_pathlength = (zenith: number) => {
     // Krisciunas and Schaefer 1991 eq 3
     return (1 - 0.96 * sind(zenith) ** 2 ) ** -0.5
}

const differentical_volume_decay = (pathlength: number, k: number) => {
    return Math.pow(10, -0.4 * k * pathlength)
}

const moon_irradiance = (rho: number, zenith_moon: number, zenith_object: number, phase_angle_moon: number) => {
    //Krisciunas and Schaefer 1991 eq 15
    // rho = separation angle [degrees]
    // zenith_moon = 90 - moon_alt [degrees]
    // zenith_object = 90 - object_alt [degrees]
    // phase_angle_moon = moon_phase [degrees]
    console.log('rho', rho, 'zenith_moon', zenith_moon, 'zenith_object', zenith_object, 'phase_angle_moon', phase_angle_moon)
    const extinction_coeff = 0.172 // extinction coefficient [mag/airmass]
    const f_rho = scattering_equation(rho)
    const moon_ill = moon_illuminance(phase_angle_moon)
    const pathlength = optical_pathlength(zenith_object)
    const moon_pathlength = optical_pathlength(zenith_moon)
    const dvd_moon = differentical_volume_decay(moon_pathlength, extinction_coeff)
    const dvd_object = differentical_volume_decay(pathlength, extinction_coeff)
    const irradiance = f_rho * moon_ill * dvd_moon * (1 - dvd_object)
    return irradiance
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
                context.config.tel_lat_lng_el.keck, 
                viz.moon_position,
            )

            const zenith_moon = 90 - viz.moon_position.altitude
            const zenith_object = 90 - viz.alt
            const phase_angle_moon = viz.moon_illumination.angle * 180 / Math.PI
            const moonIrradiance = moon_irradiance(lunarAngle,
                 zenith_moon,
                 zenith_object,
                 phase_angle_moon)
            //z.push(Math.abs(lunarAngle))
            let txt = ""
            txt += `Az: ${viz.az.toFixed(2)}<br>`
            txt += `El: ${viz.alt.toFixed(2)}<br>`
            txt += `HT: ${dayjs(viz.datetime).format(context.config.date_time_format)}<br>`
            txt += `UT: ${dayjs(viz.datetime).utc(false).format(context.config.date_time_format)}<br>`
            txt += `Moon Fraction: ${viz.moon_illumination.fraction.toFixed(2)}<br>`
            txt += `Lunar Angle: ${lunarAngle.toFixed(2)}<br>`
            txt += `Moon Irradiance: ${moonIrradiance.toFixed(2)} [nanoLamberts]<br>`
            txt += viz.observable ? '' : `<br>Not Observable: ${viz.reasons.join(', ')}`

            color.push(reason_to_color_mapping(viz.reasons))
            const daytime = date_normalize(viz.datetime)
            y.push(daytime)
            z.push(Math.log(moonIrradiance))
            text.push(txt)
        })
        const ydate = new Date(dayjs(dayViz.date).format('YYYY-MM-DD'))
        const xvals = Array.from({ length: dayViz.visibility.length }, () => ydate)
        x = [...x, ...xvals]

    })

    let name =  targetViz.target_name ?? 'Target'
    name += ' Lunar Angle' 
    const trace: Partial<Plotly.PlotData> = {
        x,
        y,
        z,
        text,
        line: {
            smoothing: 0.85
        },
        contours: {
            coloring: 'heatmap',
        },
        colorbar: {
            x: 1.05,
            title: '[Log nanoLamberts]',
        },
        //@ts-ignore
        // coloraxis: 'coloraxis',
        hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
        textposition: 'top left',
        //colorscale: 'YlGnBu',
        colorscale: 'Hot',
        // reversescale: true,
        type: 'contour',
        name: name,
        showlegend: false,
    }
    let traces = [trace]

    const lightTraces = Object.values(create_dawn_dusk_traces(targetViz, context.config.date_time_format)) as Plotly.PlotData[]
    //@ts-ignore
    traces = [...traces, ...lightTraces]
    console.log('lunar traces', traces)

    const layout: Partial<Plotly.Layout> = {
        width: 1200,
        height: 400,
        title: name,
        plot_bgcolor: 'black',
        //@ts-ignore
        // coloraxis: {
        //     cmin: 0,
        //     cmax: 30,
        // },
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