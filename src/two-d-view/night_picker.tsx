import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';

const datePickerStyle = {
    margin: '0px',
    padding: '0px'
}

interface Props {
    date: Date
    handleDateChange: (date: Dayjs | null) => void
}

export default function NightPicker(props: Props) {
    const dte = dayjs(props.date)
    console.log('night picker dte', dte)

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
                sx={datePickerStyle}
                views={['year', 'month', 'day']}
                label="Date of observation (HT)"
                value={dte}
                onChange={props.handleDateChange}
            />
        </LocalizationProvider>
    );
}