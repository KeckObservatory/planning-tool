import React from "react"
import { ra_dec_to_deg } from '../two-d-view/sky_view_util.tsx'
import { Target } from "../App.tsx"
import A from 'aladin-lite'
import { useDebounceCallback } from "../use_debounce_callback.tsx"
import { Feature, FeatureCollection, Polygon, Position, Point } from 'geojson'
import { PointingOriginMarkers, PointingOriginMarker } from "./pointing_origin_markers.tsx"
import { get_compass, get_fovz, rotate_point } from "./aladin-utils.tsx"
import { POPointFeature } from "../two-d-view/pointing_origin_select.tsx"
// import { color } from "html2canvas/dist/types/css/types/color"

interface Props {
    width: number,
    height: number,
    instrumentFOV: string,
    targets: Target[],
    selPO: POPointFeature | undefined ,
    setSelPO: React.Dispatch<React.SetStateAction<POPointFeature | undefined>>,
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


export default function AladinViewer(props: Props) {

    const [fov, setFOV] = React.useState<Position[][][]>([])
    const [compass, setCompass] = React.useState<FeatureCollection<Polygon>>({ type: 'FeatureCollection', features: [] })
    const [aladin, setAladin] = React.useState<null | any>(null)
    const [zoom, setZoom] = React.useState(5)

    // Convert pointing origins to pixel coordinates for SVG markers
    const pointingOriginMarkers = React.useMemo((): PointingOriginMarker[] => {
        if (!aladin || !props.pointingOrigins) {
            return [];
        }
        
        const [ra, dec] = aladin.getRaDec() as [number, number];
        
        return props.pointingOrigins.map((feature) => {
            const [dra, ddec] = feature.geometry.coordinates; // arcseconds offset
            const [pora, podec] = [ra + dra / 3600, dec + ddec / 3600]; // convert to degrees
            const [x, y] = aladin.world2pix(pora, podec);
            const rotatedxy = rotate_point([x, y], props.fovAngle, [props.width / 2, props.height / 2]);
            const name = feature.properties?.name ?? 'Unknown';
            
            return {
                name,
                position: rotatedxy as unknown as [number, number]
            };
        });
    }, [aladin, props.pointingOrigins, zoom, props.fovAngle]); // Include zoom to trigger recalculation on zoom changes

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

    // // define custom draw function
    // const drawFunction = function (source: any, canvasCtx: any) {
    //     canvasCtx.beginPath();
    //     canvasCtx.arc(source.x, source.y, 4, 0, 2 * Math.PI, false);
    //     canvasCtx.closePath();
    //     //canvasCtx.strokeStyle = '#c38';
    //     canvasCtx.fillStyle = source.catalog.color;
    //     canvasCtx.lineWidth = 1
    //     canvasCtx.stroke();
    //     canvasCtx.fill();
    // };

    const add_catalog = (alad: any, targets: Partial<Target>[], name = 'Targets') => {
        //var cat = A.catalog({ name: name, sourceSize: 4, shape: drawFunction});

        if (name === 'Targets') {
            var cat = A.catalog({ name: name, shape: 'circle', color: 'cyan' });
        }
        else {
            var cat = A.catalog({ name: name, shape: 'square', color: 'magenta' });
        }

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
        alad.addCatalog(cat);
    }

    const update_shapes = async (aladin: any, updatefov = true, updateCompass = true) => {

        if (props.selPO) { // if there is a selected pointing origin, move the view to it
            let [ra, dec] = aladin.getRaDec() as [number, number]
            const [dra, ddec] = props.selPO.geometry.coordinates // arcseconds offset
            aladin.gotoRaDec(ra + dra / 3600, dec + ddec / 3600)
        }

        if (updatefov) {
            const pointOfOrigin = props.selPO?.geometry.coordinates as [number, number] ?? [0, 0]
            const fovz = await get_fovz(aladin, props.instrumentFOV, props.fovAngle, pointOfOrigin)
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
                props.setSelPO && props.setSelPO(undefined)
            })
            alad.on('objectClicked', function (obj: any) {
                const targetName = obj.popupTitle.split(':').at(0) // guide star names are in the format "name:idx"
                if (targetName && props.selectCallback) {
                    props.selectCallback(targetName)
                }
            })


            const pointOfOrigin = props.selPO?.geometry.coordinates as [number, number] ?? [0, 0]
            const fovz = await get_fovz(alad, props.instrumentFOV, props.fovAngle, pointOfOrigin)
            const newCompass = await get_compass(alad, props.height, props.width, props.positionAngle)
            setZoom(fovz.zoom)
            alad.setFoV(fovz.zoom) // set zoom level of shape
            setFOV(() => [...fovz.fov])
            setAladin(alad)
            setCompass(newCompass)
            props.targets && add_catalog(alad, props.targets, 'Targets')
            props.guideStars && add_catalog(alad, props.guideStars, 'Guide Stars')
            alad.setViewCenter2NorthPoleAngle(props.positionAngle)
        })
    }

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
    }, [aladin, props.instrumentFOV, zoom, props.fovAngle, props.positionAngle, props.selPO])

    return (
        <div id='aladin-lite-div' style={{ margin: '0px', width: props.width, height: props.height }} >
            {fov.map((f, idx) => <PolylineComponent key={`fov-${idx}`} points={f} width={props.width} height={props.height} />)}
            {compass.features.map((f, idx) => <PolylineComponent 
                key={`compass-${idx}`}
                points={f.geometry.coordinates}
                width={props.width}
                height={props.height}
                color={f.properties?.color}
                fill={f.properties?.fill}
                className='compass-overlay' />)}
            
            {/* Render pointing origin markers with labels */}
            {pointingOriginMarkers.length > 0 && (
                <PointingOriginMarkers
                    markers={pointingOriginMarkers}
                    width={props.width}
                    height={props.height}
                    markerSize={8}
                    fontSize={14}
                    textOffset={35}
                    lineColor="#FFD700"   // Gold lines
                    textColor="#FFFFFF"   // White text
                    markerColor="#FFFF00" // Yellow markers
                />
            )}
        </div>
    )
}
