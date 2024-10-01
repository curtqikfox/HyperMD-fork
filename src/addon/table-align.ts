// HyperMD, copyright (c) by laobubu
// Distributed under an MIT license: http://laobubu.net/HyperMD/LICENSE
//
// DESCRIPTION: Align Table Columns
//

import * as CodeMirror from 'codemirror'
import { Addon, FlipFlop, debounce, suggestedEditorConfig, normalVisualConfig } from '../core'
import { LineHandle } from 'codemirror'
import { cm_t } from '../core/type'
import { HyperMDState, TableType } from '../mode/hypermd'


/********************************************************************************** */
//#region Addon Options

export interface Options extends Addon.AddonOptions {
  /** Enable TableAlign */
  enabled: boolean
}

export const defaultOption: Options = {
  enabled: false,
}

export const suggestedOption: Partial<Options> = {
  enabled: true,  // we recommend lazy users to enable this fantastic addon!
}

export type OptionValueType = Partial<Options> | boolean;

declare global {
  namespace HyperMD {
    interface EditorConfiguration {
      /**
       * Options for TableAlign.
       *
       * You may also provide a boolean to toggle it.
       */
      hmdTableAlign?: OptionValueType
    }
  }
}

suggestedEditorConfig.hmdTableAlign = suggestedOption
normalVisualConfig.hmdTableAlign = false

CodeMirror.defineOption("hmdTableAlign", defaultOption, function (cm: cm_t, newVal: OptionValueType) {
  const enabled = !!newVal

  ///// convert newVal's type to `Partial<Options>`, if it is not.

  if (!enabled || typeof newVal === "boolean") {
    newVal = { enabled: enabled }
  }

  ///// apply config and write new values into cm

  var inst = getAddon(cm)
  for (var k in defaultOption) {
    inst[k] = (k in newVal) ? newVal[k] : defaultOption[k]
  }
})

//#endregion

/********************************************************************************** */
//#region Addon Class

const tableIDPrefix = 'qfe-table-';

export class TableAlign implements Addon.Addon, Options /* if needed */ {
  enabled: boolean;
  table: HTMLTableElement
  private tableLineHandles: Map<string, LineHandle> = new Map(); // Store LineHandle array for each table by its tableID


  constructor(public cm: cm_t) {
    // options will be initialized to defaultOption (if exists)
    // add your code here

    new FlipFlop(
      /* ON  */() => {
        cm.on("renderLine", this._procLine)
        cm.on('change', this._onChange)
        // cm.on("update", this.updateStyle)
        // cm.refresh()
        // document.head.appendChild(this.styleEl)
      },
      /* OFF */() => {
        cm.off("renderLine", this._procLine)
        cm.on('change', this._onChange)
        // cm.off("update", this.updateStyle)
        // document.head.removeChild(this.styleEl)
      }
    ).bind(this, "enabled", true)
  }

  public styleEl = document.createElement("style")

  private _lastCSS: string

  /**
   * Remeasure visible columns, update CSS style to make columns aligned
   *
   * (This is a debounced function)
   */
  // updateStyle = debounce(() => {
  //   if (!this.enabled) return

  //   const cm = this.cm
  //   const measures = this.measure()
  //   const css = this.makeCSS(measures)
  //   if (css === this._lastCSS) return

  //   this.styleEl.textContent = this._lastCSS = css
  //   cm.refresh()
  // }, 100)

  private _onChange = (cm: cm_t) => {
    const lineHandles = this.tableLineHandles;

    // Iterate over the Map using forEach
    lineHandles.forEach((lineHandle, key) => {
        // Check if the current line handle still points to a valid line
        let table = document.getElementById(tableIDPrefix+key);
        // If the line no longer exists, delete the corresponding line handle from the map
        if (!table) {
            lineHandles.delete(key);
        }
    });
};



