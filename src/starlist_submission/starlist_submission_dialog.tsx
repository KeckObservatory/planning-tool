import { useState } from 'react'

import { Stack, Switch, FormControlLabel, TextField, List, Typography, Button } from '@mui/material';
import { DialogComponent } from '../dialog_component';
import { Dome, DomeParam, DomeSelect } from '../two-d-view/two_d_view_common.tsx';
import { useQueryParam, withDefault } from 'use-query-params';
import { ExportProps, getStarlist } from '../table_toolbar';
import { useSnackbarContext, useStateContext } from '../App';
import React from 'react';
import { get_user_schedule, Schedule, submit_starlist, SubmittedStarList } from '../api/api_root';
import { TargetListItem } from './target_list_item';
import { ScheduleTable } from './schedule_table';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';
import dayjs, { Dayjs } from 'dayjs';

interface StarlistSubmissionDialogProps extends ExportProps {
    open: boolean,
    handleClose: () => void
}

const moveItem = (rows: string[], from: number, to: number): string[] => {
    const newRows = [...rows]
    const [row] = newRows.splice(from, 1)
    newRows.splice(to, 0, row)
    return newRows
}

export const StarlistSubmissionDialog = (props: StarlistSubmissionDialogProps) => {
    // target must have ra dec and be defined
    const [dome, setDome] = useQueryParam<Dome>('dome', withDefault(DomeParam, 'Keck 2' as Dome))
    const [piName, setPiName] = useState<string>("")
    const [date, setDate] = useState<Dayjs | null>(dayjs())
    const [comments, setComments] = useState<string>("")
    const [isLgs, setIsLgs] = useState(false)
    const [schedule, setSchedule] = useState<Schedule[]>([])
    const [selectedSchedId, setSelectedSchedId] = useState<number | undefined>(undefined)
    const context = useStateContext()
    const snackbarContext = useSnackbarContext()

    // populates the form from a scheduled night. add new form values here.
    const onScheduleRowSelect = (entry: Schedule) => {
        setSelectedSchedId(entry.SchedId)
        setPiName(entry.PiLastName)
        setDate(dayjs(entry.Date))
    }

    React.useEffect(() => {
        const run = async () => {
            setSchedule(await get_user_schedule(context.obsid))
        }
        run()
    }, [context.obsid])

    const starListTextInit = getStarlist(props.exportTargets, false)
    const starListInit = starListTextInit.split('\n').filter( row => row.length > 0)

    React.useEffect(() => {
        //check if there are any lgs targets
        const anyLgs = starListInit.some(lst => lst.includes('lgs=1'))
        if (!anyLgs) {
            snackbarContext.setSnackbarMessage({severity: "warning", message: "There are no LGS targets being submitted!"})
            snackbarContext.setSnackbarOpen(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.exportTargets])

    const [starListStrings, setStarListStrings] = useState<string[] | undefined>(starListInit)

    const moveRow = (from: number, to: number) => {
        setStarListStrings((rows) => rows ? moveItem(rows, from, to) : rows)
    }

    const starListItems = (starListStrings ?? []).map((starListString, idx, rows) => {
        const isFirst = idx === 0
        const isLast = idx === rows.length - 1
        return (
            <TargetListItem
                idx={idx}
                starListString={starListString}
                isFirst={isFirst}
                isLast={isLast}
                moveRow={moveRow}
                nRows={rows.length}
            />
        )
    })

    const submit_starlist_to_database = async () => {
        const form: SubmittedStarList = {
            telescope: dome.slice(dome.length - 1),
            hstDate: date ? date.format('YYYY-MM-DD') : "",
            piname: piName,
            comments: comments,
            lgsMode: isLgs,
            slist: (starListStrings ?? []).join('\n'),
        }
        const submit_status = await submit_starlist(form)
        if (submit_status.includes("File saved sucessfully")) {
            snackbarContext.setSnackbarMessage({severity: 'success', message:submit_status})
            snackbarContext.setSnackbarOpen(true)
            props.handleClose()
        }
        else {
            snackbarContext.setSnackbarMessage({severity: 'error', message: submit_status})
            snackbarContext.setSnackbarOpen(true)
        }
    }

    const dialogTitle = (
        <span>LGS List Submission</span>
    )

    const dialogActions = (
        <Button
            variant="contained"
            color="primary"
            onClick={submit_starlist_to_database}
        >
            Submit
        </Button>
    )
    const dialogContent = (
        <Stack
            sx={{
                paddingTop: '16px',
                display: 'flex',
                flexWrap: 'wrap',
            }}
            direction='column' spacing={2}>
            <Typography variant="subtitle1">
                Schedule
            </Typography>
            <ScheduleTable
                schedule={schedule}
                onRowSelect={onScheduleRowSelect}
                selectedSchedId={selectedSchedId}
            />
            <FormControlLabel
                label="Is LGS"
                value={isLgs}
                control={<Switch checked={isLgs} />}
                onChange={(_, checked) => setIsLgs(checked)}
            />
            <DomeSelect
                dome={dome}
                setDome={setDome}
            />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DesktopDatePicker
                    sx={{ width: '25%' }}
                    views={['year', 'month', 'day']}
                    label="HST Date"
                    value={date}
                    onChange={(newDate) => setDate(newDate)}
                />
            </LocalizationProvider>
            <TextField
                label="PI Name"
                value={piName}
                focused={piName ? true : false}
                onChange={(e) => setPiName(e.target.value)}
                sx={{ width: '25%' }}
            />
            <TextField
                label="Comments"
                value={comments}
                sx={{ width: '100%' }}
                onChange={(e) => setComments(e.target.value)}
                multiline
                rows={4}
            />
            <Typography variant="subtitle1" sx={{ paddingTop: '16px' }}>
                Star List
            </Typography>
            <List
                dense
                sx={{
                    maxHeight: 400,
                    overflowY: 'auto',
                    width: '100%',
                }}
            >
                {starListItems}
            </List>
        </Stack>
    )

    return (
        <DialogComponent
            open={props.open}
            handleClose={props.handleClose}
            titleContent={dialogTitle}
            children={dialogContent}
            actions={dialogActions}
            maxWidth="xl"
            minWidth={1000}
        />
    )
}
