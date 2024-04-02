import React from "react"
import { ra_dec_to_deg } from './two-d-view/sky_view_util.tsx'
import { Target } from "./App"
import A from 'aladin-lite'

//const links = ['KCWIAnnularGuider.dat']
const links = ['KCWI_FOV.json', 'MOSFIRE_FOV.json']

interface Props {
    targets: Target[]
}

const format_target_coords = (ra: string | number, dec: string | number) => {
    const coords = `${ra} ${dec}`
    return coords
}

const style_popup = () => {
    const pt: any = document.querySelector('.aladin-popupTitle')
    pt.setAttribute('style', 'color: black')
}


const add_target = (aladin: any, ra: number, dec: number) => {
    var cat = A.catalog({ name: 'Target', sourceSize: 18 });
    aladin.addCatalog(cat);
    const options = { popupTitle: 'Target', popupDesc: '' }
    cat.addSources([A.marker(ra, dec, options)]);
    style_popup()
}

const add_selected_catalog = (aladin: any, target: Target) => {
    var cat = A.catalog({ name: 'Selected Catalog Star', sourceSize: 18, shape: 'circle' });
    aladin.addCatalog(cat);
    const options = {}
    cat.addSources(A.source(target.ra, target.dec, options));
}

const arcsec_to_deg = (ra: number, dec: number) => {
    return [ra / 3600, dec / 3600]
}

const parse_dat = (aladin: any, FOV: any, data: string) => {
    const [ra0, dec0] = aladin.getRaDec()
    let coords: [number, number][] = []
    let startradec: [number, number] = [0 + ra0, 0 + dec0]
    const lines = data.split('\n')
    let currLayer = lines[0].split(' ')[lines[0].split(' ').length - 1]
    lines.map((line, idx) => {
        const [segra0, segdec0, ...daRest] = line.split(' ')
        const layer = daRest[daRest.length - 1]
        const [ra, dec] = arcsec_to_deg(Number(segra0), Number(segdec0))
        if (layer !== currLayer) {
            currLayer = layer
            // const polyline = A.polyline(coords.splice(0, 500))
            const polyline = A.polyline(coords)
            coords.push([ra + ra0, dec + dec0])
            coords.push(startradec)
            FOV.add(polyline)
            coords = []
            startradec = [ra + ra0, dec + dec0]
        }
        else {
            coords.push([ra + ra0, dec + dec0])
        }
        if (idx === 0) {
            startradec = coords[0]
        }
    })
    coords.push(startradec)
    const polyline = A.polyline(coords)
    // const polyline = A.polyline(coords.splice(0, 500))
    console.log('polyline', polyline, ra0, dec0)
}

const add_overlay = async (aladin: any) => {
    const FOV = A.graphicOverlay({ color: 'purple', lineWidth: 2 });
    aladin.addOverlay(FOV);
    const [ra0, dec0] = aladin.getRaDec()
    for (let idx = 0; idx < links.length; idx++) {
        const link = links[idx]
        const resp = await fetch(link)
        const data = await resp.text()
        if (link.includes('.dat')) {
            const polyline = parse_dat(aladin, FOV, data)
            FOV.add(polyline)
        }
        if (link.includes('.json')) {
            const json = JSON.parse(data)
            const multipolygon = json['features'][0]['geometry']['coordinates']
            multipolygon.map((polygon: any) => {
                let p = [...polygon, polygon[0]]
                //let p = [...polygon ]
                p = p.map((point: [number, number]) => {
                    return [point[0]/3600 + ra0, point[1]/3600 + dec0]
                })
                console.log('p', p)
                const polyline = A.polyline(p)
                FOV.add(polyline)
            })

        }
    }
}

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
            popupDesc: `<t style={color: "black", text-color: "black"}>RA: ${tgt.ra} <br/> Dec: ${tgt.dec}</t>`
        }
        tgt.ra &&
            cat.addSources(
                A.marker(ra_dec_to_deg(tgt.ra as string),
                    ra_dec_to_deg(tgt.dec as string, true), options));
    }
}

export default function Aladin(props: Props) {

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
        var aladin;
        A.init.then(() => {
            aladin = A.aladin('#aladin-lite-div', params);
            add_overlay(aladin)
            add_catalog(aladin, props.targets)
        })
    }

    React.useEffect(() => {
        scriptloaded()
    }, [])

    React.useEffect(() => {
    }, [props.targets])


    return (
        <div id='aladin-lite-div' style={{ width: '600px', height: '600px' }} />
    )
}