  /** CodeMirror renderLine event handler */
  private _procLine = (cm: cm_t, line: LineHandle, el: HTMLPreElement) => {
    // Only process if the line contains a table separator (|---| format)
    if (!el.querySelector('.cm-hmd-table-sep')) return;
  
    const lineSpan = el.firstElementChild;
    const existingTable = lineSpan.getElementsByTagName('table');
    if(existingTable.length>0 && existingTable[0].childElementCount>2) return;
    const lineSpanChildren = Array.prototype.slice.call(lineSpan.childNodes, 0) as Node[];
  
    const eolState = cm.getStateAfter(line.lineNo()) as HyperMDState;
    const columnStyles = eolState.hmdTableColumns;
    const tableID = eolState.hmdTableID;
  
    let table: HTMLTableElement | null = null;
    let tr: HTMLTableRowElement;
    // If it's the first row, create the table element
    if (eolState.hmdTable && eolState.hmdTableRow === 0) {
      // const existingTable = document.getElementById(tableIDPrefix + tableID) as HTMLTableElement;
      // if the table already exist then it is just an update scenario to skip the re-rendering of the UI
      table = document.createElement('table');
      table.setAttribute('id', tableIDPrefix + tableID);
      table.oncontextmenu = (e) => {
        e.preventDefault();
        // e.stopPropagation();
      };
      
      lineSpan.appendChild(table);
      this.addTableLineHandle(tableID, line); // Store LineHandle for headers
    } 
    // Ignore the second line (table separator)
    else if (eolState.hmdTable && eolState.hmdTableRow === 1) {
      el.innerHTML = '';
      return;
    } 
    // For subsequent rows, retrieve the existing table element
    else if (eolState.hmdTable && eolState.hmdTableRow > 1) {
      table = document.getElementById(tableIDPrefix + tableID) as HTMLTableElement;
      el.style.display = 'none';
      // No need to re-add LineHandle for every row here
    }
    
    if (!table) return;
    // row =1 => the separator which is returned above so anything below should be of next index;
    const editorRowIndex = eolState.hmdTableRow > 0?(eolState.hmdTableRow+1):eolState.hmdTableRow
    // Check if the row already exists
    tr = table.querySelector(`tr[data-row-index="${editorRowIndex}"]`) as HTMLTableRowElement;
    if (!tr) {
      // Create new row if it doesn't exist
      tr = document.createElement('tr');
      tr.classList.add('CodeMirror-line');
      tr.setAttribute('data-row-index', String(editorRowIndex)); // Set row index for future reference
      table.appendChild(tr);
    } else {
      // Clear existing row content to update it
      return;
      tr.innerHTML = '';
    }
  
    let rowIndex = editorRowIndex;
    let columnIdx = eolState.hmdTable === TableType.NORMAL ? -1 : 0;
    let columnSpan, columnContentSpan;
    
    if (columnStyles[columnIdx]) {
      columnSpan = this.makeColumn(columnIdx, columnStyles[columnIdx], tableID, rowIndex);
      columnContentSpan = columnSpan.firstElementChild;
    }
  
    for (const childEl of lineSpanChildren) {
      const elClass = childEl.nodeType === Node.ELEMENT_NODE ? (childEl as HTMLElement).className : "";
  
      if (/cm-hmd-table-sep/.test(elClass)) {
        columnIdx++;
        if (columnSpan) {
          columnSpan.appendChild(columnContentSpan);
          tr.appendChild(columnSpan);
        }
  
        // Create a new column for the next segment and pass the correct row index
        if (columnStyles[columnIdx]) {
          columnSpan = this.makeColumn(columnIdx, columnStyles[columnIdx], tableID, rowIndex);
          columnContentSpan = columnSpan.firstElementChild;
        }
      } else {
        // Continue appending content to the current column
        columnContentSpan.appendChild(childEl);
      }
    }
  
    if (columnSpan) {
      columnSpan.appendChild(columnContentSpan);
      tr.appendChild(columnSpan);
    }
  };
  

  // Store line handle for table rows
  private addTableLineHandle(tableID: string, lineHandle: LineHandle) {
    // Only set the new LineHandle if it does not already exist for this tableID
    if (!this.tableLineHandles.has(tableID)) {
        this.tableLineHandles.set(tableID, lineHandle);
    }
  }

