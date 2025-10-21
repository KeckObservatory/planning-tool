import Box from "@mui/material/Box";
import FormLabel from "@mui/material/FormLabel";
import Slider from "@mui/material/Slider";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { config } from "../config";


dayjs.extend(timezone);
dayjs.extend(utc);

interface Props {
    times: Date[]
    time: Date
    setTime: Function
}

const TimeSlider = (props: Props) => {

    const valueLabelFormat = (value: number) => {
        const dte = dayjs(value)
        return `${dte.format('HH:mm')} (${dte.utc(false).format('HH:mm')} UTC)`
    }

    const handleHourOffsetChange = (_: Event, value: number | number[]) => {
        if (typeof (value) === 'number') {
            const newtime = new Date(value)
            props.setTime(newtime)
        }
    }

    const marks = props.times.map((dte: Date) => {
        return { value: dte.valueOf() }
    })

    return (
        <Box sx={{
            height: "40px",
        }} padding={0}>
            <FormLabel id="hour-offset-from-now-label">{`HT: ${dayjs(props.time).tz(config.timezone, false).format('HH:mm')}, UTC: ${dayjs(props.time).utc().format('HH:mm')}`}</FormLabel>
            <Slider
                aria-label="Hours from now"
                onChange={handleHourOffsetChange}
                value={props.time.valueOf()}
                valueLabelDisplay="auto"
                valueLabelFormat={valueLabelFormat}
                step={null}
                min={props.times[0].valueOf()}
                max={props.times[props.times.length - 1].valueOf()}
                marks={marks}
            />
        </Box>
    )
}

export default TimeSlider
