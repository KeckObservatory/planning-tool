import React from "react"
import { ra_dec_to_deg } from './two-d-view/sky_view_util.tsx'
import { Target } from "./App"
import A from 'aladin-lite'
import { useDebounceCallback } from "./use_debounce_callback.tsx"
import { Autocomplete, TextField, Tooltip, Typography } from '@mui/material'

const FOVlink = 'INSTRUMENTS_FOV.json'
const instruments = ['KCWI', 'MOSFIRE']

interface Props {
    targets: Target[]
}

const format_target_coords = (ra: string | number, dec: string | number) => {
    const coords = `${ra} ${dec}`
    return coords
}

interface PolylineProps {
    points: [number, number][]

}

const PolylineComponent = (props: PolylineProps) => {
    let pointsStr = "";
    props.points.forEach(val => {
        pointsStr += `${val[0]},${val[1]} `;
    });

    const style = {
        'position': 'absolute',
        'stroke': 'green',
        'strokeWidth': '2',
        'fillRule': 'evenodd',
        'pointerEvents': 'none' // lets clicks go through underneath el
    }
    return (
        <div className='fov-overlay' style={style as any}>
            <svg width="600" fill="none" height="600">
                <polyline points={pointsStr} />
            </svg>
        </div>
    )
}

const get_fov = async (aladin: any, instrument: string) => {
    const resp = await fetch(FOVlink)
    const data = await resp.text()
    const json = JSON.parse(data)
    console.log('json', json)
    const feature = json['features'].find((f: any) => f['properties']['instrument'] === instrument)
    const multipolygon = feature['geometry']['coordinates']
    const [ra0, dec0] = aladin.getRaDec()
    const polygons = multipolygon.map((polygon: [number, number][]) => {
        let p = [...polygon, polygon[0]]
        p = p
            .map((point: [number, number]) => {
                return [point[0] / 3600 + ra0, point[1] / 3600 + dec0]
            })
            .map((pt) => {
                const pix = aladin.world2pix(...pt) as [number, number]
                return pix as [number, number]
            })
        return p
    })
    console.log('polygons', polygons)
    return polygons as [number, number][][]
}

export default function Aladin(props: Props) {

    const [fov, setFOV] = React.useState([] as [number, number][][])
    const [instrument, setInstrument] = React.useState('KCWI')
    const [aladin, setAladin] = React.useState<null | any>(null)
    const [zoom, setZoom] = React.useState(2)

    const add_catalog = (alad: any, targets: Target[]) => {
        var cat = A.catalog({ name: 'Targets', sourceSize: 18 });
        alad.addCatalog(cat);

        alad.on('objectClicked', function (object: any) {
            if (object) {
                console.log('objectClicked', object)
            }
        })

        alad.on('zoomChanged', function (zoom: number) {
            setZoom(zoom)
        })

        alad.on('objectHovered', function (object: any) {
            if (object) console.log('objectHovored', object.data?.id0)
        })

        for (let idx = 0; idx < targets.length; idx++) {
            const tgt = targets[idx]
            const options = {
                idx: idx,
                popupTitle: tgt.target_name,
                //TODO: style popup according to theme
                popupDesc: `< t style = { color: "black", text- color: "black"
}> RA: ${tgt.ra} <br /> Dec: ${tgt.dec}</t > `
            }
            tgt.ra &&
                cat.addSources(
                    A.marker(ra_dec_to_deg(tgt.ra as string),
                        ra_dec_to_deg(tgt.dec as string, true), options));
        }
    }

    const scriptloaded = () => {
        console.log('script loaded', props)
        const firstRow = props.targets[0]
        let params: any = { survey: 'P/DSS2/color', zoom: zoom, showReticle: true }
        if (firstRow?.ra) {
            let ra = ra_dec_to_deg(firstRow.ra as string)
            let dec = ra_dec_to_deg(firstRow.dec as string, true)
            const coords = format_target_coords(ra, dec)
            params['target'] = coords
        }

        A.init.then(async () => {
            const alad = A.aladin('#aladin-lite-div', params);
            setAladin(alad)
            setFOV(await get_fov(alad, instrument))
            add_catalog(alad, props.targets)
        })
    }

    React.useEffect(() => {
        scriptloaded()
    }, [])

    React.useEffect(() => {
        const update_inst = async () => {
            setFOV(await get_fov(aladin, instrument))
        }
        update_inst()
    }, [instrument, zoom])

    React.useEffect(() => {
    }, [props.targets])

    const onChange = (value: string | undefined | null) => {
        if (value) {
            setInstrument(value)
        }
    }


    return (
        <>
            <Tooltip placement="top" title="Select semid">
                <Autocomplete
                    disablePortal
                    id="semid-selection"
                    value={{ label: instrument }}
                    onChange={(_, value) => onChange(value?.label)}
                    options={instruments.map((instr) => { return { label: instr } })}
                    sx={{ width: 300, margin: '6px'}}
                    renderInput={(params) => <TextField {...params} label="Instrument FOV" />}
                />
            </Tooltip>
            <div id='aladin-lite-div' style={{ margin: '6px', width: '600px', height: '600px' }} >
                {fov.map(f => <PolylineComponent points={f} />)}
            </div>
        </>
    )
}
