import dayjs from 'dayjs'
import * as SunCalc from 'suncalc'
import { DayViz } from './viz_dialog'
import {
    RADIUS_EARTH,
    ATMOSPHERE_HEIGHT,
    ROUND_MINUTES,
    STEP_SIZE,
    TIMES_START,
    TIMES_END
} from './constants'
import { LngLatEl } from '../App'


export const date_to_juld = (date: Date) => {
    return (date.getTime() / 86400000) + 2440587.5 //do not offset
}

export const get_gmt = (date?: Date) => {
    //NOTE: This uses the J2000 Epoch. This is the same as the GMST at 0h UT on 1 January 2000
    if (!date) date = new Date()
    const JD = date_to_juld(date)
    const T = (JD - 2451545) / 36525;
    let ThetaGMST = 67310.54841 + (876600 * 3600 + 8640184.812866) * T 
    + .093104 * (T**2) - ( 6.2 * 10**-6 ) * ( T**3 )
    ThetaGMST = ( ThetaGMST % ( 86400 * ( ThetaGMST / Math.abs(ThetaGMST) ) ) / 240) % 360
    return ThetaGMST 
}

export const ra_dec_to_deg = (time: string, dec = false) => {
    console.log('time', time, dec)
    let [hours, min, sec] = time.split(':')
    let deg
    if (dec) {
        let sign = 1
        if (hours[0] === '+') hours = hours.substring(1);
        if (hours[0] === '-') {
            hours = hours.substring(1);
            sign = -1;
        }
        deg = sign * parseInt(hours, 10) // dec is already in degrees
            + parseInt(min, 10) / 60
            + parseInt(sec, 10) / 60 ** 2
    }

    else {
        deg = 15 * parseInt(hours, 10) // convert hours to deg
            + 15 * parseInt(min, 10) / 60
            + 15 * parseInt(sec, 10) / 60 ** 2
    }
    return deg
}

export const cosd = (deg: number): number => {
    return Math.cos(Math.PI / 180 * deg)
}

export const sind = (deg: number): number => {
    return Math.sin(Math.PI / 180 * deg)
}

export const tand = (deg: number): number => {
    return Math.tan(Math.PI / 180 * deg)
}

export const ra_dec_to_az_alt = (ra: number, dec: number, date: Date, lngLatEl: LngLatEl): [number, number] => {
    /* Taken from Jean Meeus's Astronomical Algorithms textbook. Using equations
    13.5 & 13.6*/
    const hourAngle = (get_gmt(date) + lngLatEl.lng - ra) % 360
    const tanAzNum = sind(hourAngle)
    const tanAzDen = cosd(hourAngle) * sind(lngLatEl.lat) - tand(dec) * cosd(lngLatEl.lat)
    const az = Math.atan2(tanAzNum, tanAzDen) + Math.PI //radians (if reckoning from the north, subtract pi)
    // const az = Math.atan(tanAzNum/tanAzDen) //radians
    const sinEl = sind(lngLatEl.lat) * sind(dec) + cosd(lngLatEl.lat) * cosd(dec) * cosd(hourAngle)
    const el = Math.asin(sinEl) // radians
    return [(180 / Math.PI * az), (180 / Math.PI * el)]
}

export const add_hours = (date: Date, hours: number): Date => {
    const newDate = new Date(date.getTime())
    newDate.setTime(date.getTime() + hours * 3600000)
    return newDate
}

export const get_suncalc_times = (lngLatEl: LngLatEl, date?: Date) => {
    if (!date) {
        date = new Date()
    }
    SunCalc.addTime(-12, 'amateurDawn', 'amateurDusk')
    SunCalc.addTime(-18, 'astronomicalDawn', 'astronomicalDusk')
    let times = SunCalc.getTimes(date, lngLatEl.lat, lngLatEl.lng) as DayViz
    if (date < times.sunrise) { // sun has not risen yet. use yesterday.
        const yesterday = dayjs(date).add(-1, 'day').toDate()
        times = SunCalc.getTimes(yesterday, lngLatEl.lat, lngLatEl.lng) as DayViz
    }
    const nextday = dayjs(date).add(1, 'day').toDate() //be careful not to mutate date
    let nextdaytimes = SunCalc.getTimes(nextday, lngLatEl.lat, lngLatEl.lng) as DayViz
    times.sunrise = nextdaytimes.sunrise
    times.sunriseEnd = nextdaytimes.sunriseEnd

    times.amateurDawn = nextdaytimes.amateurDawn
    times.nadir = nextdaytimes.nadir
    times.astronomicalDawn = nextdaytimes.astronomicalDawn
    times.nightEnd = nextdaytimes.nightEnd
    times.dawn = nextdaytimes.dawn
    times.nauticalDawn = nextdaytimes.nauticalDawn
    times.goldenHourEnd = nextdaytimes.goldenHourEnd
    return times
}

const round_date = (minutes: number, date: Date) => {
    const coeff = 1000 * 60 * minutes;
    return new Date(Math.round(date.getTime() / coeff) * coeff)
}

const round_date_up = (date: Date, minutes: number) => {
    const coeff = 1000 * 60 * minutes
    return new Date(Math.ceil(date.getTime() / coeff) * coeff)
}

