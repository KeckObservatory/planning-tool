import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { ErrorObject } from 'ajv/dist/2019'
import {
  GridRowsProp,
  GridRowModesModel,
  GridRowModes,
  DataGridPro,
  GridColDef,
  GridToolbarContainer,
  GridActionsCellItem,
  GridEventListener,
  GridRowId,
  GridRowModel,
  GridToolbar,
  useGridApiContext,
  useGridApiEventHandler,
  GridRowParams,
  GRID_CHECKBOX_SELECTION_COL_DEF,
  GridRowSelectionModel,
} from '@mui/x-data-grid-pro';
import {
  randomId,
} from '@mui/x-data-grid-generator';
import target_schema from './target_schema.json';
import ValidationDialogButton, { validate } from './validation_check_dialog';
import SimbadButton from './simbad_button';
import { useDebounceCallback } from './use_debounce_callback.tsx';
import { TargetWizardButton } from './target_wizard';
import { Target, useStateContext } from './App.tsx';
import TargetEditDialogButton from './target_edit_dialog.tsx';
import ViewTargetsDialogButton from './two-d-view/view_targets_dialog.tsx';
import { TargetVizButton } from './two-d-view/viz_chart.tsx';

interface EditToolbarProps {
  setRows: (newRows: (oldRows: GridRowsProp) => GridRowsProp) => void;
  setRowModesModel: (
    newModel: (oldModel: GridRowModesModel) => GridRowModesModel,
  ) => void;
  selectedTargets: Target[]
}

function convert_schema_to_columns() {
  const columns: GridColDef[] = []
  Object.entries(target_schema.properties).forEach(([key, value]: [string, any]) => {
    let col = {
      field: key,
      description: value.description,
      type: value.type,
      headerName: value.short_description ?? value.description,
      width: 140,
      editable: value.editable ?? true,
    } as GridColDef
    columns.push(col)
  });

  return columns;
}

export const create_new_target = (id?: string, target_name?: string) => {
  let newTarget: Partial<Target> = {}
  Object.entries(target_schema.properties).forEach(([key, value]: [string, any]) => {
    // @ts-ignore
    newTarget[key] = value.default
  })
  newTarget = {
    ...newTarget,
    _id: id,
    target_name: target_name,
  } as Target
  return newTarget
}


function EditToolbar(props: EditToolbarProps) {
  const { setRows, setRowModesModel } = props;

  const handleAddTarget = async () => {
    const id = randomId();
    const newTarget = create_new_target(id)

    setRows((oldRows) => {
      const newRows = [newTarget, ...oldRows];
      localStorage.setItem('targets', JSON.stringify(newRows));
      return newRows
    });
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [id]: { mode: GridRowModes.Edit, fieldToFocus: 'target_name' },
    }));
  };

  return (
    <GridToolbarContainer sx={{ justifyContent: 'center' }}>
      <Button color="primary" startIcon={<AddIcon />} onClick={handleAddTarget}>
        Add Target
      </Button>
      <ViewTargetsDialogButton targets={props.selectedTargets} />
      <GridToolbar
        csvOptions={{ allColumns: true }}
      />
      <TargetWizardButton />
    </GridToolbarContainer>
  );
}

export interface TargetsContext {
  targets: Target[];
  setTargets: React.Dispatch<React.SetStateAction<Target[]>>;
}

const init_target_context = {
  targets: [],
  setTargets: () => { }
}

const TargetContext = React.createContext<TargetsContext>(init_target_context);
export const useTargetContext = () => React.useContext(TargetContext);

