export const FOVlink = 'FEATURES.json'
export const ROUND_MINUTES = 10 // minutes
export const STEP_SIZE = 1/6 //hours
export const TIMES_START = -7 //hours
export const TIMES_END = 7 //hours
export const RADIUS_EARTH = 6378.1 // km
export const ATMOSPHERE_HEIGHT = 50 // km

interface SemesterDates {
    start_day: number
    start_month: number
    end_day: number
    end_month: number
    plus_year?: number
}

interface SemesterRange {
    'A': SemesterDates
    'B': SemesterDates
}
export const SEMESTER_RANGES: SemesterRange = {
    'A': {
        start_day: 1,
        start_month: 2,
        end_day: 31,
        end_month: 7
    },
    'B': {
        start_day: 1,
        start_month: 8,
        end_day: 31,
        end_month: 1,
        plus_year: 1
    }
}

export const MARKER_SIZE = 10 //pxl radius
export const XAXIS_DTICK = 15 * 24 * 60 * 60 * 1000 // milliseconds
export const MOON_MARKER_LINE_WIDTH = 2 //pxl
export const MOON_MARKER_SIZE = 2 //pxl