const round_date_down = (date: Date, minutes: number) => {
    const coeff = 1000 * 60 * minutes
    return new Date(Math.floor(date.getTime() / coeff) * coeff)
}

export const get_day_times = (startDateTime: Date, endDateTime: Date, stepSize=STEP_SIZE) => {
    //Used for viz chart
    const start = round_date_up(startDateTime, stepSize) 
    const end = round_date_down(endDateTime, stepSize)
    const nLen = Math.round( ( end.getTime() - start.getTime() ) / (stepSize * 60 * 1000) )
    let times = Array.from({ length: nLen }, (_, idx) => new Date(start.getTime() + stepSize * 60 * 1000 * idx ))
    return [start, ...times, end] //and start and end
}

export const get_times_using_nadir = (nadir: Date, roundMin=ROUND_MINUTES, stepSize=STEP_SIZE) => {
    const nLen = Math.round( ( TIMES_END - TIMES_START ) / stepSize)
    const deltaNadir = Array.from({ length: nLen }, (_, idx) => TIMES_START + stepSize * idx )
    const roundedNadir = round_date(roundMin, nadir)
    return deltaNadir.map((hour: number) => {
        return add_hours(roundedNadir, hour)
    })
}


export const get_target_traj = (ra: number, dec: number, times: Date[], lngLatEl: LngLatEl): [number, number][] => {
    let traj: [number, number][] = []
    times.forEach((d: Date) => {
        traj.push(ra_dec_to_az_alt(ra, dec, d, lngLatEl))
    })
    return traj
}

export function air_mass(alt: number): number; //secant formula
export function air_mass(alt: number, el: number): number; // Homogeneous spherical atmosphsere with elevated observer
export function air_mass(alt: number, el?: number) {
    if (el === undefined) {
        const zenith = 90 - alt
        return 1 / cosd(zenith)
    }
    const y = el / ATMOSPHERE_HEIGHT
    const z = RADIUS_EARTH / ATMOSPHERE_HEIGHT
    const a2 = ATMOSPHERE_HEIGHT * ATMOSPHERE_HEIGHT
    const r = RADIUS_EARTH + el 
    const g = ATMOSPHERE_HEIGHT - el 
    const zenith = 90 - alt
    const firstTerm = (r * r) * cosd(zenith) * cosd(zenith) / ( a2 )
    const secondTerm = 2 * RADIUS_EARTH * (g) / a2
    const thirdTerm = y * y
    const forthTerm = (y + z) * cosd(zenith)
    const X = Math.sqrt(firstTerm + secondTerm - thirdTerm + 1) - forthTerm
    return X
}


export const get_air_mass = (ra: number, dec: number, times: Date[], lngLatEl: LngLatEl) => {
    const azAlt = get_target_traj(ra, dec, times, lngLatEl)
    const airmass = azAlt.map((a: [number, number]) => { return air_mass(a[1], lngLatEl.el) })
    // const airmass = azAlt.map((a: [number, number]) => { return air_mass(a[1]) })
    return airmass
}

export const parallatic_angle = (ra: number, dec: number, date: Date, lngLatEl: LngLatEl) => {
    const hourAngle = (get_gmt(date) + lngLatEl.lng - ra) % 360
    const numerator = sind(hourAngle)
    const denominator: number = tand(lngLatEl.lat)
        * cosd(dec)
        - sind(dec) * cosd(hourAngle)
    return Math.atan2(numerator, denominator) * 180 / Math.PI 
}

export const get_parallactic_angle = (ra: number, dec: number, times: Date[], lngLatEl: LngLatEl): number[] => {
    let ang: number[] = []
    times.forEach((date: Date) => {
        ang.push(parallatic_angle(ra, dec, date, lngLatEl))
    })
    return ang
}

const angular_separation = (lon1: number, lat1: number, lon2: number, lat2: number): number => {
    const sdlon = sind(lon2 - lon1)
    const cdlon = cosd(lon2 - lon1)
    const slat1 = sind(lat1)
    const slat2 = sind(lat2)
    const clat1 = cosd(lat1)
    const clat2 = cosd(lat2)

    const numerator1 = clat2 * sdlon
    const numerator2 = clat1 * slat2 - slat1 * clat2 * cdlon
    const denominator = slat1 * slat2 + clat1 * clat2 * cdlon
    const numerator = Math.sqrt(numerator1 * numerator1 + numerator2 * numerator2)
    return Math.atan2(numerator, denominator) * 180 / Math.PI
}

export const lunar_angle = (ra: number, dec: number, date: Date, lngLatEl: LngLatEl) => {
    const sc = SunCalc.getMoonPosition(date, lngLatEl.lat, lngLatEl.lng)
    const moonPos = [sc.altitude * Math.PI/180, sc.azimuth * Math.PI/180] as [number, number]
    const [az, alt]= ra_dec_to_az_alt(ra, dec, date, lngLatEl)
    const angle = angular_separation(alt, az, moonPos[1], moonPos[0])
    return angle
}

export const get_lunar_angle = (ra: number, dec: number, times: Date[], lngLatEl: LngLatEl): number[] => {
    let ang: number[] = []
    times.forEach((date: Date) => {
        const angle = lunar_angle(ra, dec, date, lngLatEl)
        ang.push(angle)
    })
    return ang
}