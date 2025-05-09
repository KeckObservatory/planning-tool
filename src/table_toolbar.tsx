import * as React from 'react';
import target_schema from './target_schema.json';
import AddIcon from '@mui/icons-material/Add';
import { TargetWizardButton } from './target_wizard';
import { TargetVizButton } from './two-d-view/viz_dialog.tsx';
import {
  GridToolbarContainer,
  GridToolbarExportContainer,
  GridExportMenuItemProps,
  useGridApiContext,
  gridFilteredSortedRowIdsSelector,
  gridVisibleColumnFieldsSelector,
  GridApi,
  GridRowsProp,
  GridRowModel,
  GridToolbar,
  GridToolbarProps,
  ToolbarPropsOverrides
} from '@mui/x-data-grid-pro';
import { v4 as randomId } from 'uuid';
import MenuItem from '@mui/material/MenuItem';
import Button, { ButtonProps } from '@mui/material/Button';
import { Target, useSnackbarContext } from './App.tsx';
import { Stack } from '@mui/material';
import ViewTargetsDialogButton from './two-d-view/view_targets_dialog.tsx';
import DeleteDialogButton from './delete_rows_dialog.tsx';

const getJson = (apiRef: React.MutableRefObject<GridApi>) => {
  // Select rows and columns
  const filteredSortedRowIds = gridFilteredSortedRowIdsSelector(apiRef);
  const visibleColumnsField = gridVisibleColumnFieldsSelector(apiRef);

  // Format the data. Here we only keep the value
  let data: Record<string, any> = []
  filteredSortedRowIds.forEach((id) => {
    const row: Record<string, any> = {};
    visibleColumnsField.forEach((field) => {
      row[field] = apiRef.current.getCellParams(id, field).value;
    });
    //TODO: format types
    delete row.__check__
    if (Object.keys(row).length > 0) {
      data.push(row)
    }
  });
  return data
};

const convert_target_to_targetlist_row = (target: Target) => {
  //required params
  const name = target.target_name?.slice(0, 16).padEnd(17, " ") //columns 1-16 are text last column is a space
  const ra = target.ra?.replaceAll(':', ' ')
  const dec = target.dec?.replaceAll(':', ' ')
  const equinox = target.equinox ?? '2000'
  let row = `${name} ${ra} ${dec} ${equinox}`
  const valid = target.target_name && target.ra && target.dec && target.equinox
  row = valid ? row : '# INVALID row: ' + row
  //optional params
  row = target.g_mag ? row + ` gmag=${target.g_mag}` : row
  row = target.j_mag ? row + ` jmag=${target.j_mag}` : row
  row = target.ra_offset ? row + ` raoffset=${target.ra_offset}` : row
  row = target.dec_offset ? row + ` decoffset=${target.dec_offset}` : row
  row = target.rotator_mode ? row + ` rotmode=${target.rotator_mode}` : row
  row = target.telescope_wrap ? row + ` wrap=${target.telescope_wrap}` : row
  //comment and tags go before the row
  row = target.comment ? `# ${name} comment: ${target.comment}\n` + row : row
  const tags = target.tags ?? []
  row = tags.length > 0 ? `# ${name} tags: ${tags.join(', ')}\n` + row : row
  return row
}

const getStarlist = (apiRef: React.MutableRefObject<GridApi>) => {
  // Select rows and columns
  let rows = ""
  apiRef.current.getRowModels().forEach((target) => {
    const row = convert_target_to_targetlist_row(target as Target)
    rows += row + '\n'
  })
  return rows
}

const exportBlob = (blob: Blob, filename: string) => {
  // Save the blob in a json file
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  });
};

function StarListExportMenu(props: GridExportMenuItemProps<{}>) {
  const apiRef = useGridApiContext();

  const { hideMenu } = props;

  return (
    <MenuItem
      onClick={() => {
        const txt = getStarlist(apiRef);
        const blob = new Blob([txt], {
          type: 'text/json',
        });
        exportBlob(blob, 'starlist.txt');
        // Hide the export menu after the export
        hideMenu?.();
      }}
    >
      Export Starlist Text File
    </MenuItem>
  );
}


