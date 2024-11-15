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
import { v4 as randomId } from 'uuid';
import { format_tags, PropertyProps, raDecFormat, TargetProps } from './target_edit_dialog';

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
    return [desc, key]
}))

const convert_value_to_type = (props: PropertyProps, value: unknown): unknown => {
    const type = props.type
    if (type.includes('number') || type.includes('integer')) {
        //@ts-ignore
        typeof value === 'string' && (value = value.replaceAll('\'', ''))
        return Number(value)
    }
    else if (type.includes('string')) {
        //@ts-ignore
        return String(value)
    }
    else if (type.includes('boolean')) {
        //@ts-ignore
        return Boolean(value)
    }
    else if (type.includes('array') && typeof value === 'string') {
        const arr = value.split(',') as string[]
        return arr.map(item => convert_value_to_type(props.items as PropertyProps, item))
    }
    return value
}

export const format_target_property = (key: keyof Target, value: unknown, props: PropertyProps) => {
    let fmtValue = convert_value_to_type(props, value)
    if (key === 'ra' || key === 'dec') {
        //@ts-ignore
        fmtValue = raDecFormat(fmtValue as string)
    }
    else if (key === 'tags') {
        //@ts-ignore
        fmtValue = format_tags(fmtValue as Array<string>) 
    }
    return fmtValue
}

export const format_targets = (tgts: UploadedTarget[], targetProps: TargetProps) => {
    const fmtTgts = tgts.map((tgt) => {
        Object.entries(tgt).forEach(([key, value]) => {
            const props = targetProps[key]
            const fmtValue = format_target_property(key as keyof Target, value, props)
            //@ts-ignore
            tgt[key] = fmtValue
        })
        return tgt
    }) 
    return fmtTgts 
}

interface StarListOptionalKeys {
    gmag?: number,
    jmag?: number,
    epoch?:  string,
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

/*
const re_valid = r"""
# Validate a CSV string having single, double or un-quoted values.
^                                   # Anchor to start of string.
\s*                                 # Allow whitespace before value.
(?:                                 # Group for value alternatives.
  '[^'\\]*(?:\\[\S\s][^'\\]*)*'     # Either Single quoted string,
| "[^"\\]*(?:\\[\S\s][^"\\]*)*"     # or Double quoted string,
| [^,'"\s\\]*(?:\s+[^,'"\s\\]+)*    # or Non-comma, non-quote stuff.
)                                   # End group of value alternatives.
\s*                                 # Allow whitespace after value.
(?:                                 # Zero or more additional values
  ,                                 # Values separated by a comma.
  \s*                               # Allow whitespace before value.
  (?:                               # Group for value alternatives.
    '[^'\\]*(?:\\[\S\s][^'\\]*)*'   # Either Single quoted string,
  | "[^"\\]*(?:\\[\S\s][^"\\]*)*"   # or Double quoted string,
  | [^,'"\s\\]*(?:\s+[^,'"\s\\]+)*  # or Non-comma, non-quote stuff.
  )                                 # End group of value alternatives.
  \s*                               # Allow whitespace after value.
)*                                  # Zero or more additional values
$                                   # Anchor to end of string.
"""

const re_value = r"""
# Match one value in valid CSV string.
(?!\s*$)                            # Don't match empty last value.
\s*                                 # Strip whitespace before value.
(?:                                 # Group for value alternatives.
  '([^'\\]*(?:\\[\S\s][^'\\]*)*)'   # Either $1: Single quoted string,
| "([^"\\]*(?:\\[\S\s][^"\\]*)*)"   # or $2: Double quoted string,
| ([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)  # or $3: Non-comma, non-quote stuff.
)                                   # End group of value alternatives.
\s*                                 # Strip whitespace after value.
(?:,|$)                             # Field ends on comma or EOS.
"""
*/


const csv_to_array = (text: string) => {
    var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    // Return NULL if input string is not well formed CSV string.
    if (!re_valid.test(text)) {
        console.warn('csv_to_array: invalid csv string')
        return null;
    }
    var a = [];                     // Initialize array to receive values.
    text.replace(re_value, // "Walk" the string using replace with callback.
        //@ts-ignore
        function(m0, m1, m2, m3) {
            // Remove backslash from \' in single quoted values.
            if      (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
            // Remove backslash from \" in double quoted values.
            else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
            else if (m3 !== undefined) a.push(m3);
            return ''; // Return empty string.
        });
    // Handle special case of empty last value.
    if (/,\s*$/.test(text)) a.push('');
    return a;
};

const parse_csv = (contents: string) => {
    let [headerStr, ...lines] = contents.split('\n')
        .map(s => s.replace('\r', ''))

    const header = csv_to_array(headerStr)
    if (header === null) {
        console.warn('invalid csv header')
        return []
    }

    const tgtValues = lines.map(line => csv_to_array(line)).filter((item) => item !== null) as string[][]
    const tgts = tgtValues.map(line => {
        const tgt = {} as UploadedTarget;
        header.forEach((hdr, index) => {
            const key = hdrToKeyMapping[hdr]
            let value = line.at(index)
            //@ts-ignore
            key && (tgt[key] = value)
        });
        return tgt;
    });
    return tgts
}

const split_at = (index: number, str: string) => [str.slice(0, index), str.slice(index+1)] 

const parse_txt = (contents: string, obsid: number) => {
    let tgts = [] as UploadedTarget[]
    contents.split('\n').forEach((row) => {
        if (row === '') return
        if (row.startsWith('#')) return
        const [target_name, tail] = split_at(15, row) 
        const [rah, ram, ras, dech, decm, decs, epoch, ...opts] = tail.replace(/\s\s+/g, ' ').split(' ')
        const ra = `${rah.padStart(2,'0')}:${ram.padStart(2,'0')}:${ras}`
        const dec = `${dech.padStart(2,'0')}:${decm.padStart(2,'0')}:${decs}`
        const coordValid = ra.match(targetProps.ra.pattern as string) && dec.match(targetProps.dec.pattern as string)
        if (!coordValid) {
            console.warn('ra', ra, 'dec', dec)
            return
        }
        let tgt: UploadedTarget = {
            _id: randomId(),
            target_name,
            obsid: String(obsid),
            ra,
            dec,
            epoch
        };
        opts.forEach((opt) => {
            const [key, value] = opt.split('=')
            const tgtKey = starlistToKeyMapping[key as keyof StarListOptionalKeys] as keyof Target 
            //@ts-ignore
            tgt[tgtKey] = value
        })
        tgts.push(tgt);
    });
    return tgts
}

interface UploadedTarget {
    [key: string]: string
}

export function UploadComponent(props: UploadProps) {

    const context = useStateContext()

    const fileLoad = (evt: React.ChangeEvent<HTMLInputElement>) => {
        let file: File = new File([], 'empty')
        evt.target?.files && (file = evt.target?.files[0])
        props.setLabel && props.setLabel(`${file.name} Uploaded`)
        const ext = file.name.split('.').pop()
        const fileReader = new FileReader()
        fileReader.readAsText(file, "UTF-8");
        fileReader.onload = e => {
            const contents = e.target?.result as string
            let tgts: UploadedTarget[] = [] 
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
            const fmtTgts = format_targets(tgts, targetProps)
            props.setTargets(fmtTgts)
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
