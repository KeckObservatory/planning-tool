import React from 'react';
import * as util from './sky_view_util.tsx'
import NightPicker from '../two-d-view/night_picker'
import dayjs, { Dayjs } from 'dayjs';
import { Autocomplete, Box, FormControl, FormControlLabel, FormLabel, Grid2, IconButton, Radio, RadioGroup, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { useResizeObserver } from 'usehooks-ts';
import TimeSlider from './time_slider';
import { Target, useStateContext } from '../App.tsx';
import { DomeChart } from './dome_chart.tsx';
import { SkyChart } from './sky_chart.tsx';
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { VizRow } from './viz_dialog.tsx';
import { MoonMarker } from './moon_marker.tsx';
import * as SunCalc from "suncalc";
import { BooleanParam, StringParam, useQueryParam, withDefault } from 'use-query-params';
import { alt_az_observable, Dome, DomeParam, DomeSelect, get_moon_warnings, get_shapes, hidate, TargetView } from './two_d_view_common.tsx';
import { SkyChartDataSummary } from './sky_chart_data_summary.tsx';
import { FOVSelect } from './fov_select.tsx';
import { POPointFeature, POPointingOriginCollection, POSelect } from './pointing_origin_select.tsx';
import { get_image_catalogs } from '../api/api_root';
import { LazyFallback } from '../lazy_fallback';
import { SKY_VIEW_DEFAULT_WINDOW_SIZE, SKY_VIEW_MOSFIRE_WINDOW_SIZE } from './constants';

// d3 lives behind this import, so keep it lazy as the guide star dialog does.
const GSViewer = React.lazy(() => import('../guide_star/guide_star_viewer').then(m => ({ default: m.GSViewer })))

dayjs.extend(utc)
dayjs.extend(timezone)


interface Props {
    targets: Target[]
}

const height = 525
const width = 525

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

type FullscreenChart = 'sky' | 'dome' | null

interface ChartPanelProps {
    isFullscreen: boolean
    onToggleFullscreen: () => void
    children: (width: number, height: number) => React.ReactNode
}

const ChartPanel = ({ isFullscreen, onToggleFullscreen, children }: ChartPanelProps) => {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const { width: panelWidth = 0, height: panelHeight = 0 } = useResizeObserver({ ref: containerRef })

    return (
        <Box
            ref={containerRef}
            sx={{
                position: 'relative',
                width: isFullscreen ? 'min(85vw, 1400px)' : `${width}px`,
                height: isFullscreen ? '70vh' : `${height}px`,
            }}
        >
            <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                <IconButton
                    onClick={onToggleFullscreen}
                    size="small"
                    sx={{ position: 'absolute', top: 4, left: 4, zIndex: 1, bgcolor: 'background.paper' }}
                >
                    {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
            </Tooltip>
            {panelWidth > 0 && panelHeight > 0 && children(panelWidth, panelHeight)}
        </Box>
    )
}

const TwoDView = ({ targets }: Props) => {
    const context = useStateContext()
    const today = hidate(new Date(), context.config.timezone).toDate()
    const [obsdate, setObsdate] = React.useState<Date>(today)
    const [dome, setDome] = useQueryParam<Dome>('dome', withDefault(DomeParam, 'Keck 2' as Dome))
    const [skyChart, setSkyChart] = React.useState<SkyChart>("Elevation")
    const [showMoon, setShowMoon] = React.useState(true)
    const [showSchedule, setShowSchedule] = React.useState(false)
    const [showCurrLoc, setShowCurrLoc] = React.useState(true)
    const [showLimits, setShowLimits] = React.useState(true)
    const firstTarget = targets.find(t => t.ra_deg !== undefined && t.dec_deg !== undefined)
    const [rotatorAngle, setRotatorAngle] = React.useState(firstTarget?.rotator_pa ?? 0) // default to 0 if not provided
    const lngLatEl = context.config.tel_lat_lng_el[dome]
    const [suncalcTimes, setSuncalcTimes] = React.useState(util.get_suncalc_times(lngLatEl, obsdate))
    const [times, setTimes] = React.useState(util.get_times_using_nadir(suncalcTimes.nadir))
    const [time, setTime] = React.useState(suncalcTimes.nadir)
    const [targetView, setTargetView] = React.useState<TargetView[]>([])
    const [fovs, setFOVs] = React.useState<string[]>([])
    const [pointingOrigins, setPointingOrigins] = React.useState<POPointingOriginCollection | undefined>(undefined)
    const [selPointingOrigins, setSelPointingOrigins] = React.useState<POPointFeature[]>([])
    const [instrumentFOV, setInstrumentFOV] = useQueryParam('instrument_fov', withDefault(StringParam, 'MOSFIRE'))
    const [selPO, setSelPO] = React.useState<POPointFeature | undefined>(undefined)
    const [fullscreenChart, setFullscreenChart] = React.useState<FullscreenChart>(null)
    const [imageCatalog, setImageCatalog] = React.useState<string | undefined>(undefined)
    const [imageCatalogs, setImageCatalogs] = React.useState<string[]>([])
    const [imageLoading, setImageLoading] = React.useState<boolean>(false)
    const [selTargetName, setSelTargetName] = React.useState<string>('')

    // Sky image overlay controls, mirroring the guide star dialog (and sharing its URL params).
    const [invertImage, setInvertImage] = useQueryParam('invert_image', withDefault(BooleanParam, false))
    const [showTargets, setShowTargets] = React.useState<boolean>(true)

    const imgSize = instrumentFOV === 'MOSFIRE' ? SKY_VIEW_MOSFIRE_WINDOW_SIZE : SKY_VIEW_DEFAULT_WINDOW_SIZE

    // Targets need degree coordinates to be placed on the image.
    const skyTargets = React.useMemo(() => targets
        .filter((tgt) => (tgt.ra_deg !== undefined || tgt.ra) && (tgt.dec_deg !== undefined || tgt.dec))
        .map((tgt) => ({
            ...tgt,
            ra_deg: tgt.ra_deg ?? util.ra_dec_to_deg(String(tgt.ra), false),
            dec_deg: tgt.dec_deg ?? util.ra_dec_to_deg(String(tgt.dec), true),
        })), [targets])

    // The sky image is centred on the first target with coordinates (the viewer falls back to
    // its own default with none); other targets are plotted if they land on the image.
    const centerTarget = skyTargets.at(0)

    React.useEffect(() => {
        const fun = async () => {
            const pos = await get_shapes('pointing_origins') as POPointingOriginCollection
            console.log('pointing origins', pos)
            setPointingOrigins(pos)
            const imgCats = await get_image_catalogs()
            if (imgCats) {
                setImageCatalogs(imgCats)
                setImageCatalog(imgCats.at(0))
            }
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
                        moon_position,
                        lunar_angle: util.lunar_angle(ra_deg, dec_deg, datetime, lngLatEl, moon_position)
                    }
                    azEl.push([az, alt])
                    visibility.push(vis)
                })

                //include these limit crossings as well, i
                // so that the visibility plot shows the full 
                // range of the target's trajectory
                const limitedVisibility = util.add_limit_crossings(ra_deg, dec_deg, visibility, lngLatEl, geoModel)
                const vizSum = util.sum_observable_hours(limitedVisibility)
                const tgtv: TargetView = {
                    ...tgt,
                    date: obsdate,
                    dome,
                    ra_deg,
                    dec_deg,
                    visibility: limitedVisibility,
                    visibilitySum: vizSum
                }
                tviz.push(tgtv)
            }
        })

        const fun = async () => {
            const featureCollection = await get_shapes('fov')
            // an instrument has one collection per shape, so dedupe
            const newFovs = [...new Set(featureCollection
                .filter((collection) => collection.properties.dome === dome)
                .map((collection) => collection.properties.instrument))]
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

    const moonInfo = SunCalc.getMoonIllumination(time)
    const moonWarnings = React.useMemo(() => get_moon_warnings(targetView), [targetView])

    if (fullscreenChart) {
        return (
            <ChartPanel isFullscreen onToggleFullscreen={() => setFullscreenChart(null)}>
                {(panelWidth, panelHeight) => fullscreenChart === 'sky' ? (
                    <SkyChart
                        height={panelHeight}
                        width={panelWidth}
                        chartType={skyChart}
                        showLimits={showLimits}
                        targetView={targetView}
                        showMoon={showMoon}
                        showSchedule={showSchedule}
                        showCurrLoc={showCurrLoc}
                        times={times}
                        suncalcTimes={suncalcTimes}
                        time={time}
                        obsdate={obsdate}
                        dome={dome}
                    />
                ) : (
                    <DomeChart
                        height={panelHeight}
                        width={panelWidth}
                        targetView={targetView}
                        showMoon={showMoon}
                        showCurrLoc={showCurrLoc}
                        times={times}
                        time={time}
                        dome={dome}
                    />
                )}
            </ChartPanel>
        )
    }

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
                        <FormControlLabel
                            label="Show Schedule"
                            value={showSchedule}
                            control={<Switch checked={showSchedule} />}
                            onChange={(_, checked) => setShowSchedule(checked)}
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
                                lngLatEl={lngLatEl}
                                obsdate={obsdate}
                                width={width} 
                                height={height}
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
                    {
                        pointingOrigins && (
                            // POSelect renders two dropdowns as siblings; keep them side by side.
                            <Stack direction='row' alignItems='flex-start'>
                                <POSelect
                                    pointing_origins={pointingOrigins}
                                    instrument={instrumentFOV}
                                    selPointingOrigins={selPointingOrigins}
                                    setSelPointingOrigins={setSelPointingOrigins}
                                    selPO={selPO}
                                    setSelPO={setSelPO}
                                />
                            </Stack>
                        )
                    }
                    <Stack direction='row' spacing={1} justifyContent='left'>
                        <Tooltip title={'Rotator angle for Field of View'}>
                            <TextField
                                sx={{ width: '200px', margin: '6px' }}
                                label={'Rotator Angle'}
                                id="rotator-angle"
                                value={rotatorAngle}
                                onChange={(event) => setRotatorAngle(Number(event.target.value))}
                            />
                        </Tooltip>
                        {imageCatalog && (
                            <Tooltip title={'Select Image Catalog'}>
                                <Autocomplete
                                    disablePortal
                                    id="two-d-view-image-catalog"
                                    value={imageCatalog}
                                    onChange={(_, value) => value && setImageCatalog(value)}
                                    options={imageCatalogs}
                                    sx={{ width: '200px', margin: '6px' }}
                                    renderInput={(params) => <TextField {...params} label={'Image Catalog'} />}
                                />
                            </Tooltip>
                        )}
                    </Stack>
                    <Stack direction='row' sx={{ flexWrap: 'wrap', paddingLeft: '6px' }}>
                        <FormControlLabel
                            label="Invert Image"
                            control={<Switch checked={invertImage} />}
                            onChange={(_, checked) => setInvertImage(checked)}
                        />
                        <FormControlLabel
                            label="Show Targets"
                            control={<Switch checked={showTargets} />}
                            onChange={(_, checked) => setShowTargets(checked)}
                        />
                    </Stack>
                </Stack>
            </Grid2>
            <Grid2 size={{ xs: 8 }}>
                <Stack width="100%" spacing={0.5} sx={{ marginBottom: '4px' }}>
                    {moonWarnings.map((warning) => (
                        <Typography
                            key={warning.target_name}
                            variant="body2"
                            sx={{
                                color: warning.level === 'heavy' ? 'error.main' : 'warning.main',
                                fontWeight: 'bold'
                            }}
                        >
                            Target {warning.target_name} passes within {warning.lunar_angle.toFixed(1)} degrees of the moon this night
                        </Typography>
                    ))}
                </Stack>
                <Stack sx={{}} width="100%" direction="row" justifyContent='center' spacing={1}>
                    <ChartPanel isFullscreen={false} onToggleFullscreen={() => setFullscreenChart('dome')}>
                        {(panelWidth, panelHeight) => (
                            <DomeChart
                                height={panelHeight}
                                width={panelWidth}
                                targetView={targetView}
                                showMoon={showMoon}
                                showCurrLoc={showCurrLoc}
                                times={times}
                                time={time}
                                dome={dome}
                            />
                        )}
                    </ChartPanel>
                    <ChartPanel isFullscreen={false} onToggleFullscreen={() => setFullscreenChart('sky')}>
                        {(panelWidth, panelHeight) => (
                            <SkyChart
                                height={panelHeight}
                                width={panelWidth}
                                chartType={skyChart}
                                showLimits={showLimits}
                                targetView={targetView}
                                showMoon={showMoon}
                                showSchedule={showSchedule}
                                showCurrLoc={showCurrLoc}
                                times={times}
                                suncalcTimes={suncalcTimes}
                                time={time}
                                obsdate={obsdate}
                                dome={dome}
                            />
                        )}
                    </ChartPanel>
                </Stack>
            </Grid2>
            <Grid2 size={{ xs: 4 }}>
                <Box sx={{ position: 'relative', width, height }}>
                    {imageLoading && (
                        <Typography
                            sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontSize: '24px',
                                fontWeight: 'bold',
                                color: 'white',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                padding: '16px',
                                borderRadius: '8px',
                                zIndex: 10
                            }}
                        >
                            Loading...
                        </Typography>
                    )}
                    <React.Suspense fallback={<LazyFallback height={height} />}>
                        <GSViewer
                            key={instrumentFOV} // reset zoom/pan to the instrument's default
                            markerMode='target'
                            imageCatalog={imageCatalog}
                            guideStars={skyTargets}
                            height={height}
                            width={width}
                            size={imgSize} // in degrees
                            centerRA={centerTarget?.ra_deg}
                            centerDec={centerTarget?.dec_deg}
                            guideStarName={selTargetName}
                            setGuideStarName={setSelTargetName}
                            setImageLoading={setImageLoading}
                            instrumentFOV={instrumentFOV}
                            fovAngle={Number(rotatorAngle)}
                            selPO={selPO}
                            pointingOrigins={selPointingOrigins}
                            invertImage={invertImage}
                            showCatalog={showTargets}
                        />
                    </React.Suspense>
                </Box>
            </Grid2>
        </Grid2 >
    );
}


export default TwoDView