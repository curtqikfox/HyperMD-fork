import { getAddon as HyperMD_GetAddon } from "hypermd/addon/table-align";
import { EditorView } from 'codemirror/view';
import { StateField, RangeSet } from '@codemirror/state';
import editableTablePlugin from './editableTablePlugin';  // Custom table plugin

// Default HyperMD TableAlign options (if you want to pass any specific options)
const defaultOption = {};

// Define the TableAlign addon to handle tables using the new `editableTablePlugin`
export class TableAlign {
  cm: EditorView;

  constructor(cm: EditorView) {
    this.cm = cm;

    // Use the editableTablePlugin to initialize table decorations
    const field = editableTablePlugin();
    this.cm.dispatch({
      effects: field.create(this.cm.state),
    });
  }

  // Optionally add more methods to manage your custom table view if needed
}

// Use HyperMD's Addon Getter pattern to ensure a single instance of the TableAlign addon
export const getAddon = HyperMD_GetAddon("TableAlign", TableAlign, defaultOption);

// Register the addon with the global HyperMD helper collection
declare global {
  namespace HyperMD {
    interface HelperCollection {
      TableAlign?: TableAlign;
    }
  }
}

// Helper to initialize the custom table addon when setting up the editor
export function useTableAlign(cm: EditorView) {
  return getAddon(cm);
}
