import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import {
    DataGrid,
    GridColDef,
    GridRowParams,
} from '@mui/x-data-grid';
import { Target, useSnackbarContext, useStateContext } from '../App.tsx';
import { v4 as randomId } from 'uuid';
import { convert_schema_to_columns } from '../target_table.tsx';
import { IconButton } from '@mui/material';
import React from 'react';
import { create_new_target } from '../table_toolbar.tsx';
import { submit_target } from '../api/api_root.tsx';
import target_schema from '../target_schema.json';

interface AddGuideStarButtonProps {
    guidestar: Partial<Target>;
    setRows?: React.Dispatch<React.SetStateAction<Target[]>>;
    science_target_name?: string;
}

const AddGuideStarButton = (props: AddGuideStarButtonProps) => {
    const { guidestar, science_target_name, setRows } = props

    const context = useStateContext()
    const snackbarContext = useSnackbarContext() 

    const handleClick = async () => {
        const id = randomId();
        let newTarget = create_new_target(id, context.obsid, guidestar.target_name)
        newTarget = {
            ...newTarget,
            ...guidestar, 
            tags: [...(newTarget.tags ?? []), 'guide_star for ' + (science_target_name ?? '')],
        }
        const resp = await submit_target([newTarget])
        if (resp.errors.length > 0) {
            console.error('error submitting target')
            snackbarContext.setSnackbarMessage({ severity: 'error', message: 'Error adding target' })
            snackbarContext.setSnackbarOpen(true);
            return
        }
        snackbarContext.setSnackbarMessage({ severity: 'success', message: 'Guide star added successfully' })
        console.log("Added guide star for target:", resp.targets[0])
        snackbarContext.setSnackbarOpen(true);
        setRows && setRows((oldRows) => {
            return [resp.targets[0], ...oldRows]
        });
    }

    return (
        <IconButton color="primary" onClick={handleClick}>
            <AddIcon />
        </IconButton>
    )
}


interface Props {
    guidestars?: Partial<Target>[];
    setRows?: React.Dispatch<React.SetStateAction<Target[]>>;
    science_target_name?: string;
    selectedGuideStarName?: string;
    setSelectedGuideStarName?: (name: string) => void;
}

export default function GuideStarTable(props: Props) {
    const { guidestars, selectedGuideStarName, setSelectedGuideStarName, science_target_name } = props;
    const context = useStateContext()
    const cfg = context.config
    let columns = convert_schema_to_columns(target_schema as any); //TODO: fix this
    //add dist column
    columns.push({
        field: 'dist',
        headerName: 'Distance',
        width: 150,
    });
    const sortOrder = cfg.default_guide_star_table_columns;
    const [rowSelectModel, setRowSelectModel] = React.useState<any>([]);

    React.useEffect(() => {
        // console.log("Selected guide star name:", selectedGuideStarName, apiRef.current)
        // apiRef.current.selectRow(selectedGuideStarName);
        setRowSelectModel([selectedGuideStarName])
    }, [selectedGuideStarName]);

    columns = columns.sort((a, b) => {
        return sortOrder.indexOf(a.field) - sortOrder.indexOf(b.field);
    });

    const visibleColumns = Object.fromEntries(columns.map((col) => {
        const visible = cfg.default_guide_star_table_columns.includes(col.field)
        return [col.field, visible]
    }));

    const ActionsCell = (params: GridRowParams<Partial<Target>>) => {
        const { row } = params;
        return [
            <AddGuideStarButton
                guidestar={row}
                science_target_name={science_target_name}
                setRows={props.setRows}
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
                    getRowId={(row: Partial<Target>) => row.target_name ?? row._id ?? randomId()}
                    rows={guidestars ?? []}
                    columns={columns}
                    rowSelectionModel={rowSelectModel}
                    onRowSelectionModelChange={(newRowSelectionModel) => {
                        console.log("Row selection model changed:", newRowSelectionModel)
                        setRowSelectModel(newRowSelectionModel);
                        setSelectedGuideStarName && setSelectedGuideStarName(newRowSelectionModel[0] as string);
                    }}
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