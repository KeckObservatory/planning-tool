import React, { useState, useEffect } from 'react'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

import { Target, useStateContext } from '../App';
import { Autocomplete, Stack, TextField, Switch, FormControlLabel, Typography } from '@mui/material';
import { DialogComponent } from '../dialog_component';
import GuideStarTable from './guide_star_table';
import { ra_dec_to_deg } from '../catalog_button';
import { FOVSelect } from '../two-d-view/fov_select';
import { Dome, DomeParam, DomeSelect, get_shapes } from '../two-d-view/two_d_view';
import { ArrayParam, BooleanParam, StringParam, useQueryParam, withDefault } from 'use-query-params';
import { get_catalog_targets, get_catalogs, get_image_catalogs, get_catalog_image } from '../api/api_root';
import UploadDialog from '../upload_targets_dialog';
import { LaserContours, POPointFeature, POPointingOriginCollection, POSelect } from '../two-d-view/pointing_origin_select';
import { NGSViewer } from './NGSViewer';
// import AladinViewer from '../aladin/aladin';
import { MagRangeSlider } from './mag_range_slider';
import { MOSFIRE_WINDOW_SIZE, DEFAULT_WINDOW_SIZE, DEFAULT_RA, DEFAULT_DEC } from '../two-d-view/constants';
import { MuiChipsInput } from 'mui-chips-input';

export interface CatalogTarget {
    name: string;
    ra: string;
    dec: string;
    equinox: number;
    pm_ra: number;
    pm_dec: number;
    dra: number;
    ddec: number;
    jmag: number;
    rmag: number;
    vmag: number;
    hmag: number;
    kmag: number;
    spec_type: string | null
    galaxy: number
    dist: number
    "B-V": number
    "B-R": number
}

interface ButtonProps {
    targets: Target[]
    setRows: React.Dispatch<React.SetStateAction<Target[]>>
}

export interface TargetViz extends Target {
}

interface VizDialogProps {
    open: boolean,
    setRows: React.Dispatch<React.SetStateAction<Target[]>>
    targets: Target[]
    handleClose: () => void
}

export const GuideStarButton = (props: ButtonProps) => {

    const { targets, setRows } = props
    const [open, setOpen] = React.useState(false);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            <Tooltip title={`Click to find and add guide stars for selected target(s)`}>
                <IconButton color="primary" onClick={handleClickOpen}>
                    <AutoAwesomeIcon />
                </IconButton>
            </Tooltip>
            {open &&
                <GuideStarDialog
                    open={open}
                    targets={targets}
                    handleClose={handleClose}
                    setRows={setRows}
                />
            }
        </>
    );
}

export const guidestar_to_target = (guidestar: CatalogTarget, mapping: object): Partial<Target> => {
    let tgt = Object.fromEntries(Object.entries(guidestar).map(([key, value]) => {
        if (key in mapping) {
            return [mapping[key as keyof object], value];
        } else {
            return [key, value];
        }

    }));
    tgt.ra = tgt.ra.replace(/\s+/g, '');
    tgt.dec = tgt.dec.replace(/\s+/g, '');
    tgt.ra_deg = tgt.ra_deg ?? ra_dec_to_deg(tgt.ra as string);
    tgt.dec_deg = tgt.dec_deg ?? ra_dec_to_deg(tgt.dec as string, true);
    return tgt;
}


