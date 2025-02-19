// TableEditor.ts
// HyperMD addon: Replace markdown table blocks with an editable HTML table widget.

import * as CodeMirror from "codemirror";
import { Addon, FlipFlop, debounce } from "../core";
import { cm_t } from "../core/type";
import "codemirror/mode/markdown/markdown";
import { runMode } from "codemirror";


/************************************************************************************
 * Addon Options
 ************************************************************************************/
export interface TableEditorOptions extends Addon.AddonOptions {
  enabled: boolean;
}

export const defaultTableEditorOptions: TableEditorOptions = { enabled: false };

CodeMirror.defineOption(
  "hmdTableEditor",
  defaultTableEditorOptions,
  function (cm: cm_t, newVal: TableEditorOptions | boolean) {
    const enabled = typeof newVal === "boolean" ? newVal : !!newVal.enabled;
    const inst = TableEditor.getInstance(cm);
    inst.setEnabled(enabled);
  }
);

/************************************************************************************
 * TableWidgetData Interface
 ************************************************************************************/
interface TableWidgetData {
  start: number; // starting line number
  end: number;   // ending line number
  widget: CodeMirror.LineWidget;
  containerEl: HTMLElement;
  rows: TableCell[][];
  alignments: string[];
  markdown: string;
  hasHeader: boolean;
}

/************************************************************************************
 * TableCell Class
 ************************************************************************************/
class TableCell {
  public table: TableEditor;
  public row: number;
  public col: number;
  public text: string;
  public padStart: number;
  public padEnd: number;
  public dirty: boolean = false;
  public start: number = 0;
  public end: number = 0;
  public el: HTMLElement;
  public contentEl: HTMLElement;

  constructor(
    table: TableEditor,
    row: number,
    col: number,
    text: string = "",
    padStart: number = 1,
    padEnd: number = 1
  ) {
    this.table = table;
    this.row = row;
    this.col = col;
    this.text = text;
    this.padStart = padStart;
    this.padEnd = padEnd;
  }

  setTextDir() {
    const dir = this.table.getContainerDir();
    this.el.setAttribute("dir", dir);
    if (this.row === 0 && this.col === 0) {
      this.table.getContainerEl().setAttribute("dir", dir);
    }
  }

  init(cellEl: HTMLElement, start: number, end: number, alignment?: string) {
    this.el = cellEl;
    this.start = start;
    this.end = end;
    this.setTextDir();

    const wrapper = document.createElement("div");
    wrapper.className = "table-cell-wrapper";
    while (cellEl.firstChild) {
      wrapper.appendChild(cellEl.firstChild);
    }
    if (!wrapper.firstChild) {
      wrapper.appendChild(document.createElement("br"));
    }
    cellEl.appendChild(wrapper);
    this.contentEl = wrapper;

    if (alignment) {
      cellEl.style.textAlign = alignment;
    }

    this.attachEvents();
    this.enableInlineMarkdown();
  }

  attachEvents() {
    this.el.addEventListener("click", (evt) => {
      evt.stopPropagation();
      this.table.setCellFocus(this.row, this.col);
    });

    this.el.addEventListener("contextmenu", (evt: MouseEvent) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.table.showContextMenu(evt, this);
    });

    // On input, update text and live-render with caret preservation
    this.el.addEventListener("input", () => {
      this.text = this.contentEl.innerText;
      this.dirty = true;
      this.enableInlineMarkdownWithCaretPreservation();
    });

