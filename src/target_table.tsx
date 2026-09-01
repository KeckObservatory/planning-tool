import * as React from 'react';
import Box from '@mui/material/Box';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { ErrorObject, JSONSchemaType } from 'ajv/dist/2019'
import { EditToolbarProps, EditToolbar } from './table_toolbar.tsx';
import {
  GridRowModesModel,
  GridRowModes,
  DataGrid,
  GridColDef,
  GridActionsCellItem,
  GridEventListener,
  GridRowId,
  useGridApiContext,
  useGridApiEventHandler,
  GridRowParams,
  GRID_CHECKBOX_SELECTION_COL_DEF,
  GridRowSelectionModel,
  GridValueParser,
  GridValueSetter,
  GridCellEditStopParams,
  GridRowModel,
  GridValueFormatter,
  GridSortModel,
} from '@mui/x-data-grid';
import target_schema from './target_schema.json';
import ValidationDialogButton, { validate } from './validation_check_dialog';
import CatalogButton from './catalog_button.tsx';
import { useDebounceCallback } from './use_debounce_callback.tsx';
import { Target, useSnackbarContext, useStateContext, ViewMode } from './App.tsx';
import TargetEditDialogButton, { format_string_array, format_edit_entry, PropertyProps, rowSetter, TargetProps } from './target_edit_dialog.tsx';
import ViewTargetsDialogButton from './two-d-view/view_targets_dialog.tsx';
import { delete_target, submit_target } from './api/api_root.tsx';
import { format_target_property } from './upload_targets_dialog.tsx';
import { ra_dec_to_deg } from './two-d-view/sky_view_util.tsx';
import { Tooltip } from '@mui/material';
import { createEnumParam, useQueryParam, withDefault } from 'use-query-params';


export const convert_schema_to_columns = (schema: JSONSchemaType<Target>) => {
  const columns: GridColDef[] = []
  Object.entries(schema.properties).forEach(([key, valueProps]: [string, any]) => {
    // format value for display
    const valueParser: GridValueParser = (value: unknown) => {
      value = format_target_property(key as keyof Target, value, valueProps)
      if (value && valueProps.type === 'array') { //convert array to string for display
        value = Array.isArray(value) ? (value as string[]).join(',') : value as string
      }
      if (value && key === 'ra' || key === 'dec') { //format ra/dec for display
        console.log('formatting', key, value)
        value = format_edit_entry(key, value as string, true)
        console.log('formatted value', value)
      }
      return value
    }

    const valueSetter: GridValueSetter<Target> = (value: unknown, tgt: Target) => {
      if (valueProps.type === 'array' && value) {
        value = Array.isArray(value) ? (value as string[]).join(',') : value as string
      }
      tgt = { ...tgt, [key]: value }
      if (key === 'ra') {
        tgt = { ...tgt, ra_deg: value ? ra_dec_to_deg(String(value)) : undefined }
      } else if (key === 'dec') {
        tgt = { ...tgt, dec_deg: value ? ra_dec_to_deg(String(value), true) : undefined }
      }
      return tgt
    }

    const valueFormatter: GridValueFormatter = (value) => {
      if ((key === 'ra' || key === 'dec') && typeof value === 'string') {
        const formattedValue = format_edit_entry(key, value)
        return formattedValue
      }
      return value
    }

    let type = valueProps.type === 'array' ? 'string' : valueProps.type
    type = type.includes('string') ? 'string' : type //multiple typed fields are cast as string and formatted later on
    const editable = valueProps.type === 'array' ? false : valueProps.editable ?? true
    let width = undefined
    if (key === 'ra' || key === 'dec') width = 150
    if (key === 'target_name') width = 200
    if (key === 'tags') width = 200
    let col = {
      field: key,
      valueParser,
      valueSetter,
      valueFormatter,
      description: valueProps.description,
      // enum-constrained fields (lgs, rotator_mode, telescope_wrap, ...) get a
      // dropdown editor instead of a free-text cell, same options as the edit dialog.
      type: valueProps.enum ? 'singleSelect' : (valueProps.type === 'array' ? 'string' : valueProps.type), //array cells are cast as string
      valueOptions: valueProps.enum,
      headerName: valueProps.short_description ?? valueProps.description,
      editable,
      width
    } as GridColDef

    // priority is typed number|string, so the grid would otherwise sort it as text
    // and put "10" ahead of "2". Compare the coerced numbers instead.
    // The comparator stays ascending - the grid negates it itself for 'desc' - but
    // the click order is flipped so the header toggles highest-first before lowest.
    if (key === 'priority') {
      col.sortComparator = (a, b) => priority_value({ priority: a } as Target) - priority_value({ priority: b } as Target)
      col.sortingOrder = ['desc', 'asc', null]
    }

    columns.push(col)
  });

  return columns;
}

