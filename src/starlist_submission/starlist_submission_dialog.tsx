import { useState } from 'react'

import { Stack, TextField, List, Typography, Button, Tooltip } from '@mui/material';
import { DialogComponent } from '../dialog_component';
import { Dome, DomeParam } from '../two-d-view/two_d_view_common.tsx';
import { useQueryParam, withDefault } from 'use-query-params';
import { ExportProps, getStarlist } from '../table_toolbar';
import { useSnackbarContext, useStateContext } from '../App';
import React from 'react';
import { get_user_schedule, ObserverSchedule, submit_starlist, SubmittedStarList, TelSchedule } from '../api/api_root';
import { TargetListItem } from './target_list_item';
import { ObserverScheduleTable } from './observer_schedule_table';
import { TelescopeScheduleTable } from './telescope_schedule_table';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';
import dayjs, { Dayjs } from 'dayjs';
import { Target } from '../App';
import { config } from '../config.tsx';
import { has_nonzero_value } from '../validation_check_dialog.tsx';
import { QueuedSubmission, submission_key, SubmissionQueueTable } from './submission_queue_table';

interface StarlistSubmissionDialogProps extends ExportProps {
    open: boolean,
    handleClose: () => void
}

// Max targets allowed for a scheduled night: anything less than a full night gets the
// half-night limit. With no schedule entry selected, the full-night limit applies.
export const target_limit = (fractionOfNight?: number): number =>
    fractionOfNight == null || fractionOfNight >= 1
        ? config.full_night_target_limit
        : config.half_night_target_limit

const moveItem =(rows: string[], from: number, to: number): string[] => {
    const newRows = [...rows]
    const [row] = newRows.splice(from, 1)
    newRows.splice(to, 0, row)
    return newRows
}

// Flags problems with individual targets in the export list: missing names, and
// targets that are duplicated - either sharing a name, or whose ra_deg/dec_deg fall
// within tolerance of another target's. Returns one warning message per problem found.
const find_malformed_targets = (targets: Target[]): string[] => {
    const warnings: string[] = []

    const unnamedCount = targets.filter((tgt) => !tgt.target_name).length
    if (unnamedCount > 0) {
        warnings.push(`${unnamedCount} target(s) are missing a name.`)
    }

    const duplicates = new Set<string>()

    const nameCounts = new Map<string, number>()
    targets.forEach((tgt) => {
        if (!tgt.target_name) return
        nameCounts.set(tgt.target_name, (nameCounts.get(tgt.target_name) ?? 0) + 1)
    })
    nameCounts.forEach((count, name) => {
        if (count > 1) duplicates.add(name)
    })

    for (let i = 0; i < targets.length; i++) {
        const a = targets[i]
        if (a.ra_deg == null || a.dec_deg == null) continue
        for (let j = i + 1; j < targets.length; j++) {
            const b = targets[j]
            if (b.ra_deg == null || b.dec_deg == null) continue
            if (Math.abs(a.ra_deg - b.ra_deg) < config.duplicate_radec_tolerance_deg &&
                Math.abs(a.dec_deg - b.dec_deg) < config.duplicate_radec_tolerance_deg) {
                a.target_name && duplicates.add(a.target_name)
                b.target_name && duplicates.add(b.target_name)
            }
        }
    }

    if (duplicates.size > 0) {
        warnings.push(`Duplicate targets found (name or RA/Dec): ${[...duplicates].join(', ')}`)
    }

    return warnings
}

// Whether any target being submitted has a real (nonzero) proper motion - LGS/NGS targets
// cannot have proper motion, so this gates the Submit button.
const has_nonzero_pm = (targets: Target[]): boolean =>
    targets.some((tgt) => has_nonzero_value(tgt.pm_ra) || has_nonzero_value(tgt.pm_dec))

// A pm_ra/pm_dec of exactly zero means "no measurement", not "measured to be zero" - strip it
// so the generated starlist never writes a meaningless pmra=0/pmdec=0.
const strip_zero_pm = (targets: Target[]): Target[] => targets.map((tgt) => {
    const pm_ra = has_nonzero_value(tgt.pm_ra) ? tgt.pm_ra : undefined
    const pm_dec = has_nonzero_value(tgt.pm_dec) ? tgt.pm_dec : undefined
    if (pm_ra === tgt.pm_ra && pm_dec === tgt.pm_dec) return tgt
    return { ...tgt, pm_ra, pm_dec }
})

