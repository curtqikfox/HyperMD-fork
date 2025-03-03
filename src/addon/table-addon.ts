// // ObsidianTableEditor.ts
// // An Obsidian-like table editor addon for HyperMD/CodeMirror
// // (C) 2025 Your Name – Distributed under the MIT License

// import * as CodeMirror from "codemirror";
// import { Addon } from "../core";
// import { cm_t } from "../core/type";

// /************************************************************************************
//  * Addon Options
//  ************************************************************************************/
// export interface TableEditorOptions extends Addon.AddonOptions {
//   enabled: boolean;
// }

// export const defaultTableEditorOptions: TableEditorOptions = {
//   enabled: false,
// };

// CodeMirror.defineOption(
//   "hmdTableEditor",
//   defaultTableEditorOptions,
//   function (cm: cm_t, newVal: TableEditorOptions | boolean) {
//     const enabled = typeof newVal === "boolean" ? newVal : !!newVal.enabled;
//     const inst = TableEditor.getInstance(cm);
//     inst.setEnabled(enabled);
//   }
// );

// /************************************************************************************
//  * TableCell Class – Represents one cell in the table.
//  *
//  * This class is very similar in spirit to Obsidian’s internal “mI” object.
//  ************************************************************************************/
// class TableCell {
//   // Data fields
//   public table: TableEditor;
//   public row: number;
//   public col: number;
//   public text: string;
//   public padStart: number;
//   public padEnd: number;
//   public dirty: boolean = false;
//   public start: number = 0; // offset within markdown block (for sync)
//   public end: number = 0;
//   // DOM references
//   public el: HTMLElement;
//   public contentEl: HTMLElement;

//   constructor(
//     table: TableEditor,
//     row: number,
//     col: number,
//     text: string = "",
//     padStart: number = 1,
//     padEnd: number = 1
//   ) {
//     this.table = table;
//     this.row = row;
//     this.col = col;
//     this.text = text;
//     this.padStart = padStart;
//     this.padEnd = padEnd;
//   }

//   /**
//    * Set text direction based on the table container’s direction.
//    * (Obsidian calls Ew() on the container.)
//    */
//   setTextDir() {
//     const dir = this.table.containerEl.getAttribute("dir") || "ltr";
//     this.el.setAttribute("dir", dir);
//     // If this is the first cell, force the container’s direction
//     if (this.row === 0 && this.col === 0) {
//       this.table.containerEl.setAttribute("dir", dir);
//     }
//   }

//   /**
//    * Initialize the cell element.
//    *
//    * – Wrap existing child nodes into a “cell wrapper” div.
//    * – Attach event listeners (click, contextmenu, drag, pointer events)
//    *   so that selection and editing work like Obsidian.
//    */
//   init(cellEl: HTMLElement, start: number, end: number) {
//     this.el = cellEl;
//     this.start = start;
//     this.end = end;
//     this.setTextDir();

//     // Create a wrapper for the cell’s content.
//     const wrapper = document.createElement("div");
//     wrapper.className = "table-cell-wrapper";
//     // Move any existing children into the wrapper.
//     while (cellEl.firstChild) {
//       wrapper.appendChild(cellEl.firstChild);
//     }
//     // Ensure the cell is never empty.
//     if (!wrapper.firstChild) {
//       wrapper.appendChild(document.createElement("br"));
//     }
//     cellEl.appendChild(wrapper);
//     this.contentEl = wrapper;

//     this.attachEvents();
//   }

//   /**
//    * Attach events to the cell:
//    * – Click: sets cell focus.
//    * – Contextmenu: shows the custom menu.
//    * – Input & blur: mark dirty and sync changes.
//    * – (Additional events for drag selection can be added here.)
//    */
//   attachEvents() {
//     // On click, set cell focus.
//     this.el.addEventListener("click", (evt) => {
//       evt.stopPropagation();
//       this.table.setCellFocus(this.row, this.col);
//     });
//     // On contextmenu, show the table’s context menu (for row/column operations)
//     this.el.addEventListener("contextmenu", (evt: MouseEvent) => {
//       evt.preventDefault();
//       evt.stopPropagation();
//       this.table.showContextMenu(evt, this);
//     });
//     // On input, mark cell as dirty so that we know to sync.
//     this.el.addEventListener("input", () => {
//       this.text = this.contentEl.innerText;
//       this.dirty = true;
//     });
//     // On blur, sync changes and (optionally) run inline markdown.
//     this.el.addEventListener("blur", () => {
//       this.table.syncCell(this);
//       this.enableInlineMarkdown();
//     });
//   }

