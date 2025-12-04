import * as React from 'react';
import Box from '@mui/material/Box';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { ErrorObject } from 'ajv/dist/2019'
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
} from '@mui/x-data-grid';
import target_schema from './target_schema.json';
import ValidationDialogButton, { validate } from './validation_check_dialog';
import CatalogButton from './catalog_button.tsx';
import { useDebounceCallback } from './use_debounce_callback.tsx';
import { Target, useSnackbarContext, useStateContext } from './App.tsx';
import TargetEditDialogButton, { format_string_array, format_edit_entry, PropertyProps, rowSetter, TargetProps } from './target_edit_dialog.tsx';
import ViewTargetsDialogButton from './two-d-view/view_targets_dialog.tsx';
import { delete_target, submit_target } from './api/api_root.tsx';
import { format_target_property } from './upload_targets_dialog.tsx';
import { Tooltip } from '@mui/material';


function convert_schema_to_columns() {
  const columns: GridColDef[] = []
  Object.entries(target_schema.properties).forEach(([key, valueProps]: [string, any]) => {
    // format value for display
    const valueParser: GridValueParser = (value: unknown) => {
      value = format_target_property(key as keyof Target, value, valueProps)
      if (value && valueProps.type === 'array') { //convert array to string for display
        value = Array.isArray(value) ? (value as string[]).join(',') : value as string
      }
      return value
    }

    //TODO: use to update other values when this value is changed (e.g. ra/dec change -> degRa/degDec update)
    const valueSetter: GridValueSetter<Target> = (value: unknown, tgt: Target) => {
      if (valueProps.type === 'array' && value) {
        value = Array.isArray(value) ? (value as string[]).join(',') : value as string
      }
      tgt = { ...tgt, [key]: value }
      return tgt
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
      description: valueProps.description,
      type: valueProps.type === 'array' ? 'string' : valueProps.type, //array cells are cast as string
      headerName: valueProps.short_description ?? valueProps.description,
      editable,
      width
    } as GridColDef

    columns.push(col)
  });

  return columns;
}

interface Duplicate {
  target_name: string,
  reason: string
}

const check_for_duplicates = (targets: Target[]) => {
  const duplicates: Duplicate[] = []
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index]
    const duplicateNames = targets.some((t, idx) => {
      return t.target_name === target.target_name && idx !== index
    })
    const duplcateRADEC = targets.some((t, idx) => {
      return t.ra === target.ra && t.dec === target.dec && idx !== index
    })
    const alreadyInList = duplicates.some((dup) => dup.target_name === target.target_name)
    if (
      target.target_name //only check for duplicates if target has a name
      && (duplicateNames || duplcateRADEC)
      && !alreadyInList
    ) {
      const duplicate: Duplicate = {
        target_name: target.target_name as string,
        reason: duplicateNames ? 'duplicate name' : 'duplicate ra/dec'
      }
      duplicates.push(duplicate)
    }
  }
  return duplicates
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

interface TargetTableProps {
  targets: Target[];
}

export default function TargetTable(props: TargetTableProps) {
  const { targets } = props
  const context = useStateContext()
  const sbcontext = useSnackbarContext();
  const [rows, setRows] = React.useState(targets as Target[]);
  const [rowModesModel, setRowModesModel] = React.useState<GridRowModesModel>({});
  const [rowSelectionModel, setRowSelectionModel] = React.useState<GridRowSelectionModel>([]);
  const cfg = context.config
  let columns = convert_schema_to_columns();
  const sortOrder = cfg.default_table_columns
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

  const submit_one_target = async (target: Target) => {
    const resp = await submit_target([target])
    if (resp.errors.length > 0) {
      throw new Error('error updating target')
    }
    const submittedTarget = resp.targets.at(0)
    //update target in rows 
    const newTargets = rows.map((tgt) => {
      return tgt._id === submittedTarget?._id ?
        submittedTarget : tgt
    })
    setRows(newTargets)
    return submittedTarget
  }


  const edit_target = async (target: Target) => {
    const resp = await submit_one_target(target)
    return resp
  }

  React.useEffect(() => {
    const duplicates = check_for_duplicates(rows)
    if (duplicates.length > 0) {
      sbcontext.setSnackbarMessage({
        message: `Duplicate targets found: ${duplicates.map(dup => `${dup.target_name} (${dup.reason})`).join('\n')}`,
        severity: 'error'
      })
      sbcontext.setSnackbarOpen(true)
    }
  }, [rows])

  React.useEffect(() => { // when semid is changed
    setRows(targets)
  }, [targets])

  const handleEditClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  };

  const handleDeleteClick = async (id: GridRowId) => {
    const delRow = rows.find((row) => row._id === id);
    console.log('deleting', id, delRow)
    delRow && delete_target([delRow._id as string])
    const newRows = rows.filter((row) => row._id !== id)
    setRows(newRows);
  };

  const processRowUpdate = async (newRow: GridRowModel<Target>) => {
    //row is sent to DataGrid rows. Used to match row with what was edited.
    const newRows = rows.map((row) => (row._id === newRow._id ? newRow : row))
    setRows(newRows);
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
      return validate_sanitized_target(row);
    }, [editTarget, count])

    const apiRef = useGridApiContext();

    // Update refs when state changes
    React.useEffect(() => {
      editTargetRef.current = editTarget;
      countRef.current = count;
    }, [editTarget, count]);

    const handleRowChange = React.useCallback(async (override = false) => {
      if (countRef.current > 0 || override) {
        let newTgt: Target | undefined = undefined
        const isEdited = editTargetRef.current.status?.includes('EDITED')
        if (isEdited) newTgt = await edit_target(editTargetRef.current)
        processRowUpdate(editTargetRef.current) //TODO: May want to wait till save is successful
        if (newTgt) {
          newTgt.tic_id || newTgt.gaia_id && setHasCatalog(true)
          debounced_edit_click(id)
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
        let value = apiRef.current.getCellValue(id, params.field);
        let type = (target_schema.properties as TargetProps)[params.field as keyof PropertyProps].type
        // convert type to string if array
        const changeDetected = editTarget[params.field as keyof Target] !== value
        if (changeDetected) {
          const isNumber = type.includes('number') || type.includes('integer')
          if (type === 'array') {
            value = format_string_array(Array.isArray(value) ? value.flat(Infinity) : value.split(','))
          }
          else {
            value = format_edit_entry(params.field, value, isNumber)
          }
          const newTgt = rowSetter(editTarget, params.field, value)
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
      <ValidationDialogButton errors={errors} target={editTarget} />,
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
            rows={rows ?? []}
            columns={columns}
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
            slotProps={{
              // @ts-ignore
              toolbar: {
                rows,
                setRows,
                processRowUpdate,
                setRowModesModel,
                obsid: context.obsid, //TODO: allow admin to edit obsid
                submit_one_target,
                selectedTargets
              } as EditToolbarProps,
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
    </RowsContext.Provider>
  );
}
