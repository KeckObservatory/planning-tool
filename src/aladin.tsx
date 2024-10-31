import React from "react"
import { ra_dec_to_deg } from './two-d-view/sky_view_util.tsx'
import { Target } from "./App"
import A from 'aladin-lite'
import { Autocomplete, TextField, Tooltip } from '@mui/material'

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
    return polygons as [number, number][][]
}



export default function AladinViewer(props: Props) {
    console.log('aladin viewer init', props)

    const [fov, setFOV] = React.useState([] as [number, number][][])
    const [instrument, setInstrument] = React.useState('KCWI')
    const [aladin, setAladin] = React.useState<null | any>(null)
    //const [zoom, setZoom] = React.useState(360) //for whole sky
    const [zoom, setZoom] = React.useState(2)

        // define custom draw function
        const drawFunction = function(source: any, canvasCtx: any) {
            canvasCtx.beginPath();
            canvasCtx.arc(source.x, source.y, 2, 0, 2 * Math.PI, false);
            canvasCtx.closePath();
            //canvasCtx.strokeStyle = '#c38';
            canvasCtx.fillStyle = source.catalog.color;
            canvasCtx.lineWidth = 1
            canvasCtx.stroke();
            canvasCtx.fill();
        };

    const add_catalog = (alad: any, targets: Target[], name='Targets') => {
        //var cat = A.catalog({ name: name, sourceSize: 4, shape: drawFunction});
        var cat = A.catalog({ name: name, shape: drawFunction});
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
                popupTitle: tgt.target_name + JSON.stringify(idx),
                size: 4,
                //TODO: style popup according to theme
                popupDesc: `< t style = { color: "black", text- color: "black"
}> RA: ${tgt.ra} <br /> Dec: ${tgt.dec}</t > `
            }
            const ra = tgt.ra ? ra_dec_to_deg(tgt.ra as string) : tgt.ra_deg
            const dec = tgt.dec ? ra_dec_to_deg(tgt.ra as string,true) : tgt.dec_deg
            if (ra && dec) {
                cat.addSources( A.marker(ra,dec , options));
            }
            // tgt.ra &&
            //     cat.addSources(
            //         A.marker(ra_dec_to_deg(tgt.ra as string),
            //             ra_dec_to_deg(tgt.dec as string, true), options));
        }
    }

    const scriptloaded = async () => {
        console.log('script loaded', props)
        const firstRow = props.targets[0]
        let params: any = { survey: 'P/DSS2/color', projection: 'MOL', zoom: zoom, showReticle: true }
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
            // //@ts-ignore
            // const result = Object.groupBy(props.targets, ({ target_name}) => target_name);
            // console.log('adding catalog')
            // for (const [key, value] of Object.entries(result)) {
            //     console.log(`${key}`);
            //     add_catalog(alad, value as Target[], key)
            // }
            
            add_catalog(alad, props.targets)
        })
    }

    React.useEffect(() => {
        scriptloaded()
    }, [])

    React.useEffect(() => {
        const update_inst = async () => {
            aladin && setFOV(await get_fov(aladin, instrument))
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
            <div id='aladin-lite-div' style={{ margin: '6px', width: '900px', height: '900px' }} >
                {fov.map(f => <PolylineComponent points={f} />)}
            </div>
        </>
    )
}