//   /**
//    * Returns the cell text padded with leading and trailing spaces.
//    */
//   getTextWithPadding(): string {
//     return " ".repeat(this.padStart) + this.text + " ".repeat(this.padEnd);
//   }

//   /**
//    * (Optional) Use a custom method to enable inline markdown rendering.
//    * In Obsidian, CodeMirror.runMode or similar is used.
//    */
//   enableInlineMarkdown() {
//     // For example:
//     // CodeMirror.runMode(this.text, "markdown", this.contentEl);
//     // For now, we simply leave the content unchanged.
//   }

//   /**
//    * Get absolute offsets of the cell’s text within the entire markdown block.
//    */
//   getAbsoluteOffsets() {
//     const tableStart = this.table.tableStart || 0;
//     return {
//       start: tableStart + this.start,
//       end: tableStart + this.end,
//       textStart: tableStart + this.start + this.padStart,
//       textEnd: tableStart + this.end - this.padEnd,
//     };
//   }
// }

// /************************************************************************************
//  * TableEditor Class – The overall table widget
//  *
//  * This class encapsulates the widget that replaces the markdown table.
//  * It creates an HTML table with contentEditable cells, installs custom events,
//  * and provides methods to sync the edited table back into markdown.
//  * It also implements right‑click menus to add or remove rows/columns.
//  ************************************************************************************/
// class TableEditor implements Addon.Addon {
//   public cm: cm_t;
//   public enabled: boolean = false;
//   public containerEl: HTMLElement;
//   // These represent the line numbers (or offsets) of the original markdown table.
//   public tableStart: number = 0;
//   public tableEnd: number = 0;
//   // 2D array of TableCell objects.
//   public rows: TableCell[][] = [];

//   // Use a WeakMap so that each CodeMirror instance gets its own TableEditor.
//   private static instances = new WeakMap<cm_t, TableEditor>();

//   constructor(cm: cm_t) {
//     this.cm = cm;
//     // Create a container element for the table widget.
//     this.containerEl = document.createElement("div");
//     this.containerEl.className = "hmd-table-editor";
//   }

//   static getInstance(cm: cm_t): TableEditor {
//     if (!this.instances.has(cm)) {
//       this.instances.set(cm, new TableEditor(cm));
//     }
//     return this.instances.get(cm)!;
//   }

//   setEnabled(enabled: boolean) {
//     this.enabled = enabled;
//     if (enabled) {
//       this.scanForMarkdownTable();
//     } else {
//       this.removeWidget();
//     }
//   }

//   /**
//    * Scan the document for a markdown table block.
//    * (Here we use a simple regular-expression check; in production you may wish to be more robust.)
//    */
//   scanForMarkdownTable() {
//     const doc = this.cm.getDoc();
//     const text = doc.getValue();
//     // A simple check: look for a block containing at least one pipe per line.
//     const match = text.match(/((\|.*\n)+)/);
//     if (match) {
//       const tableMarkdown = match[0];
//       // For simplicity, assume the table starts at the beginning.
//       // (In a real addon you would compute the actual line numbers.)
//       this.tableStart = 0;
//       this.tableEnd = tableMarkdown.split("\n").length - 1;
//       this.buildTableWidget(tableMarkdown);
//     }
//   }

//   /**
//    * Build the HTML table widget from the markdown table string.
//    */
//   buildTableWidget(markdown: string) {
//     // Clear any previous widget content.
//     this.containerEl.innerHTML = "";
//     this.rows = [];

//     // Parse the markdown table into a 2D array of strings.
//     const lines = markdown.trim().split("\n");
//     const tableData = lines.map((line) => {
//       let l = line.trim();
//       if (l.startsWith("|")) l = l.slice(1);
//       if (l.endsWith("|")) l = l.slice(0, -1);
//       return l.split("|").map((cell) => cell.trim());
//     });

//     // Determine if there is a header row (if the second row is a separator row).
//     const hasHeader =
//       tableData.length > 1 &&
//       tableData[1].every((cell) => /^-+$/.test(cell));

//     // Create the HTML table.
//     const tableEl = document.createElement("table");
//     tableEl.className = "table-widget";
//     tableEl.contentEditable = "true";
//     tableEl.style.width = "100%";
//     tableEl.style.borderCollapse = "collapse";