// `priority` is typed number|string in the schema, and cell edits always arrive as
// strings (format_edit_entry stringifies), so coerce rather than type-check -
// a `typeof === 'number'` test would read every edited value as unset.
// Anything unset/blank/non-numeric counts as 0, per the schema's description.
export const priority_value = (tgt: Target): number => {
  const priority = Number(tgt.priority)
  return Number.isFinite(priority) ? priority : 0
}

// The `priority` column is how targets get reordered: type a number into it and the
// table sorts by it, highest first. Exports/viz read from the raw `rows` array rather
// than the grid's displayed order, so they have to apply the same sort explicitly or
// the arrangement made in the table wouldn't carry into the submitted starlist.
// Array.sort is stable, so targets sharing a priority (e.g. an untouched list where
// everything is 0) keep their existing relative position.
export const sort_by_priority = (targets: Target[]): Target[] => {
  return [...targets].sort((a, b) => priority_value(b) - priority_value(a))
}

export const DUPLICATE_COORD_TOLERANCE_DEG = 1 / 3600 // 1 arcsecond

// Two targets are duplicates if they share a name, or sit within an arcsecond of
// each other. Returns the name of every target involved, so each row's validation
// button can flag itself. This replaces a snackbar that fired on every change to
// `rows`, which popped up far too often to be useful.
export const find_duplicate_target_names = (targets: Target[]): Set<string> => {
  const duplicateNames = new Set<string>()
  for (let i = 0; i < targets.length; i++) {
    const a = targets[i]
    for (let j = i + 1; j < targets.length; j++) {
      const b = targets[j]
      const sameName = !!a.target_name && a.target_name === b.target_name
      const sameCoords = a.ra_deg != null && a.dec_deg != null
        && b.ra_deg != null && b.dec_deg != null
        && Math.abs(a.ra_deg - b.ra_deg) < DUPLICATE_COORD_TOLERANCE_DEG
        && Math.abs(a.dec_deg - b.dec_deg) < DUPLICATE_COORD_TOLERANCE_DEG
      if (sameName || sameCoords) {
        a.target_name && duplicateNames.add(a.target_name)
        b.target_name && duplicateNames.add(b.target_name)
      }
    }
  }
  return duplicateNames
}

export interface RowsContext {
  rows: Target[];
  setRows: React.Dispatch<React.SetStateAction<Target[]>>;
}

const init_rows_context = {
  rows: [],
  setRows: () => { }
}

const RowsContext = React.createContext<RowsContext>(init_rows_context);
export const useRowsContext = () => React.useContext(RowsContext);

export const ViewParam = createEnumParam<ViewMode>(['ao', 'non_ao'])

interface TargetTableProps {
  targets: Target[];
}

const get_unique_tags= (rows: Target[]): string[] => {
  const tagsSet = new Set<string>();
  rows.forEach(row => {
    if (row.tags && Array.isArray(row.tags)) {
      row.tags.forEach(tag => tagsSet.add(tag));
    }
  });
  return Array.from(tagsSet).sort();
};

