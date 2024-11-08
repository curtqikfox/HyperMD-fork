// PowerPack for integrating md-advanced-tables with HyperMD using the ITextEditor interface.
// This ensures that tables are automatically formatted and managed by md-advanced-tables.
//
// License: Make sure you comply with md-advanced-tables' license requirements.
// Source: https://github.com/tgrosinger/md-advanced-tables

import * as CodeMirror from 'codemirror';
import { ITextEditor, TableEditor, Point, Range} from '@tgrosinger/md-advanced-tables';
import { defaultSettings, TableEditorPluginSettings } from './settings';

/**
 * HyperMDTextEditor is an implementation of the ITextEditor interface from
 * the mte-kernel library. It teaches the table editor library how to interface
 */
export class HyperMDTextEditor {
  private readonly editor: CodeMirror.Editor;
  private readonly settings: TableEditorPluginSettings;


  constructor( editor: CodeMirror.Editor, settings: TableEditorPluginSettings) {
    this.editor = editor;
    this.settings = settings;
  }

  public getCursorPosition = (): Point => {
    const position = this.editor.getCursor();
    console.log(position);
    return new Point(1, position.ch);
  };

  public setCursorPosition = (pos: Point): void => {
    this.editor.setCursor({ line: pos.row, ch: pos.column });
  };

  public setSelectionRange = (range: Range): void => {
    this.editor.setSelection(
      { line: range.start.row, ch: range.start.column },
      { line: range.end.row, ch: range.end.column },
    );
  };

  public getLastRow = (): number => this.editor.lastLine();

  public acceptsTableEdit = (row: number): boolean => {
    
    return true;
  };

  public getLine = (row: number): string => this.editor.getLine(row);

  public insertLine = (row: number, line: string): void => {
    if (row > this.getLastRow()) {
      this.editor.replaceRange('\n' + line, { line: row, ch: 0 });
    } else {
      this.editor.replaceRange(line + '\n', { line: row, ch: 0 });
    }
  };

  public deleteLine = (row: number): void => {
    // If on the last line of the file, we cannot replace to the next row.
    // Instead, replace all the contents of this line.
    if (row === this.getLastRow()) {
      const rowContents = this.getLine(row);
      this.editor.replaceRange(
        '',
        { line: row, ch: 0 },
        { line: row, ch: rowContents.length },
      );
    } else {
      this.editor.replaceRange(
        '',
        { line: row, ch: 0 },
        { line: row + 1, ch: 0 },
      );
    }
  };

  public replaceLines = (
    startRow: number,
    endRow: number,
    lines: string[],
  ): void => {
    // Take one off the endRow and instead go to the end of that line
    const realEndRow = endRow - 1;
    const endRowContents = this.editor.getLine(realEndRow);
    const endRowFinalIndex = endRowContents.length;

    this.editor.replaceRange(
      lines.join('\n'),
      { line: startRow, ch: 0 },
      { line: realEndRow, ch: endRowFinalIndex },
    );
  };

  public transact = (func: Function): void => {
    /*
    this.editor.operation(() => {
      func();
    });
    */
    func();
  };
}

/** Initialize and apply TableEditor with md-advanced-tables */
function applyAdvancedTableEditor(cm:CodeMirror.Editor) {
  const settings = new TableEditorPluginSettings(defaultSettings);

  const textEditor = new HyperMDTextEditor(cm, settings);
  const tableEditor = new TableEditor(textEditor);

  // Automatically format all tables when editor content changes
  cm.on('change', (instance, changeObj) => {
    if (changeObj.origin !== 'setValue') {
      console.log(settings.asOptions());
      tableEditor.formatAll((settings.asOptions()));
    }
  });
}


// Hook into HyperMD instance creation to apply the table editor automatically
CodeMirror.defineOption('advancedTables', null, (cm, val) => {
  if (val) {
    applyAdvancedTableEditor(cm);
  }
});