  // Get LineHandles for a table by tableID
  private getTableLineHandles(tableID: string): LineHandle | undefined {
    return this.tableLineHandles.get(tableID);
  }
  /**
   * create a <span> container as column,
   * note that put content into column.firstElementChild
   */
  makeColumn(index: number, style: string, tableID: string, rowIndex: number): HTMLSpanElement {
    
    var span = rowIndex===0?document.createElement("th"):document.createElement("td");
    span.className = `hmd-table-column hmd-table-column-${index} hmd-table-column-${style}`
    span.setAttribute("data-column", "" + index)
    span.setAttribute("data-table-id", tableID)

    var span2 = document.createElement("span")
    span2.style.display = 'block';
    span2.className = "hmd-table-column-content"
    span2.setAttribute("data-column", "" + index)
    span2.setAttribute("data-row", "" + rowIndex);  // Store the row index
    span2.setAttribute("contentEditable", 'true');

    span2.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    }, true);

    // span2.addEventListener('keydown', (e) => {
    //   e.stopPropagation();
    // }, true);

    // span2.onkeydown = (e) => {
    //   // e.preventDefault();
    //   e.stopPropagation();
    // }

    span2.onselectstart = (e) => {
      e.stopPropagation();
    }
    
    // Add input event listener to detect changes in the cell
    span2.oninput = (e) => {
      const cellValue = span2.textContent || '';
      const columnIndex = parseInt(span.getAttribute('data-column')!, 10);
      const rowIndex = parseInt(span2.getAttribute('data-row')!, 10);  // Get the row index
      const tableID = span.getAttribute('data-table-id')!;
      
      // Update the underlying markdown content
      this.updateMarkdownTable(this.cm, tableID, rowIndex, columnIndex, cellValue);
    };

    span.appendChild(span2)
    return span;
}


updateMarkdownTable(cm, tableID: string, rowIndex: number, columnIndex: number, newValue: string) {
  ++columnIndex;
  rowIndex = rowIndex>0?(rowIndex-1):rowIndex;
  const lineHandles = this.getTableLineHandles(tableID);
  
  // if (!lineHandles || lineHandles.length <= rowIndex) return;
  
  // Get the specific LineHandle for the row being updated
  const lineHandle = cm.getLineHandle(lineHandles.lineNo()+rowIndex); // lineHandles[rowIndex];
  const lineContent = lineHandle.text;

  // Update the specific cell in the Markdown table row
  const updatedLine = this.replaceTableCellContent(lineContent, columnIndex, newValue);

  // Use the LineHandle to replace the line content in CodeMirror
  const lineNo = this.cm.getLineNumber(lineHandle); // Get the line number from the handle
  if (lineNo !== null) {
    this.cm.replaceRange(updatedLine, { line: lineNo, ch: 0 }, { line: lineNo, ch: lineContent.length });
    if(rowIndex===0) cm.refresh();
  }
}

  

replaceTableCellContent(lineContent: string, columnIndex: number, newValue: string): string {
  // Split the line by the pipe character (|) to get individual columns
  const columns = lineContent.split('|');

  // Update the content of the correct column
  if (columns[columnIndex] !== undefined) {
    columns[columnIndex] = ` ${newValue.trim()} `;  // Ensure proper formatting
  }

  // Rebuild the line with the updated content
  return columns.join('|');
}


  /** Measure all visible tables and columns */
  // measure() {
  //   const cm = this.cm
  //   const lineDiv = cm.display.lineDiv as HTMLDivElement // contains every <pre> line
  //   const contentSpans = lineDiv.querySelectorAll(".hmd-table-column-content")

  //   /** every table's every column's width in px */
  //   var ans: { [tableID: string]: number[] } = {}

  //   for (let i = 0; i < contentSpans.length; i++) {
  //     const contentSpan = contentSpans[i] as HTMLSpanElement
  //     const column = contentSpan.parentElement as HTMLSpanElement

  //     const tableID = column.getAttribute("data-table-id")
  //     const columnIdx = ~~column.getAttribute("data-column")
  //     const width = contentSpan.offsetWidth + 1 // +1 because browsers turn 311.3 into 312

  //     if (!(tableID in ans)) ans[tableID] = []
  //     var columnWidths = ans[tableID]
  //     while (columnWidths.length <= columnIdx) columnWidths.push(0)
  //     if (columnWidths[columnIdx] < width) columnWidths[columnIdx] = width
  //   }

  //   return ans
  // }

  /** Generate CSS */
  // makeCSS(measures: { [tableID: string]: number[] }): string {
  //   var rules: string[] = []
  //   for (const tableID in measures) {
  //     const columnWidths = measures[tableID]
  //     const rulePrefix = `pre.HyperMD-table-row.HyperMD-table_${tableID} .hmd-table-column-`
  //     for (let columnIdx = 0; columnIdx < columnWidths.length; columnIdx++) {
  //       const width = columnWidths[columnIdx]
  //       rules.push(`${rulePrefix}${columnIdx} { min-width: ${width + .5}px }`)
  //     }
  //   }
  //   return rules.join("\n")
  // }
}

//#endregion

/** ADDON GETTER (Singleton Pattern): a editor can have only one TableAlign instance */
export const getAddon = Addon.Getter("TableAlign", TableAlign, defaultOption)
declare global { namespace HyperMD { interface HelperCollection { TableAlign?: TableAlign } } }
