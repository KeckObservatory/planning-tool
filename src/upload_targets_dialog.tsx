import React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { Tooltip } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import { RotatorMode, Target, TelescopeWrap, useStateContext } from './App';
import target_schema from './target_schema.json'
import { randomId } from '@mui/x-data-grid-generator';
import { PropertyProps, TargetProps } from './target_edit_dialog';

interface Props {
    setTargets: Function
}

interface UploadProps extends Props {
    label: string
    setLabel?: Function,
    setOpen?: Function
}


const targetProps = target_schema.properties as TargetProps

let hdrToKeyMapping = Object.fromEntries(Object.entries(targetProps).map(([key, value]: [keyof TargetProps, PropertyProps]) => {
    const desc = value.short_description ?? value.description
    return[desc, key]
}))

let convert_string_to_type = (key: keyof Target, value: string) => {
    //@ts-ignore
    if (targetProps[key] === 'number') {
        return Number(value)
    }
    return value
}

interface StarListOptionalKeys {
    gmag?: number,
    jmag?: number,
    epoch?: number,
    raoffset?: number,
    decoffset?: number,
    pmra?: number,
    pmdec?: number,
    rotmode?: RotatorMode,
    wrap?: TelescopeWrap,
    dra?: number,
    ddec?: number,
}

let starlistToKeyMapping = {
    'gmag': 'g_mag',
    'jmag': 'j_mag',
    'epoch': 'epoch',
    'raoffset': 'ra_offset',
    'decoffset': 'dec_offset',
    'pmra': 'pm_ra',
    'pmdec': 'pm_dec',
    'rotmode': 'rotator_mode',
    'wrap': 'telescope_wrap',
    'dra': 'd_ra',
    'ddec': 'd_dec',
}

const parse_json = (contents: string) => {
    const tgts = JSON.parse(contents)
    return tgts
}

const parse_csv = (contents: string) => {
    const [header, ...lines] = contents.split('\n')
        .map(s => s.replace('\r', '').split(','))
    const tgts = lines.map((item) => {
        const tgt = {} as Target;
        header.forEach((desc, index) => {
            const key = hdrToKeyMapping[desc] as keyof Target
            tgt[key] = item.at(index) as keyof Target[keyof Target]
        });
        return tgt;
    });
    return tgts
}

const split_at = (index: number, str: string) => [str.slice(0, index), str.slice(index)] 

const parse_txt = (contents: string, obsid: number) => {
    let tgts = [] as Target[]
    contents.split('\n').forEach((row) => {
        if (row === '') return
        if (row.startsWith('#')) return
        const [target_name, remainder] = split_at(15, row) 
        const [rah, ram, ras, dech, decm, decs, epoch, ...opts] = remainder.replace(/\s\s+/g, ' ').split(' ')
        let tgt: Target = {
            _id: randomId(),
            target_name,
            obsid: obsid,
            ra: `${rah.padStart(2,'0')}:${ram.padStart(2,'0')}:${ras}`,
            dec: `${dech.padStart(2,'0')}:${decm.padStart(2,'0')}:${decs}`,
            epoch
        };
        opts.forEach((opt) => {
            const [key, value] = opt.split('=')
            const tgtKey = starlistToKeyMapping[key as keyof StarListOptionalKeys] as keyof Target 
            //@ts-ignore
            tgt[tgtKey] = convert_string_to_type(tgtKey, value)
        })
        console.log('tgt', tgt)
        tgts.push(tgt);
    });
    return tgts
}

export function UploadComponent(props: UploadProps) {

    const context = useStateContext()

    const fileLoad = (evt: React.ChangeEvent<HTMLInputElement>) => {
        let file: File = new File([], 'empty')
        evt.target?.files && (file = evt.target?.files[0])
        props.setLabel && props.setLabel(`${file.name} Uploaded`)
        const ext = file.name.split('.').pop()
        console.log('file', file, ext)
        const fileReader = new FileReader()
        fileReader.readAsText(file, "UTF-8");
        fileReader.onload = e => {
            const contents = e.target?.result as string
            //const tgts = ext?.includes('csv') ? parse_csv(contents) : parse_txt(contents, context.obsid)
            let tgts: Target[] = [] 
            switch (ext) {
                case 'json':
                    tgts = parse_json(contents)
                    break;
                case 'csv':
                    tgts = parse_csv(contents)
                    break;
                case 'txt':
                    tgts = parse_txt(contents, context.obsid)
                    break;
                default:
                    console.error('file type not supported')
                    return
            }
            console.log('tgts', tgts)
            props.setOpen && props.setOpen(false)
            props.setTargets(tgts)
        };
    };
    return (
        <>
            <input
                accept="*.csv,*.txt"
                style={{ display: 'none' }}
                id="raised-button-file"
                type="file"
                multiple
                onChange={fileLoad}
            />
            <label htmlFor="raised-button-file">
                <Button variant="outlined" component="span" color="primary"
                >
                    {props.label}
                </Button>
            </label>
        </>
    )

}

export default function UploadDialog(props: Props) {
    const [open, setOpen] = React.useState(false);
    const [label, setLabel] = React.useState("Upload Targets");

    const handleClickOpen = () => {
        setOpen(true);
    };


    const handleClose = () => {
        setOpen(false);
    };

    return (
        <div>
            <Tooltip title="Upload Targets from .csv file">
                <Button onClick={handleClickOpen} startIcon={<UploadIcon />}>
                    {label}
                </Button>
            </Tooltip>
            <Dialog
                open={open}
                onClose={handleClose}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">{"Upload Targets from .csvfile"}</DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Select the file to upload
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <UploadComponent
                        label={label}
                        setLabel={setLabel}
                        setOpen={setOpen}
                        setTargets={props.setTargets} />
                </DialogActions>
            </Dialog>
        </div>
    );
}