export default function TargetTable() {
  const context = useStateContext()
  const [rows, setRows] = React.useState(context.targets as Target[]);
  const [rowModesModel, setRowModesModel] = React.useState<GridRowModesModel>({});
  const [rowSelectionModel, setRowSelectionModel] =
    React.useState<GridRowSelectionModel>([]);
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
  const csvExportColumns = cfg.csv_order
  let pinnedColumns = cfg.pinned_table_columns
  const leftPin = [...new Set([GRID_CHECKBOX_SELECTION_COL_DEF.field, ...cfg.pinned_table_columns.left])]
  pinnedColumns.left = leftPin 

  const edit_target = async (target: Target) => {
    console.log('debounced save', target)
  }

  const debounced_save = useDebounceCallback(edit_target, 2000)

  const handleEditClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  };

  const handleDeleteClick = async (id: GridRowId) => {
    const delRow = rows.find((row) => row._id === id);
    console.log('deleting', id, delRow)
    setRows(() => {
      const newRows = rows.filter((row) => row._id !== id)
      localStorage.setItem('targets', JSON.stringify(newRows));
      return newRows
    });
  };

  const processRowUpdate = (newRow: GridRowModel) => {
    //sends to server
    const updatedRow = { ...newRow } as Target;
    const newRows = rows.map((row) => (row._id === newRow._id ? updatedRow : row))
    setRows(newRows);
    localStorage.setItem('targets', JSON.stringify(newRows))
    return updatedRow;
  };

  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel);
  };

  const ActionsCell = (params: GridRowParams<Target>) => {
    const { id, row } = params;
    const [editTarget, setEditTarget] = React.useState<Target>(row);
    const [count, setCount] = React.useState(0); //prevents scroll update from triggering save
    const [hasSimbad, setHasSimbad] = React.useState(row.tic_id || row.gaia_id ? true : false);
    validate(row)
    const [errors, setErrors] = React.useState<ErrorObject<string, Record<string, any>, unknown>[]>(validate.errors ?? []);
    const debounced_edit_click = useDebounceCallback(handleEditClick, 500)

    React.useEffect(() => { // when targed is edited in target edit dialog or simbad dialog
      if (count > 0) {
        console.log('editTarget updated', editTarget, row)
        processRowUpdate(editTarget)
        debounced_save(editTarget)?.then((resp) => {
          console.log('save response', resp)
        })
        validate(editTarget)
        setErrors(validate.errors ? validate.errors : [])
        editTarget.tic_id || editTarget.gaia_id && setHasSimbad(true)
        debounced_edit_click(id)
      }
      setCount((prev: number) => prev + 1)
    }, [editTarget])

    const apiRef = useGridApiContext();

    const handleEvent: GridEventListener<'cellEditStop'> = (params) => {
      setTimeout(() => { //wait for cell to update before setting editTarget
        const value = apiRef.current.getCellValue(id, params.field);
        //Following line is a hack to prevent cellEditStop from firing from non-selected shell.
        //@ts-ignore
        if (editTarget[params.field] === value) return //no change detected. not going to set target as edited.
        setEditTarget({ ...editTarget, [params.field]: value })
      }, 300)
    }
    useGridApiEventHandler(apiRef, 'cellEditStop', handleEvent)

    return [
      <SimbadButton hasSimbad={hasSimbad} target={editTarget} setTarget={setEditTarget} />,
      <TargetVizButton target={editTarget} />,
      <ValidationDialogButton errors={errors} target={editTarget} />,
      <TargetEditDialogButton
        target={editTarget}
        setTarget={setEditTarget}
      />,
      <GridActionsCellItem
        icon={<DeleteIcon />}
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

  return (
    <TargetContext.Provider value={{ targets: rows, setTargets: setRows }}>
      <Box
        sx={{
          height: 500,
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
          <DataGridPro
            disableRowSelectionOnClick
            checkboxSelection
            rows={rows ?? []}
            columns={columns}
            rowModesModel={rowModesModel}
            onRowModesModelChange={handleRowModesModelChange}
            slots={{
              //@ts-ignore
              toolbar: EditToolbar,
            }}
            onRowSelectionModelChange={(newRowSelectionModel) => {
              setRowSelectionModel(newRowSelectionModel);
            }}
            rowSelectionModel={rowSelectionModel}
            slotProps={{
              toolbar: {
                setRows,
                setRowModesModel,
                csvOptions: { fields: csvExportColumns, allColumns: true, fileName: `MyTargets` },
                selectedTargets: rowSelectionModel.map((id) => {
                  return rows.find((row) => row._id === id)
                }) 
              },
            }}
            pinnedColumns={pinnedColumns}
            initialState={{
              columns: {
                columnVisibilityModel:
                  visibleColumns
              }
            }}
          />
        )}
      </Box>
    </TargetContext.Provider>
  );
}
