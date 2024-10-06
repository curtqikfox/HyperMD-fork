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
  caretPosition: number
  activeRow: number
  activeColumn: number


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
  if (existingTable.length > 0 && existingTable[0].childElementCount > 1) return;

  const lineSpanChildren = Array.prototype.slice.call(lineSpan.childNodes, 0) as Node[];
  const eolState = cm.getStateAfter(line.lineNo()) as HyperMDState;
  const columnStyles = eolState.hmdTableColumns;
  const tableID = eolState.hmdTableID;

  let table: HTMLTableElement | null = null;
  let tr: HTMLTableRowElement;

  // If it's the first row, create the table element
  if (eolState.hmdTable && eolState.hmdTableRow === 0) {
    lineSpan.getElementsByTagName('table');
    const tableHolder = document.createElement('span');
    tableHolder.classList.add('qmd-table-holder')
    table = document.createElement('table');
    table.setAttribute('id', tableIDPrefix + tableID);
    table.oncontextmenu = (e) => e.preventDefault();
    tableHolder.append(table);
    lineSpan.appendChild(tableHolder);

    this.addTableLineHandle(tableID, line); // Store LineHandle for headers
    this.createEditableOptions(tableHolder); // Add options for adding rows/columns
  } else if (eolState.hmdTable && eolState.hmdTableRow === 1) {
    el.innerHTML = '';
    return;
  } else if (eolState.hmdTable && eolState.hmdTableRow > 1) {
    table = document.getElementById(tableIDPrefix + tableID) as HTMLTableElement;
    el.style.display = 'none';
  }

  if (!table) return;

  const editorRowIndex = eolState.hmdTableRow > 0 ? eolState.hmdTableRow + 1 : eolState.hmdTableRow;

  // Check if the row already exists
  tr = table.querySelector(`tr[data-row-index="${editorRowIndex}"]`) as HTMLTableRowElement;
  if (!tr) {
    tr = document.createElement('tr');
    tr.classList.add('CodeMirror-line');
    tr.setAttribute('data-row-index', String(editorRowIndex)); // Set row index for future reference
    table.appendChild(tr);
  } else {
    return; // Skip if the row already exists
  }

  let rowIndex = editorRowIndex;
  let columnIdx = eolState.hmdTable === TableType.NORMAL ? -1 : 0;
  let columnSpan: HTMLSpanElement | undefined, columnContentSpan: HTMLElement | undefined;

  if (columnStyles[columnIdx]) {
    columnSpan = this.makeColumn(columnIdx, columnStyles[columnIdx], tableID, rowIndex);
    columnContentSpan = columnSpan.firstElementChild as HTMLElement;
  }
  let activeEl = null;
  for (const childEl of lineSpanChildren) {
    const elClass = childEl.nodeType === Node.ELEMENT_NODE ? (childEl as HTMLElement).className : "";

    if (/cm-hmd-table-sep/.test(elClass)) {
      columnIdx++;
      if (columnSpan) {
        columnSpan.appendChild(columnContentSpan!);
        tr.appendChild(columnSpan);
      }

      if (columnStyles[columnIdx]) {
        columnSpan = this.makeColumn(columnIdx, columnStyles[columnIdx], tableID, rowIndex);
        columnContentSpan = columnSpan.firstElementChild as HTMLElement;
      }
    } else {
      columnContentSpan?.appendChild(childEl);
      // console.log(this.activeRow, rowIndex, this.activeColumn, columnIdx, columnContentSpan)
      if(this.activeRow===rowIndex && this.activeColumn===columnIdx) {
        activeEl = columnContentSpan;
      }
    }
  }

  if (columnSpan) {
    columnSpan.appendChild(columnContentSpan!);
    tr.appendChild(columnSpan);
    // console.log(tr)
    if(activeEl) {
      // console.log('query', `${tableIDPrefix}${tableID} >tr:nth-child(${this.activeRow}) > td:nth-child(${this.activeColumn-1})`)
      activeEl = tr.childNodes[this.activeColumn].childNodes[0];
      // const el = document.querySelector(`#${tableIDPrefix}${tableID} > tr:nth-child(${this.activeRow}) > td:nth-child(${this.activeColumn-1})`);
      // console.log(111111, el);
      setTimeout(()=> {
        this.setCaretPosition(activeEl, this.caretPosition);
        this.activeColumn = null;
        this.activeRow = null;
      })
      
    }
  }
};

