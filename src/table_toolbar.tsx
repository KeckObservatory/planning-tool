import * as React from 'react';
import target_schema from './target_schema.json';
import AddIcon from '@mui/icons-material/Add';
import {
  randomId,
} from '@mui/x-data-grid-generator';
import { TargetWizardButton } from './target_wizard';
import ViewTargetsDialogButton from './two-d-view/view_targets_dialog.tsx';
import {
    GridToolbarContainer,
    GridToolbarExportContainer,
    GridCsvExportMenuItem,
    GridCsvExportOptions,
    GridExportMenuItemProps,
    useGridApiContext,
    gridFilteredSortedRowIdsSelector,
    gridVisibleColumnFieldsSelector,
    GridApi,
    GridRowsProp,
    GridRowModel,
} from '@mui/x-data-grid-pro';
import MenuItem from '@mui/material/MenuItem';
import Button, { ButtonProps } from '@mui/material/Button';
import { Target, useStateContext } from './App.tsx';
import { submit_one_target } from './target_table.tsx';

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

const getStarlist = (apiRef: React.MutableRefObject<GridApi>) => {
    // Select rows and columns
    let rows = ""
    apiRef.current.getRowModels().forEach((target) => {
      if (Object.keys(target).length ===0) return
      console.log(target)
      const invalid = false
      let row = "" 
      if (invalid) row = '# ' + row
      const name = target.target_name.splice(0, 14).padEnd(15, " ")
      const ra = target.ra.replace(':', ' ')
      const dec = target.dec.replace(':', ' ')
      row += name + " " + ra + " " + dec + "\n"
      console.log('row')
      rows += row
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
            Export JSON
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
  csvOptions: GridCsvExportOptions;
}

function CustomExportButton(props: ExportButtonProps) {
  return (
    <GridToolbarExportContainer {...props}>
      <GridCsvExportMenuItem options={props.csvOptions} />
      <JsonExportMenuItem />
    </GridToolbarExportContainer>
  );
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

interface EditToolbarProps {
  setRows: (newRows: (oldRows: GridRowsProp) => GridRowsProp) => void;
  obsid: number;
  processRowUpdate: (newRow: GridRowModel<Target>) => Promise<GridRowModel<Target>>;
  csvOptions: GridCsvExportOptions
  selectedTargets: Target[]
}

export function EditToolbar(props: EditToolbarProps) {
  const { setRows, processRowUpdate, csvOptions } = props;
  const context = useStateContext()

  const handleAddTarget = async () => {
    const id = randomId();
    const newTarget = create_new_target(id, props.obsid)
    const submittedTarget = await submit_one_target(newTarget)
    if (!submittedTarget) {
      console.error('error submitting target')
      return
    }
    context.setTargets((oldTargets) => [submittedTarget, ...oldTargets]);
    processRowUpdate(submittedTarget)

    setRows((oldRows) => {
      const newRows = [submittedTarget, ...oldRows];
      return newRows
    });
  };

  return (
    <GridToolbarContainer sx={{ justifyContent: 'center' }}>
      <Button color="primary" startIcon={<AddIcon />} onClick={handleAddTarget}>
        Add Target
      </Button>
      <ViewTargetsDialogButton targets={props.selectedTargets} />
      <CustomExportButton csvOptions={csvOptions}/>
      {/* <GridToolbar
        csvOptions={csvOptions}
      /> */}
      <TargetWizardButton />
    </GridToolbarContainer>
  );
}