export default function TargetTable(props: TargetTableProps) {
  const { targets } = props
  const context = useStateContext()
  const sbcontext = useSnackbarContext();
  const [rows, setRows] = React.useState(targets as Target[]);
  const [rowModesModel, setRowModesModel] = React.useState<GridRowModesModel>({});
  const [rowSelectionModel, setRowSelectionModel] = React.useState<GridRowSelectionModel>([]);
  // Controlled rather than initialState: initialState only applies at mount and is
  // permanently discarded once a header is clicked, so the highest-priority-first
  // default wasn't reliably in effect.
  const [sortModel, setSortModel] = React.useState<GridSortModel>([{ field: 'priority', sort: 'desc' }]);
  const [selectedTagFilter, setSelectedTagFilter] = React.useState<string | null>(null);
  const cfg = context.config

  const [viewMode, _] = useQueryParam<ViewMode>('view_mode', withDefault(ViewParam, 'non_ao' as ViewMode))
  let columns = convert_schema_to_columns(target_schema as unknown as JSONSchemaType<Target>);
  const leftPinnedFields = cfg.pinned_table_columns.left.filter((field) => field !== 'selected')
  const rightPinnedFields = cfg.pinned_table_columns.right
  const defaultFields = cfg.default_table_columns[viewMode].filter((field) => !leftPinnedFields.includes(field))
  const remainingFields = columns
    .map((col) => col.field)
    .filter((field) => ![...leftPinnedFields, ...defaultFields, ...rightPinnedFields].includes(field))
  const sortOrder = [...leftPinnedFields, ...remainingFields, ...defaultFields, ...rightPinnedFields]
  columns = columns.sort((a, b) => {
    return sortOrder.indexOf(a.field) - sortOrder.indexOf(b.field);
  });
  const visibleColumns = Object.fromEntries(columns.map((col) => {
    const visible = cfg.default_table_columns[viewMode].includes(col.field)
    return [col.field, visible]
  }));
  const [columnVisibilityModel, setColumnVisibilityModel] = React.useState(visibleColumns)
  React.useEffect(() => {
    setColumnVisibilityModel(visibleColumns)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])
  let pinnedColumns = cfg.pinned_table_columns
  const leftPin = [...new Set([GRID_CHECKBOX_SELECTION_COL_DEF.field, ...cfg.pinned_table_columns.left])]
  pinnedColumns.left = leftPin

  // context.targets is the app-wide snapshot of all targets (used e.g. by the
  // guide star table to check what's already been added). It's only ever
  // populated by an initial fetch, so any local add/edit must be mirrored
  // into it here - otherwise it silently falls out of sync with `rows`, and
  // the effect below (which resets `rows` from `targets` on every reference
  // change) will wipe out local changes that never made it into context.
  //
  // This deliberately updates in place only and never inserts: a save can land
  // after its target was deleted (an edit debounced from a row that has since
  // been removed), and inserting there would resurrect the deleted row.
  // Genuine additions insert into context explicitly at the point of the add.
  const update_context_target = (target: Target) => {
    context.setTargets && context.setTargets((oldTargets) => {
      if (!oldTargets?.some((tgt) => tgt._id === target._id)) {
        return oldTargets
      }
      return oldTargets.map((tgt) => (tgt._id === target._id ? target : tgt))
    })
  }

  const submit_one_target = async (target: Target) => {
    const resp = await submit_target([target])
    if (resp.errors.length > 0) {
      throw new Error('error updating target')
    }
    const submittedTarget = resp.targets.at(0)
    // The grid is keyed solely on _id, so a target that comes back without one
    // would share an `undefined` key with every other such row - deleting any
    // one of them would then remove all of them. Fall back to the id we sent.
    if (submittedTarget && !submittedTarget._id) {
      console.error('submit_target returned a target with no _id; falling back to the submitted id', { sent: target, received: submittedTarget })
      submittedTarget._id = target._id
    }
    //update target in rows
    setRows((oldRows) => oldRows.map((tgt) => {
      return tgt._id === submittedTarget?._id ?
        submittedTarget : tgt
    }))
    if (submittedTarget) {
      update_context_target(submittedTarget)
    }
    return submittedTarget
  }


  const edit_target = async (target: Target) => {
    const resp = await submit_one_target(target)
    return resp
  }

  const duplicateNames = React.useMemo(() => find_duplicate_target_names(rows), [rows])

  React.useEffect(() => { // when semid is changed
    setRows(targets)
  }, [targets])

  const handleEditClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  };

  const handleDeleteClick = async (id: GridRowId) => {
    // Deleting by a null/undefined id would match every row that is also
    // missing an _id, removing all of them instead of just this one.
    if (id === undefined || id === null || id === '') {
      console.error('refusing to delete: row has no _id', { id, rows })
      sbcontext.setSnackbarMessage({ severity: 'error', message: 'Cannot delete target: it has no id' })
      sbcontext.setSnackbarOpen(true)
      return
    }
    const delRow = rows.find((row) => row._id === id);
    console.log('deleting', id, delRow)
    delRow && delete_target([delRow._id as string])
    setRows((oldRows) => oldRows.filter((row) => row._id !== id));
    context.setTargets && context.setTargets((oldTargets) => (oldTargets ?? []).filter((tgt) => tgt._id !== id));
  };

  const processRowUpdate = async (newRow: GridRowModel<Target>) => {
    //row is sent to DataGrid rows. Used to match row with what was edited.
    setRows((oldRows) => oldRows.map((row) => (row._id === newRow._id ? newRow : row)));
    update_context_target(newRow);
    return newRow;
  };

  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel);
  };

  const validate_sanitized_target = (tgt: Target) => {
    let sanitizedTgt: Partial<Target> = {}
    Object.entries(tgt).forEach(([key, value]) => {
      //allow empty strings to be valid for non-required fields
      const required = value === "" && target_schema.required.includes(key)
      if (value === "" || value === undefined && required) {
        return
      }
      sanitizedTgt[key as keyof Target] = value
    })

    validate(sanitizedTgt as Target)
    return validate.errors ?? []
  }

  const autosizeOptions = {
    includeHeaders: true,
    includeOutliers: false,
    outliersFactor: 1.5,
    expand: false
  }

  const debounced_edit_click = useDebounceCallback(handleEditClick, 500)

  const ActionsCell = (params: GridRowParams<Target>) => {
    const { id, row } = params;
    const [editTarget, setEditTarget] = React.useState<Target>(row);
    const [count, setCount] = React.useState(0); //prevents scroll update from triggering save
    const [hasCatalog, setHasCatalog] = React.useState(row.tic_id || row.gaia_id ? true : false);
    const editTargetRef = React.useRef<Target>(editTarget);
    const countRef = React.useRef<number>(count);
    
    const errors = React.useMemo<ErrorObject<string, Record<string, any>, unknown>[]>(() => {
      return validate_sanitized_target(editTargetRef.current);
    }, [editTarget, count])

    const apiRef = useGridApiContext();

    // Update refs when state changes
    React.useEffect(() => {
      editTargetRef.current = editTarget;
      countRef.current = count;
    }, [editTarget, count]);

    const handleRowChange = React.useCallback(async (override = false) => {
      if (countRef.current > 0 || override) {
        const isEdited = editTargetRef.current.status?.includes('EDITED')
        if (!isEdited) {
          processRowUpdate(editTargetRef.current)
          return
        }
        try {
          const newTgt = await edit_target(editTargetRef.current)
          processRowUpdate(editTargetRef.current)
          if (newTgt) {
            newTgt.tic_id || newTgt.gaia_id && setHasCatalog(true)
            debounced_edit_click(id)
          }
        } catch (err) {
          console.error('Failed to save target edit', err)
          sbcontext.setSnackbarMessage({
            severity: 'error',
            message: `Failed to save changes to ${editTargetRef.current.target_name || 'target'}`
          })
          sbcontext.setSnackbarOpen(true)
        }
      }
    }, [id])

    const debouncedHandleRowChange = useDebounceCallback(handleRowChange, 2000)

    React.useEffect(() => { // when targed is edited in target edit dialog or catalog dialog
      debouncedHandleRowChange()
      setCount((prev: number) => prev + 1)
    }, [editTarget])

    //NOTE: cellEditStop is fired when a cell is edited and focus is lost. but all cells are updated.
    const handleEvent: GridEventListener<'cellEditStop'> = (params: GridCellEditStopParams) => {
      setTimeout(() => { //wait for cell to update before setting editTarget
        // Read the latest edit target via the ref, not the `editTarget` closed over
        // when this handler was attached: several cells can be edited within this
        // 300ms window, and basing the diff on a stale snapshot here would have each
        // edit overwrite the ones that landed in between instead of building on them.
        const currentTarget = editTargetRef.current
        let value = apiRef.current.getCellValue(id, params.field);
        let type = (target_schema.properties as TargetProps)[params.field as keyof PropertyProps].type
        // convert type to string if array
        const changeDetected = currentTarget[params.field as keyof Target] !== value
        if (changeDetected) {
          const isNumber = type.includes('number') || type.includes('integer')
          if (type === 'array') {
            value = format_string_array(Array.isArray(value) ? value.flat(Infinity) : value.split(','))
          }
          else {
            value = format_edit_entry(params.field, value, isNumber)
          }
          const newTgt = rowSetter(currentTarget, params.field, value)
          setEditTarget(newTgt)
        }
      }, 300)
    }

    const catalogSetTarget = async (newTgt: Target) => {
      await setEditTarget(newTgt)
      handleRowChange(true) //override save
      setHasCatalog(newTgt.tic_id || newTgt.gaia_id ? true : false)
      setCount((prev: number) => prev + 1)
    }

    useGridApiEventHandler(apiRef, 'cellEditStop', handleEvent)

    return [
      <CatalogButton hasCatalog={hasCatalog} target={editTarget} setTarget={catalogSetTarget} />,
      <ViewTargetsDialogButton targets={[editTarget]} />,
      <ValidationDialogButton
        errors={errors}
        target={editTarget}
        isDuplicate={!!editTarget.target_name && duplicateNames.has(editTarget.target_name)}
      />,
      <TargetEditDialogButton
        target={editTarget}
        setTarget={setEditTarget}
      />,
      <GridActionsCellItem
        icon={
          <Tooltip title="Delete target from database">
            <DeleteIcon />
          </Tooltip>
        }
        label="Delete"
        onClick={() => handleDeleteClick(id)}
        color="inherit"
      />,
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

  const selectedTargets = rowSelectionModel.map((id) => {
    return rows.find((tgt) => tgt._id === id)
  }).filter((tgt) => tgt !== undefined) as Target[]

  const uniqueTags = get_unique_tags(rows);
  
  const filteredRows = selectedTagFilter
    ? rows.filter(row => row.tags && row.tags.includes(selectedTagFilter))
    : rows;

  return (
    <RowsContext.Provider value={{ rows: rows, setRows: setRows }}>
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
            getRowId={(row: Target) => row._id}
            //disableRowSelectionOnClick // turned off for now to allow row edit
            processRowUpdate={processRowUpdate}
            autosizeOptions={autosizeOptions}
            checkboxSelection
            rows={filteredRows ?? []}
            columns={columns}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            rowModesModel={rowModesModel}
            onRowModesModelChange={handleRowModesModelChange}
            slots={{
              //@ts-ignore
              toolbar: EditToolbar,
            }}
            //@ts-ignore
            onRowSelectionModelChange={(newRowSelectionModel) => {
              setRowSelectionModel(newRowSelectionModel);
            }}
            rowSelectionModel={rowSelectionModel}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={(newModel) => setColumnVisibilityModel(newModel)}
            slotProps={{
              // @ts-ignore
              toolbar: {
                rows,
                setRows,
                processRowUpdate,
                setRowModesModel,
                obsid: context.obsid,
                submit_one_target,
                selectedTargets,
                uniqueTags,
                selectedTagFilter,
                setSelectedTagFilter
              } as EditToolbarProps,
            }}
            // pinnedColumns: pinnedColumns, // pro version only
          />
        )}
      </Box>
    </RowsContext.Provider>
  );
}
