import React from 'react';
import * as util from './sky_view_util.tsx'
import NightPicker from '../two-d-view/night_picker'
import dayjs, { Dayjs } from 'dayjs';
import { Autocomplete, Button, FormControl, FormControlLabel, FormLabel, Grid2, Radio, RadioGroup, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import TimeSlider from './time_slider';
import { Target, useStateContext } from '../App.tsx';
import { DomeChart } from './dome_chart.tsx';
import { SkyChart } from './sky_chart.tsx';
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { alt_az_observable } from './target_viz_chart.tsx';
import { VizRow } from './viz_dialog.tsx';
import AladinViewer from '../aladin';
import { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { MoonMarker } from './moon_marker.tsx';
import * as SunCalc from "suncalc";
import { FOVlink, STEP_SIZE } from './constants.tsx';
import { createEnumParam, StringParam, useQueryParam, withDefault } from 'use-query-params';
import html2canvas from 'html2canvas';

dayjs.extend(utc)
dayjs.extend(timezone)


interface Props {
    targets: Target[]
}

export type Dome = "K1" | "K2"

const height = 500
const width = 500



export interface TargetView extends Target {
    dome: Dome,
    date: Date,
    ra_deg: number,
    dec_deg: number,
    visibility: VizRow[],
    visibilitySum: number
}


interface DomeSelectProps {
    dome: Dome
    setDome: (dome: Dome) => void
}

interface SkyChartSelectProps {
    skyChart: SkyChart
    setSkyChart: (skyChart: SkyChart) => void
}

export type ShapeCatagory = 'fov' | 'compass_rose'
interface ShapeCfgFile {
    fov: FeatureCollection<MultiPolygon>
    compass_rose: FeatureCollection<Polygon>
}


export const get_shapes = async (fcType: ShapeCatagory) => {
    const resp = await fetch(FOVlink)
    const data = await resp.text()
    const json = JSON.parse(data) as ShapeCfgFile
    const featureCollection = json[fcType]
    return featureCollection
}

export const SkyChartSelect = (props: SkyChartSelectProps) => {
    const { skyChart, setSkyChart } = props


    const handleSkyChartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSkyChart(event.target.value as SkyChart)
    }


    return (
        <FormControl sx={{ display: 'inlineBlock' }}>
            <FormLabel sx={{ marginRight: '6px', paddingTop: '9px' }} id="sky-chart-row-radio-buttons-group-label">Sky Chart Type: </FormLabel>
            <RadioGroup
                row
                aria-labelledby="sky-chart-row-radio-buttons-group-label"
                name="sky-chart-radio-buttons-group"
                value={skyChart}
                onChange={handleSkyChartChange}
            >
                <FormControlLabel value="Airmass" control={<Radio />} label="Airmass" />
                <FormControlLabel value="Elevation" control={<Radio />} label="Elevation" />
                <FormControlLabel value="Parallactic" control={<Radio />} label="Parallactic Angle" />
                <FormControlLabel value="Lunar Angle" control={<Radio />} label="Lunar Angle" />
                <FormControlLabel value="Azimuth" control={<Radio />} label="Azimuth" />
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

export const DomeParam = createEnumParam<Dome>(['K1', 'K2'])

const TwoDView = ({ targets }: Props) => {
    const context = useStateContext()
    const today = hidate(new Date(), context.config.timezone).toDate()
    const [obsdate, setObsdate] = React.useState<Date>(today)
    const [dome, setDome] = useQueryParam<Dome>('dome', withDefault(DomeParam, 'K2' as Dome))
    const [skyChart, setSkyChart] = React.useState<SkyChart>("Airmass")
    const [showMoon, setShowMoon] = React.useState(true)
    const [showCurrLoc, setShowCurrLoc] = React.useState(true)
    const [showLimits, setShowLimits] = React.useState(true)
    const [rotatorAngle, setRotatorAngle] = React.useState(0)
    const [positionAngle] = React.useState(0)
    const lngLatEl = context.config.tel_lat_lng_el.keck
    const [suncalcTimes, setSuncalcTimes] = React.useState(util.get_suncalc_times(lngLatEl, obsdate))
    const [times, setTimes] = React.useState(util.get_times_using_nadir(suncalcTimes.nadir))
    const [time, setTime] = React.useState(suncalcTimes.nadir)
    const [targetView, setTargetView] = React.useState<TargetView[]>([])
    const [fovs, setFOVs] = React.useState<string[]>([])
    //const [instrumentFOV, setInstrumentFOV] = React.useState('MOSFIRE')
    const [instrumentFOV, setInstrumentFOV] = useQueryParam('instrument_fov', withDefault(StringParam, 'MOSFIRE'))

    React.useEffect(() => {
        const fun = async () => {
            const featureCollection = await get_shapes('fov')
            const features = featureCollection['features'].filter((feature: any) => {
                return feature['properties'].type === 'FOV'
            })
            const newFovs = features.map((feature: any) => feature['properties'].instrument) as string[]
            setFOVs(newFovs)
        }
        fun()
    }, [])

    React.useEffect(() => {
        const newSuncalcTimes = util.get_suncalc_times(lngLatEl, obsdate)
        const newTimes = util.get_times_using_nadir(newSuncalcTimes.nadir)
        const tviz: TargetView[] = []
        const KG = context.config.tel_geometry.keck[dome]
        targets.forEach((tgt: Target) => {
            if (tgt.ra && tgt.dec) {
                const ra_deg = tgt.ra_deg ?? util.ra_dec_to_deg(tgt.ra as string, false)
                const dec_deg = tgt.dec_deg ?? util.ra_dec_to_deg(tgt.dec as string, true)
                const azEl: [number, number][] = []
                // util.get_target_traj(ra_deg, dec_deg, newTimes, keckLngLat) as [number, number][]
                const visibility: VizRow[] = []
                newTimes.forEach((datetime: Date) => {
                    const [az, alt] = util.ra_dec_to_az_alt(ra_deg, dec_deg, datetime, lngLatEl)
                    const air_mass_val = util.air_mass(alt, lngLatEl.el)
                    const moon_illumination = SunCalc.getMoonIllumination(datetime)
                    const moon_position = util.get_moon_position(datetime, lngLatEl)
                    // const air_mass_val = util.air_mass(alt)
                    const vis: VizRow = {
                        az,
                        alt,
                        ...alt_az_observable(alt, az, KG),
                        datetime,
                        air_mass: air_mass_val,
                        moon_illumination,
                        moon_position
                    }
                    azEl.push([az, alt])
                    visibility.push(vis)
                })

                const vizSum = visibility.reduce((sum: number, viz: VizRow) => {
                    return viz.observable ? sum + STEP_SIZE : sum
                }, 0)
                const tgtv: TargetView = {
                    ...tgt,
                    date: obsdate,
                    dome,
                    ra_deg,
                    dec_deg,
                    visibility,
                    visibilitySum: vizSum
                }
                tviz.push(tgtv)
            }
        })

        const fun = async () => {
            const featureCollection = await get_shapes('fov')
            const features = featureCollection['features'].filter((feature: any) => {
                return feature['properties'].type === 'FOV' && feature['properties'].dome === dome
            })
            const newFovs = features.map((feature: any) => feature['properties'].instrument) as string[]
            console.log('dome', dome, 'obsdate', obsdate, 'instrumentFOV', 'skychart', skyChart)
            !newFovs.includes(instrumentFOV) && setInstrumentFOV(newFovs[0])
            setFOVs(newFovs)
        }

        fun()
        setTargetView(tviz)
        setSuncalcTimes(newSuncalcTimes)
        setTime(newSuncalcTimes.nadir)
        setTimes(newTimes)
    }, [obsdate, targets, dome, skyChart])

    const handleDateChange = (newDate: Dayjs | null) => {
        if (!newDate) return
        const newObsDate = hidate(newDate?.toDate(), context.config.timezone).toDate()
        newDate && setObsdate(newObsDate)
    }

    const onInstrumentFOVChange = (value: string | undefined | null) => {
        if (value) {
            setInstrumentFOV(value)
        }
    }

    const save_img = () => {

        const classNames = [
            'aladin-logo-container',
            'aladin-tooltip-container aladin-cooFrame bottom',
            'aladin-horizontal-list aladin-location',
            'aladin-tooltip-container top aladin-zoom-out',
            'aladin-tooltip-container top aladin-zoom-in',
            'aladin-tooltip-container aladin-stack-control top right',
            'aladin-tooltip-container aladin-grid-control top right',
            'aladin-tooltip-container aladin-projection-control bottom left',
            'aladin-tooltip-container aladin-fullScreen-control left'
        ]
        
        const doc = document.getElementById('aladin-lite-div');

        classNames.forEach((className) => {
            const element = doc?.getElementsByClassName(className)[0] as HTMLElement;
            if (element) {
                doc?.removeChild(element)
            }
        });

        html2canvas(doc as HTMLElement).then((canvas) => {
            if (canvas) {
                const link = document.createElement('a');
                link.download = 'sky-chart.png';
                link.href = canvas.toDataURL();
                link.click();
            }
        })
    }

    const moonInfo = SunCalc.getMoonIllumination(time)


    return (
        <Grid2 container spacing={2}>
            <Grid2 size={{ xs: 8 }}>
                <>
                    <Stack sx={{ verticalAlign: 'bottom', paddingTop: '9px', marginBottom: '0px', overflow: "auto" }}
                        width="100%"
                        direction="row"
                        justifyContent='center'
                        spacing={1}>
                        <NightPicker date={obsdate} handleDateChange={handleDateChange} />
                        <DomeSelect dome={dome} setDome={setDome} />
                        <FormControlLabel
                            label="Show Current Location"
                            value={showCurrLoc}
                            control={<Switch checked={showCurrLoc} />}
                            onChange={(_, checked) => setShowCurrLoc(checked)}
                        />
                        <FormControlLabel
                            label="Show Telescope Limits"
                            value={showLimits}
                            control={<Switch checked={showLimits} />}
                            onChange={(_, checked) => setShowLimits(checked)}
                        />
                        <FormControlLabel
                            label="Show Moon"
                            value={showMoon}
                            control={<Switch checked={showMoon} />}
                            onChange={(_, checked) => setShowMoon(checked)}
                        />
                    </Stack>
                    <TimeSlider
                        times={times}
                        time={time}
                        setTime={setTime}
                    />
                    <Stack width="100%" direction="row" justifyContent='space-between' spacing={0}>
                        <SkyChartSelect skyChart={skyChart} setSkyChart={setSkyChart} />
                        <Stack direction='column'>
                            <FormControl sx={{ display: 'inlineBlock' }}>
                                <FormLabel sx={{ marginRight: '6px', paddingTop: '9px' }}
                                    id="moon-phase-group-label">Moon Fraction: </FormLabel>
                            </FormControl>
                            <Stack direction='row' spacing={1}>
                                <MoonMarker
                                    moonInfo={moonInfo}
                                    datetime={time} width={width} height={height}
                                />
                                <Typography>{Math.floor(moonInfo.fraction * 100)}%</Typography>
                            </Stack>
                        </Stack>
                    </Stack>
                </>
            </Grid2>
            <Grid2 size={{ xs: 4 }}>
                <Stack width="100%" direction="column" justifyContent='center' spacing={1}>
                    <Tooltip placement="top" title="Select instrument field of view">
                        <Autocomplete
                            disablePortal
                            id="semid-selection"
                            value={{ label: instrumentFOV }}
                            onChange={(_, value) => onInstrumentFOVChange(value?.label)}
                            options={fovs.map((instr) => { return { label: instr } })}
                            sx={{ width: '200px', paddingTop: '9px', margin: '6px' }}
                            renderInput={(params) => <TextField {...params} label="Instrument FOV" />}
                        />
                    </Tooltip>
                    <Tooltip title={'Rotator angle for Field of View'}>
                        <TextField
                            sx={{ width: '200px', margin: '6px' }}
                            label={'Rotator Angle'}
                            id="rotator-angle"
                            value={rotatorAngle}
                            onChange={(event) => setRotatorAngle(Number(event.target.value))}
                        />
                    </Tooltip>
                    <Tooltip title={'Rotator angle for Field of View'}>
                        <Button
                            sx={{ width: '200px', margin: '6px' }}
                            onClick={save_img}
                            variant='contained'
                        >
                            Save Image as .png
                        </Button>

                    </Tooltip>
                    {/* <Tooltip title={'Position angle for the sky'}>
                        <TextField
                            sx={{ width: '200px', margin: '6px' }}
                            label={'Position Angle'}
                            id="position-angle"
                            value={positionAngle}
                            onChange={(event) => setPositionAngle(Number(event.target.value))}
                        />
                    </Tooltip> */}
                </Stack>
            </Grid2>
            <Grid2 size={{ xs: 8 }}>
                <Stack sx={{}} width="100%" direction="row" justifyContent='center' spacing={1}>
                    <DomeChart
                        height={height}
                        width={width}
                        targetView={targetView}
                        showMoon={showMoon}
                        showCurrLoc={showCurrLoc}
                        times={times}
                        time={time}
                        dome={dome}
                    />
                    <SkyChart
                        height={height}
                        width={width}
                        chartType={skyChart}
                        showLimits={showLimits}
                        targetView={targetView}
                        showMoon={showMoon}
                        showCurrLoc={showCurrLoc}
                        times={times}
                        suncalcTimes={suncalcTimes}
                        time={time}
                        dome={dome}
                    />
                </Stack>
            </Grid2>
            <Grid2 size={{ xs: 4 }}>
                <AladinViewer
                    height={height}
                    fovAngle={rotatorAngle}
                    positionAngle={positionAngle}
                    instrumentFOV={instrumentFOV}
                    width={width}
                    targets={targets} />
            </Grid2>
        </Grid2 >
    );
}


export default TwoDView