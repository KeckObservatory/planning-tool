import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';
import dayjs, { Dayjs } from 'dayjs';

const datePickerStyle = {
    paddingTop: '9px',
    width: '175px',
    VerticalAlign: 'bottom'
}

interface Props {
    date: Date
    handleDateChange: (date: Dayjs | null) => void
}

export default function NightPicker(props: Props) {
    const dte = dayjs(props.date)

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DesktopDatePicker
                sx={datePickerStyle}
                views={['year', 'month', 'day']}
                label="Date of observation (HT)"
                value={dte}
                onChange={props.handleDateChange}
            />
        </LocalizationProvider>
    );
}