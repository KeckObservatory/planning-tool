import React from 'react';
import * as util from './sky_view_util.tsx'
import { LngLatEl } from './sky_view_util.tsx';
import NightPicker from '../two-d-view/night_picker'
import dayjs, { Dayjs } from 'dayjs';
import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, Switch } from '@mui/material';
import TimeSlider from './time_slider';
import { Target, useStateContext } from '../App.tsx';
import { DomeChart } from './dome_chart.tsx';
import { SkyChart } from './sky_chart.tsx';
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)


interface Props {
    targets: Target[]
}

export type Dome = "K1" | "K2"



export interface TargetView extends Target {
    dome: Dome,
    date: Date,
    times: Date[],
    ra_deg: number,
    dec_deg: number,
    azEl: [number, number][],
    air_mass?: number,
    parallactic?: number,
    lunar_angle?: number
}


interface DomeSelectProps {
    dome: Dome
    setDome: (dome: Dome) => void
}

interface SkyChartSelectProps {
    skyChart: SkyChart
    setSkyChart: (skyChart: SkyChart) => void
}

export const SkyChartSelect = (props: SkyChartSelectProps) => {
    const { skyChart, setSkyChart } = props

    const handleSkyChartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSkyChart(event.target.value as SkyChart)
    }

    return (
        <FormControl>
            <FormLabel id="sky-chart-row-radio-buttons-group-label">Sky Chart</FormLabel>
            <RadioGroup
                row
                aria-labelledby="sky-chart-row-radio-buttons-group-label"
                name="sky-chart-radio-buttons-group"
                value={skyChart}
                onChange={handleSkyChartChange}
            >
                <FormControlLabel value="Elevation" control={<Radio />} label="Elevation" />
                <FormControlLabel value="Airmass" control={<Radio />} label="Airmass" />
                <FormControlLabel value="Parallactic" control={<Radio />} label="Parallactic Angle" />
                <FormControlLabel value="LunarAngle" control={<Radio />} label="Lunar Angle" />
            </RadioGroup>
        </FormControl>
    )
}

export const DomeSelect = (props: DomeSelectProps) => {
    const { dome, setDome } = props

    const handleDomeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setDome(event.target.value as Dome)
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

export const hidate = (date: Date, timezone: string) => {
    return dayjs(date).tz(timezone)
}


const TwoDView = ({targets}: Props) => {
    const context = useStateContext()
    const today = hidate(new Date(), context.config.timezone).toDate()
    const [obsdate, setObsdate] = React.useState<Date>(today)
    const [dome, setDome] = React.useState<Dome>("K2")
    const [skyChart, setSkyChart] = React.useState<SkyChart>("Elevation")
    const [showMoon, setShowMoon] = React.useState(true)
    const [showCurrLoc, setShowCurrLoc] = React.useState(true)
    const keckLngLat: LngLatEl = {
        lng: context.config.keck_longitude,
        lat: context.config.keck_latitude,
        el: context.config.keck_elevation * 1_000 // convert km to meters
    }
    const [nadir, setNadir] = React.useState(util.get_suncalc_times(keckLngLat, obsdate).nadir)
    const [times, setTimes] = React.useState(util.get_times_using_nadir(nadir))
    const [time, setTime] = React.useState(nadir)
    const [targetView, setTargetView] = React.useState<TargetView[]>([])

    React.useEffect(() => {
        const newNadir = util.get_suncalc_times(keckLngLat, obsdate).nadir
        const newTimes = util.get_times_using_nadir(newNadir)
        const tviz: TargetView[] = [] 
        targets.forEach((tgt: Target) => {
            if (tgt.ra && tgt.dec) {
                const ra_deg = tgt.ra_deg ?? util.ra_dec_to_deg(tgt.ra as string, false)
                const dec_deg = tgt.dec_deg ?? util.ra_dec_to_deg(tgt.dec as string, true)
                const azEl = util.get_target_traj(ra_deg, dec_deg, newTimes, keckLngLat) as [number, number][]
                const tgtv: TargetView = {
                    ...tgt,
                    date: obsdate,
                    dome,
                    times: newTimes,
                    ra_deg,
                    dec_deg,
                    azEl
                }
                tviz.push(tgtv)
            }
        })
        setTargetView(tviz)
        setNadir(newNadir)
        setTime(newNadir)
        setTimes(newTimes)
    }, [obsdate, targets])

    const handleDateChange = (newDate: Dayjs | null) => {
        if (!newDate) return
        const newObsDate = hidate(newDate?.toDate(), context.config.timezone).toDate()
        newDate && setObsdate(newObsDate)
    }


    return (
        <React.Fragment>
            <NightPicker date={obsdate} handleDateChange={handleDateChange} />
            <TimeSlider
                times={times}
                time={time}
                setTime={setTime}
            />
            <DomeSelect dome={dome} setDome={setDome} />
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
            <SkyChartSelect skyChart={skyChart} setSkyChart={setSkyChart} />
            <SkyChart
                chartType={skyChart}
                targetView={targetView}
                showMoon={showMoon}
                showCurrLoc={showCurrLoc}
                times={times}
                time={time}
                dome={dome}
            />
            <DomeChart
                targetView={targetView}
                showMoon={showMoon}
                showCurrLoc={showCurrLoc}
                times={times}
                time={time}
                dome={dome}
            />
        </React.Fragment>
    );
}


export default TwoDView