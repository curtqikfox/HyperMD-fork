// code.js
import * as CodeMirror from "codemirror";
import { registerRenderer, CodeRenderer, getAddon as getFoldCode } from "../addon/fold-code";
import { getAddon as getFold } from "../addon/fold";

/** Advanced Table Plugin */
const manageAdvancedTableLang = (code: string, info: any) => {
  // Optionally add any special handling for the markdown table content
  return code;
};

export const AdvancedTableRenderer: CodeRenderer = (code, info) => {
  var el = document.createElement('div');
  el.setAttribute('class', 'hmd-fold-code-advanced-table');

  // Manage the table content (you can add more advanced processing if needed)
  code = manageAdvancedTableLang(code, info);

  // Create a table element and populate it with the parsed markdown table
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.margin = '10px 0';

  const rows = code.split('\n');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    const cells = parseMarkdownRow(row);
    
    cells.forEach(cell => {
      const td = document.createElement('td');
      td.style.border = '1px solid #ccc';
      td.style.padding = '5px';
      td.style.textAlign = 'center';
      td.innerHTML = parseMarkdownToHtml(cell);
      tr.appendChild(td);
    });

    table.appendChild(tr);
  });

  el.appendChild(table);

  return el;
};

// Global variable to keep track of the focused cell
let focusedCellInfo = null;

const handleTableChange = (cm: CodeMirror.Editor, changeObj: CodeMirror.EditorChange) => {
  // Remove the condition that skips processing on "+cellEdit" origin
  // Now, the table will re-render on every change

  const doc = cm.getDoc();
  const content = doc.getValue().split("\n");
  const tableBlocks: {
    start: CodeMirror.Position;
    end: CodeMirror.Position;
    lines: string[];
  }[] = [];

  let currentTableLines: string[] = [];
  let startLine = -1;

  const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line.trim());
  const isAlignmentRow = (line: string) => /^\s*\|\s*(:?-+:?)(\s*\|\s*:?-+:?)*\s*\|\s*$/.test(line.trim());

  content.forEach((line, index) => {
    if (isTableRow(line) && currentTableLines.length === 0) {
      currentTableLines.push(line);
      startLine = index;
    } else if (currentTableLines.length === 1 && isAlignmentRow(line)) {
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1 && isTableRow(line)) {
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1) {
      const startPos = { line: startLine, ch: 0 };
      const endPos = { line: index - 1, ch: content[index - 1].length };

      tableBlocks.push({ start: startPos, end: endPos, lines: currentTableLines.slice() });

      currentTableLines = [];
      startLine = -1;
    } else {
      currentTableLines = [];
      startLine = -1;
    }
  });

  if (currentTableLines.length > 1) {
    const startPos = { line: startLine, ch: 0 };
    const endPos = { line: content.length - 1, ch: content[content.length - 1].length };

    tableBlocks.push({ start: startPos, end: endPos, lines: currentTableLines.slice() });
  }

  tableBlocks.forEach(({ start, end, lines }) => {
    replaceMarkdownTableWithHtml(cm, start, end, lines);
  });
};

const replaceMarkdownTableWithHtml = (
  cm: CodeMirror.Editor,
  start: CodeMirror.Position,
  end: CodeMirror.Position,
  lines: string[]
) => {

  console.log(11111112222)
  const headerLine = lines[0];
  const alignmentLine = lines[1];
  const bodyLines = lines.slice(2);

  const table = document.createElement("table");
  table.classList.add("markdown-table");
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.margin = '10px 0';

  // Store the table data for updating
  const tableData = {
    cm,
    startLine: start.line,
    lines,
  };

  const parseRow = (line: string, rowIndex: number, cellTag: "th" | "td") => {
    const row = document.createElement("tr");
    const cells = parseMarkdownRow(line);

    cells.forEach((cellText, colIndex) => {
      const cell = document.createElement(cellTag);
      cell.contentEditable = "true";
      cell.innerHTML = parseMarkdownToHtml(cellText);

      // Assign row and column indices to the cell
      cell.rowIndex = rowIndex;
      cell.colIndex = colIndex;

      // Event listener to track focused cell
      cell.addEventListener("focus", () => {
        focusedCellInfo = {
          tableStartLine: tableData.startLine,
          rowIndex: cell.rowIndex,
          colIndex: cell.colIndex,
          selectionStart: getCaretCharacterOffsetWithin(cell),
        };
      });

      // Update caret position on input
      cell.addEventListener("input", () => {
        updateCellInMarkdown(tableData, rowIndex, colIndex, cell);
        if (document.activeElement === cell) {
          focusedCellInfo.selectionStart = getCaretCharacterOffsetWithin(cell);
        }
      });

      cell.addEventListener("keydown", (e) => {
        e.stopPropagation(); // Prevent the event from bubbling up to CodeMirror
      });

      row.appendChild(cell);
    });

    return row;
  };

  // Parse header row
  table.appendChild(parseRow(headerLine, 0, "th"));

  // Parse body rows
  bodyLines.forEach((rowLine, index) => {
    table.appendChild(parseRow(rowLine, index + 2, "td"));
  });

  const widget = document.createElement("div");
  widget.appendChild(table);
  cm.getDoc().markText(start, end, {
    replacedWith: widget,
    clearOnEnter: false,
    // inclusiveLeft: true,
    // inclusiveRight: true,
    clearWhenEmpty: false,
  });

  // After rendering the table, restore focus if needed
  if (focusedCellInfo && focusedCellInfo.tableStartLine === tableData.startLine) {
    const { rowIndex, colIndex, selectionStart } = focusedCellInfo;
    const cellToFocus = findCellInTable(table, rowIndex, colIndex);
    console.log(121212, cellToFocus, rowIndex, colIndex, table);
    if (cellToFocus) {
      setTimeout(() => {
        console.log(2222, cellToFocus, selectionStart)
        cellToFocus.focus();
        setCaretPosition(cellToFocus, selectionStart);
      }, 0);
    }
  }
};

