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
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridActionsCellItem,
  GridEventListener,
  GridRowId,
  GridRowModel,
  GridRowEditStopReasons,
  GridToolbar,
  GridRowSelectionModel,
} from '@mui/x-data-grid';
import {
  randomId,
} from '@mui/x-data-grid-generator';
import target_schema from './target_schema.json';
import ValidationDialogButton, { validate } from './validation_check_dialog';
import SimbadButton from './simbad_button';
import { useDebounceCallback } from './use_debounce_callback.tsx';
import { TargetWizardButton } from './target_wizard';
import { Target } from './App.tsx';
import TargetEditDialogButton from './target_edit_dialog.tsx';
import ViewTargetsDialogButton from './two-d-view/view_targets_dialog.tsx';

export interface TargetRow extends Target {
  isNew?: boolean;
  id: string;
}

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
      type: value.type,
      headerName: value.description,
      width: 180,
      editable: false,
    } as GridColDef
    columns.push(col)
  });

  return columns;
}

export const create_new_target = (id?: string, target_name?: string) => {
  let newTarget: Partial<TargetRow> = {}
  Object.entries(target_schema.properties).forEach(([key, value]: [string, any]) => {
    // @ts-ignore
    newTarget[key] = value.default
  })
  newTarget = {
    ...newTarget,
    id: id,
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
  targets: TargetRow[];
  setTargets: React.Dispatch<React.SetStateAction<TargetRow[]>>;
}

const init_target_context = {
  targets: [],
  setTargets: () => { }
}

const TargetContext = React.createContext<TargetsContext>(init_target_context);
export const useTargetContext = () => React.useContext(TargetContext);

export default function TargetTable() {
  const initTargets = localStorage.getItem('targets') ? JSON.parse(localStorage.getItem('targets') as string) : []
  const [rows, setRows] = React.useState(initTargets as TargetRow[]);
  const [rowModesModel, setRowModesModel] = React.useState<GridRowModesModel>({});
  const [rowSelectionModel, setRowSelectionModel] =
    React.useState<GridRowSelectionModel>([]);

  const edit_target = async (target: Target) => {
    console.log('debounced save', target)
  }

  const debounced_save = useDebounceCallback(edit_target, 2000)

  const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true;
    }
  };

  const handleEditClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  };


  const handleDeleteClick = async (id: GridRowId) => {
    const delRow = rows.find((row) => row.id === id);
    console.log('deleting', id, delRow)
    setRows(() => {
      const newRows = rows.filter((row) => row.id !== id)
      localStorage.setItem('targets', JSON.stringify(newRows));
      return newRows
    });
  };

  const processRowUpdate = (newRow: GridRowModel) => {
    //sends to server
    const updatedRow = { ...newRow, isNew: false } as TargetRow;
    const newRows = rows.map((row) => (row.id === newRow.id ? updatedRow : row))
    setRows(newRows);
    localStorage.setItem('targets', JSON.stringify(newRows))
    return updatedRow;
  };

  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel);
  };


  let columns = convert_schema_to_columns();


  const addColumns: GridColDef[] = [
    {
      field: 'actions',
      type: 'actions',
      editable: false,
      headerName: 'Actions',
      width: 300,
      disableExport: true,
      cellClassName: 'actions',
      getActions: ({ id, row }) => {
        const [editTarget, setEditTarget] = React.useState<TargetRow>(row);
        const [count, setCount] = React.useState(0); //prevents scroll update from triggering save
        const [hasSimbad, setHasSimbad] = React.useState(row.tic_id | row.gaia_id ? true : false);
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

        return [
          <SimbadButton hasSimbad={hasSimbad} target={editTarget} setTarget={setEditTarget} />,
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
    }
  ];

  columns = [...addColumns, ...columns];

  const initVisible = ['actions', 'target_name', 'ra', 'dec' ]
  const visibleColumns = Object.fromEntries(columns.map((col) => {
    const visible = initVisible.includes(col.field)
    return [col.field, visible]
  }));

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
        <DataGrid
          disableRowSelectionOnClick
          checkboxSelection
          rows={rows}
          columns={columns}
          editMode="row"
          rowModesModel={rowModesModel}
          onRowModesModelChange={handleRowModesModelChange}
          onRowEditStop={handleRowEditStop}
          onRowSelectionModelChange={(newRowSelectionModel) => {
            console.log('selected', newRowSelectionModel)
            setRowSelectionModel(newRowSelectionModel);
          }}
          rowSelectionModel={rowSelectionModel}
          slots={{
            toolbar: EditToolbar,
          }}
          slotProps={{
            toolbar: { setRows, setRowModesModel, selectedTargets: rowSelectionModel.map((id) => rows.find((row) => row.id === id)) },
          }}
          initialState={{
            columns: {
              columnVisibilityModel:
                visibleColumns
            }
          }}
        />
      </Box>
    </TargetContext.Provider>
  );
}