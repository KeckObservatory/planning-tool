import React, { useEffect, useState } from "react";
import { GeoModel, Target, useStateContext } from "../App";
import { ra_dec_to_deg, 
    get_day_times, 
    get_suncalc_times, 
    ROUND_MINUTES, 
    ra_dec_to_az_alt, 
    air_mass, 
    LngLatEl} from "./sky_view_util";
import { DomeSelect, Dome } from "./two_d_view";
import dayjs, { Dayjs, ManipulateType } from 'dayjs';
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import VisibilityIcon from '@mui/icons-material/Visibility';
import { GetTimesResult } from "suncalc";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import { StringParam, useQueryParam, withDefault } from "use-query-params";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Plot from "react-plotly.js";
import * as SunCalc from "suncalc";

dayjs.extend(utc)
dayjs.extend(timezone)

interface ButtonProps {
    target: Target
}

interface Props extends ButtonProps { //TODO: Is extension needed?
    dome: Dome
    semester: string
}


interface SemesterDates {
    start_day: number
    start_month: number
    end_day: number
    end_month: number
    plus_year?: number
}

interface SemesterRange {
    'A': SemesterDates
    'B': SemesterDates
}

//TODO: add to config
const SEMESTER_RANGES: SemesterRange = {
    'A': {
        start_day: 1,
        start_month: 2,
        end_day: 31,
        end_month: 7
    },
    'B': {
        start_day: 1,
        start_month: 8,
        end_day: 31,
        end_month: 1,
        plus_year: 1
    }
}

//HELPER FUNCTIONS
const get_semester_dates = (semester: string) => {
    const sem = semester[semester.length - 1] as 'A' | 'B'
    const year = Number(semester.slice(0, 4))
    const plusYear = SEMESTER_RANGES[sem].plus_year ?? 0
    const endYear = year + plusYear
    const range = SEMESTER_RANGES[sem as 'A' | 'B']

    const startDate = dayjs().year(year).month(range.start_month).date(range.start_day)

    const endDate = dayjs().year(endYear).month(range.end_month).date(range.end_day)
    const ranges = dayjs_range(startDate, endDate, 'day')
    return ranges
}

export const alt_az_observable = (alt: number, az: number, KG: GeoModel) => {
    const minDeckAz = KG.t2
    const maxDeckAz = KG.t3
    const minAlt = KG.r1
    const deckAlt = KG.r3
    const trackLimit = KG.trackLimit

    const reasons: Array<string> = []
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

export const dayjs_range = (start: Dayjs, end: Dayjs, unit: ManipulateType = 'day') => {
    const range = [];
    let current = start;
    while (!current.isAfter(end)) {
        range.push(current);
        current = current.add(1, unit);
    }
    return range;
}


export const TargetVizButton = (props: ButtonProps) => {
    const { target } = props
    const targetName = target.target_name

    const [open, setOpen] = React.useState(false);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            <Tooltip title={`Click to view target visibility for ${targetName}`}>
                <IconButton onClick={handleClickOpen}>
                    <VisibilityIcon />
                </IconButton>
            </Tooltip>
            <TargetVizDialog
                open={open}
                target={target}
                handleClose={handleClose}
            />
        </>
    );
}

interface TargetViz extends Target {
    semester: string
    semester_visibility: DayViz[]
}

export interface DayViz extends GetTimesResult {
    date: Date,
    visibility: VizRow[]
    visible_hours: number
    amateurDawn: Date, // Sun in 12 degrees below the horizon
    amateurDusk: Date, // Sun in 12 degrees below the horizon
    astronomicalDawn: Date, // Sun is 18 degrees below the horizon
    astronomicalDusk: Date, // Sun is 18 degrees below the horizon
}

export interface VizRow {
    datetime: Date
    alt: number
    az: number
    observable: boolean
    air_mass: number
    reasons: string[]
    moon_fraction: number
}

const get_curr_semester = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const sem = month > 1 && month < 8 ? 'A' : 'B'
    return `${year}${sem}`
}