    this.el.addEventListener("blur", () => {
      this.table.syncCell(this);
      this.enableInlineMarkdownWithCaretPreservation();
    });
  }

  /**
   * Render Markdown with token visibility control.
   * Doesn't convert to raw text on focus; tokens are always hidden unless focused.
   */
  enableInlineMarkdown() {
    const renderedHtml = markdownToHTML(this.text);
    this.contentEl.innerHTML = renderedHtml || "<br/>";
  }

  /**
   * Re-renders the cell's content while preserving the caret position.
   */
  enableInlineMarkdownWithCaretPreservation() {
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    let startOffset = 0;
    let targetNode: Node | null = null;

    // Save caret position if we have a selection inside this cell
    if (range && this.contentEl.contains(range.startContainer)) {
      startOffset = range.startOffset;
      targetNode = range.startContainer;
    }

    // Update the cell's content with rendered markdown
    this.enableInlineMarkdown();

    // Restore the caret position
    if (targetNode) {
      const newRange = document.createRange();
      const walker = document.createTreeWalker(this.contentEl, NodeFilter.SHOW_TEXT);
      let charCount = 0;
      let found = false;

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const length = node.textContent?.length || 0;
        if (charCount + length >= startOffset) {
          newRange.setStart(node, startOffset - charCount);
          newRange.collapse(true);
          found = true;
          break;
        }
        charCount += length;
      }

      if (found) {
        selection?.removeAllRanges();
        selection?.addRange(newRange);
      }
    }
  }

  getTextWithPadding(): string {
    return " ".repeat(this.padStart) + this.text + " ".repeat(this.padEnd);
  }

  getAbsoluteOffsets() {
    const widgetData = this.table.widgets.find(w =>
      w.rows.some(row => row.includes(this))
    );
    const tableStart = widgetData ? widgetData.start : 0;
    return {
      start: tableStart + this.start,
      end: tableStart + this.end,
      textStart: tableStart + this.start + this.padStart,
      textEnd: tableStart + this.end - this.padEnd,
    };
  }
}


/************************************************************************************
 * TableEditor Class
 ************************************************************************************/
class TableEditor implements Addon.Addon {
  public cm: cm_t;
  public enabled: boolean = false;
  public widgets: TableWidgetData[] = [];
  public styleEl = document.createElement("style");

  private static instances: WeakMap<cm_t, TableEditor> = new WeakMap();

  constructor(public cmInstance: cm_t) {
    this.cm = cmInstance;
    new FlipFlop(
      /* ON  */() => {
        this.cm.on("renderLine", this._procLine);
        this.cm.on("update", this.scanTables);
        this.cm.refresh();
        document.head.appendChild(this.styleEl);
      },
      /* OFF */() => {
        this.cm.off("renderLine", this._procLine);
        this.cm.off("update", this.scanTables);
        document.head.removeChild(this.styleEl);
      }
    ).bind(this, "enabled", true);
  }

  private _procLine = () => {};

  public static getInstance(cm: cm_t): TableEditor {
    if (!TableEditor.instances.has(cm)) {
      TableEditor.instances.set(cm, new TableEditor(cm));
    }
    return TableEditor.instances.get(cm)!;
  }

  getContainerEl(): HTMLElement {
    return this.widgets.length > 0 ? this.widgets[0].containerEl : document.createElement("div");
  }

  getContainerDir(): string {
    return this.getContainerEl().getAttribute("dir") || "ltr";
  }

