import { Chip, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material"
import DeleteIcon from '@mui/icons-material/Delete'
import { SubmittedStarList } from "../api/api_root"

export type SubmissionStatus = 'pending' | 'sending' | 'sent' | 'failed'

// One night's LGS submission. The star list itself isn't stored here: every entry shares the
// dialog's star list, read at submit time so reordering after queueing still applies.
export interface QueuedSubmission {
    key: string // telescope + HST date + semid; one submission per program per night
    form: Omit<SubmittedStarList, 'slist'>
    status: SubmissionStatus
    message?: string // the backend's response, shown on hover
}

export const submission_key = (form: Omit<SubmittedStarList, 'slist'>) =>
    `${form.telescope}|${form.hstDate}|${form.semid}`

const STATUS_COLOR: Record<SubmissionStatus, 'default' | 'info' | 'success' | 'error'> = {
    pending: 'default',
    sending: 'info',
    sent: 'success',
    failed: 'error',
}

interface Props {
    queue: QueuedSubmission[]
    onRemove: (key: string) => void
    disabled?: boolean // while a submit is in flight
}

export const SubmissionQueueTable = ({ queue, onRemove, disabled }: Props) => {
    if (queue.length === 0) {
        return (
            <Typography variant="body2" sx={{ padding: '8px' }}>
                No nights added. Submit sends the form above as a single submission, or use
                "Add to list" to queue several nights for the same star list.
            </Typography>
        )
    }

    return (
        <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell>HST Date</TableCell>
                        <TableCell>Telescope</TableCell>
                        <TableCell>Instrument</TableCell>
                        <TableCell>PI</TableCell>
                        <TableCell>Program</TableCell>
                        <TableCell>Comments</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell />
                    </TableRow>
                </TableHead>
                <TableBody>
                    {queue.map((entry) => (
                        <TableRow key={entry.key}>
                            <TableCell>{entry.form.hstDate}</TableCell>
                            <TableCell>{entry.form.telescope}</TableCell>
                            <TableCell>{entry.form.instrument}</TableCell>
                            <TableCell>{entry.form.piname}</TableCell>
                            <TableCell>{entry.form.semid}</TableCell>
                            <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {entry.form.comments}
                            </TableCell>
                            <TableCell>
                                <Tooltip title={entry.message ?? ''}>
                                    <Chip size="small" label={entry.status} color={STATUS_COLOR[entry.status]} />
                                </Tooltip>
                            </TableCell>
                            <TableCell>
                                <Tooltip title="Remove from list">
                                    <span>
                                        <IconButton
                                            size="small"
                                            disabled={disabled || entry.status === 'sending'}
                                            onClick={() => onRemove(entry.key)}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    )
}