interface TargetVizDialogProps {
    open: boolean, target: Target, handleClose: () => void
}

const TargetVizDialog = (props: TargetVizDialogProps) => {
    const [dome, setDome] = useState<Dome>("K2")
    const default_semester = get_curr_semester(new Date())
    const [semester, setSemester] = useQueryParam('semester', withDefault(StringParam, default_semester))
    return (
        <Dialog
            maxWidth={false}
            onClose={() => props.handleClose()}
            open={props.open}
        >
            <DialogTitle>
                <>
                    <span>Target Visability Chart</span>
                </>
            </DialogTitle>
            <DialogContent >
                <SemesterSelect semester={semester} setSemester={setSemester}/>
                <DomeSelect dome={dome} setDome={setDome}/>
                <TargetVizChart target={props.target} semester={semester} dome={dome} />
            </DialogContent>
        </Dialog>
    )
}

interface SemesterSelectProps {
    semester: string
    setSemester: (semester: string) => void
}


export const SemesterSelect = (props: SemesterSelectProps) => {
    const { semester, setSemester } = props
    const handleSemesterChange = (semester?: string) => {
        if (semester) setSemester(semester)
    }
    return (
        <Tooltip title="Select Semester visibility Range.">
            <TextField
                // focused
                label={'Semester Select'}
                id="target-name"
                value={semester}
                onChange={(event) => handleSemesterChange(event.target.value)}

            />
        </Tooltip>
    )
}

const date_normalize = (date: Date) => {
    const d = new Date(date.valueOf())
    d.setFullYear(2020, 1, 1)
    //if morning set to next day
    return d.getHours() < 12 ? dayjs(d).add(1, 'day').toDate() : d
}

export const reason_to_color_mapping = (reasons: string[]) => {
    const colors = {
        'Deck Blocking': '#7570b3',
        'Below Horizon': '#e7298a',
        'Above Tracking Limits': '#d95f02'
    }
    const cols = reasons.map((reason: string) => colors[reason as keyof typeof colors])
    return cols.length ? cols[0] : '#1b9e77'
}

