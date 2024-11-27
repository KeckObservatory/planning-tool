import React, { useEffect, useState } from "react";
import { GeoModel, Target, useStateContext } from "../App";
import {
    ra_dec_to_deg,
    get_day_times,
    get_suncalc_times,
    ROUND_MINUTES,
    ra_dec_to_az_alt,
    air_mass,
    LngLatEl
} from "./sky_view_util";
import { DomeSelect, Dome } from "./two_d_view";
import dayjs, { Dayjs, ManipulateType } from 'dayjs';
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import arraySupport from 'dayjs/plugin/arraySupport'
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
import { Autocomplete, Stack } from "@mui/material";
import { useTargetContext } from "../target_table";

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(arraySupport)

interface ButtonProps {
    targetName: string 
    targetNames: string[]
}

interface Props{ 
    target: Target,
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
    const { targetName, targetNames } = props

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
                targetName={targetName}
                targetNames={targetNames}
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
    open: boolean,
    targetName: string 
    targetNames: string[]
    handleClose: () => void
}

const TargetVizDialog = (props: TargetVizDialogProps) => {
    const [dome, setDome] = useState<Dome>("K2")
    const default_semester = get_curr_semester(new Date())
    const [semester, setSemester] = useQueryParam('semester', withDefault(StringParam, default_semester))
    const context = useTargetContext()
    const initTarget = context.targets.find((t: Target) => t.target_name === props.targetName || t._id === props.targetName)
    const [target, setTarget] = useState<Target>(initTarget ?? {} as Target)

    const onTargetNameSelect = (name: string) => {
        if (name !== props.targetName) {
            const newTarget = context.targets.find((t: Target) => t.target_name === name || t._id === name)
            setTarget(newTarget ?? {} as Target)
        }
    }

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
                <Stack
                    sx={{
                        paddingTop: '16px',
                        display: 'flex',
                        flexWrap: 'wrap',
                    }}
                    direction='column'>
                    <Stack direction='row'>
                        <SemesterSelect semester={semester} setSemester={setSemester} />
                        <DomeSelect dome={dome} setDome={setDome} />
                        <Tooltip title={'Target'}>
                            <Autocomplete
                                disablePortal
                                id="selected-target"
                                value={props.targetName}
                                onChange={(_, value) => value && onTargetNameSelect(value)}
                                options={props.targetNames ?? []}
                                sx={{ width: 250 }}
                                renderInput={(params) => <TextField {...params} label={'Selected Target'} />}
                            />
                        </Tooltip>
                    </Stack>
                    {target && <TargetVizChart target={target} semester={semester} dome={dome} />}
                </Stack>
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

const date_normalize = (date: Date, utctz = false) => {
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

const create_dawn_dusk_traces = (targetViz: TargetViz, date_time_format: string) => {

    const trace = {
        yaxis: 'y2',
        hovertemplate: '<b>%{text}</b>', //disable to show xyz coords
        textposition: 'top left',
        mode: 'lines+markers',
        showlegend: false,
        type: 'scattergl',
        marker: {
            size: 2,
            symbol: 'square',
        },
        line: {
            width: 2
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
                    air_mass: air_mass_val
                }
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



    let traces = targetViz.semester_visibility.map((dayViz: DayViz) => {
        let text: string[] = []
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
            txt += `UT: ${dayjs(viz.datetime).utc(false).format(context.config.date_time_format)}<br>`
            txt += `Moon Fraction: ${viz.moon_fraction.toFixed(2)}<br>`
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
                size: ROUND_MINUTES,
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
        width: 1600,
        height: 600,
        title: `${target.target_name ?? 'Target'} Visibility`,
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
            gridwidth: 0,
            // scaleanchor: 'y2',
            autorange: 'reversed',
            layer: 'above traces',
            // tickmode: 'auto',
            tickformat: '%H:%M',
        },
        xaxis: {
            title: 'Date',
            type: 'date',
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
            divId='target-viz-chart'
            layout={layout}
        />
    )
}