export const GuideStarDialog = (props: VizDialogProps) => {
    // target must have ra dec and be defined

    const context = useStateContext()
    const { targets, open, setRows } = props
    const [guideStarName, setGuideStarName] = useState<string>('')
    const [instrumentFOV, setInstrumentFOV] = useQueryParam('instrument_fov', withDefault(StringParam, 'MOSFIRE'))
    const init_img_size = instrumentFOV === 'MOSFIRE' ? MOSFIRE_WINDOW_SIZE : DEFAULT_WINDOW_SIZE 
    const [imgSize, setImgSize] = useState<number>(init_img_size)
    const [magRange, setMagRange] = useQueryParam('mag_range', withDefault(ArrayParam, undefined)) //set to undefined to prevent unwanted rerenders on initial load
    const [fovs, setFOVs] = React.useState<string[]>([])
    const [pointingOrigins, setPointingOrigins] = React.useState<POPointingOriginCollection | undefined>(undefined)
    const [contours, setContours] = React.useState<LaserContours>([])
    const [trickMap, setTrickMap] = React.useState<any>(undefined)
    const [selPointingOrigins, setSelPointingOrigins] = React.useState<POPointFeature[]>([])
    const [selPO, setSelPO] = React.useState<POPointFeature | undefined>(undefined)
    const [useLaser, setUseLaser] = useQueryParam('show_laser', withDefault(BooleanParam, true))
    const [showTrickMap, setShowTrickMap] = useQueryParam('show_trick_map', withDefault(BooleanParam, false))
    const [invertImage, setInvertImage] = useQueryParam('invert_image', withDefault(BooleanParam, false))
    const [rotatorAngle, setRotatorAngle] = React.useState(0)

    const [dome, setDome] = useQueryParam<Dome>('dome', withDefault(DomeParam, 'Keck 2' as Dome))

    let initTarget = targets.at(0) ?? {} as Target
    const initTags = initTarget.tags ? [...initTarget.tags, initTarget.target_name, ''] : []
    const [tags, setTags] = React.useState<string[]>(initTags.filter((tag): tag is string => typeof tag === 'string'))
    const [target, setTarget] = useState<Target>(initTarget)
    const [guidestars, setGuideStars] = useState<Partial<Target>[]>([])

    const [image, setImage] = useState<string | undefined>(undefined)
    const [imageLoading, setImageLoading] = useState<boolean>(false)
    const [catalogLoading, setCatalogLoading] = useState<boolean>(false)

    const [catalog, setCatalog] = useState<string | undefined>(undefined)
    const [catalogs, setCatalogs] = useState<string[]>([])

    const [imageCatalog, setImageCatalog] = useState<string | undefined>(undefined)
    const [imageCatalogs, setImageCatalogs] = useState<string[]>([])

    useEffect(() => {
        console.log('fetching catalogs and shapes')

        const fetch_and_set_catalogs = async () => {
            const cats = await get_catalogs()
            if (cats) {
                setCatalogs(cats)
                setCatalog(cats.at(0))
            }
            const getImageCat = await get_image_catalogs()
            if (getImageCat) {
                setImageCatalogs(getImageCat)
                setImageCatalog(getImageCat.at(0))
            }
        }

        const fetch_and_set_shapes = async () => {
            const featureCollection = await get_shapes('fov')
            const pos = await get_shapes('pointing_origins') as POPointingOriginCollection
            const cntrs = useLaser ? await get_shapes('laser_contours') : await get_shapes('fsm')
            const trkMap = showTrickMap ? await get_shapes('trick_map') : undefined
            const domeFovFeatures = featureCollection['features'].filter((feature: any) => {
                return feature['properties'].type === 'FOV'
            }).filter((feature: any) => {
                return feature['properties'].dome === dome
            })
            const newFovs = domeFovFeatures.map((feature: any) => feature['properties'].instrument) as string[]
            setFOVs(newFovs)
            setPointingOrigins(pos)
            setContours(cntrs as unknown as LaserContours)
            setTrickMap(trkMap)
        }

        fetch_and_set_catalogs()
        fetch_and_set_shapes()

    }, [])

    useEffect(() => {  //refetch image when fov changes
        setImgSize(instrumentFOV === 'MOSFIRE' ? MOSFIRE_WINDOW_SIZE : DEFAULT_WINDOW_SIZE)
     }, [instrumentFOV])

    useEffect(() => {
        const fetch_and_set_laser_contours = async () => {
            const cntrs = useLaser ? await get_shapes('laser_contours') : await get_shapes('fsm')
            const trkMap = showTrickMap ? await get_shapes('trick_map') : undefined
            setContours(cntrs as unknown as LaserContours)
            setTrickMap(trkMap)
        }
        fetch_and_set_laser_contours()
    }, [useLaser, showTrickMap])

    useEffect(() => {
        if (targets.length > 0) {
            const target = targets.at(0) ?? {} as Target
            setTarget(target)
        }
    }, [targets])

    useEffect(() => {
        const handle_dome_change = async () => {
            if (dome === 'Keck 1') {
                setShowTrickMap(false)
            }
            const featureCollection = await get_shapes('fov')
            const domeFovFeatures = featureCollection['features'].filter((feature: any) => {
                return feature['properties'].type === 'FOV' && feature['properties'].dome === dome
            })
            const newFovs = domeFovFeatures.map((feature: any) => feature['properties'].instrument) as string[]
            setFOVs(newFovs)
            setInstrumentFOV(newFovs.at(0) ?? '')
        }
        handle_dome_change()
    }, [dome])

    useEffect(() => {
        const fun = async () => {
            const ra = target.ra_deg ?? ra_dec_to_deg(String(target.ra ?? DEFAULT_RA))
            const dec = target.dec_deg ?? ra_dec_to_deg(String(target.dec ?? DEFAULT_DEC), true)
            if (catalog) {
                setCatalogLoading(true)
                const mr = Array.isArray(magRange) && magRange.length >= 2 ?
                    [String(magRange[0]), String(magRange[1])] as [string, string] : undefined
                const gs = await get_catalog_targets(
                    catalog,
                    ra,
                    dec,
                    imgSize,
                    mr
                )
                if (gs) {
                    const gsTgts = gs.map((star: CatalogTarget) => {
                        const tgt = guidestar_to_target(star, context.config.catalog_to_target_map)
                        return tgt
                    })
                    setGuideStars(gsTgts)
                }
                setCatalogLoading(false)

            }
            if (imageCatalog) {
                setImageLoading(true)
                const img = get_catalog_image(imageCatalog, ra, dec, imgSize)
                setImage(img)
            }

        }
        fun()
    }, [catalog, target, imageCatalog, imgSize])

    useEffect(() => {
        const fun = async () => {
            setCatalogLoading(true)
            const ra = target.ra_deg ?? ra_dec_to_deg(String(target.ra ?? 0))
            const dec = target.dec_deg ?? ra_dec_to_deg(String(target.dec ?? 0), true)
            const mr = Array.isArray(magRange) && magRange.length >= 2 ? [String(magRange[0]), String(magRange[1])] as [string, string] : undefined
            if (catalog) {
                console.log('mag range changed. fetching catalog targets with mag range', mr)
                const gs = await get_catalog_targets(
                    catalog,
                    ra,
                    dec,
                    imgSize,
                    mr
                )
                if (gs) {
                    const gsTgts = gs.map((star: CatalogTarget) => {
                        const tgt = guidestar_to_target(star, context.config.catalog_to_target_map)
                        return tgt
                    })
                    setGuideStars(gsTgts)
                }
                setCatalogLoading(false)
            }
        }
        fun()
    }, [magRange, instrumentFOV])


    const onTargetNameSelect = (name: string) => {
        const targetName = target.target_name ?? target._id
        if (name !== targetName) {
            let newTarget = targets.find((t: Target) => t.target_name === name || t._id === name)
            newTarget = (newTarget && newTarget.ra && newTarget.dec) ? newTarget : {} as Target
            setTarget(newTarget)
        }
    }

    // const onGuideStarNameSelect = (name: string) => {
    //     if (name !== guideStarName) { //ignore setting guide star if the target is selected
    //         let newGuideStar = guidestars.find((gs: Partial<Target>) => gs.target_name === name)
    //         if (newGuideStar) {
    //             setGuideStarName(name)
    //         }
    //     }
    // }

    const dialogTitle = (
        <span>Guide Star Selection</span>
    )

    const telContours = contours?.find((feature) => feature.properties.telescope === dome)
    const centerRa = target.ra_deg ?? ra_dec_to_deg(String(target.ra ?? 0))
    const centerDec = target.dec_deg ?? ra_dec_to_deg(String(target.dec ?? 0), true)

    const dialogContent = (
        <Stack
            sx={{
                paddingTop: '16px',
                display: 'flex',
                flexWrap: 'wrap',
            }}
            direction='column'>
            <Stack direction='row' spacing={0}>
                {
                    imageCatalog && (
                        <Tooltip title={'Select Image Catalog'}>
                            <Autocomplete
                                disablePortal
                                id="selected-image-catalog"
                                value={imageCatalog}
                                onChange={(_, value) => value && (setImageCatalog(value))}
                                options={imageCatalogs}
                                sx={{ width: '150px', paddingTop: '9px', margin: '6px' }}
                                renderInput={(params) => <TextField {...params} label={'Selected Image Catalog'} />}
                            />
                        </Tooltip>
                    )
                }
                {
                    catalog && (
                        <Tooltip title={'Select Guide Star from Catalog'}>
                            <Autocomplete
                                disablePortal
                                id="selected-catalog"
                                value={catalog}
                                onChange={(_, value) => value && (setCatalog(value))}
                                options={catalogs}
                                sx={{ width: '150px', paddingTop: '9px', margin: '6px' }}
                                renderInput={(params) => <TextField {...params} label={'Selected Catalog'} />}
                            />
                        </Tooltip>
                    )
                }
                <Tooltip title={'Target'}>
                    <Autocomplete
                        disablePortal
                        id="selected-target"
                        value={target.target_name ?? target._id}
                        onChange={(_, value) => value && onTargetNameSelect(value)}
                        options={targets.map(target => target.target_name ?? target._id)}
                        sx={{ width: '200px', paddingTop: '9px', margin: '6px' }}
                        renderInput={(params) => <TextField {...params} label={'Selected Target'} />}
                    />
                </Tooltip>
                <Tooltip title={'Rotator angle for Field of View'}>
                    <TextField
                        sx={{ width: '100px', paddingTop: '9px', margin: '6px' }}
                        label={'Rotator Angle'}
                        id="rotator-angle"
                        value={rotatorAngle}
                        onChange={(event) => setRotatorAngle(Number(event.target.value))}
                    />
                </Tooltip>
                <FOVSelect
                    fovs={fovs}
                />
                {pointingOrigins && (
                    <POSelect
                        pointing_origins={pointingOrigins}
                        instrument={instrumentFOV}
                        selPointingOrigins={selPointingOrigins}
                        setSelPointingOrigins={setSelPointingOrigins}
                        selPO={selPO}
                        setSelPO={setSelPO}
                    />
                )}
                <MuiChipsInput
                    sx={{ width: '500px', paddingTop: '9px', margin: '6px' }}
                    value={tags}
                    onChange={(value) => setTags(value)}
                    label={tags.length === 0 ? "Add Tags" : "Edit Tags"}
                    id="tags"
                />
            </Stack>
            <Stack direction='row' spacing={0}>
                <UploadDialog
                    setTargets={setGuideStars}
                />
                <FormControlLabel
                    label="Invert Image"
                    value={invertImage}
                    control={<Switch checked={invertImage} />}
                    onChange={(_, checked) => setInvertImage(checked)}
                />
                <FormControlLabel
                    label="Show Laser"
                    value={useLaser}
                    control={<Switch checked={useLaser} />}
                    onChange={(_, checked) => setUseLaser(checked)}
                />
                <FormControlLabel
                    label="Show Trick Map"
                    value={showTrickMap}
                    control={<Switch checked={showTrickMap} />}
                    onChange={(_, checked) => setShowTrickMap(checked)}
                />
                <DomeSelect
                    dome={dome}
                    setDome={setDome}
                />
                <MagRangeSlider
                    range={magRange as [string, string]}
                    setRange={setMagRange}
                />
            </Stack>
            <Stack direction='row' justifyContent={'center'} spacing={2} sx={{ marginTop: '16px' }}>
                <Stack direction='column' sx={{ position: 'relative', display: 'inline-block' }}>
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
                    {
                        < NGSViewer
                            imgUrl={image ?? ''}
                            guideStars={guidestars as Target[]}
                            height={600}
                            width={600}
                            size={imgSize} // in degrees
                            centerRA={centerRa} // in degrees
                            centerDec={centerDec} // in degrees
                            guideStarName={guideStarName}
                            setGuideStarName={setGuideStarName}
                            setImageLoading={setImageLoading}
                            instrumentFOV={instrumentFOV}
                            fovAngle={rotatorAngle}
                            positionAngle={target.rotator_pa ? Number(target.rotator_pa) : 0}
                            selPO={selPO}
                            pointingOrigins={selPointingOrigins}
                            invertImage={invertImage}
                            showLaser={true}
                            contours={telContours}
                            showTrickMap={showTrickMap}
                            trickMap={trickMap}
                        />
                    }
                    {/* {
                        guidestars.length > 0 &&
                        (<AladinViewer
                            targets={[target]}
                            guideStars={guidestars}
                            positionAngle={target.rotator_pa ? Number(target.rotator_pa) : 0}
                            pointingOrigins={selPointingOrigins}
                            fovAngle={rotatorAngle}
                            selPO={selPO}
                            setSelPO={setSelPO}
                            instrumentFOV={instrumentFOV}
                            height={500}
                            width={500}
                            selectCallback={onGuideStarNameSelect}
                            selectedGuideStarName={guideStarName}
                            contours={telContours}
                        />)
                    } */}
                </Stack>
                <Stack direction='column' justifyContent='center' sx={{ position: 'relative', display: 'inline-block' }}>
                    {catalogLoading && (
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
                            Catalog Loading...
                        </Typography>
                    )}
                    <GuideStarTable
                        selectedGuideStarName={guideStarName}
                        setSelectedGuideStarName={setGuideStarName}
                        guidestars={guidestars}
                        setRows={setRows}
                        useLaser={useLaser}
                        science_target_name={target.target_name ?? target._id}
                    />
                </Stack>
            </Stack>
        </Stack>
    )

    return (
        <DialogComponent
            open={open}
            handleClose={props.handleClose}
            titleContent={dialogTitle}
            children={dialogContent}
            maxWidth="xl"
            minWidth={1600}
        />
    )
}

