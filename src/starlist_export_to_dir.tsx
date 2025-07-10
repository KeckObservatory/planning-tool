import MenuItem from "@mui/material/MenuItem";
import { GridExportMenuItemProps, useGridApiContext } from "@mui/x-data-grid-pro";
import { getStarlist } from "./table_toolbar";
import { SnackbarContextProps, useSnackbarContext } from "./App";
import { DialogComponent } from './dialog_component';
import { Button, Input, TextField } from "@mui/material";
import React from "react";

interface ETProps {
    open: boolean;
    handleClose: Function;
    handleSubmit?: Function;
    fileName: string;
    setFileName: Function;
}

function ExportTargetsNameDialog(props: ETProps) {
    const { open, handleClose, fileName, setFileName, handleSubmit } = props;

    const dialogTitle = (
        <div>Set File Name</div>
    );

    const dialogContent = (
        <>
            <TextField
                required
                id="filename-required"
                label="File Name"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
            />
            <Button
                variant="contained"
                color="primary"
                onClick={() => {
                    if (handleSubmit) {
                        handleSubmit();
                    }
                    handleClose();
                }}>
                Submit
            </Button>
        </>
    )

    return (
        <DialogComponent
            open={open}
            handleClose={handleClose}
            titleContent={dialogTitle}
            children={dialogContent}
            maxWidth="sm"
        />
    );
}


const exportBlob = (blob: Blob, filename: string, snackbarContext: SnackbarContextProps) => {
    const formData = new FormData();
    formData.append('file', blob, filename);
    fetch('/api/upload', {
        method: 'POST',
        body: formData,
    })
        .then(response => {
            if (!response.ok) {
                console.error('error saving targets to dir', response);
                snackbarContext.setSnackbarMessage({ severity: 'error', message: 'Error saving to starlist directory' })
            }
            snackbarContext.setSnackbarMessage({ severity: 'success', message: 'File saved to starlist directory' })
            return response.json();
        }
        )
}

export const StarListExportDirMenu = (props: GridExportMenuItemProps<{}>) => {
    const apiRef = useGridApiContext();
    const [open, setOpen] = React.useState(false);
    const [fileName, setFileName] = React.useState('starlist.txt');

    const { hideMenu } = props;
    const snackbarContext = useSnackbarContext()

    const handleClose = () => {
        setOpen(false);
    };

    const handleExport = () => {
        const txt = getStarlist(apiRef);
        const blob = new Blob([txt], {
            type: 'text/json',
        });
        exportBlob(blob, fileName, snackbarContext);
        hideMenu?.();
    }
    return (
        <>
            <MenuItem
                onClick={() => {
                    setOpen(true);
                }}
            >
                Export Starlist Text File
            </MenuItem >
            <ExportTargetsNameDialog
                open={open}
                handleClose={handleClose}
                handleSubmit={handleExport}
                fileName={fileName}
                setFileName={setFileName}
            />
        </>

    );
}