export const TargetVizChart = (props: Props) => {
    const { target, semester, dome } = props 
    const regexp = new RegExp("^[12][0-9]{3}[AB]$")
    const init_target_viz = { semester, dome, ...target, semester_visibility: [] }
    const [targetViz, setTargetView] = useState<TargetViz>(init_target_viz)
    const context = useStateContext()

    const KG = context.config.keck_geometry[dome as Dome]
    const lngLatEl: LngLatEl = {
        lng: context.config.keck_longitude, 
        lat: context.config.keck_latitude, 
        el: context.config.keck_elevation
    }

    useEffect(() => {
        const validSemester = regexp.test(semester)
        if (!validSemester) {
            return
        }
        const dates = get_semester_dates(semester)
        let tViz: TargetViz = {
            ...target,
            semester: semester,
            semester_visibility: [],
        }

        const ra = target.ra_deg ?? ra_dec_to_deg(target.ra as string)
        const dec = target.dec_deg ?? ra_dec_to_deg(target.dec as string, true)
        tViz.semester_visibility = dates.map((date: Dayjs) => {
            let suncalc_times = get_suncalc_times(lngLatEl, date.toDate())
            const startTime = suncalc_times.sunset
            const endTime = suncalc_times.nightEnd
            const times = get_day_times(startTime, endTime, ROUND_MINUTES)
            const visibility = times.map((time: Date) => {
                const [az, alt] = ra_dec_to_az_alt(ra, dec, time, lngLatEl)
                const air_mass_val = air_mass(alt, lngLatEl.el)
                const moon_fraction = SunCalc.getMoonIllumination(time).fraction
                // const air_mass_val = air_mass(alt)
                const vis: VizRow = { 
                    az, 
                    alt, 
                    ...alt_az_observable(alt, az, KG), 
                    datetime: time, 
                    moon_fraction,
                    air_mass: air_mass_val }
                return vis
            })


            const vizSum = visibility.reduce((sum: number, viz: VizRow) => {
                return viz.observable ? sum + 1 : sum
            }, 0)

            const visible_hours = vizSum * ROUND_MINUTES / 60

            return { ...suncalc_times, date: date.toDate(), visibility, visible_hours }
        })

        setTargetView(tViz as TargetViz)
    }, [target, semester, dome])


    const traces = targetViz.semester_visibility.map((dayViz: DayViz) => {
        let texts: string[] = []
        let y: Date[] = []
        let color: string[] = []
        //let color: number[] = []
        dayViz.visibility.forEach((viz: VizRow) => {
            let txt = ""
            txt += `Az: ${viz.az.toFixed(2)}<br>`
            txt += `El: ${viz.alt.toFixed(2)}<br>`
            txt += `Airmass: ${air_mass(viz.alt, lngLatEl.el).toFixed(2)}<br>`
            // txt += `Airmass: ${air_mass(viz.alt).toFixed(2)}<br>`
            txt += `HT: ${dayjs(viz.datetime).format(context.config.date_time_format)}<br>`
            txt += `Visible for: ${dayViz.visible_hours.toFixed(2)} hours<br>`
            txt += viz.observable ? '' : `<br>Not Observable: ${viz.reasons.join(', ')}`
            texts.push(txt)
            color.push(reason_to_color_mapping(viz.reasons))
            // color.push(viz.reasons.length? viz.reasons[0] : 'visible')
            // const daytime = new Date(viz.datetime.valueOf())
            const daytime = date_normalize(viz.datetime)
            // daytime.setFullYear(2020, 1, 1)
            y.push(daytime)
            texts.push(txt)
        })
        const ydate = new Date(dayjs(dayViz.date).format('YYYY-MM-DD'))
        const x = Array.from({ length: y.length }, () => ydate)

        const trace: Partial<Plotly.PlotData> = {
            x,
            y,
            marker: {
                color,
                size: ROUND_MINUTES,
                symbol: 'square',
                opacity: 1 // too dense to see ticks
            },
            // color,
            text: texts,
            //@ts-ignore
            hovorinfo: 'text',
            hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
            line: {
                width: 10,
            },
            textposition: 'top left',
            type: 'scattergl',
            mode: 'markers',
            showlegend: false,
            name: targetViz.target_name ?? 'Target'
        }
        return trace
    })

    //Add UT time trace
    if (traces.length > 0) {
        let UTTrace = {...traces.at(0)} as Partial<Plotly.PlotData>
        //@ts-ignore
        const ydates = UTTrace.y.map((date: Date) => dayjs(date).add(10, 'hour').toDate())
        //@ts-ignore
        UTTrace.y = ydates
        if (UTTrace.marker) {
            UTTrace.marker.opacity = 0;
            UTTrace.marker.size = 0;
        }
        if (UTTrace.line) {
            UTTrace.line.width = 0;
        }
        UTTrace.yaxis = 'y2'
        UTTrace.visible = true 
        console.log('UTTrace', UTTrace)
        traces.push(UTTrace)
    }


    const layout: Partial<Plotly.Layout> = {
        width: 1600,
        height: 600,
        title: `${target.target_name ?? 'Target'} Visibility`,
        yaxis2: {
            title: 'Time [UTC]',
            type: 'date',
            overlaying: 'y', 
            side: 'right',
            gridwidth: 5,
            layer: 'above traces',
            autorange: 'reversed',
            tickformat: '%H:%M',
        },
        yaxis: {
            title: 'Time [HT]',
            type: 'date',
            layer: 'above traces',
            gridwidth: 5,
            autorange: 'reversed',
            tickformat: '%H:%M',
            tickmode: 'auto',
            nticks: 10
        },
        xaxis: {
            title: 'Date',
            type: 'date',
            layer: 'above traces',
            dtick: 15 * 24 * 60 * 60 * 1000, // milliseconds
            tickformat: '%Y-%m-%d',
            // tickmode: 'auto',
            //nticks: 0
        },
        hovermode: "closest",
    }

    return (
        <Plot
            data={traces}
            layout={layout}
        />
    )
}