/** Generic function to add row or column */
private modifyTable(table: HTMLTableElement, mode: 'row' | 'column') {
  const numCols = table.rows[0]?.cells.length || 0;

  if (mode === 'row') {
    const newRow = table.insertRow();
    for (let i = 0; i < numCols; i++) {
      const newCell = newRow.insertCell();
      newCell.innerHTML = ``; // Placeholder content
    }
  } else if (mode === 'column') {
    for (let i = 0; i < table.rows.length; i++) {
      const newCell = table.rows[i].insertCell();
      newCell.innerHTML = ``; // Placeholder content
    }
  }
}

/** Create buttons for adding rows/columns and attach events */
createEditableOptions(tableHolder: HTMLSpanElement) {
  const columnDiv = document.createElement('div');
  columnDiv.classList.add('add-table-column');
  const rowDiv = document.createElement('div');
  rowDiv.classList.add('add-table-row');
  tableHolder.appendChild(columnDiv);
  tableHolder.appendChild(rowDiv);

  columnDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-plus"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>';
  rowDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-plus"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>';

  const table = tableHolder.getElementsByTagName('table')[0];

  // Use the generalized modifyTable function for click events
  rowDiv.onclick = () => this.modifyTable(table, 'row');
  columnDiv.onclick = () => this.modifyTable(table, 'column');
}


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

    span2.onselectstart = (e) => {
      e.stopPropagation();
    }
    
    // if(rowIndex===0) {
    //   span2.onblur = (e) => {
    //     e.preventDefault();
    //     e.stopPropagation();
    //     const cellValue = span2.textContent || '';
    //     const columnIndex = parseInt(span.getAttribute('data-column')!, 10);
    //     const rowIndex = parseInt(span2.getAttribute('data-row')!, 10);  // Get the row index
    //     const tableID = span.getAttribute('data-table-id')!;
        
    //     // Update the underlying markdown content
    //     this.updateMarkdownTable(this.cm, tableID, rowIndex, columnIndex, cellValue);
    //   };
       
    // } else {
      // Add input event listener to detect changes in the cell
      span2.oninput = (e) => {
        const cellValue = span2.textContent || '';
        const columnIndex = parseInt(span.getAttribute('data-column')!, 10);
        const rowIndex = parseInt(span2.getAttribute('data-row')!, 10);  // Get the row index
        const tableID = span.getAttribute('data-table-id')!;

        // Get the cursor position inside the contenteditable span2
        this.caretPosition = this.getCaretPosition(span2);
        this.activeRow = rowIndex;
        this.activeColumn = index
        
        // Update the underlying markdown content
        this.updateMarkdownTable(this.cm, tableID, rowIndex, columnIndex, cellValue);
      };
    // }

    span.appendChild(span2)
    return span;
  }

  // Function to get the caret position in a contenteditable element
  getCaretPosition(element) {
    let caretPos = 0;
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const selectedNode = selection.anchorNode;
        
        // Check if the selected node is inside the target element (span2)
        if (selectedNode && element.contains(selectedNode)) {
            caretPos = range.startOffset;
        }
    }
    return caretPos;
  };

  // Function to set the caret position in a contenteditable element
  // Function to set the caret position in a contenteditable element
  setCaretPosition (element, caretPosition)  {
    // Ensure the element is focused and editable
    element.focus();

    // Create a new range and selection object
    const range = document.createRange();
    const selection = window.getSelection();

    // Get the first child node of the element (usually the text node)
    let textNode = element.firstChild;

    // If there is no textNode, create a new text node if the content is empty
    if (!textNode) {
        textNode = document.createTextNode('');  // Create an empty text node
        element.appendChild(textNode);  // Append the new text node to the element
    }
    console.log(textNode);
    // Clamp the caret position to a valid range (0 to textNode.length)
    const validPosition = Math.min(caretPosition, textNode.length);
    
    try {
        // Set the range at the specified caret position
        range.setStart(textNode, validPosition);
        range.setEnd(textNode, validPosition);
      console.log(validPosition, textNode.length, caretPosition)
        // Clear any existing selection and set the new range
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (error) {
        console.error("Error setting caret position:", error);
    }
  };




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
}

//#endregion

/** ADDON GETTER (Singleton Pattern): a editor can have only one TableAlign instance */
export const getAddon = Addon.Getter("TableAlign", TableAlign, defaultOption)
declare global { namespace HyperMD { interface HelperCollection { TableAlign?: TableAlign } } }
