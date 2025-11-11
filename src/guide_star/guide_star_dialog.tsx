import React, { useState, useEffect } from 'react'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import AladinViewer from '../aladin';

import { Target, useStateContext } from '../App';
import { Autocomplete, Stack, TextField } from '@mui/material';
import { DialogComponent } from '../dialog_component';
import GuideStarTable from './guide_star_table';
import { ra_dec_to_deg } from '../catalog_button';
import { FOVSelect } from '../two-d-view/fov_select';
import { get_shapes } from '../two-d-view/two_d_view';
import { StringParam, useQueryParam, withDefault } from 'use-query-params';
import { get_catalog_targets, get_catalogs } from '../api/api_root';
import UploadDialog from '../upload_targets_dialog';
import { POPointFeature, POPointingOriginCollection, POSelect } from '../two-d-view/pointing_origin_select';

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

const height = 500
const width = 500

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
    const [instrumentFOV] = useQueryParam('instrument_fov', withDefault(StringParam, 'MOSFIRE'))
    const [fovs, setFOVs] = React.useState<string[]>([])
    const [pointingOrigins, setPointingOrigins] = React.useState<POPointingOriginCollection | undefined>(undefined)
    const [selPointingOrigins, setSelPointingOrigins] = React.useState<POPointFeature[]>([])

    let initTarget = targets.at(0) ?? {} as Target
    const [target, setTarget] = useState<Target>(initTarget)
    const [guidestars, setGuideStars] = useState<Partial<Target>[]>([])

    const [catalog, setCatalog] = useState<string | undefined>(undefined)
    const [catalogs, setCatalogs] = useState<string[]>([])

    useEffect(() => {
        const fun = async () => {
            const cats = await get_catalogs()

            console.log('available catalogs:', cats, 'setting catalog to:', cats.at(0))
            setCatalogs(cats)
            setCatalog(cats.at(0))
        }
        fun()
    }, [])

    useEffect(() => {
        if (targets.length > 0) {
            const target = targets.at(0) ?? {} as Target
            setTarget(target)
        }
    }, [targets])

    useEffect(() => {
        const fun = async () => {
            const ra = target.ra_deg ?? ra_dec_to_deg(String(target.ra ?? 0))
            const dec = target.dec_deg ?? ra_dec_to_deg(String(target.dec ?? 0), true)
            if (catalog) {
                const gs = await get_catalog_targets(catalog, ra, dec, 0.5)

                const gsTgts = gs.map((star: CatalogTarget) => {
                    const tgt = guidestar_to_target(star, context.config.catalog_to_target_map)
                    return tgt
                })

                console.log('setting guide stars:', gs)
                setGuideStars(gsTgts)
            }
        }
        fun()
    }, [catalog, target])

    React.useEffect(() => {
        const fun = async () => {
            const featureCollection = await get_shapes('fov')
            const pos = await get_shapes('pointing_origins') as POPointingOriginCollection
            const features = featureCollection['features'].filter((feature: any) => {
                return feature['properties'].type === 'FOV'
            })
            const newFovs = features.map((feature: any) => feature['properties'].instrument) as string[]
            setFOVs(newFovs)
            setPointingOrigins(pos)
            console.log('pointing origins', pos)
        }
        fun()
    }, [])

    const onGuideStarNameSelect = (name: string) => {
        if (name !== guideStarName) { //ignore setting guide star if the target is selected
            let newGuideStar = guidestars.find((gs: Partial<Target>) => gs.target_name === name)
            if (newGuideStar) {
                setGuideStarName(name)
            }
        }
    }

    const onTargetNameSelect = (name: string) => {
        const targetName = target.target_name ?? target._id
        if (name !== targetName) {
            let newTarget = targets.find((t: Target) => t.target_name === name || t._id === name)
            newTarget = (newTarget && newTarget.ra && newTarget.dec) ? newTarget : {} as Target
            setTarget(newTarget)
        }
    }

    const dialogTitle = (
        <span>Guide Star Selection</span>
    )

    const dialogContent = (
        <Stack
            sx={{
                paddingTop: '16px',
                display: 'flex',
                flexWrap: 'wrap',
            }}
            direction='column'>
            <Stack direction='row' spacing={1}>
                {
                    catalog && (
                        <Tooltip title={'Select Guide Star from Catalog'}>
                            <Autocomplete
                                disablePortal
                                id="selected-catalog"
                                value={catalog}
                                onChange={(_, value) => value && (setCatalog(value))}
                                options={catalogs}
                                sx={{ width: 200 }}
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
                        sx={{ width: 200 }}
                        renderInput={(params) => <TextField {...params} label={'Selected Target'} />}
                    />
                </Tooltip>
                <FOVSelect
                    fovs={fovs}
                />
                <POSelect
                    pointing_origins={pointingOrigins}
                    instrument={instrumentFOV}
                    selPointingOrigins={selPointingOrigins}
                    setSelPointingOrigins={setSelPointingOrigins}
                />
                <UploadDialog
                    setTargets={setGuideStars}
                />
            </Stack>
            <Stack direction='row' spacing={2} sx={{ marginTop: '16px' }}>
                {
                    guidestars.length > 0 &&
                    (<AladinViewer
                        targets={[target]}
                        guideStars={guidestars}
                        positionAngle={target.rotator_pa ?? 0}
                        fovAngle={0}
                        instrumentFOV={instrumentFOV}
                        height={height}
                        width={width}
                        selectCallback={onGuideStarNameSelect}
                        selectedGuideStarName={guideStarName}
                    />)
                }
                <GuideStarTable
                    selectedGuideStarName={guideStarName}
                    setSelectedGuideStarName={setGuideStarName}
                    guidestars={guidestars}
                    setRows={setRows}
                    science_target_name={target.target_name ?? target._id}
                />
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
        />
    )
}
