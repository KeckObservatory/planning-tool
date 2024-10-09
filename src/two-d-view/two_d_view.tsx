import React from 'react';
import * as util from './sky_view_util.tsx'
import Plot from 'react-plotly.js';
import { KECK_LAT, KECK_LONG, KECK_ELEVATION, LngLatEl } from './sky_view_util.tsx';
import NightPicker from '../two-d-view/night_picker'
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import * as SunCalc from 'suncalc'
import { BooleanParam, DateParam, StringParam, useQueryParam, withDefault } from 'use-query-params';
import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, Switch } from '@mui/material';
import TimeSlider from './time_slider';
import { Target } from '../App.tsx';

dayjs.extend(utc)
dayjs.extend(timezone)

export const TIMEZONE = "Pacific/Honolulu"
export const TIME_FORMAT = "MM:DD HH:mm"
export const DATE_TIME_FORMAT = "YYYY/MM/DD HH:mm"

interface Props {
    targets: Target[]
}

interface KeckGeoModel {
    K1: GEOModel
    K2: GEOModel
}

interface GEOModel {
    r0: number,
    r1: number,
    r2: number,
    r3: number,
    t0: number,
    t1: number,
    t2: number,
    t3: number,
    trackLimit: number
}

//TODO: Put this in a config file
export const KECK_GEOMETRY: KeckGeoModel = {
    K1: {
        r0: 0,
        r1: 18,
        r2: 0,
        r3: 33.3,
        t0: 0,
        t1: 361,
        t2: 5.3,
        t3: 146.2,
        trackLimit: 85
    },
    K2: {
        r0: 0,
        r1: 18,
        r2: 0,
        r3: 36.8,
        t0: 0,
        t1: 361,
        t2: 185.3,
        t3: 332.8,
        trackLimit: 85
    }
}

const make_disk_polar = (r1: number, r2: number, th1: number, th2: number) => {

    let rr1 = [] as number[]
    let tt1 = [] as number[]
    let rr2 = [] as number[]
    let tt2 = [] as number[]
    for (let th = th1; th < th2; th++) {
        rr1.push(r1)
        tt1.push(th)
        rr2.push(r2)
        tt2.push(th)
    }

    const r = [...rr1, ...rr2.reverse(), rr1[0]]
    const theta = [...tt1, ...tt2.reverse(), tt1[0]]

    const pTrace: Partial<Plotly.PlotData | any> = {
        r: r,
        theta: theta,
        opacity: .5,
        color: "rgb(0,0,0)",
        line: {
            color: "rgb(0,0,0)",
            width: 0
        },
        type: 'scatterpolar',
        fill: 'toself',
        mode: 'lines',
        name: 'telescope bottom limit',
        hoverinfo: "none",
        hovermode: false,
    }
    return pTrace
}

export const DomeSelect = () => {

    const [dome, setDome] = useQueryParam('dome', withDefault(StringParam, "K2"))

    const handleDomeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setDome(event.target.value)
    }

    return (
    <FormControl>
        <FormLabel id="dome-row-radio-buttons-group-label">Dome</FormLabel>
        <RadioGroup
            row
            aria-labelledby="dome-row-radio-buttons-group-label"
            name="dome-radio-buttons-group"
            value={dome}
            onChange={handleDomeChange}
        >
            <FormControlLabel value="K1" control={<Radio />} label="K1" />
            <FormControlLabel value="K2" control={<Radio />} label="K2" />
        </RadioGroup>
    </FormControl>
    )
}

