import { Button, Tooltip } from "@mui/material"
import { Dome, TargetView } from "./two_d_view"
import { GeoModel, LngLatEl, useStateContext } from "../App"
import * as util from './sky_view_util.tsx'
import { alt_az_observable } from "./target_viz_chart.tsx"

// Function to convert array of objects to CSV and save
const saveRowsAsCSV = (rows: any[], filename: string = 'sky_chart_data.csv') => {
    if (rows.length === 0) {
        console.warn('No data to export')
        return
    }

    // Get headers from the first object's keys
    const headers = Object.keys(rows[0])

    // Create CSV content
    const csvContent = [
        // Header row
        headers.join(','),
        // Data rows
        ...rows.map(row =>
            headers.map(header => {
                const value = row[header]
                // Handle values that might contain commas or quotes
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`
                }
                return value
            }).join(',')
        )
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }
}

interface Props {
    targetView: TargetView[],
    time: Date,
    dome: Dome
}


const generate_times = (startTime: Date, endTime: Date, stepSize: number) => {
    const totalMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60)
    const nLen = Math.floor(totalMinutes / stepSize) + 1
    const deltaTimes = Array.from({ length: nLen }, (_, idx) => stepSize * idx)
    console.log('generated delta times: ', deltaTimes)
    return deltaTimes.map((minutes: number) => {
        return util.add_hours(startTime, minutes / 60)
    })
}

const find_transition_time = (ra: number, dec: number, lngLatEl: LngLatEl, geoModel: GeoModel,
    startTime: Date, endTime: Date, minStep = 1) => {
    const times = generate_times(startTime, endTime, minStep)
    console.log('finding transition in times', times)
    const altAz = util.ra_dec_to_az_alt(ra, dec, startTime, lngLatEl)
    const startObservable = alt_az_observable(altAz[1], altAz[0], geoModel).observable
    for (let idx = 1; idx < times.length - 1; idx++) {
        const altAz = util.ra_dec_to_az_alt(ra, dec, times[idx], lngLatEl)
        const obs = alt_az_observable(altAz[1], altAz[0], geoModel)
        if (obs.observable !== startObservable) { //transitioned
            return startObservable ? times[idx - 1] : times[idx]
        }
    }
    console.log('no transition found between ', startTime, ' and ', endTime, 'using: ', startObservable ? startTime : endTime)
    return startObservable ? startTime : endTime
}

const find_fine_transition_time = (tv: TargetView, vIdx: number, lngLatEl: LngLatEl, geoModel: GeoModel) => {
    // const visibleTime = tv.visibility[vIdx].datetime
    // const nonVisibleTime = !tv.visibility[vIdx].observable ? tv.visibility[vIdx + 1].datetime : tv.visibility[vIdx - 1].datetime
    // const startTime = visibleTime < nonVisibleTime ? visibleTime : nonVisibleTime
    // const endTime = visibleTime > nonVisibleTime ? visibleTime : nonVisibleTime

    const [start, end] = !tv.visibility[vIdx].observable ? 
    [tv.visibility[vIdx].datetime, tv.visibility[vIdx - 1].datetime] : 
    [tv.visibility[vIdx - 1].datetime, tv.visibility[vIdx].datetime]
    console.log('finding fine transition time between ', start, ' and ', end)
    //find transition time
    const transitionTime = find_transition_time(tv.ra_deg, tv.dec_deg, lngLatEl, geoModel, start, end)
    return transitionTime
}

export const SkyChartDataSummary = (props: Props) => {
    const { targetView, time, dome } = props
    const context = useStateContext()

    const lngLatEl = context.config.tel_lat_lng_el[dome]
    const geoModel = context.config.tel_geometry[dome]

    const generateRows = () => {
        let rows: any[] = []
        targetView.map(tv => {
            const target_name = tv.target_name

            //get transition times 
            let transitionTimesIdx: number[] = []
            //loop through visibility array and find transitions

            for (let idx = 1; idx < tv.visibility.length; idx++) {
                const sv = tv.visibility[idx]
                const lastSV = tv.visibility[idx - 1]
                //check if transitioning
                if (sv.observable !== lastSV.observable) {
                    // transitioning from not visible to visible
                    transitionTimesIdx.push(idx)
                }
            }

            //loop through transition times and find more precise times
            const fineTransitionTimes: Date[] = []
            transitionTimesIdx.forEach((vIdx) => {
                const ftt = find_fine_transition_time(tv, vIdx, lngLatEl, geoModel)
                fineTransitionTimes.push(ftt)
            })


            fineTransitionTimes.forEach(t => {
                console.log('transition time: ', t)
                const azAlt = util.ra_dec_to_az_alt(tv.ra_deg, tv.dec_deg, t, lngLatEl)
                const observable = alt_az_observable(azAlt[1], azAlt[0], geoModel)
                let row = {
                    target_name,
                    datetime: t,
                    airmass: util.air_mass(azAlt[1], lngLatEl.el),
                    altitude: azAlt[1],
                    azimuth: azAlt[0],
                    observable: observable.observable,
                    status: observable ? 'rising': 'setting',
                    reasons: observable.reasons.join(', ')
                }
                rows.push(row)
            })
        })
        return rows.sort((a, b) => (a.datetime > b.datetime) ? 1 : ((b.datetime > a.datetime) ? -1 : 0))
    }

    const handleDownload = () => {
        const rows = generateRows()
        const timestamp = time.toISOString().split('T')[0].replace(/:/g, '-')
        saveRowsAsCSV(rows, `target_data_${timestamp}.csv`)
    }

    return (
        <Tooltip title={'Save chart data as .png file'}>
            <Button
                sx={{ height: '36px', width: '200px', margin: '6px', marginTop: 'auto' }}
                onClick={handleDownload}
                variant='contained'
            >
                Download Table
            </Button>
        </Tooltip>
    )
}