  getIdentifier(): string {
    return (this.cm.getWrapperElement().id || "default") + "-table";
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.removeAllWidgets();
    }
  }

  scanTables = debounce(() => {
    if (!this.enabled) return;
    const doc = this.cm.getDoc();
    const lines = doc.getValue().split("\n");

    const foundBlocks: { start: number; end: number; text: string }[] = [];
    let current: { start: number; end: number; lines: string[] } | null = null;

    // Gather consecutive lines that contain a pipe ("|")
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\|/.test(line)) {
        if (!current) {
          current = { start: i, end: i, lines: [line] };
        } else {
          current.end = i;
          current.lines.push(line);
        }
      } else {
        if (current) {
          foundBlocks.push({
            start: current.start,
            end: current.end,
            text: current.lines.join("\n"),
          });
          current = null;
        }
      }
    }
    if (current) {
      foundBlocks.push({
        start: current.start,
        end: current.end,
        text: current.lines.join("\n"),
      });
    }

    // Only create a table widget if we have at least two lines
    // and the second line is a proper alignment row
    foundBlocks.forEach((block) => {
      const blockLines = block.text.trim().split("\n");

      // Must have at least 2 lines (header + alignment row)
      if (blockLines.length < 2) {
        return;
      }

      // Check if second line is a valid alignment row
      // (similar logic to buildTableWidget’s `hasHeader` check)
      let secondLine = blockLines[1].trim();
      if (secondLine.startsWith("|")) secondLine = secondLine.slice(1);
      if (secondLine.endsWith("|")) secondLine = secondLine.slice(0, -1);

      const alignmentCells = secondLine.split("|").map(x => x.trim());
      // If every cell matches /^:?-+:?$/, we consider it a valid alignment row
      if (!alignmentCells.every(cell => /^:?-+:?$/.test(cell))) {
        return;
      }

      // If we get here, it looks like a valid table block
      const exists = this.widgets.find(
        (w) => w.start === block.start && w.end === block.end
      );
      if (!exists) {
        this.buildTableWidget(block.start, block.end, block.text);
      }
    });

    // Remove stale widgets
    this.widgets = this.widgets.filter((w) => {
      const stillExists = foundBlocks.some(
        (block) => block.start === w.start && block.end === w.end
      );
      if (!stillExists) {
        w.widget.clear();
      }
      return stillExists;
    });
  }, 100);

  computeAlignments(tableData: string[][]): string[] {
    const alignments: string[] = [];
    if (tableData.length < 2) return alignments;
    const sepRow = tableData[1];
    sepRow.forEach((cell) => {
      const trimmed = cell.trim();
      if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
        alignments.push("center");
      } else if (trimmed.startsWith(":")) {
        alignments.push("left");
      } else if (trimmed.endsWith(":")) {
        alignments.push("right");
      } else {
        alignments.push("left");
      }
    });
    return alignments;
  }

  buildTableWidget(start: number, end: number, markdown: string) {
    const container = document.createElement("div");
    container.className = "hmd-table-editor";

    for (let i = start; i <= end; i++) {
      this.cm.addLineClass(i, "wrap", "hidden-table-line");
    }

    const lines = markdown.trim().split("\n");
    const tableData = lines.map((line) => {
      let l = line.trim();
      if (l.startsWith("|")) l = l.slice(1);
      if (l.endsWith("|")) l = l.slice(0, -1);
      return l.split("|").map(cell => cell.trim());
    });

    let hasHeader = false;
    let alignments: string[] = [];
    if (
      tableData.length > 1 &&
      tableData[1].every((cell) => /^:?-+:?$/.test(cell))
    ) {
      hasHeader = true;
      alignments = this.computeAlignments(tableData);
    }

    const tableEl = document.createElement("table");
    tableEl.className = "table-widget";
    tableEl.style.width = "auto";
    tableEl.style.borderCollapse = "collapse";

    const rows: TableCell[][] = [];

    if (hasHeader) {
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      tableData[0].forEach((cellText, colIndex) => {
        const th = document.createElement("th");
        th.contentEditable = "true";
        th.innerText = cellText;
        const align = alignments[colIndex] || "left";
        th.style.textAlign = align;

        const cell = new TableCell(this, 0, colIndex, cellText);
        cell.init(th, 0, cellText.length + cell.padStart + cell.padEnd, align);
        headerRow.appendChild(th);

        if (!rows[0]) rows[0] = [];
        rows[0][colIndex] = cell;
      });

      thead.appendChild(headerRow);
      tableEl.appendChild(thead);
    }

    const tbody = document.createElement("tbody");
    const bodyStartIndex = hasHeader ? 2 : 0;

    for (let i = bodyStartIndex; i < tableData.length; i++) {
      const tr = document.createElement("tr");
      const rowIndex = hasHeader ? i - 1 : i;

      tableData[i].forEach((cellText, colIndex) => {
        const td = document.createElement("td");
        td.contentEditable = "true";
        td.innerText = cellText;
        const align = alignments[colIndex] || "left";
        td.style.textAlign = align;

        const cell = new TableCell(this, rowIndex, colIndex, cellText);
        cell.init(td, 0, cellText.length + cell.padStart + cell.padEnd, align);
        tr.appendChild(td);

        if (!rows[rowIndex]) rows[rowIndex] = [];
        rows[rowIndex][colIndex] = cell;
      });
      tbody.appendChild(tr);
    }

    tableEl.appendChild(tbody);

    tableEl.addEventListener("contextmenu", (evt: MouseEvent) => {
      evt.preventDefault();
      this.showContextMenu(evt, null);
    });

    container.appendChild(tableEl);

    const widget = this.cm.addLineWidget(start, container, {
      coverGutter: false,
      noHScroll: true,
    });

    const widgetData: TableWidgetData = {
      start,
      end,
      widget,
      containerEl: container,
      rows,
      alignments,
      markdown,
      hasHeader,
    };

    this.widgets.push(widgetData);
  }

  removeAllWidgets() {
    this.widgets.forEach((w) => {
      w.widget.clear();
    });
    this.widgets = [];
    const doc = this.cm.getDoc();
    for (let i = 0; i < doc.lineCount(); i++) {
      this.cm.removeLineClass(i, "wrap", "hidden-table-line");
    }
  }

  syncCell(cell: TableCell) {
    const widgetData = this.widgets.find(w =>
      w.rows.some(row => row.includes(cell))
    );
    if (!widgetData) return;

    const rowIndex = widgetData.rows.findIndex(row => row.includes(cell));
    if (rowIndex === -1) return;

    const rowCells = widgetData.rows[rowIndex].map(c => c.getTextWithPadding());
    const newRowMarkdown = `| ${rowCells.join(" | ")} |`;

    const doc = this.cm.getDoc();
    const markdownRowIndex = (rowIndex > 0 && widgetData.hasHeader)
      ? rowIndex + 1
      : rowIndex;
    const fromLine = widgetData.start + markdownRowIndex;
    const currentRowText = doc.getLine(fromLine);

    if (currentRowText.trim() === newRowMarkdown.trim()) {
      return; 
    }

    this.cm.operation(() => {
      doc.replaceRange(
        newRowMarkdown,
        { line: fromLine, ch: 0 },
        { line: fromLine, ch: currentRowText.length }
      );
    });
  }

  syncCompleteTable(cell: TableCell) {
    const widgetData = this.widgets.find(w =>
      w.rows.some(row => row.includes(cell))
    );
    if (!widgetData) return;

    let markdown = "";
    const rows = widgetData.rows;

    if (widgetData.hasHeader) {
      const headerCells = rows[0].map(c => c.getTextWithPadding());
      markdown += `| ${headerCells.join(" | ")} |\n`;

      const alignRow = widgetData.alignments.map(align => {
        if (align === "center") return ":---:";
        if (align === "right") return "---:";
        return ":---";
      }).join(" | ");
      markdown += `| ${alignRow} |\n`;

      for (let i = 1; i < rows.length; i++) {
        const rowCells = rows[i].map(c => c.getTextWithPadding());
        markdown += `| ${rowCells.join(" | ")} |\n`;
      }
    } else {
      for (let i = 0; i < rows.length; i++) {
        const rowCells = rows[i].map(c => c.getTextWithPadding());
        markdown += `| ${rowCells.join(" | ")} |\n`;
      }
    }

    const doc = this.cm.getDoc();
    const from = widgetData.start;
    const to = widgetData.end + 1;
    const currentText = doc.getRange({ line: from, ch: 0 }, { line: to, ch: 0 });

    if (currentText.trim() === markdown.trim()) {
      return;
    }

    this.cm.operation(() => {
      doc.replaceRange(markdown, { line: from, ch: 0 }, { line: to, ch: 0 });
    });

    const widget = widgetData.widget;
    if (!widget || widget.line !== doc.getLineHandle(from)) {
      this.widgets = this.widgets.filter(w => w !== widgetData);
      this.buildTableWidget(from, from + markdown.split("\n").length - 1, markdown);
    }
  }
  

  setCellFocus(row: number, col: number) {
    let widgetData = this.widgets.find(w =>
      w.containerEl.contains(document.activeElement)
    );
    if (!widgetData && this.widgets.length > 0) {
      widgetData = this.widgets[0];
    }
    if (!widgetData) return;
    const cell = widgetData.rows[row] && widgetData.rows[row][col];
    if (cell) {
      cell.el.focus();
    }
  }

  showContextMenu(evt: MouseEvent, cell: TableCell | null) {
    const existing = document.getElementById("table-context-menu");
    if (existing) existing.remove();
    const menu = document.createElement("div");
    menu.id = "table-context-menu";
    menu.style.position = "absolute";
    menu.style.zIndex = "10000";
    menu.style.backgroundColor = "#fff";
    menu.style.border = "1px solid #ccc";
    menu.style.padding = "4px";

    const createItem = (label: string, action: () => void) => {
      const item = document.createElement("div");
      item.innerText = label;
      item.style.padding = "2px 4px";
      item.style.cursor = "pointer";
      item.addEventListener("click", () => {
        action();
        menu.remove();
        if (cell) this.syncCell(cell);
        else if (this.widgets.length > 0) {
          this.syncCell(this.widgets[0].rows[0][0]);
        }
      });
      menu.appendChild(item);
    };

    createItem("Insert Row Above", () => {
      const targetRow = cell ? cell.row : 0;
      this.insertRow(targetRow, "above");
    });
    createItem("Insert Row Below", () => {
      const targetRow = cell ? cell.row : 0;
      this.insertRow(targetRow, "below");
    });
    createItem("Delete Row", () => {
      const targetRow = cell ? cell.row : 0;
      this.deleteRow(targetRow);
    });
    createItem("Insert Column Left", () => {
      const targetCol = cell ? cell.col : 0;
      this.insertColumn(targetCol, "left");
    });
    createItem("Insert Column Right", () => {
      const targetCol = cell ? cell.col : 0;
      this.insertColumn(targetCol, "right");
    });
    createItem("Delete Column", () => {
      const targetCol = cell ? cell.col : 0;
      this.deleteColumn(targetCol);
    });

    document.body.appendChild(menu);
    menu.style.left = evt.pageX + "px";
    menu.style.top = evt.pageY + "px";

    const removeMenu = () => {
      menu.remove();
      document.removeEventListener("click", removeMenu);
    };
    document.addEventListener("click", removeMenu);
  }

  insertRow(targetRow: number, position: "above" | "below") {
    if (this.widgets.length === 0) return;
    const widgetData = this.widgets[0];
    const newRow: TableCell[] = [];
    const colCount = widgetData.rows[0] ? widgetData.rows[0].length : 1;
    for (let col = 0; col < colCount; col++) {
      newRow.push(new TableCell(this, targetRow, col, ""));
    }
    if (position === "above") {
      widgetData.rows.splice(targetRow, 0, newRow);
    } else {
      widgetData.rows.splice(targetRow + 1, 0, newRow);
    }
    this.syncMarkdown();
  }

  deleteRow(targetRow: number) {
    if (this.widgets.length === 0) return;
    const widgetData = this.widgets[0];
    if (widgetData.rows.length > 1) {
      widgetData.rows.splice(targetRow, 1);
      this.syncMarkdown();
    }
  }

  insertColumn(targetCol: number, position: "left" | "right") {
    if (this.widgets.length === 0) return;
    const widgetData = this.widgets[0];
    widgetData.rows.forEach((row, rowIndex) => {
      const newCell = new TableCell(
        this,
        rowIndex,
        position === "left" ? targetCol : targetCol + 1,
        ""
      );
      if (position === "left") {
        row.splice(targetCol, 0, newCell);
      } else {
        row.splice(targetCol + 1, 0, newCell);
      }
    });
    this.syncMarkdown();
  }

  deleteColumn(targetCol: number) {
    if (this.widgets.length === 0) return;
    const widgetData = this.widgets[0];
    widgetData.rows.forEach((row) => {
      if (row.length > 1) {
        row.splice(targetCol, 1);
      }
    });
    this.syncMarkdown();
  }

  syncMarkdown() {
    if (this.widgets.length === 0) return;
    this.syncCompleteTable(this.widgets[0].rows[0][0]);
  }
}