export const StarlistSubmissionDialog = (props: StarlistSubmissionDialogProps) => {
    // target must have ra dec and be defined
    const [dome, setDome] = useQueryParam<Dome>('dome', withDefault(DomeParam, 'Keck 2' as Dome))
    const [piName, setPiName] = useState<string>("")
    const [semid, setSemid] = useState<string>("")
    const [date, setDate] = useState<Dayjs | null>(dayjs())
    const [comments, setComments] = useState<string>("")
    const [schedule, setSchedule] = useState<ObserverSchedule[]>([])
    const [selectedSchedId, setSelectedSchedId] = useState<number | undefined>(undefined)
    const [instrument, setInstrument] = useState<string>("")
    const [fractionOfNight, setFractionOfNight] = useState<number | undefined>(undefined)
    // Nights queued to receive this same star list, sent one request each on Submit.
    const [queue, setQueue] = useState<QueuedSubmission[]>([])
    const [submitting, setSubmitting] = useState<boolean>(false)
    const context = useStateContext()
    const snackbarContext = useSnackbarContext()

    // populates the form from a scheduled night. add new form values here.
    const onScheduleRowSelect = (entry: ObserverSchedule | TelSchedule) => {
        setSelectedSchedId(entry.SchedId)
        setPiName(entry.PiLastName)
        setInstrument(entry.Instrument)
        setFractionOfNight(entry.FractionOfNight)
        setDate(dayjs(entry.Date))
        if (entry.TelNr === 1 || entry.TelNr === 2) {
            setDome(`Keck ${entry.TelNr}` as Dome)
        }
        setSemid(`${entry.Semester}_${entry.ProjCode}`)
    }

    React.useEffect(() => {
        const run = async () => {
            const resp = await get_user_schedule(context.obsid)
            setSchedule(Array.isArray(resp) ? resp : [])
        }
        run()
    }, [context.obsid])

    const starListTextInit = getStarlist(strip_zero_pm(props.exportTargets), false)
    const starListInit = starListTextInit.split('\n').filter( row => row.length > 0)

    const malformedTargetWarnings = React.useMemo(
        () => find_malformed_targets(props.exportTargets),
        [props.exportTargets]
    )
    const hasMalformedTargets = malformedTargetWarnings.length > 0

    // LGS/NGS targets cannot have proper motion, so a real (nonzero) pm_ra/pm_dec blocks
    // submission entirely rather than just warning.
    const hasNonzeroPM = React.useMemo(
        () => has_nonzero_pm(props.exportTargets),
        [props.exportTargets]
    )

    React.useEffect(() => {
        if (!props.open) return

        // The app's global snackbar only holds one message at a time, so every
        // warning found is combined into a single message rather than firing
        // setSnackbarMessage repeatedly (which would just have the last call win).
        const warnings: string[] = []

        const anyLgs = props.exportTargets.some(tgt => tgt.lgs === '1')
        if (!anyLgs) {
            warnings.push("There are no LGS targets being submitted!")
        }

        const pmTargetNames = props.exportTargets
            .filter(tgt => has_nonzero_value(tgt.pm_ra) || has_nonzero_value(tgt.pm_dec))
            .map(tgt => tgt.target_name)
            .filter((name): name is string => !!name)
        if (pmTargetNames.length > 0) {
            warnings.push(`Targets should not have proper motion: ${pmTargetNames.join(', ')}`)
        }

        warnings.push(...malformedTargetWarnings)

        if (warnings.length > 0) {
            snackbarContext.setSnackbarMessage({ severity: 'warning', message: warnings.join('\n') })
            snackbarContext.setSnackbarOpen(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.exportTargets, props.open])

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

    // A cleared/partially-typed picker leaves a non-null but invalid Dayjs, not null,
    // so `date ? ... : ""` alone let an unformattable date slip through to the backend.
    const isDateValid = date != null && date.isValid()
    const isPiNameValid = piName.trim().length > 0

    const show_message = (severity: 'success' | 'warning' | 'error', message: string) => {
        snackbarContext.setSnackbarMessage({ severity, message })
        snackbarContext.setSnackbarOpen(true)
    }

    // The form fields for one night, or an error message if they aren't complete.
    const current_form = (): Omit<SubmittedStarList, 'slist'> | string => {
        if (date == null || !date.isValid()) return 'Please select a valid HST date.'
        if (!isPiNameValid) return 'Please enter a PI name.'
        return {
            telescope: dome.slice(dome.length - 1),
            hstDate: date.format('YYYY-MM-DD'),
            piname: piName,
            comments: comments ?? "",
            semid: semid ?? "",
            instrument: instrument ?? "",
        }
    }

    const add_to_queue = () => {
        const form = current_form()
        if (typeof form === 'string') {
            show_message('error', form)
            return
        }
        const key = submission_key(form)
        if (queue.some((entry) => entry.key === key)) {
            show_message('warning', `${form.hstDate} on Keck ${form.telescope} for ${form.semid || 'this program'} is already in the list.`)
            return
        }
        setQueue((q) => [...q, { key, form, status: 'pending', fractionOfNight }])
    }

    const remove_from_queue = (key: string) => setQueue((q) => q.filter((entry) => entry.key !== key))

    const set_entry_status = (key: string, status: QueuedSubmission['status'], message?: string) =>
        setQueue((q) => q.map((entry) => entry.key === key ? { ...entry, status, message } : entry))

    const submit_queue = async () => {
        // Entries already sent are skipped, so pressing Submit again retries only the failures.
        const toSend = queue.filter((entry) => entry.status !== 'sent')
        const slist = (starListStrings ?? []).join('\n')
        setSubmitting(true)
        let failed = 0
        for (const entry of toSend) { // one at a time, so each night gets its own clear result
            set_entry_status(entry.key, 'sending')
            const status = String(await submit_starlist({ ...entry.form, slist }) ?? 'No response')
            const ok = status.includes('success')
            if (!ok) failed += 1
            set_entry_status(entry.key, ok ? 'sent' : 'failed', status)
        }
        setSubmitting(false)
        if (failed === 0) {
            show_message('success', `Submitted ${toSend.length} star list(s).`)
            props.handleClose()
        } else {
            show_message('error', `${failed} of ${toSend.length} submission(s) failed - hover a status for details. Submit again to retry them.`)
        }
    }

    const submit_starlist_to_database = async () => {
        if (hasMalformedTargets) {
            snackbarContext.setSnackbarMessage({ severity: 'error', message: 'Please fix the malformed targets before submitting.' })
            snackbarContext.setSnackbarOpen(true)
            return
        }
        if (hasNonzeroPM) {
            snackbarContext.setSnackbarMessage({ severity: 'error', message: 'LGS/NGS targets cannot have proper motion. Please remove proper motion values before submitting.' })
            snackbarContext.setSnackbarOpen(true)
            return
        }
        if (queue.length > 0) {
            await submit_queue()
            return
        }
        const fields = current_form()
        if (typeof fields === 'string') {
            show_message('error', fields)
            return
        }
        const form: SubmittedStarList = { ...fields, slist: (starListStrings ?? []).join('\n') }
        const submit_status = await submit_starlist(form)
        if (submit_status.includes("success")) {
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
        <span>LGS List Submission. Select the schedule row you want to submit.</span>
    )

    const unsentCount = queue.filter((entry) => entry.status !== 'sent').length
    // With a list, Submit sends the list (the form only feeds "Add to list"); without one, it
    // sends the form as before.
    // Each night being submitted must fit the star list within its own (full/half night) limit.
    const nTargets = (starListStrings ?? []).length
    const limit_warning = (fraction: number | undefined, night?: { telescope: string, hstDate: string }): string | undefined => {
        const limit = target_limit(fraction)
        if (nTargets <= limit) return undefined
        const size = fraction == null ? 'night' : fraction >= 1 ? 'full night' : 'half night'
        const where = night ? `${night.hstDate} on Keck ${night.telescope} (${size})` : `a ${size}`
        return `${nTargets} targets exceed the ${limit}-target limit for ${where}.`
    }
    const targetLimitWarnings = (queue.length > 0
        ? queue.filter((entry) => entry.status !== 'sent')
            .map((entry) => limit_warning(entry.fractionOfNight, entry.form))
        : [limit_warning(fractionOfNight, isDateValid ? { telescope: dome.slice(dome.length - 1), hstDate: date.format('YYYY-MM-DD') } : undefined)]
    ).filter((w): w is string => !!w)
    const exceedsTargetLimit = targetLimitWarnings.length > 0
    const submitBlocked = hasMalformedTargets || hasNonzeroPM || submitting || exceedsTargetLimit
        || (queue.length > 0 ? unsentCount === 0 : (!isDateValid || !isPiNameValid))

    const dialogActions = (
        <Stack direction='row' spacing={1} alignItems='center'>
            {exceedsTargetLimit && (
                <Typography variant="body2" color="error" sx={{ whiteSpace: 'pre-line' }}>
                    {targetLimitWarnings.join('\n')}
                </Typography>
            )}
            <Tooltip title="Queue this night to receive the same star list">
                <span>
                    <Button
                        variant="outlined"
                        disabled={!isDateValid || !isPiNameValid || submitting}
                        onClick={add_to_queue}
                    >
                        Add to list
                    </Button>
                </span>
            </Tooltip>
            <Button
                variant="contained"
                color="primary"
                disabled={submitBlocked}
                onClick={submit_starlist_to_database}
            >
                {submitting ? 'Submitting...' : queue.length > 0 ? `Submit ${unsentCount} night(s)` : 'Submit'}
            </Button>
        </Stack>
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
                Your Schedule
            </Typography>
            <ObserverScheduleTable
                schedule={schedule}
                onRowSelect={onScheduleRowSelect}
                selectedSchedId={selectedSchedId}
            />
            <Typography variant="subtitle1">
                Telescope Schedule (AO instruments only)
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DesktopDatePicker
                    sx={{ width: '25%' }}
                    views={['year', 'month', 'day']}
                    label="HST Date"
                    value={date}
                    onChange={(newDate) => setDate(newDate)}
                    slotProps={{
                        textField: {
                            error: !isDateValid,
                            helperText: isDateValid ? undefined : 'Required',
                        },
                    }}
                />
            </LocalizationProvider>
            <TelescopeScheduleTable
                onRowSelect={onScheduleRowSelect}
                selectedSchedId={selectedSchedId}
                date={date}
            />
            <TextField
                label="Comments"
                value={comments}
                sx={{ width: '100%' }}
                onChange={(e) => setComments(e.target.value)}
                multiline
                rows={4}
            />
            <Typography variant="subtitle1">
                Nights to Submit
            </Typography>
            <SubmissionQueueTable
                queue={queue}
                onRemove={remove_from_queue}
                disabled={submitting}
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
