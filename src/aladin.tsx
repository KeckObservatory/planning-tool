import React from "react"
import { ra_dec_to_deg, cosd, sind } from './two-d-view/sky_view_util.tsx'
import { Target } from "./App"
import A from 'aladin-lite'
import { useDebounceCallback } from "./use_debounce_callback.tsx"
import { Feature, FeatureCollection, MultiPolygon, Position } from 'geojson'

const FOVlink = 'INSTRUMENTS_FOV.json'

interface Props {
    width: number,
    height: number,
    instrumentFOV: string,
    targets: Target[],
    angle: number
}

const format_target_coords = (ra: string | number, dec: string | number) => {
    const coords = `${ra} ${dec}`
    return coords
}

interface PolylineProps {
    points: Position[][]

}

const PolylineComponent = (props: PolylineProps) => {
    let pointsStr = "";
    props.points.forEach(val => {
        pointsStr += `${val.at(0)},${val.at(1)} `;
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

const rotate_fov = (coords: Position[][][], angle?: number) => {

    const rotFOV = angle ? coords.map(shape => {
        const newShape = shape.map(point => {
            const [x, y] = point as unknown as [number, number]
            const newPoint = [
                x * cosd(angle) - y * sind(angle),
                x * sind(angle) + y * cosd(angle)
            ]
            return newPoint as unknown as Position[]
        })
        return newShape
    }) : coords
    return rotFOV
}

const get_fov = async (aladin: any, instrumentFOV: string, angle: number) => {
    const [ra, dec] = aladin.getRaDec() as [number, number]
    const resp = await fetch(FOVlink)
    const data = await resp.text()
    const featureCollection = JSON.parse(data) as FeatureCollection<MultiPolygon>
    const feature = featureCollection['features'].find((f: any) => f['properties']['instrument'] === instrumentFOV)
    let multipolygon = (feature as Feature<MultiPolygon>).geometry.coordinates
    multipolygon = rotate_fov(multipolygon, angle)
    const polygons = multipolygon.map((polygon: Position[][]) => {
        let absPolygon = [...polygon, polygon[0]]
        absPolygon = absPolygon
            .map((point) => {
                const [x, y] = point as unknown as [number, number]
                return [x / 3600 + ra, y / 3600 + dec]
            })
            .map((point) => {
                const [x, y] = point as unknown as [number, number]
                const pix = aladin.world2pix(x, y)
                return pix
            })
        return absPolygon
    })

    return polygons as Position[][][]
}

export default function AladinViewer(props: Props) {
    const { width, height, targets, instrumentFOV, angle } = props

    const [fov, setFOV] = React.useState<Position[][][]>([])
    const [aladin, setAladin] = React.useState<null | any>(null)
    const [zoom, setZoom] = React.useState(2)

    // define custom draw function
    const drawFunction = function (source: any, canvasCtx: any) {
        canvasCtx.beginPath();
        canvasCtx.arc(source.x, source.y, 2, 0, 2 * Math.PI, false);
        canvasCtx.closePath();
        //canvasCtx.strokeStyle = '#c38';
        canvasCtx.fillStyle = source.catalog.color;
        canvasCtx.lineWidth = 1
        canvasCtx.stroke();
        canvasCtx.fill();
    };

    const add_catalog = (alad: any, targets: Target[], name = 'Targets') => {
        //var cat = A.catalog({ name: name, sourceSize: 4, shape: drawFunction});
        var cat = A.catalog({ name: name, shape: drawFunction });
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
                popupDesc: `<t> RA: ${tgt.ra} <br /> Dec: ${tgt.dec}</t>`
            }
            const ra = tgt.ra ? ra_dec_to_deg(tgt.ra as string) : tgt.ra_deg
            const dec = tgt.dec ? ra_dec_to_deg(tgt.ra as string, true) : tgt.dec_deg
            if (ra && dec) {
                cat.addSources(A.marker(ra, dec, options));
            }
            // tgt.ra &&
            //     cat.addSources(
            //         A.marker(ra_dec_to_deg(tgt.ra as string),
            //             ra_dec_to_deg(tgt.dec as string, true), options));
        }
    }


    const scriptloaded = async () => {
        console.log('script loaded', props)
        const firstRow = targets.at(0)
        let params: any = {
            survey: 'P/DSS2/color',
            projection: 'MOL',
            zoom: zoom,
            showCooGrid: false,
            showCooGridControl: true,
            showReticle: true
        }
        if (firstRow?.ra) {
            let ra = ra_dec_to_deg(firstRow.ra as string)
            let dec = ra_dec_to_deg(firstRow.dec as string, true)
            const coords = format_target_coords(ra, dec)
            params['target'] = coords
        }

        A.init.then(async () => {
            const alad = A.aladin('#aladin-lite-div', params);
            if (!alad) return
            const FOV = await get_fov(alad, instrumentFOV, angle)
            setFOV(FOV)
            setAladin(alad)
            add_catalog(alad, targets)
        })
    }

    React.useEffect(() => {
        scriptloaded()
    }, [])

    const update_inst_fov = async (instrumentFOV: string, angle: number) => {
        if (!aladin) return
        let FOV = await get_fov(aladin, instrumentFOV, angle)
        setFOV(FOV)
    }

    const debounced_update_inst_fov = useDebounceCallback(update_inst_fov, 250)

    React.useEffect(() => {
        debounced_update_inst_fov(instrumentFOV, angle)
    }, [aladin, instrumentFOV, zoom, angle])

    React.useEffect(() => {
    }, [targets])


    return (
        <div id='aladin-lite-div' style={{ margin: '0px', width: width, height: height }} >
            {fov.map(f => <PolylineComponent points={f} />)}
        </div>
    )
}
