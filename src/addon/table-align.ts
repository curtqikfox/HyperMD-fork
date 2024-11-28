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

const handleTableChange = (cm: CodeMirror.Editor, changeObj: CodeMirror.EditorChange) => {
  if (changeObj.origin === "+cellEdit") {
    return; // Ignore changes made by cell editing
  }

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

      cell.addEventListener("input", () => {
        updateCellInMarkdown(tableData, rowIndex, colIndex, cell);
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
    clearOnEnter: false, // Prevent the widget from being cleared when the cursor enters it
  });
};

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
