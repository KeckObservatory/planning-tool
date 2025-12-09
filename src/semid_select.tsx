import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { useQueryParam } from 'use-query-params';
import { useStateContext } from './App';

export const SemidSelect = () => {
    const [semid, setSemid] = useQueryParam<string>('semid');
    const context = useStateContext()

    const handleChange = (event: SelectChangeEvent) => {
        console.log("Setting semid to", event.target.value);
        setSemid(event.target.value as string);
    };

    return (
        <Box sx={{ minWidth: 120 }}>
            <FormControl fullWidth size="small">
                <InputLabel id="semid-select-label">Semid</InputLabel>
                <Select
                    labelId="semid-select-label"
                    id="semid-simple-select"
                    value={semid}
                    label="Semid"
                    onChange={handleChange}
                >
                    <MenuItem key={"undefined"} value={undefined}>All Semids</MenuItem>
                    {
                        context.semids.map((sid) => (
                            <MenuItem key={sid} value={sid}>{sid}</MenuItem>
                        ))
                    }
                </Select>
            </FormControl>
        </Box>
    );
}