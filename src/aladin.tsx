import React from "react"
import { ra_dec_to_deg, cosd, sind, r2d } from './two-d-view/sky_view_util.tsx'
import { Target } from "./App"
import A from 'aladin-lite'
import { useDebounceCallback } from "./use_debounce_callback.tsx"
import { Feature, FeatureCollection, MultiPolygon, Polygon, Position, Point } from 'geojson'
import { get_shapes } from "./two-d-view/two_d_view.tsx"
import { POPointFeature } from "./two-d-view/pointing_origin_select.tsx"

interface Props {
    width: number,
    height: number,
    instrumentFOV: string,
    targets: Target[],
    guideStars?: Partial<Target>[],
    pointingOrigins?: Feature<Point, { name?: string }>[],
    fovAngle: number
    positionAngle: number
    selectCallback?: (targetName: string) => void
    selectedGuideStarName?: string
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

const rotate_multipolygon = (coords: Position[][][], angle: number, pnt=[0,0]) => {

    const rotFOV = coords.map(shape => {
        const newShape = shape.map(point => {
            let [x, y] = point as unknown as [number, number]
            x -= pnt[0]
            y -= pnt[1]
            let newPoint = [
                x * cosd(angle) - y * sind(angle),
                x * sind(angle) + y * cosd(angle)
            ]
            newPoint[0] += pnt[0]
            newPoint[1] += pnt[1]
            return newPoint as unknown as Position[]
        })
        return newShape
    })
    return rotFOV
}

const get_angle = (aladin: any) => {
    //Compass rose is a euclidian object put onto a non-euclidian projection, 
    //so we need to calculate the angle of two vectors that are small enough to be approximately euclidian
    //usually 5 arcminutes is good enough
    const [ra, dec] = aladin.getRaDec() as [number, number]
    const dra = 5 / (24 * 60) //hours 5 minutes is probably good
    const ddec = 90 //deg
    // const dra = 5/(24*60) //hours 5 minutes is probably good
    // const ddec = 5/60 //deg

    const [x0, y0] = aladin.world2pix(ra, dec) // originate compass on center of screen
    const [x1, y1] = aladin.world2pix(ra, dec + ddec) //point up 
    const [x2, y2] = aladin.world2pix(ra + dra, dec) //point left 
    const angle = r2d(Math.atan2((y2 - x0) * (x1 - x0) - (y1 - y0) * (x2 - x0), (x1 - x0) * (x2 - x0) + (y1 - y0) * (y2 - y0)))
    return angle
}

const get_compass = async (aladin: any, height: number, width: number, positionAngle: number) => {
    const fc = await get_shapes('compass_rose') as FeatureCollection<Polygon>
    const angle = 90 + get_angle(aladin) // rotate to match compass
    const aladinAngle = aladin.getViewCenter2NorthPoleAngle()
    // const wcs = aladin.getViewWCS()
    fc['features'].forEach((f) => {
        let polygon = f.geometry.coordinates
        const offsetx = f.properties?.offsetx
        const offsety = f.properties?.offsety
        const margin = f.properties?.margin ?? 50
        polygon = [...polygon, polygon[0]]
        polygon = polygon.map((point) => {
            const [x, y] = point as unknown as [number, number]
            return [x + width - margin + offsetx, y + height - margin + offsety] as unknown as Position[]
        })
        const rotPnt = [width - margin, height - margin ]
        const compassAngle = -1 * (angle + positionAngle + aladinAngle)
        polygon = rotate_multipolygon([polygon], compassAngle, rotPnt)[0]
        f.geometry.coordinates = polygon
    })
    return fc
}

const get_fovz = async (aladin: any, instrumentFOV: string, angle: number) => {
    const [ra, dec] = aladin.getRaDec() as [number, number]
    const fc = await get_shapes('fov')
    const features = fc['features'].filter((f: any) => f['properties'].type === 'FOV')
    const feature = features.find((f: any) => f['properties'].instrument === instrumentFOV)
    if (!feature) return { fov: [], zoom: 5 } 
    const multipolygon = (feature as Feature<MultiPolygon>).geometry.coordinates
    const rotPolygon = rotate_multipolygon(multipolygon, angle)
    const polygons = rotPolygon.map((polygon: Position[][]) => {
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

    const zoom = feature?.properties?.zoom ?? 1
    const out = { fov: polygons as Position[][][], zoom: zoom as number }
    return out 
}

export default function AladinViewer(props: Props) {

    const [fov, setFOV] = React.useState<Position[][][]>([])
    const [compass, setCompass] = React.useState<FeatureCollection<Polygon>>({ type: 'FeatureCollection', features: [] })
    const [aladin, setAladin] = React.useState<null | any>(null)
    const [zoom, setZoom] = React.useState(5)

    React.useEffect(() => {
        if (props.selectedGuideStarName && aladin) {
            const overlays = aladin.getOverlays()
            overlays.forEach((cat: any) => {
                if (cat.name === 'Guide Stars') {
                    cat.select( (source: any) => {
                        return source.popupTitle.startsWith(props.selectedGuideStarName + ':')
                    })
                }
            })
        }
    }, [props.selectedGuideStarName])

    // define custom draw function
    const drawFunction = function (source: any, canvasCtx: any) {
        canvasCtx.beginPath();
        canvasCtx.arc(source.x, source.y, 4, 0, 2 * Math.PI, false);
        canvasCtx.closePath();
        //canvasCtx.strokeStyle = '#c38';
        canvasCtx.fillStyle = source.catalog.color;
        canvasCtx.lineWidth = 1
        canvasCtx.stroke();
        canvasCtx.fill();
    };

    const add_catalog = (alad: any, targets: Partial<Target>[], name = 'Targets') => {
        //var cat = A.catalog({ name: name, sourceSize: 4, shape: drawFunction});

        if (name === 'Targets') {
            var cat = A.catalog({ name: name, shape: drawFunction });
        }
        else {
            var cat = A.catalog({ name: name, shape: 'square' });
        }
        alad.addCatalog(cat);

        alad.on('zoomChanged', function (zoom: number) {
            setZoom(zoom)
        })


        for (let idx = 0; idx < targets.length; idx++) {
            const tgt = targets[idx]
            const popupTitle = tgt.target_name ?? tgt._id ?? 'Unknown'
            const options = {
                idx: idx,
                name: tgt.target_name ?? tgt._id ?? 'Unknown',
                popupTitle: popupTitle + ':' + JSON.stringify(idx),
                size: 4,
                popupDesc: `<t> RA: ${tgt.ra} <br /> Dec: ${tgt.dec}</t>`
            }
            const ra = tgt.ra_deg ?? ra_dec_to_deg(tgt.ra as string)
            const dec = tgt.dec_deg ?? ra_dec_to_deg(tgt.dec as string, true)
            if (ra && dec) {
                cat.addSources(A.marker(ra, dec, options));
            }
        }
    }

    const update_shapes = async (aladin: any, updatefov = true, updateCompass = true, updatePointingOrigins = true) => {
        if (updatefov) {
            const fovz = await get_fovz(aladin, props.instrumentFOV, props.fovAngle)
            setFOV(() => [...fovz.fov])
        }
        if (updateCompass) {
            let newCompass = await get_compass(aladin, props.height, props.width, props.positionAngle)
            setCompass(newCompass)
            const aladinAngle = aladin.getViewCenter2NorthPoleAngle()
            aladin.setViewCenter2NorthPoleAngle(props.positionAngle + aladinAngle)
        }

    }

    const debounced_update_shapes = useDebounceCallback(update_shapes, 250)

    const add_pointing_origins = (ra: number, dec: number, aladin: any, pointingOrigins: POPointFeature[]) => {
        const markers = pointingOrigins?.map((feature) => {
            const [dra, ddec] = feature.geometry.coordinates //arcseconds
            const [pora, podec] = [ra + dra / 3600, dec + ddec / 3600]
            const name = feature.properties?.name ?? 'Unknown'
            return A.marker(pora, podec, { name: name, popupTitle: name })
        })
        const cat = A.catalog({ name: 'Pointing Origins', shape: 'diamond' });
        markers.forEach((marker) => cat.addSources(marker))
        aladin.removeOverlay('Pointing Origins')
        aladin.addCatalog(cat);
    }

    const scriptloaded = async () => {
        const firstRow = props.targets.at(0) ?? { ra: '0', dec: '0', ra_deg: 0, dec_deg: 0 }
        const ra = firstRow.ra_deg ?? ra_dec_to_deg(firstRow.ra ?? '0')
        const dec = firstRow.dec_deg ?? ra_dec_to_deg(firstRow.dec ?? '0', true)
        const startPos = `${ra} ${dec}`
        let params: any = {
            survey: 'P/SDSS9/color',
            projection: 'MOL',
            fov: 15 / 60,
            showCooGrid: false,
            showCooGridControl: true,
            showReticle: false,
            target: startPos
        }
        A.init.then(async () => {
            const alad = A.aladin('#aladin-lite-div', params);
            if (!alad) return
            alad.on('fullScreenToggled', function () {
                debounced_update_shapes(alad)
            })
            alad.on('positionChanged', function () {
                debounced_update_shapes(alad, false, true)
            })
            alad.on('objectClicked', function (obj: any) {
                const targetName = obj.popupTitle.split(':').at(0) // guide star names are in the format "name:idx"
                if (targetName && props.selectCallback) {
                    props.selectCallback(targetName)
                }
            })
            const fovz = await get_fovz(alad, props.instrumentFOV, props.fovAngle)
            const newCompass = await get_compass(alad, props.height, props.width, props.positionAngle)
            setZoom(fovz.zoom)
            alad.setFoV(fovz.zoom) // set zoom level of shape
            setFOV(() => [...fovz.fov])
            setAladin(alad)
            setCompass(newCompass)
            props.targets && add_catalog(alad, props.targets, 'Targets')
            props.guideStars && add_catalog(alad, props.guideStars, 'Guide Stars')
            if (props.pointingOrigins) { //TODO: add a catalog for pointing origins and add to aladin
                add_pointing_origins(ra, dec, alad, props.pointingOrigins as POPointFeature[])
            }
            alad.setViewCenter2NorthPoleAngle(props.positionAngle)
        })
    }

    React.useEffect(() => {
        if (aladin && props.pointingOrigins) {
            const [ra, dec] = aladin.getRaDec() as [number, number]
            add_pointing_origins(ra, dec, aladin, props.pointingOrigins as POPointFeature[])
        }
    }, [props.pointingOrigins])

        

    React.useEffect(() => {
        scriptloaded()
    }, [])


    React.useEffect(() => {
        //remove old catalog and add new one
        if (!aladin || !props.guideStars) return
        aladin.removeOverlay('Guide Stars')
        add_catalog(aladin, props.guideStars, 'Guide Stars')
    }, [props.guideStars])


    React.useEffect(() => {
        if(!aladin) return
        debounced_update_shapes(aladin)
    }, [aladin, props.instrumentFOV, zoom, props.fovAngle, props.positionAngle])

    React.useEffect(() => {
    }, [props.targets])


    return (
        <div id='aladin-lite-div' style={{ margin: '0px', width: props.width, height: props.height }} >
            {fov.map(f => <PolylineComponent points={f} width={props.width} height={props.height} />)}
            {compass.features.map(f => <PolylineComponent points={f.geometry.coordinates}
                width={props.width}
                height={props.height}
                color={f.properties?.color}
                fill={f.properties?.fill}
                className='compass-overlay' />)}
        </div>
    )
}
