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

export class TableAlign implements Addon.Addon, Options /* if needed */ {
  enabled: boolean;
  table: HTMLTableElement

  constructor(public cm: cm_t) {
    // options will be initialized to defaultOption (if exists)
    // add your code here

    new FlipFlop(
      /* ON  */() => {
        cm.on("renderLine", this._procLine)
        // cm.on("update", this.updateStyle)
        // cm.refresh()
        // document.head.appendChild(this.styleEl)
      },
      /* OFF */() => {
        cm.off("renderLine", this._procLine)
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
  updateStyle = debounce(() => {
    if (!this.enabled) return

    const cm = this.cm
    const measures = this.measure()
    const css = this.makeCSS(measures)
    if (css === this._lastCSS) return

    this.styleEl.textContent = this._lastCSS = css
    cm.refresh()
  }, 100)

  // private _procLine = (cm: cm_t, line: LineHandle, el: HTMLPreElement) => {
  //   if (!el.querySelector('.cm-hmd-table-sep')) return;
    
  //   const lineSpan = el.firstElementChild;
  //   const lineSpanChildren = Array.prototype.slice.call(lineSpan.childNodes, 0) as Node[];
    
  //   const eolState = cm.getStateAfter(line.lineNo()) as HyperMDState;
  //   const columnStyles = eolState.hmdTableColumns;
  //   const tableID = eolState.hmdTableID;

  //   // Step 1: Create a <table> element to replace the span structure
  //   const table = document.createElement('table');
  //   table.className = `hmd-table hmd-table-${tableID}`;
  //   table.setAttribute("data-table-id", tableID);

  //   // Step 2: Create a <tr> (table row) element to hold the table cells
  //   let row = document.createElement('tr');
    
  //   // Column index starts from 0 or -1 based on the table type
  //   var columnIdx = eolState.hmdTable === TableType.NORMAL ? -1 : 0;
  //   table.appendChild(row);
  //       row = document.createElement('tr');
  //   // Step 3: Iterate through the lineSpanChildren to process the line content
  //   for (const el of lineSpanChildren) {
  //     const elClass = el.nodeType === Node.ELEMENT_NODE && (el as HTMLElement).className || "";
      
  //     if (/cm-hmd-table-sep/.test(elClass)) {
  //       // If a separator (|) is found, finalize the current column and move to the next
        
  //       // Step 4: Append the row to the table and start a new row
  //       // table.appendChild(row);
  //       // row = document.createElement('tr');
        
  //       // Increment column index and create a new <td> (table cell)
  //       columnIdx++;
  //     } else {
  //       // Step 5: Create a <td> (table cell) element for non-separator content
  //       const cell = document.createElement('td');
  //       cell.className = `hmd-table-column hmd-table-column-${columnIdx} hmd-table-column-${columnStyles[columnIdx] || "dummy"}`;
  //       cell.setAttribute('data-column', "" + columnIdx);
  //       cell.setAttribute('data-table-id', tableID);
  //       cell.appendChild(el); // Append content into the <td>

  //       // Step 6: Append the <td> (table cell) to the current row
  //       row.appendChild(cell);
  //     }
  //   }

  //   // Step 7: Append the final row to the table
  //   if (row.childNodes.length > 0) {
  //     table.appendChild(row);
  //   }

  //   // Step 8: Clear the original content and append the table to the line span
  //   lineSpan.innerHTML = ''; // Clear existing content
  //   lineSpan.appendChild(table); // Add the <table> element to the DOM
  // }


  /** CodeMirror renderLine event handler */
  private _procLine = (cm: cm_t, line: LineHandle, el: HTMLPreElement) => {
    // Only process if the line contains a table separator (|---| format)
    if (!el.querySelector('.cm-hmd-table-sep')) return;
    
    const lineSpan = el.firstElementChild;
    const lineSpanChildren = Array.prototype.slice.call(lineSpan.childNodes, 0) as Node[];
  
    const eolState = cm.getStateAfter(line.lineNo()) as HyperMDState;
    const columnStyles = eolState.hmdTableColumns;
    const tableID = eolState.hmdTableID;
  
    let table: HTMLTableElement | null = null;
    let tr: HTMLTableRowElement;
  
    // If it's the first row, create the table element
    if (eolState.hmdTable && eolState.hmdTableRow === 0) {
      table = document.createElement('table');
      table.setAttribute('id', 'qfe-table-' + tableID);
      table.onmousedown = (e) => {
        e.stopPropagation();
        // e.preventDefault();
      }
      lineSpan.appendChild(table);
      // console.log("******123", lineSpan, el)
    } else if (eolState.hmdTable && eolState.hmdTableRow === 1) {
      // Ignore the second line (table separator) and clear content
      el.innerHTML = '';
      return;
    } else if (eolState.hmdTable && eolState.hmdTableRow > 1) {
      // For subsequent rows, retrieve the existing table element
      table = document.getElementById('qfe-table-' + tableID) as HTMLTableElement;
      el.style.display = 'none';
    }
  
    // Ensure we have a valid table element before proceeding
    if (!table) return;
    //if the table child count is zero then it means its the nxt line so replace the whole line 
    // Create a new table row (tr)
    tr = document.createElement('tr');
    tr.classList.add('CodeMirror-line'); // Ensures styling compatibility with CodeMirror
  
    let columnIdx = eolState.hmdTable === TableType.NORMAL ? -1 : 0;
    let columnSpan = this.makeColumn(columnIdx, columnStyles[columnIdx] || "dummy", tableID);
    let columnContentSpan = columnSpan.firstElementChild;
  
    for (const childEl of lineSpanChildren) {
      const elClass = childEl.nodeType === Node.ELEMENT_NODE ? (childEl as HTMLElement).className : "";
  
      if (/cm-hmd-table-sep/.test(elClass)) {
        // If we encounter a table separator ("|"), finalize the current column and move to the next
        columnIdx++;
        columnSpan.appendChild(columnContentSpan);
        tr.appendChild(columnSpan);
  
        // Create a new column for the next segment
        columnSpan = this.makeColumn(columnIdx, columnStyles[columnIdx] || "dummy", tableID);
        columnContentSpan = columnSpan.firstElementChild;
      } else {
        // Otherwise, continue appending content to the current column
        columnContentSpan.appendChild(childEl);
      }
    }
  
    // Append the last column to the row
    columnSpan.appendChild(columnContentSpan);
    tr.appendChild(columnSpan);
  
    // Append the row (tr) to the table (and thus to the current line in CodeMirror)
    table.appendChild(tr);
  };
  

  /**
   * create a <span> container as column,
   * note that put content into column.firstElementChild
   */
  makeColumn(index: number, style: string, tableID: string): HTMLSpanElement {
    var span = document.createElement("td")
    span.className = `hmd-table-column hmd-table-column-${index} hmd-table-column-${style}`
    span.setAttribute("data-column", "" + index)
    span.setAttribute("data-table-id", tableID)

    var span2 = document.createElement("span")
    span2.style.display = 'block';
    span2.className = "hmd-table-column-content"
    span2.setAttribute("data-column", "" + index)
    span2.setAttribute("contentEditable", 'true');
    span2.onmousedown = (e) => {
      // e.stopPropagation();
      span2.focus();
    }

    span.appendChild(span2)
    return span
  }




  /** Measure all visible tables and columns */
  measure() {
    const cm = this.cm
    const lineDiv = cm.display.lineDiv as HTMLDivElement // contains every <pre> line
    const contentSpans = lineDiv.querySelectorAll(".hmd-table-column-content")

    /** every table's every column's width in px */
    var ans: { [tableID: string]: number[] } = {}

    for (let i = 0; i < contentSpans.length; i++) {
      const contentSpan = contentSpans[i] as HTMLSpanElement
      const column = contentSpan.parentElement as HTMLSpanElement

      const tableID = column.getAttribute("data-table-id")
      const columnIdx = ~~column.getAttribute("data-column")
      const width = contentSpan.offsetWidth + 1 // +1 because browsers turn 311.3 into 312

      if (!(tableID in ans)) ans[tableID] = []
      var columnWidths = ans[tableID]
      while (columnWidths.length <= columnIdx) columnWidths.push(0)
      if (columnWidths[columnIdx] < width) columnWidths[columnIdx] = width
    }

    return ans
  }

  /** Generate CSS */
  makeCSS(measures: { [tableID: string]: number[] }): string {
    var rules: string[] = []
    for (const tableID in measures) {
      const columnWidths = measures[tableID]
      const rulePrefix = `pre.HyperMD-table-row.HyperMD-table_${tableID} .hmd-table-column-`
      for (let columnIdx = 0; columnIdx < columnWidths.length; columnIdx++) {
        const width = columnWidths[columnIdx]
        rules.push(`${rulePrefix}${columnIdx} { min-width: ${width + .5}px }`)
      }
    }
    return rules.join("\n")
  }
}

//#endregion

/** ADDON GETTER (Singleton Pattern): a editor can have only one TableAlign instance */
export const getAddon = Addon.Getter("TableAlign", TableAlign, defaultOption)
declare global { namespace HyperMD { interface HelperCollection { TableAlign?: TableAlign } } }