/************************************************************************************
 * Export the Addon Getter
 ************************************************************************************/
export const getAddon = Addon.Getter("TableEditor", TableEditor, defaultTableEditorOptions);

declare global {
  namespace HyperMD {
    interface HelperCollection {
      TableEditor?: TableEditor;
    }
  }
}



/**
 * Parse a string for basic bold (**) and italic (_).
 * Return an HTML string that:
 *   - wraps the bold text in <span class="md-segment"><span class="md-token">**</span><strong>...</strong><span class="md-token">**</span></span>
 *   - wraps the italic text similarly with <em>... <span class="md-token">_</span> etc.
 *
 * If no match, returns a simple text node (escaped).
 */
 function parseBasicMarkdown(raw: string): string {
  // We’ll do a naive approach:
  // 1. Replace all "**bold**" matches
  // 2. Then replace all "_italic_" matches
  // 3. Return the combined result
  // This is not fully correct for all nested edge cases, but is illustrative.

  // Safe-escape angle brackets
  let escaped = raw
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // BOLD: look for **...**
  // We'll create a capturing group:  \*\*(.+?)\*\*
  // Then in the replacement, we build a .md-segment that reveals tokens on focus-within
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, (_, content) => {
    return `<span class="md-segment">` +
             `<span class="md-token">**</span>` +
             `<strong>${content}</strong>` +
             `<span class="md-token">**</span>` +
           `</span>`;
  });

  // ITALIC: look for _..._
  escaped = escaped.replace(/_(.+?)_/g, (_, content) => {
    return `<span class="md-segment">` +
             `<span class="md-token">_</span>` +
             `<em>${content}</em>` +
             `<span class="md-token">_</span>` +
           `</span>`;
  });

  return escaped;
}


