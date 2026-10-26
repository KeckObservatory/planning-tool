import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material"
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import dayOfYear from 'dayjs/plugin/dayOfYear'
import { ObserverSchedule } from "../api/api_root"

dayjs.extend(utc)
dayjs.extend(dayOfYear)

interface Props {
    schedule: ObserverSchedule[]
    onRowSelect: (entry: ObserverSchedule) => void
    selectedSchedId?: number
}

export const ObserverScheduleTable = (props: Props) => {
    const { schedule, onRowSelect, selectedSchedId } = props

    if (schedule.length === 0) {
        return (
            <Typography variant="body2" sx={{ padding: '8px' }}>
                No scheduled nights found.
            </Typography>
        )
    }


    const utDate = (entry: ObserverSchedule) => dayjs.utc(entry.Date).add(1, 'day')

    return (
        <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell>Instrument</TableCell>
                        <TableCell>HST Date</TableCell>
                        <TableCell>UT Date</TableCell>
                        <TableCell>Day of Year</TableCell>
                        <TableCell>Telescope</TableCell>
                        <TableCell>Fraction of Night</TableCell>
                        <TableCell>PI</TableCell>
                        <TableCell>Project Code</TableCell>
                        <TableCell>Observers</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {schedule.map((entry, idx) => (
                        <TableRow
                            key={entry.SchedId ?? idx}
                            hover
                            selected={selectedSchedId === entry.SchedId}
                            onClick={() => onRowSelect(entry)}
                            sx={{ cursor: 'pointer' }}
                        >
                            <TableCell>{entry.Instrument}</TableCell>
                            <TableCell>{entry.Date}</TableCell>
                            <TableCell>{utDate(entry).format('YYYY-MM-DD')}</TableCell>
                            <TableCell>{utDate(entry).dayOfYear()}</TableCell>
                            <TableCell>{entry.TelNr}</TableCell>
                            <TableCell>{entry.FractionOfNight}</TableCell>
                            <TableCell>{entry.PiLastName}</TableCell>
                            <TableCell>{entry.ProjCode}</TableCell>
                            <TableCell>{entry.Observers}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    )
}