const TwoDView = (props: Props) => {

    const keckLngLat: LngLatEl = {
        lng: KECK_LONG,
        lat: KECK_LAT,
        el: KECK_ELEVATION * 1_000 // convert km to meters
    }

    const today = dayjs(new Date()).tz(TIMEZONE).toDate()
    const [date, setDate] = useQueryParam('date', withDefault(DateParam, today))
    const [dome, setDome] = useQueryParam('dome', withDefault(StringParam, "K2"))
    const [showMoon, setShowMoon] = useQueryParam('show_moon', withDefault(BooleanParam, true))
    const [showCurrLoc, setShowCurrLoc] = useQueryParam('show_current_location', withDefault(BooleanParam, true))
    const [nadir, setNadir] = React.useState(util.get_suncalc_times(keckLngLat, date).nadir)
    const [times, setTimes] = React.useState(util.get_times_using_nadir(nadir))
    const [time, setTime] = React.useState(nadir)

    React.useEffect(() => {
        const newNadir = util.get_suncalc_times(keckLngLat, date).nadir
        setNadir(newNadir)
        setTimes(() => util.get_times_using_nadir(newNadir))
        setTime(newNadir)
    }, [date])


    let targets_deg: Target[] = []
    console.log('targets', props.targets)
    props.targets.forEach((s: Target) => {
        if (s.ra && s.dec) {
            let sd = {
                ...s,
                ra_deg: util.ra_dec_to_deg(s.ra, false),
                dec_deg: util.ra_dec_to_deg(s.dec, true)
            }
            targets_deg.push(sd)
        }
    })

    let traces: any[] = []


    targets_deg.forEach((tgt: Target) => {
        const ra = tgt.ra_deg as number
        const dec = tgt.dec_deg as number
        const azEl = util.get_target_traj(ra, dec, times, keckLngLat) as [number, number][]
        // console.log('axEl', azEl)

        let [rr, tt] = [[] as number[], [] as number[]]
        const texts: string[] = []
        azEl.forEach((ae: [number, number], idx: number) => {
            if (ae[1] >= 0) {
                rr.push(90 - ae[1])
                tt.push(ae[0])

                let txt = ""
                txt += `Az: ${ae[0].toFixed(2)}<br>`
                txt += `El: ${ae[1].toFixed(2)}<br>`
                txt += `Airmass: ${util.air_mass(ae[1]).toFixed(2)}<br>`
                txt += `HT: ${dayjs(times[idx]).format(TIME_FORMAT)}`
                texts.push(txt)
            }
        })

        const trace = {
            r: rr,
            theta: tt,
            text: texts,
            hovorinfo: 'text',
            hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
            line: {
                width: 10
            },
            textposition: 'top left',
            type: 'scatterpolar',
            mode: 'lines',
            namelength: -1,
            name: tgt.target_name
        }
        traces.push(trace)
    })

    if (showMoon) {
        let [rr, tt] = [[] as number[], [] as number[]]
        const texts: string[] = []
        times.forEach((time: Date, idx: number) => {
            const azel = SunCalc.getMoonPosition(time, keckLngLat.lat, keckLngLat.lng)
            const ae = [(Math.PI + azel.azimuth) * 180 / Math.PI, azel.altitude * 180 / Math.PI]
            const r = 90 - ae[1]
            if (r <= 90) {
                rr.push(90 - ae[1])
                tt.push(ae[0])
                let txt = ""
                txt += `Az: ${ae[0].toFixed(2)}<br>`
                txt += `El: ${ae[1].toFixed(2)}<br>`
                txt += `Airmass: ${util.air_mass(ae[1]).toFixed(2)}<br>`
                txt += `HT: ${dayjs(times[idx]).format(TIME_FORMAT)}`
                texts.push(txt)
            }
        })

        const moonTrace = {
            r: rr,
            theta: tt,
            text: texts,
            opacity: .5,
            hovorinfo: 'text',
            color: "rgb(0,0,0)",
            hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
            line: {
                width: 10
            },
            textposition: 'top left',
            type: 'scatterpolar',
            mode: 'markers',
            namelength: -1,
            name: 'Moon'
        }
        traces.push(moonTrace)
    }

    if (showCurrLoc) {
        let [rr, tt] = [[] as number[], [] as number[]]
        const texts: string[] = []
        if (showMoon) {
            const azel = SunCalc.getMoonPosition(time, keckLngLat.lat, keckLngLat.lng)
            const ae = [(Math.PI + azel.azimuth) * 180 / Math.PI, azel.altitude * 180 / Math.PI]
            const r = 90 - ae[1]
            if (r <= 88) {
                rr.push(90 - ae[1])
                tt.push(ae[0])
                let txt = ""
                txt += `Az: ${ae[0].toFixed(2)}<br>`
                txt += `El: ${ae[1].toFixed(2)}<br>`
                txt += `Airmass: ${util.air_mass(ae[1]).toFixed(2)}<br>`
                txt += `HT: ${dayjs(time).format(TIME_FORMAT)}`
                texts.push(txt)
            }
        }
        targets_deg.forEach((tgt: Target) => { //add current location trace
            const ra = tgt.ra_deg as number
            const dec = tgt.dec_deg as number
            const azEl = util.get_target_traj(ra, dec, [time], keckLngLat) as [number, number][]
            const r = 90 - azEl[0][1]
            if (r <= 88) {
                rr.push(r)
                tt.push(azEl[0][0])
                let txt = ""
                txt += `Az: ${azEl[0][0].toFixed(2)}<br>`
                txt += `El: ${azEl[0][1].toFixed(2)}<br>`
                txt += `Airmass: ${util.air_mass(azEl[0][1]).toFixed(2)}<br>`
                txt += `HT: ${dayjs(time).format(TIME_FORMAT)}`
                texts.push(txt)
            }
        })

        const trace = {
            r: rr,
            theta: tt,
            text: texts,
            hovorinfo: 'text',
            hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
            color: "rgb(0,0,0)",
            textposition: 'top left',
            type: 'scatterpolar',
            mode: 'markers',
            marker: { size: 12, color: 'red' },
            namelength: -1,
            name: 'Current location'
        }
        traces.push(trace)
    }

    const KG = KECK_GEOMETRY[dome as keyof KeckGeoModel]
    const r0 = 90 - KG.r0
    const r1 = 90 - KG.r1
    const t0 = KG.t0
    const t1 = KG.t1
    const r2 = 90 - KG.r2
    const r3 = 90 - KG.r3
    const t2 = KG.t2
    const t3 = KG.t3
    const d1 = make_disk_polar(r0, r1, t0, t1)
    const d2 = make_disk_polar(r2, r3, t2, t3)
    const shape = {
        ...d1,
        r: [...d1.r, ...d2.r],
        theta: [...d1.theta, ...d2.theta]
    }
    traces.push(shape)


    const layout: Partial<Plotly.Layout> = {
        width: 900,
        height: 800,
        title: 'Target Trajectories',
        hovermode: "closest",
        polar: {
            radialaxis: {
                showticklabels: true,
                tickmode: "array",
                tickvals: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
                ticktext: ['90', '80', '70', '60', '50', '40', '30', '20', '10', '0'],
            },
            angularaxis: {
                showticklabels: true,
                rotation: +90,
                direction: "clockwise"
            },
        },
        margin: {
            l: 40,
            r: 40,
            b: 40,
            t: 40,
            pad: 4
        },
        annotations: [{
            xref: 'paper',
            yref: 'paper',
            x: 0.45,
            xanchor: 'right',
            y: 1,
            yanchor: 'middle',
            text: 'North',
            showarrow: false
        }, {
            xref: 'paper',
            yref: 'paper',
            x: 1,
            xanchor: 'left',
            y: .55,
            yanchor: 'top',
            text: 'East',
            showarrow: false
        }]
    }


    const handleDateChange = (date: Dayjs | null) => {
        if (date) setDate(date.tz(TIMEZONE).toDate())
    }


    return (
        <React.Fragment>
            <NightPicker date={date} handleDateChange={handleDateChange} />
            <TimeSlider
                nadir={nadir}
                times={times}
                time={time}
                setTime={setTime}
            />
            <DomeSelect />
            <FormControlLabel
                label="Show Current Location"
                value={showCurrLoc}
                control={<Switch checked={showCurrLoc} />}
                onChange={(_, checked) => setShowCurrLoc(checked)}
            />
            <FormControlLabel
                label="Show Moon"
                value={showMoon}
                control={<Switch checked={showMoon} />}
                onChange={(_, checked) => setShowMoon(checked)}
            />
            <Plot
                data={traces}
                layout={layout}
            />
        </React.Fragment>
    );

}

export default TwoDView