//     if (hasHeader) {
//       // Build <thead> using the first row.
//       const thead = document.createElement("thead");
//       const headerRow = document.createElement("tr");
//       tableData[0].forEach((cellText, colIndex) => {
//         const th = document.createElement("th");
//         th.contentEditable = "true";
//         th.innerText = cellText;
//         // Create and initialize a TableCell.
//         const cell = new TableCell(this, 0, colIndex, cellText);
//         cell.init(th, 0, cellText.length + cell.padStart + cell.padEnd);
//         headerRow.appendChild(th);
//         if (!this.rows[0]) this.rows[0] = [];
//         this.rows[0][colIndex] = cell;
//       });
//       thead.appendChild(headerRow);
//       tableEl.appendChild(thead);

//       // Build <tbody> skipping the second (separator) row.
//       const tbody = document.createElement("tbody");
//       for (let i = 2; i < tableData.length; i++) {
//         const tr = document.createElement("tr");
//         tableData[i].forEach((cellText, colIndex) => {
//           const td = document.createElement("td");
//           td.contentEditable = "true";
//           td.innerText = cellText;
//           const cell = new TableCell(this, i - 2, colIndex, cellText);
//           cell.init(td, 0, cellText.length + cell.padStart + cell.padEnd);
//           tr.appendChild(td);
//           if (!this.rows[i - 2]) this.rows[i - 2] = [];
//           this.rows[i - 2][colIndex] = cell;
//         });
//         tbody.appendChild(tr);
//       }
//       tableEl.appendChild(tbody);
//     } else {
//       // No header: treat all rows equally.
//       const tbody = document.createElement("tbody");
//       tableData.forEach((rowData, rowIndex) => {
//         const tr = document.createElement("tr");
//         rowData.forEach((cellText, colIndex) => {
//           const td = document.createElement("td");
//           td.contentEditable = "true";
//           td.innerText = cellText;
//           const cell = new TableCell(this, rowIndex, colIndex, cellText);
//           cell.init(td, 0, cellText.length + cell.padStart + cell.padEnd);
//           tr.appendChild(td);
//           if (!this.rows[rowIndex]) this.rows[rowIndex] = [];
//           this.rows[rowIndex][colIndex] = cell;
//         });
//         tbody.appendChild(tr);
//       });
//       tableEl.appendChild(tbody);
//     }

//     // Attach a table-level contextmenu handler (if not already handled on individual cells)
//     tableEl.addEventListener("contextmenu", (evt: MouseEvent) => {
//       evt.preventDefault();
//       this.showContextMenu(evt, null);
//     });

//     // Append the table element to our container.
//     this.containerEl.appendChild(tableEl);

//     // Insert the widget into the CodeMirror document.
//     // (Here we use addWidget so that the table behaves like a block widget.)
//     this.cm.addWidget(this.cm.getDoc().getCursor(), this.containerEl, true);
//   }

//   /**
//    * Remove the widget from the document.
//    */
//   removeWidget() {
//     if (this.containerEl.parentNode) {
//       this.containerEl.parentNode.removeChild(this.containerEl);
//     }
//   }

//   /**
//    * Sync a single cell’s changes back to the markdown.
//    * (For simplicity, we rebuild the entire markdown table from the cell texts.)
//    */
//   syncCell(cell: TableCell) {
//     // Reconstruct a 2D array of strings from our rows.
//     let markdown = "";
//     if (this.containerEl.querySelector("thead")) {
//       // Has header: first row, then separator, then remaining rows.
//       const header = this.rows[0].map((c) => c.getTextWithPadding());
//       markdown += `| ${header.join(" | ")} |\n`;
//       markdown += `| ${header.map(() => "---").join(" | ")} |\n`;
//       for (let i = 1; i < this.rows.length; i++) {
//         const row = this.rows[i].map((c) => c.getTextWithPadding());
//         markdown += `| ${row.join(" | ")} |\n`;
//       }
//     } else {
//       // No header.
//       for (let i = 0; i < this.rows.length; i++) {
//         const row = this.rows[i].map((c) => c.getTextWithPadding());
//         markdown += `| ${row.join(" | ")} |\n`;
//       }
//     }
//     // Update the CodeMirror document (replace from tableStart to tableEnd).
//     const doc = this.cm.getDoc();
//     this.cm.operation(() => {
//       doc.replaceRange(
//         markdown + "\n",
//         { line: this.tableStart, ch: 0 },
//         { line: this.tableEnd + 1, ch: 0 }
//       );
//     });
//   }

//   /**
//    * Set focus into the cell at (row, col)
//    */
//   setCellFocus(row: number, col: number) {
//     const cell = this.rows[row] && this.rows[row][col];
//     if (cell) {
//       cell.el.focus();
//     }
//   }