// Function to find a cell in the table based on row and column indices
function findCellInTable(table: HTMLTableElement, rowIndex: number, colIndex: number): HTMLElement | null {
  const rows = table.getElementsByTagName('tr');
  console.log('total rows', rows.length, rowIndex);
  if (rowIndex > rows.length) return null;
  // adjusting the rowIndex since the first row is row formatting in markdown
  rowIndex = rowIndex>0?rowIndex-1:rowIndex;
  const row = rows[rowIndex];
  const cellTag = rowIndex === 0 ? 'th' : 'td';
  const cells = row.getElementsByTagName(cellTag);
  if (colIndex >= cells.length) return null;
  return cells[colIndex];
}

// Function to get caret character offset within a contentEditable element
function getCaretCharacterOffsetWithin(element: HTMLElement) {
  let caretOffset = 0;
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    caretOffset = preCaretRange.toString().length;
  }
  return caretOffset;
}

// Function to set caret position within a contentEditable element
function setCaretPosition(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  let currentOffset = 0;
  let found = false;

  function traverseNodes(node: Node) {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent.length;
      if (currentOffset + textLength >= offset) {
        range.setStart(node, offset - currentOffset);
        range.collapse(true);
        found = true;
      } else {
        currentOffset += textLength;
      }
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverseNodes(node.childNodes[i]);
        if (found) break;
      }
    }
  }

  traverseNodes(element);
  if (!found) {
    range.selectNodeContents(element);
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

// Function to parse a markdown table row, handling escaped pipes
function parseMarkdownRow(line: string): string[] {
  const cells = [];
  let cell = '';
  let escaping = false;

  // Remove leading and trailing pipes
  let trimmedLine = line.trim();
  if (trimmedLine.startsWith('|')) trimmedLine = trimmedLine.slice(1);
  if (trimmedLine.endsWith('|')) trimmedLine = trimmedLine.slice(0, -1);

  for (let i = 0; i < trimmedLine.length; i++) {
    const char = trimmedLine[i];
    if (escaping) {
      cell += char;
      escaping = false;
    } else if (char === '\\') {
      escaping = true;
    } else if (char === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

// Function to escape pipe characters in markdown cell content
function escapeMarkdownCellContent(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

const parseMarkdownToHtml = (markdown: string): string => {
  // Basic Markdown parsing for bold and italic text
  const escapedMarkdown = markdown.replace(/\\\|/g, '|').replace(/\\\\/g, '\\');
  return escapedMarkdown
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
};

const updateCellInMarkdown = (
  tableData: { cm: CodeMirror.Editor; startLine: number; lines: string[] },
  rowIndex: number,
  colIndex: number,
  cell: HTMLElement
) => {
  const { cm, startLine, lines } = tableData;
  const text = cell.textContent || "";
  const escapedText = escapeMarkdownCellContent(text.trim());

  // Update the cell content in the tableData.lines
  const lineIndex = rowIndex;
  const line = lines[lineIndex];

  // Reconstruct the row with the updated cell content
  const cells = parseMarkdownRow(line);
  cells[colIndex] = escapedText;

  const reconstructedLine = '| ' + cells.join(' | ') + ' |';

  // Update the line in lines
  lines[lineIndex] = reconstructedLine;

  // Replace the entire row in the editor
  const doc = cm.getDoc();
  const from = { line: startLine + lineIndex, ch: 0 };
  const to = { line: startLine + lineIndex, ch: doc.getLine(startLine + lineIndex).length };

  cm.replaceRange(reconstructedLine, from, to, "+cellEdit");
};

// Register the table renderer for CodeMirror
CodeMirror.defineOption("advancedTable", null, (cm: CodeMirror.Editor) => {
  // Listen to the change event to detect Markdown tables and replace them
  cm.on('change', handleTableChange);
});
