import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import {
    DataGrid,
    GridColDef,
    GridRowParams,
    GRID_CHECKBOX_SELECTION_COL_DEF,
} from '@mui/x-data-grid';
import { useStateContext } from '../App.tsx';
import { convert_schema_to_columns } from '../target_table.tsx';
import { IconButton } from '@mui/material';
import { SimbadTargetData } from '../catalog_button.tsx';

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

interface GuideStarTarget extends SimbadTargetData {
    target_name: string;
}

const targets: GuideStarTarget[] = [
    {
        "dec": "+30:39:36.630403128",
        "dec_deg": 30.960175112,
        "epoch": "J2000",
        "equinox": "2000",
        "g_mag": 15.113876,
        "j_mag": 5.039,
        "pm_dec": 0.827,
        "pm_ra": 0.707,
        "ra": "01:33:50.8965749232",
        "ra_deg": 23.3620690622,
        "systemic_velocity": -179.2,
        "target_name": "M33 buddy"
    },
    {
        "dec": "+30:39:36.630403128",
        "dec_deg": 30.660175112,
        "epoch": "J2000",
        "equinox": "2000",
        "g_mag": 15.113876,
        "j_mag": 5.039,
        "pm_dec": 0.827,
        "pm_ra": 0.707,
        "ra": "01:33:50.8965749232",
        "ra_deg": 23.1620690622,
        "target_name": "M33 buddy"
    },
    {
        "dec": "+30:39:36.630403128",
        "dec_deg": 30.560175112,
        "epoch": "J2000",
        "equinox": "2000",
        "g_mag": 15.113876,
        "j_mag": 5.039,
        "pm_dec": 0.827,
        "pm_ra": 0.707,
        "ra": "01:33:50.8965749232",
        "ra_deg": 23.4620690622,
        "target_name": "M33 buddy 2"
    },
    {
        "dec": "+30:39:36.630403128",
        "dec_deg": 30.560175112,
        "epoch": "J2000",
        "equinox": "2000",
        "g_mag": 15.113876,
        "j_mag": 5.039,
        "pm_dec": 0.827,
        "pm_ra": 0.707,
        "ra": "01:33:50.8965749232",
        "ra_deg": 23.5620690622,
        "target_name": "M33 buddy 3"
    }
]

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


export default function GuideStarTable() {
    const context = useStateContext()

    const cfg = context.config
    let columns = convert_schema_to_columns();
    const sortOrder = cfg.default_guide_star_table_columns;
    columns = columns.sort((a, b) => {
        return sortOrder.indexOf(a.field) - sortOrder.indexOf(b.field);
    });
    const visibleColumns = Object.fromEntries(columns.map((col) => {
        const visible = cfg.default_table_columns.includes(col.field)
        return [col.field, visible]
    }));
    let pinnedColumns = cfg.pinned_table_columns
    const leftPin = [...new Set([GRID_CHECKBOX_SELECTION_COL_DEF.field, ...cfg.pinned_table_columns.left])]
    pinnedColumns.left = leftPin

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
            headerName: 'Actions',
            width: 250,
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
                width: '100%',
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
                    checkboxSelection
                    rows={targets ?? []}
                    columns={columns}
                    disableMultipleRowSelection={true}
                    slots={{
                    }}
                    slotProps={{
                        toolbar: {},
                    }}
                    initialState={{
                        // pinnedColumns: pinnedColumns, // pro version only
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