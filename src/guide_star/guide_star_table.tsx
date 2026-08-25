import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import {
    DataGrid,
    GridColDef,
    GridRowParams,
    useGridApiRef,
} from '@mui/x-data-grid';
import { Target, useSnackbarContext, useStateContext } from '../App.tsx';
import { v4 as randomId } from 'uuid';
import { convert_schema_to_columns } from '../target_table.tsx';
import { IconButton, Tooltip } from '@mui/material';
import React from 'react';
import { create_new_target } from '../table_toolbar.tsx';
import { submit_target } from '../api/api_root.tsx';
import target_schema from '../target_schema.json';

// Guide stars are considered "the same" as an existing target when their
// coordinates are within this tolerance (in degrees). This is far tighter
// than any real dithering between guide star catalogs but loose enough to
// tolerate floating point / precision differences in ra_deg/dec_deg.
const COORD_MATCH_TOLERANCE_DEG = 1 / 3600; // ~1 arcsec

const is_guidestar_already_added = (
    guidestar: Partial<Target>,
    science_target_name: string | undefined,
    existingTargets: Target[] | undefined,
): boolean => {
    if (!existingTargets) {
        return false;
    }
    // target_name is truncated to 15 chars when a guide star is submitted, so
    // compare against the same truncated form.
    const guidestarName = guidestar.target_name != null ? String(guidestar.target_name).slice(0, 15) : undefined;
    return existingTargets.some((t) => {
        if (t.science_target !== science_target_name) {
            return false;
        }
        if (guidestarName && t.target_name === guidestarName) {
            return true;
        }
        if (guidestar.ra_deg == null || guidestar.dec_deg == null || t.ra_deg == null || t.dec_deg == null) {
            return false;
        }
        return (
            Math.abs(t.ra_deg - guidestar.ra_deg) < COORD_MATCH_TOLERANCE_DEG &&
            Math.abs(t.dec_deg - guidestar.dec_deg) < COORD_MATCH_TOLERANCE_DEG
        );
    });
}

interface AddGuideStarButtonProps {
    guidestar: Partial<Target>;
    setRows?: React.Dispatch<React.SetStateAction<Target[]>>;
    science_target_name?: string;
    useLaser?: boolean;
}

const AddGuideStarButton = (props: AddGuideStarButtonProps) => {
    const { guidestar, science_target_name, setRows } = props

    const context = useStateContext()
    const snackbarContext = useSnackbarContext()

    const [justAdded, setJustAdded] = React.useState(false);
    const alreadyAdded = justAdded || is_guidestar_already_added(guidestar, science_target_name, context.targets);

    //remove nulls
    let sanitizedGuideStar = Object.fromEntries(Object.entries(guidestar).filter(([_, v]) => v != null));
    sanitizedGuideStar.target_name = String(sanitizedGuideStar.target_name).slice(0, 15) ?? randomId();


    const handleClick = async () => {
        const id = randomId();
        let newTarget = create_new_target(id, context.obsid, guidestar.target_name)
        newTarget = {
            ...newTarget,
            ...sanitizedGuideStar, 
            equinox: String(guidestar.equinox) ?? '2000',
            science_target: science_target_name,
        }
        if (props.useLaser) {
            newTarget.lgs = '1'
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
        setJustAdded(true);
        setRows && setRows((oldRows) => {
            //find index of target with same name as science target and insert the new guide star underneath it,
            //  if it exists. Otherwise add the guide star to the top of the table.
            const index = oldRows.findIndex(row => row.target_name === science_target_name);
            let newRows = [...oldRows];
            if (index !== -1) {
                newRows.splice(index + 1, 0, resp.targets[0]);
                return newRows;
            }
            else {
                newRows.unshift(resp.targets[0]);
            }
            return newRows;
        });
    }

    return (
        <Tooltip title={alreadyAdded ? 'Already added to target list' : 'Add to target list'}>
            <IconButton
                color="primary"
                onClick={handleClick}
                sx={alreadyAdded ? { color: 'success.main' } : undefined}
            >
                <AddIcon />
            </IconButton>
        </Tooltip>
    )
}


interface Props {
    guidestars?: Partial<Target>[];
    setRows?: React.Dispatch<React.SetStateAction<Target[]>>;
    science_target_name?: string;
    selectedGuideStarName?: string;
    setSelectedGuideStarName?: (name: string) => void;
    useLaser?: boolean;
}

export default function GuideStarTable(props: Props) {
    const { guidestars, selectedGuideStarName, setSelectedGuideStarName, science_target_name } = props;
    const context = useStateContext()
    const cfg = context.config
    let columns = convert_schema_to_columns(target_schema as any); //TODO: fix this
    columns = columns.map((col) => {
        if (col.field === 'target_name') {
            return { ...col, width: 150}
        }
        return { ...col, width: 100 }
    })
    //add dist column
    columns.push({
        field: 'dist',
        headerName: 'Distance',
        width: 150,
    });
    const sortOrder = cfg.default_guide_star_table_columns;
    const [rowSelectModel, setRowSelectModel] = React.useState<any>([]);
    const apiRef = useGridApiRef();

    React.useEffect(() => {
        setRowSelectModel(selectedGuideStarName ? [selectedGuideStarName] : [])

        if (!selectedGuideStarName) {
            return;
        }

        // Wait a frame so the grid has rendered/paginated before we measure it.
        const frame = requestAnimationFrame(() => {
            const api = apiRef.current;
            if (!api) {
                return;
            }
            const rowIndex = api.getRowIndexRelativeToVisibleRows(selectedGuideStarName);
            const dimensions = api.getRootDimensions();
            if (rowIndex === undefined || rowIndex === null || rowIndex < 0 || !dimensions?.isReady) {
                return;
            }
            const { rowHeight, viewportInnerSize } = dimensions;
            const rowTop = rowIndex * rowHeight;
            const totalHeight = api.getRowsCount() * rowHeight;
            // Try to center the row in the viewport, but clamp so we don't
            // overscroll past the top or bottom of the table.
            const desiredScrollTop = rowTop + rowHeight / 2 - viewportInnerSize.height / 2;
            const maxScrollTop = Math.max(0, totalHeight - viewportInnerSize.height);
            const scrollTop = Math.min(Math.max(desiredScrollTop, 0), maxScrollTop);
            api.scroll({ top: scrollTop });
        });
        return () => cancelAnimationFrame(frame);
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
                useLaser={props.useLaser}
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
                height: 600,
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
                    apiRef={apiRef}
                    getRowId={(row: Partial<Target>) => row.target_name ?? row._id ?? randomId()}
                    rows={guidestars ?? []}
                    columns={columns}
                    rowSelectionModel={rowSelectModel}
                    onRowSelectionModelChange={(newRowSelectionModel) => {
                        console.log("Row selection model changed:", newRowSelectionModel)
                        setRowSelectModel(newRowSelectionModel);
                        setSelectedGuideStarName && setSelectedGuideStarName(newRowSelectionModel[0] as string);
                    }}
                    density="compact"
                    initialState={{
                        columns: {
                            columnVisibilityModel:
                                visibleColumns
                        },
                        pagination: {
                            paginationModel: { pageSize: 100 }
                        }
                    }}
                    pageSizeOptions={[10, 25, 50, 100]}
                />
            )}
        </Box>
    );
}