// function markdownToHTML(mdText: string): string {
//   let html = "";
//   runMode(mdText, "markdown", (tokenText, style) => {
//     if (tokenText === "\n") {
//       // Convert line-breaks to <br>
//       html += "<br/>";
//       return;
//     }
//     if (style) {
//       // Wrap styled tokens in a <span> with a corresponding class
//       // e.g., cm-header, cm-strong, cm-link, etc.
//       html += `<span class="cm-${style}">${tokenText}</span>`;
//     } else {
//       // Plain text with no specific style
//       html += tokenText;
//     }
//   });
//   return html;
// }




/**
 * Convert Markdown text into HTML with nested token spans.
 * Markdown tokens are wrapped in <span class="md-token">...</span>
 * with their hierarchy preserved.
 */
function markdownToHTML(mdText: string): string {
  let html = "";
  let stack: { type: string; content: string }[] = [];

  runMode(mdText, "markdown", (tokenText, style) => {
    // Detect markdown tokens like **, *, _, etc.
    const isToken = /(\*\*|__|`|\*|_|~|>|#{1,6}|!\[|\[|\]|\(|\))/g.test(tokenText);
    const escaped = tokenText.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    if (isToken) {
      // Wrap markdown tokens in .md-token spans
      html += `<span class="md-token">${escaped}</span>`;
      // Track tokens to manage nested structure
      stack.push({ type: "token", content: tokenText });
    } else {
      // Wrap normal text with its_class for nesting
      html += `<span class="its_class"><span class="${style ? `cm-${style}` : ""}">${escaped}</span></span>`;
    }
  });

  // Combine tokens into a nested structure
  let finalHTML = "";
  const nestingStack: string[] = [];
  let currentWrapper = "";

  for (const item of stack) {
    if (item.type === "token") {
      // Open or close a nested span based on token patterns
      if (item.content === "**" || item.content === "*") {
        if (nestingStack.length && nestingStack[nestingStack.length - 1] === item.content) {
          // Close the current wrapper
          currentWrapper += `<span class="md-token">${item.content}</span></span>`;
          nestingStack.pop();
        } else {
          // Open a new wrapper
          currentWrapper += `<span class="its_class"><span class="md-token">${item.content}</span>`;
          nestingStack.push(item.content);
        }
      } else {
        // Inline token without nesting
        currentWrapper += `<span class="md-token">${item.content}</span>`;
      }
    }
  }

  finalHTML = html + currentWrapper;

  return finalHTML;
}
