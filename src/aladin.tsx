import React from "react"
import { ra_dec_to_deg } from './two-d-view/sky_view_util.tsx'
import { Target } from "./App"
import A from 'aladin-lite'
import { useDebounceCallback } from "./use_debounce_callback.tsx"

// const links = ['KCWI_FOV.json', 'MOSFIRE_FOV.json']
const links = ['KCWI_FOV.json']

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

const get_fov = async (aladin: any) => {
    const link = links[0]
    const resp = await fetch(link)
    const data = await resp.text()
    const json = JSON.parse(data)
    const multipolygon = json['features'][0]['geometry']['coordinates']
    const [ra0, dec0] = aladin.getRaDec()
    const polygons = multipolygon.map((polygon: [number, number][]) => {
        //let p = [...polygon, polygon[0]]
        let p = [...polygon ]
        p = p
            .map((point: [number, number]) => {
                return [point[0] / 3600 + ra0, point[1] / 3600 + dec0]
            })
            .map((pt) => {
                const pix = aladin.world2pix(...pt) as [number, number]
                // return [Math.round(pix[1]), Math.round(pix[1])] as [number, number]
                return pix as [number, number]
            })
        return p 
    })
    console.log('polygons', polygons)
    return polygons as [number, number][][]
}

    const add_overlay = async (aladin: any, FOV: any) => {
        aladin.addOverlay(FOV);
        const [ra0, dec0] = aladin.getRaDec()
        for (let idx = 0; idx < links.length; idx++) {
            const link = links[idx]
            const resp = await fetch(link)
            const data = await resp.text()
            if (link.includes('.json')) {
                const json = JSON.parse(data)
                const multipolygon = json['features'][0]['geometry']['coordinates']
                multipolygon.map((polygon: [number, number][]) => {
                    let p = [...polygon, polygon[0]]
                    p = p
                        .map((point: [number, number]) => {
                            return [point[0] / 3600 + ra0, point[1] / 3600 + dec0]
                        })
                        .map((pt) => {
                            return aladin.world2pix(...pt) as [number, number]
                        })
                    const polyline = A.polyline(p)
                    FOV.add(polyline)
                })

            }
        }
    }



    export default function Aladin(props: Props) {

        const [fov, setFOV] = React.useState([] as [number, number][][])

        const add_catalog = (aladin: any, targets: Target[]) => {
            var cat = A.catalog({ name: 'Targets', sourceSize: 18 });
            aladin.addCatalog(cat);

            aladin.on('objectClicked', function (object: any) {
                if (object) {
                    console.log('objectClicked', object)
                }
            })

            aladin.on('objectHovered', function (object: any) {
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
            let params: any = { survey: 'P/DSS2/color', zoom: 2, showReticle: true }
            if (firstRow?.ra) {
                let ra = ra_dec_to_deg(firstRow.ra as string)
                let dec = ra_dec_to_deg(firstRow.dec as string, true)
                const coords = format_target_coords(ra, dec)
                params['target'] = coords
            }

            A.init.then(async () => {
                const aladin = A.aladin('#aladin-lite-div', params);
                const FOV = A.graphicOverlay({ color: 'purple', lineWidth: 2 });
                add_overlay(aladin, FOV)
                setFOV(await get_fov(aladin))
                add_catalog(aladin, props.targets)
            })
        }

        React.useEffect(() => {
            scriptloaded()
        }, [])

        React.useEffect(() => {
        }, [props.targets])


        return (
            <div id='aladin-lite-div' style={{ width: '600px', height: '600px' }} >
                {fov.map( f => <PolylineComponent points={f}/>)}
            </div>
        )
    }
