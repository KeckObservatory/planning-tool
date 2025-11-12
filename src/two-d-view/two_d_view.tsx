import React from 'react';
import * as util from './sky_view_util.tsx'
import NightPicker from '../two-d-view/night_picker'
import dayjs, { Dayjs } from 'dayjs';
import { Button, FormControl, FormControlLabel, FormLabel, Grid2, Radio, RadioGroup, Stack, Switch, TextField, Tooltip } from '@mui/material';
import TimeSlider from './time_slider';
import { Target, useStateContext } from '../App.tsx';
import { DomeChart } from './dome_chart.tsx';
import { SkyChart } from './sky_chart.tsx';
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { alt_az_observable } from './target_viz_chart.tsx';
import { VizRow } from './viz_dialog.tsx';
import AladinViewer from '../aladin/aladin.tsx';
import { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { MoonMarker } from './moon_marker.tsx';
import * as SunCalc from "suncalc";
import { FOVlink, STEP_SIZE } from './constants.tsx';
import { createEnumParam, StringParam, useQueryParam, withDefault } from 'use-query-params';
import html2canvas from 'html2canvas';
import { SkyChartDataSummary } from './sky_chart_data_summary.tsx';
import { FOVSelect } from './fov_select.tsx';
import { POPointFeature, POPointingOriginCollection, POSelect } from './pointing_origin_select.tsx';

dayjs.extend(utc)
dayjs.extend(timezone)


interface Props {
    targets: Target[]
}

export type Dome = "Keck 1" | "Keck 2"

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

export type ShapeCatagory = 'fov' | 'compass_rose' | 'pointing_origins' | 'vignetting_contours'
interface ShapeCfgFile {
    fov: FeatureCollection<MultiPolygon>
    compass_rose: FeatureCollection<Polygon>
    pointing_origins: FeatureCollection<GeoJSON.Geometry>
    vignetting_contours: FeatureCollection<GeoJSON.MultiLineString>
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
                <FormControlLabel value="Keck 1" control={<Radio />} label="Keck 1" />
                <FormControlLabel value="Keck 2" control={<Radio />} label="Keck 2" />
            </RadioGroup>
        </FormControl>
    )
}

export const hidate = (date: Date, timezone: string) => {
    return dayjs(date).tz(timezone)
}

export const DomeParam = createEnumParam<Dome>(['Keck 1', 'Keck 2'])

const TwoDView = ({ targets }: Props) => {
    const context = useStateContext()
    const today = hidate(new Date(), context.config.timezone).toDate()
    const [obsdate, setObsdate] = React.useState<Date>(today)
    const [dome, setDome] = useQueryParam<Dome>('dome', withDefault(DomeParam, 'Keck 2' as Dome))
    const [skyChart, setSkyChart] = React.useState<SkyChart>("Airmass")
    const [showMoon, setShowMoon] = React.useState(true)
    const [showCurrLoc, setShowCurrLoc] = React.useState(true)
    const [showLimits, setShowLimits] = React.useState(true)
    const [rotatorAngle, setRotatorAngle] = React.useState(0)
    const [positionAngle] = React.useState(0)
    const lngLatEl = context.config.tel_lat_lng_el[dome]
    const [suncalcTimes, setSuncalcTimes] = React.useState(util.get_suncalc_times(lngLatEl, obsdate))
    const [times, setTimes] = React.useState(util.get_times_using_nadir(suncalcTimes.nadir))
    const [time, setTime] = React.useState(suncalcTimes.nadir)
    const [targetView, setTargetView] = React.useState<TargetView[]>([])
    const [fovs, setFOVs] = React.useState<string[]>([])
    const [pointingOrigins, setPointingOrigins] = React.useState<POPointingOriginCollection | undefined>(undefined)
    const [selPointingOrigins, setSelPointingOrigins] = React.useState<POPointFeature[]>([])
    const [instrumentFOV, setInstrumentFOV] = useQueryParam('instrument_fov', withDefault(StringParam, 'MOSFIRE'))

    React.useEffect(() => {
        const fun = async () => {
            const featureCollection = await get_shapes('fov')
            const pos = await get_shapes('pointing_origins') as POPointingOriginCollection 
            const features = featureCollection['features'].filter((feature: any) => {
                return feature['properties'].type === 'FOV'
            })
            const newFovs = features.map((feature: any) => feature['properties'].instrument) as string[]
            setFOVs(newFovs)
            console.log('pointing origins', pos)
            setPointingOrigins(pos)
        }
        fun()
    }, [])

    React.useEffect(() => {
        const newSuncalcTimes = util.get_suncalc_times(lngLatEl, obsdate)
        const newTimes = util.get_times_using_nadir(newSuncalcTimes.nadir)
        const tviz: TargetView[] = []
        const geoModel = context.config.tel_geometry[dome]
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
                        ...alt_az_observable(alt, az, geoModel),
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
            console.log('dome', dome, 'obsdate', obsdate, 'skychart', skyChart)
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

    const save_img = () => {

        const doc = document.getElementById('aladin-lite-div') as HTMLElement

        console.log('doc', doc)
        html2canvas(doc).then((canvas) => {
            console.log('Canvas created')
            if (canvas) {
                console.log('saving canvas')
                const link = document.createElement('a');
                link.download = 'sky-chart.png';
                link.href = canvas.toDataURL();
                link.click();
            }
        }).finally(() => {
            console.log('Canvas saving process completed');
        });
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
                        <SkyChartDataSummary targetView={targetView} time={obsdate} dome={dome} />
                        <Stack direction='column'>
                            <MoonMarker
                                moonInfo={moonInfo}
                                datetime={time} width={width} height={height}
                            />
                        </Stack>
                    </Stack>
                </>
            </Grid2>
            <Grid2 size={{ xs: 4 }}>
                <Stack width="100%" direction="column" justifyContent='center' spacing={1}>
                    <FOVSelect 
                        fovs={fovs}
                    />
                    <POSelect
                        pointing_origins={pointingOrigins}
                        instrument={instrumentFOV}
                        selPointingOrigins={selPointingOrigins}
                        setSelPointingOrigins={setSelPointingOrigins}
                    />
                    <Tooltip title={'Rotator angle for Field of View'}>
                        <TextField
                            sx={{ width: '200px', margin: '6px' }}
                            label={'Rotator Angle'}
                            id="rotator-angle"
                            value={rotatorAngle}
                            onChange={(event) => setRotatorAngle(Number(event.target.value))}
                        />
                    </Tooltip>
                    <Tooltip title={'Save Image as a .png file'}>
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
                    width={width}
                    fovAngle={rotatorAngle}
                    positionAngle={positionAngle}
                    instrumentFOV={instrumentFOV}
                    pointingOrigins={selPointingOrigins}
                    targets={targets} />
            </Grid2>
        </Grid2 >
    );
}


export default TwoDView