//   /**
//    * Show a custom context menu.
//    * If a cell is provided then the menu options will operate on that cell’s row/column.
//    * Otherwise (if invoked on the table container) default options are provided.
//    */
//   showContextMenu(evt: MouseEvent, cell: TableCell | null) {
//     // Remove any existing menu.
//     const existing = document.getElementById("table-context-menu");
//     if (existing) existing.remove();

//     const menu = document.createElement("div");
//     menu.id = "table-context-menu";
//     menu.style.position = "absolute";
//     menu.style.zIndex = "10000";
//     menu.style.backgroundColor = "#fff";
//     menu.style.border = "1px solid #ccc";
//     menu.style.padding = "4px";

//     // Define menu options.
//     const createItem = (label: string, action: () => void) => {
//       const item = document.createElement("div");
//       item.innerText = label;
//       item.style.padding = "2px 4px";
//       item.style.cursor = "pointer";
//       item.addEventListener("click", () => {
//         action();
//         menu.remove();
//         // After a change, sync the markdown.
//         this.syncCell(cell || this.rows[0][0]);
//       });
//       menu.appendChild(item);
//     };

//     // Row operations.
//     createItem("Insert Row Above", () => {
//       const targetRow = cell ? cell.row : 0;
//       this.insertRow(targetRow, "above");
//     });
//     createItem("Insert Row Below", () => {
//       const targetRow = cell ? cell.row : 0;
//       this.insertRow(targetRow, "below");
//     });
//     createItem("Delete Row", () => {
//       const targetRow = cell ? cell.row : 0;
//       this.deleteRow(targetRow);
//     });
//     // Column operations.
//     createItem("Insert Column Left", () => {
//       const targetCol = cell ? cell.col : 0;
//       this.insertColumn(targetCol, "left");
//     });
//     createItem("Insert Column Right", () => {
//       const targetCol = cell ? cell.col : 0;
//       this.insertColumn(targetCol, "right");
//     });
//     createItem("Delete Column", () => {
//       const targetCol = cell ? cell.col : 0;
//       this.deleteColumn(targetCol);
//     });

//     document.body.appendChild(menu);
//     menu.style.left = evt.pageX + "px";
//     menu.style.top = evt.pageY + "px";

//     const removeMenu = () => {
//       menu.remove();
//       document.removeEventListener("click", removeMenu);
//     };
//     document.addEventListener("click", removeMenu);
//   }

//   /**
//    * Insert a new row.
//    * The new row is inserted “above” or “below” the given row index.
//    */
//   insertRow(targetRow: number, position: "above" | "below") {
//     const newRow: TableCell[] = [];
//     // Determine the number of columns from the first row.
//     const colCount = this.rows[0] ? this.rows[0].length : 1;
//     for (let col = 0; col < colCount; col++) {
//       newRow.push(new TableCell(this, targetRow, col, ""));
//     }
//     if (position === "above") {
//       this.rows.splice(targetRow, 0, newRow);
//     } else {
//       this.rows.splice(targetRow + 1, 0, newRow);
//     }
//     this.syncMarkdown();
//   }

//   /**
//    * Delete the row at the given index.
//    */
//   deleteRow(targetRow: number) {
//     if (this.rows.length > 1) {
//       this.rows.splice(targetRow, 1);
//       this.syncMarkdown();
//     }
//   }

//   /**
//    * Insert a new column.
//    */
//   insertColumn(targetCol: number, position: "left" | "right") {
//     this.rows.forEach((row, rowIndex) => {
//       const newCell = new TableCell(this, rowIndex, position === "left" ? targetCol : targetCol + 1, "");
//       if (position === "left") {
//         row.splice(targetCol, 0, newCell);
//       } else {
//         row.splice(targetCol + 1, 0, newCell);
//       }
//     });
//     this.syncMarkdown();
//   }

//   /**
//    * Delete the column at the given index.
//    */
//   deleteColumn(targetCol: number) {
//     this.rows.forEach((row) => {
//       if (row.length > 1) {
//         row.splice(targetCol, 1);
//       }
//     });
//     this.syncMarkdown();
//   }

//   /**
//    * Sync the entire table back to markdown.
//    */
//   syncMarkdown() {
//     // For simplicity, we call syncCell on the first cell.
//     this.syncCell(this.rows[0][0]);
//   }
// }

// /************************************************************************************
//  * Export the addon getter (singleton pattern)
//  ************************************************************************************/
// export const getAddon = Addon.Getter("TableEditor", TableEditor, defaultTableEditorOptions);

// declare global {
//   namespace HyperMD {
//     interface HelperCollection {
//       TableEditor?: TableEditor;
//     }
//   }
// }
