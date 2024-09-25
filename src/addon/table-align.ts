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
    // const measures = this.measure()
    // const css = this.makeCSS(measures)
    // if (css === this._lastCSS) return

    // this.styleEl.textContent = this._lastCSS = css
    cm.refresh()
  }, 100)

  private _procLine = (cm: cm_t, line: LineHandle, el: HTMLPreElement) => {
    // Check if the line has already been processed to avoid infinite loop
    if (el.classList.contains('hmd-table-processed')) {
      return; // Exit if already processed
    }
  
    const lineNo = line.lineNo();
    const lines = cm.getValue().split('\n');
  
    // Step 1: Check if the current line matches |---|
    if (/^\|\s*-+\s*\|/.test(lines[lineNo])) {
      // Hide the current line
      // el.style.display = 'none';
  
      // Step 2: Look for the previous line as the header
      if (lineNo > 0 && /^\|.*\|$/.test(lines[lineNo - 1])) {
        const headerLine = lines[lineNo - 1].split('|').map(cell => cell.trim()).filter(Boolean);
  
        // Step 3: Prepare to gather content lines
        let content: string[][] = [];
  
        // Step 4: Collect content rows
        for (let i = lineNo + 1; i < lines.length; i++) {
          if (!/^\|.*\|/.test(lines[i])) break;
          const row = lines[i].split('|').map(cell => cell.trim()).filter(Boolean);
          if (row.length) content.push(row);
        }
  
        // Step 5: Build HTML table
        const tableHTML = this.buildTableHTML(headerLine, content);
  
        // Step 6: Replace the lines with the table
        const tableContainer = document.createElement('div');
        tableContainer.innerHTML = tableHTML; // Set the HTML of the table
  
        // Clear existing content in the line
        el.innerHTML = ''; // Clear existing content
        el.appendChild(tableContainer); // Append the new table
  
        // Mark this line as processed to avoid re-processing
        el.classList.add('hmd-table-processed');
      }
  
      return; // Exit after processing the line
    }
  
    // If not a header or separator line, just continue
  }
  
  // Helper method to build the HTML table
  private buildTableHTML(header: string[], content: string[][]): string {
    let html = '<table><thead><tr>';
    
    header.forEach(cell => {
      html += `<th><div contentEditable="true">${cell}</div></th>`;
    });
    
    html += '</tr></thead><tbody>';
    
    content.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td><div contentEditable="true">${cell}</div></td>`;
      });
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    return html;
  }
  
  
  
  
  
  /**
   * Helper function to build the HTML table from headers and content rows.
   */
  buildHtmlTable(headers: string[], content: string[][]): string {
    let html = '<table>\n';
  
    // Add the header row
    html += '  <thead>\n    <tr>\n';
    headers.forEach(header => {
      html += `      <th>${header}</th>\n`;
    });
    html += '    </tr>\n  </thead>\n';
  
    // Add the content rows
    html += '  <tbody>\n';
    content.forEach(row => {
      html += '    <tr>\n';
      row.forEach(cell => {
        html += `      <td>${cell}</td>\n`;
      });
      html += '    </tr>\n';
    });
    html += '  </tbody>\n';
  
    html += '</table>\n';
    return html;
  }
  
  /** CodeMirror renderLine event handler */
  // private _procLine = (cm: cm_t, line: LineHandle, el: HTMLPreElement) => {
  //   if (!el.querySelector('.cm-hmd-table-sep')) return
  //   const lineSpan = el.firstElementChild
  //   const lineSpanChildren = Array.prototype.slice.call(lineSpan.childNodes, 0) as Node[]

  //   const eolState = cm.getStateAfter(line.lineNo()) as HyperMDState
  //   const columnStyles = eolState.hmdTableColumns
  //   const tableID = eolState.hmdTableID

  //   var columnIdx = eolState.hmdTable === TableType.NORMAL ? -1 : 0
  //   // var columnSpan = this.makeColumn(columnIdx, columnStyles[columnIdx] || "dummy", tableID)
  //   var columnContentSpan = columnSpan.firstElementChild
  //   console.log('damnnnnn*******', tableID, lineSpanChildren, line)
  //   for (const el of lineSpanChildren) {
  //     const elClass = el.nodeType === Node.ELEMENT_NODE && (el as HTMLElement).className || ""
  //     // if (/cm-hmd-table-sep/.test(elClass)) {
  //     //   // found a "|", and a column is finished
  //     //   columnIdx++
  //     //   columnSpan.appendChild(columnContentSpan)
  //     //   lineSpan.appendChild(columnSpan)
  //     //   lineSpan.appendChild(el)

  //     //   columnSpan = this.makeColumn(columnIdx, columnStyles[columnIdx] || "dummy", tableID)
  //     //   columnContentSpan = columnSpan.firstElementChild
  //     // } else {
  //     //   columnContentSpan.appendChild(el)
  //     // }
  //   }
  //   columnSpan.appendChild(columnContentSpan)
  //   lineSpan.appendChild(columnSpan)
  // }

  // /**
  //  * create a <span> container as column,
  //  * note that put content into column.firstElementChild
  //  */
  // makeColumn(index: number, style: string, tableID: string): HTMLSpanElement {
  //   var span = document.createElement("span")
  //   span.className = `hmd-table-column hmd-table-column-${index} hmd-table-column-${style}`
  //   span.setAttribute("data-column", "" + index)
  //   span.setAttribute("data-table-id", tableID)

  //   var span2 = document.createElement("span")
  //   span2.className = "hmd-table-column-content"
  //   span2.setAttribute("data-column", "" + index)

  //   span.appendChild(span2)
  //   return span
  // }

  // /** Measure all visible tables and columns */
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

  // /** Generate CSS */
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
