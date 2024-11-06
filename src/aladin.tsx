import React from "react"
import { ra_dec_to_deg, cosd, sind } from './two-d-view/sky_view_util.tsx'
import { Target } from "./App"
import A from 'aladin-lite'
import { useDebounceCallback } from "./use_debounce_callback.tsx"
import { Feature, MultiPolygon, Position } from 'geojson'
import { get_shapes } from "./two-d-view/two_d_view.tsx"

interface Props {
    width: number,
    height: number,
    instrumentFOV: string,
    targets: Target[],
    angle: number
}

interface PolylineProps {
    points: Position[][]
    width: number
    height: number
    fill?: string
    color?: string
    className?: string
}

const PolylineComponent = (props: PolylineProps) => {
    let pointsStr = "";
    props.points.forEach(val => {
        pointsStr += `${val.at(0)},${val.at(1)} `;
    });

    const width = JSON.stringify(props.width)
    const height = JSON.stringify(props.height)
    const fill = props.fill ?? 'none'
    const color = props.color ?? 'green'
    const className = props.className ?? 'fov-overlay'

    const style = {
        'position': 'absolute',
        'stroke': color,
        'strokeWidth': '2',
        'fillRule': 'evenodd',
        'pointerEvents': 'none' // lets clicks go through underneath el
    }
    return (
        <div className={className} style={style as any}>
            <svg width={width} fill={fill} height={height}>
                <polyline points={pointsStr} />
            </svg>
        </div>
    )
}

const rotate_multipolygon= (coords: Position[][][], angle?: number) => {

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

const get_angle = (aladin: any) => {
    const [ra, dec] = aladin.getRaDec() as [number, number]
    const ddeg = .2 
    
    const [x0, y0] = aladin.world2pix(ra, dec)
    const [x1, y1] = aladin.world2pix(ra, dec+ddeg)
    const [x2, y2] = aladin.world2pix(ra+ddeg, dec)
    console.log('x0, y0', x0, y0, 'x1, y1', x1, y1, 'x2, y2', x2, y2)
    const angle = ( 180 / Math.PI ) * Math.atan2(y2 - y0, x2 - x0) - Math.atan2(y1 - y0, x1 - x0)
    console.log('compass angle:', angle)
    return angle
}

const get_compass = async (aladin: any, height: number, width: number) => {
    const [ra, dec] = aladin.getRaDec() as [number, number]
    const features = await get_shapes('static shape')
    const feature = features.find((f: any) => f['properties'].name === 'CompassRose')
    if (!feature) return []
    let multipolygon = (feature as Feature<MultiPolygon>).geometry.coordinates
    const angle = get_angle(aladin)
    const margin = 50
    const scale = 1 / 60 
    multipolygon = rotate_multipolygon(multipolygon, angle)
    const polygons = multipolygon.map((polygon: Position[][]) => {
        let absPolygon = [...polygon, polygon[0]]
        absPolygon = absPolygon
            .map((point) => { 
                const [x, y] = point as unknown as [number, number]
                return [x + ra, y + dec]
            })
            .map((point) => { //convert to pixel, scale, and translate
                let [x, y] = aladin.world2pix(...point)

                x = x * scale 
                y = y * scale 
                // x = x + width + margin //shift left
                // y = y + height + margin //shift down

                return [x, y] as unknown as Position[]
            })
        console.log('aladin', aladin, absPolygon)
        return absPolygon
    })

    return polygons as Position[][][]
}

const get_fov = async (aladin: any, instrumentFOV: string, angle: number) => {
    const [ra, dec] = aladin.getRaDec() as [number, number]
    const features = await get_shapes()
    const feature = features.find((f: any) => f['properties'].instrument === instrumentFOV)
    if (!feature) return []
    let multipolygon = (feature as Feature<MultiPolygon>).geometry.coordinates
    multipolygon = rotate_multipolygon(multipolygon, angle)
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
    const [compass, setCompass] = React.useState<Position[][][]>([])
    const [aladin, setAladin] = React.useState<null | any>(null)
    const [zoom, setZoom] = React.useState(5)

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
            // zoom: zoom,
            fov: 15/60, 
            showCooGrid: false,
            showCooGridControl: true,
            showReticle: false,
            target: firstRow?.target_name
        }
        params['target'] = firstRow?.ra?.replaceAll(':', " ") + ' ' + firstRow?.dec?.replaceAll(':', ' ')
        console.log('params', params)

        A.init.then(async () => {
            const alad = A.aladin('#aladin-lite-div', params);
            if (!alad) return
            const FOV = await get_fov(alad, instrumentFOV, angle)
            const newCompass = await get_compass(alad, height, width)
            setFOV(FOV)
            setAladin(alad)
            setCompass(newCompass)
            add_catalog(alad, targets)
        })
    }

    React.useEffect(() => {
        scriptloaded()
    }, [])

    const update_shapes= async (instrumentFOV: string, angle: number) => {
        if (!aladin) return
        let FOV = await get_fov(aladin, instrumentFOV, angle)
        let newCompass = await get_compass(aladin, height, width)
        setCompass(newCompass)
        setFOV(FOV)
    }

    const debounced_update_shapes= useDebounceCallback(update_shapes, 250)

    React.useEffect(() => {
        debounced_update_shapes(instrumentFOV, angle)
    }, [aladin, instrumentFOV, zoom, angle])

    React.useEffect(() => {
    }, [targets])


    return (
        <div id='aladin-lite-div' style={{ margin: '0px', width: width, height: height }} >
            {fov.map(f => <PolylineComponent points={f} width={width} height={height}/>)}
            {compass.map(f => <PolylineComponent points={f} width={width} height={height} color='red' className='compass-overlay'/>)}
        </div>
    )
}
