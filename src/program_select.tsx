import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { useStateContext } from './App';
import { Tooltip } from '@mui/material';

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

interface props {
    semids: string[]
    onChange: (value: string[]) => void;
}

export const ProgramChipsInput = (props: props) => {
    const state = useStateContext()

    return (
    <Tooltip placement="left"
    title="Add your programs here. Other users who share these programs will be able to see and edit these targets.">
        <Autocomplete
            multiple
            id="checkboxes-semids"
            options={state.semids}
            disableCloseOnSelect
            onChange={(_event, value) => props.onChange(value)}
            renderOption={(props, option, { selected }) => {
                const { key, ...optionProps } = props;
                return (
                    <li key={key} {...optionProps}>
                        <Checkbox
                            icon={icon}
                            checkedIcon={checkedIcon}
                            style={{ marginRight: 8 }}
                            checked={selected}
                        />
                        {option}
                    </li>
                );
            }}
            style={{ width: 500 }}
            renderInput={(params) => (
                <TextField {...params} label="Semids" placeholder="Semids" />
            )}
        />
    </Tooltip>
    )
}