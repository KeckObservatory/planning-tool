
import Tooltip from '@mui/material/Tooltip';
import { IconButton } from '@mui/material';
import { get_simbad } from './api/api_root.tsx';
import ModeStandbyIcon from '@mui/icons-material/ModeStandby';
import { Target } from './App';
import { ra_dec_to_deg } from './two-d-view/sky_view_util.tsx';


export interface Props {
    target: Target
    setTarget: Function
    hasSimbad: boolean
}

// export const ra_dec_to_deg = (time: string | number, dec = false): number => {
//     //if float return
//     if (typeof time === 'number') { //already stored as degree
//         return time
//     }

//     let deg = 0;
//     let sigfig = 3;
//     (time as string).includes('+') || (time as string).includes('-') && (dec = true)
//     try {
//         let [hours, min, sec] = (time as string).split(':')
//         sigfig = sec.split('.')[1].length
//         if (dec) {
//             const decDeg = Number(hours)
//             let sign = Math.sign(decDeg)
//             deg = decDeg // dec is already in degrees
//                 + sign * Number(min) / 60
//                 + sign * Number(sec) / 3600
//             console.log('time', time, 'dec', dec, 'sign', sign, 'decDeg', decDeg, 'hours', hours)
//         }

//         else {
//             deg = Number(hours) * 15 // convert hours to deg
//                 + Number(min) / 4
//                 + Number(sec) / 240
//         }
//     }
//     finally {
//         return Number(deg.toFixed(sigfig))
//     }
// }

export interface SimbadTargetData {
    ra?: string,
    dec?: string,
    ra_deg?: number,
    dec_deg?: number,
    pm_ra?: number,
    pm_dec?: number,
    epoch?: string,
    tic?: string,
    j_mag?: number,
    g_mag?: number,
    sys_rv?: number
    gaia_id?: string,
    tic_id?: string
}

export const get_simbad_data = async (targetName: string): Promise<SimbadTargetData> => {
    const simbad_output = await get_simbad(targetName)
    let bibcodesSection = false
    let identifiersSection = false
    const simbadData: SimbadTargetData = {}

    const simbadLines = simbad_output.split('\n')
    let currDr = 0 
    for (let line of simbadLines) {
        line.startsWith('Bib') && (bibcodesSection = true)
        line.startsWith('Identifiers (') && (identifiersSection = true)
        if (line.startsWith('Coordinates(ICRS')) {
            simbadData['ra'] = line.split(': ')[1].split(' ').slice(0, 3).join(':')
            simbadData['dec'] = line.split(': ')[1].split(' ').slice(4, 7).join(':')
            simbadData['ra'] && (simbadData['ra_deg'] = ra_dec_to_deg(simbadData['ra']))
            simbadData['dec'] && (simbadData['dec_deg'] = ra_dec_to_deg(simbadData['dec'], true))
            simbadData['epoch'] = line.split('=')[1].split(',')[0]
        }
        else if (line.startsWith('Radial Velocity')) {
            const sysRv = Number(line.split(' ')[2].replace(' ', ''))
            sysRv && (simbadData['sys_rv'] = sysRv)
        }
        else if (line.startsWith('Flux J')) {
            const fluxJ = Number(line.split(': ')[1].split(' ')[0])
            fluxJ && (simbadData['j_mag'] = fluxJ)
        }
        else if (line.startsWith('Flux G')) {
            const fluxG = Number(line.split(': ')[1].split(' ')[0])
            fluxG && (simbadData['g_mag'] = fluxG)
        }
        else if (line.startsWith('Proper motions')) {
            const [pmRa, pmDec] = line.split(' ').slice(2, 4);
            Number(pmRa) && (simbadData['pm_ra'] = Number(pmRa))
            Number(pmDec) && (simbadData['pm_dec'] = Number(pmDec))
        }
        else if (identifiersSection
            && bibcodesSection === false
            && (line.includes('Gaia') || line.includes('TIC'))) {
            let ticMatch = line.match(new RegExp('TIC\\s\\w+'))
            const tic = ticMatch ? ticMatch[0].split(' ')[1] : ""
            let gaiaMatch = line.match(new RegExp('Gaia\\s\\w+\\s\\w+'))
            const dr = gaiaMatch ? gaiaMatch[0].split(' ')[1] : ""
            const gaia = gaiaMatch ? gaiaMatch[0].split(' ')[2] : ""
            tic && (simbadData['tic_id'] = tic)
            if (dr && gaia) {
                Number(dr[2]) > currDr && (
                    simbadData['gaia_id'] = gaia)
                currDr = Number(dr[2])
            }
        }
        ;
    }
    return simbadData
}


export default function SimbadButton(props: Props) {
    const { target, setTarget } = props
    const targetName = target.target_name

    const handleClickOpen = async () => {
        if (targetName) {
            const simbadData = await get_simbad_data(targetName)
            setTarget({ ...target, ...simbadData, state: "EDITED" })
        }
    }

    return (
        <Tooltip title={`Click to add Simbad info to target ${targetName}`}>
            <IconButton onClick={handleClickOpen}>
                <ModeStandbyIcon color={props.hasSimbad ? 'success' : 'inherit'} />
            </IconButton>
        </Tooltip>
    );
}