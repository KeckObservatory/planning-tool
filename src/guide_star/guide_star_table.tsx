import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import {
    DataGrid,
    GridColDef,
    GridRowParams,
    useGridApiRef
} from '@mui/x-data-grid';
import { useStateContext } from '../App.tsx';
import { convert_schema_to_columns } from '../target_table.tsx';
import { IconButton } from '@mui/material';
import { GuideStarTarget } from './guide_star_dialog.tsx';
import React from 'react';

// interface CatalogStarData {
//     name: string;
//     ra: string;
//     dec: string;
//     equinox: number;
//     pm_ra: number;
//     pm_dec: number;
//     dra: number;
//     ddec: number;
//     spec_type: string;
//     galaxy: number;
//     mag: number;
//     vmag: number;
//     rmag: number;
//     jmag: number;
//     hmag: number;
//     kmag: number;
//     dist: number;
//     b_vmag: number;
//     b_rmag: number;
// }


const AddGuideStarButton = (props: { target: GuideStarTarget }) => {
    const { target } = props

    const handleClick = () => {
        console.log("Add guide star for target:", target)
    }

    return (
        <IconButton color="primary" onClick={handleClick}>
            <AddIcon />
        </IconButton>
    )
}


interface Props {
    targets?: GuideStarTarget[];
    selectedGuideStarName?: string;
}

export default function GuideStarTable(props: Props) {
    const { targets, selectedGuideStarName } = props;
    const context = useStateContext()
    const cfg = context.config
    let columns = convert_schema_to_columns();
    const sortOrder = cfg.default_guide_star_table_columns;
    const apiRef = useGridApiRef();

    React.useEffect(() => {
        if (apiRef.current && selectedGuideStarName) {
            console.log("Selected guide star name:", selectedGuideStarName, apiRef.current)
            apiRef.current.selectRow(selectedGuideStarName);
        }
    }, [selectedGuideStarName]);

    columns = columns.sort((a, b) => {
        return sortOrder.indexOf(a.field) - sortOrder.indexOf(b.field);
    });

    const visibleColumns = Object.fromEntries(columns.map((col) => {
        const visible = cfg.default_guide_star_table_columns.includes(col.field)
        return [col.field, visible]
    }));

    const ActionsCell = (params: GridRowParams<GuideStarTarget>) => {
        const { row } = params;
        return [
            <AddGuideStarButton
                target={row}
            />
        ];
    }

    const addColumns: GridColDef[] = [
        {
            field: 'actions',
            type: 'actions',
            editable: false,
            headerName: 'Add',
            width: 50,
            disableExport: true,
            cellClassName: 'actions',
            getActions: ActionsCell,
        }
    ];

    columns = [...addColumns, ...columns];


    return (
        <Box
            sx={{
                height: 1000,
                width: 1200,
                '& .actions': {
                    color: 'text.secondary',
                },
                '& .textPrimary': {
                    color: 'text.primary',
                },
            }}
        >
            {Object.keys(visibleColumns).length > 0 && (
                <DataGrid
                    getRowId={(row: GuideStarTarget) => row.target_name}
                    rows={targets ?? []}
                    columns={columns}
                    initialState={{
                        columns: {
                            columnVisibilityModel:
                                visibleColumns
                        }
                    }}
                />
            )}
        </Box>
    );
}