function JsonExportMenuItem(props: GridExportMenuItemProps<{}>) {
  const apiRef = useGridApiContext();

  const { hideMenu } = props;

  return (
    <MenuItem
      onClick={() => {
        const json = getJson(apiRef);
        const blob = new Blob([JSON.stringify(json, null, 2)], {
          type: 'text/json',
        });
        exportBlob(blob, 'targets.json');

        // Hide the export menu after the export
        hideMenu?.();
      }}
    >
      Export JSON
    </MenuItem>
  );
}


interface ExportButtonProps extends ButtonProps {
}

function CustomExportButton(props: ExportButtonProps) {
  return (
    <GridToolbarExportContainer {...props}>
      <JsonExportMenuItem />
      <StarListExportMenu />
    </GridToolbarExportContainer>
  );
}

export const get_targets_from_selected_targets = (selectedTargets: Target[], targets: Target[]): Target[] => {
  const selectedTargetIds = new Set(selectedTargets.map((target) => target._id))
  //filter out targets that don't have ra and dec
  return targets.filter((target) => selectedTargetIds.has(target._id) && target.ra && target.dec)
}

export const create_new_target = (id?: string, obsid?: number, target_name?: string) => {
  let newTarget: Partial<Target> = {}
  Object.entries(target_schema.properties).forEach(([key, value]: [string, any]) => {
    newTarget[key as keyof Target] = value.default
  })
  newTarget = {
    ...newTarget,
    obsid: obsid,
    _id: id,
    target_name: target_name,
    status: 'CREATED'
  }
  return newTarget as Target
}

export interface EditToolbarProps extends Partial<GridToolbarProps & ToolbarPropsOverrides> {
  rows: Target[];
  setRows: (newRows: (oldRows: GridRowsProp) => GridRowsProp) => void;
  obsid: number;
  processRowUpdate: (newRow: GridRowModel<Target>) => Promise<GridRowModel<Target>>;
  submit_one_target: Function
  selectedTargets: Target[]
}

export function EditToolbar(props: EditToolbarProps) {
  const { rows, setRows, processRowUpdate, selectedTargets, submit_one_target } = props;

  const snackbarContext = useSnackbarContext()

  const handleAddTarget = async () => {
    const id = randomId();
    const newTarget = create_new_target(id, props.obsid)
    const submittedTarget = await submit_one_target(newTarget)
    if (!submittedTarget) {
      console.error('error submitting target')
      snackbarContext.setSnackbarMessage({ severity: 'error', message: 'Error adding target' })
      return
    }
    processRowUpdate(submittedTarget)
    setRows((oldRows) => {
      const newRows = [submittedTarget, ...oldRows];
      return newRows
    });
  };

  const vizTargets = selectedTargets.length > 0 ?
    get_targets_from_selected_targets(selectedTargets, rows)
    :
    rows.filter((target) => target.ra && target.dec)

  return (
    // <GridToolbarContainer sx={{ justifyContent: 'center' }}>
    <GridToolbarContainer sx={{ justifyContent: 'space-between' }}>
      <Stack justifyContent={'left'} direction="row" spacing={1}>
        <Button color="primary" startIcon={<AddIcon />} onClick={handleAddTarget}>
          Add Target
        </Button>
        <DeleteDialogButton setRows={setRows} targets={props.selectedTargets} color='primary' />
        <ViewTargetsDialogButton targets={props.selectedTargets} color='primary' />
        <TargetVizButton targets={vizTargets} />
        <TargetWizardButton />
      </Stack>
      <Stack justifyContent={'right'} direction="row" spacing={1}>
        <CustomExportButton/>
        <GridToolbar
          printOptions={{ disableToolbarButton: true }}
          csvOptions={{ disableToolbarButton: true }}
        />
      </Stack>
    </GridToolbarContainer>
  );
}