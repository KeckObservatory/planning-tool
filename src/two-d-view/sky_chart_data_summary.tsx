import { Button } from "@mui/material"
import { TargetView } from "./two_d_view"

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

export const SkyChartDataSummary = (props: { targetView: TargetView[], time: Date }) => {
    const { targetView, time } = props

    const generateRows = () => {
        let rows: any[] = []
        targetView.map(tv => {
            const target_name = tv.target_name
            tv.visibility.forEach(sv => {
                let row = { 
                    target_name, 
                    datetime: sv.datetime.toISOString(), 
                    airmass: sv.air_mass, 
                    altitude: sv.alt, 
                    azimuth: sv.az,
                    observable: sv.observable,
                    reasons: sv.reasons.join(', ')
                }
                rows.push(row)
            })
        })
        return rows
    }

    const handleDownload = () => {
        const rows = generateRows()
        const timestamp = time.toISOString().split('T')[0].replace(/:/g, '-')
        saveRowsAsCSV(rows, `target_data_${timestamp}.csv`)
    }

    return (
        <Button onClick={handleDownload}>
            Download Table
        </Button>
    )
}