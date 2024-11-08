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
    const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
    
    cells.forEach(cell => {
      const td = document.createElement('td');
      td.style.border = '1px solid #ccc';
      td.style.padding = '5px';
      td.style.textAlign = 'center';
      td.textContent = cell;
      tr.appendChild(td);
    });

    table.appendChild(tr);
  });

  el.appendChild(table);

  return el;
};


const handleChange = (cm: CodeMirror.Editor, changeObj: CodeMirror.EditorChange) => {
  const doc = cm.getDoc();
  const content = doc.getValue().split("\n"); // Split content by lines
  const tableBlocks: { start: CodeMirror.Position; end: CodeMirror.Position; text: string }[] = [];

  let currentTableLines: string[] = []; // Store lines of the current table
  let startLine = -1; // Start line number of the current table

  const isTableRow = (line: string) => /^\|.*\|$/.test(line.trim()); // Check if a line is a table row
  const isAlignmentRow = (line: string) => /^\|\s*-{3,}.*\|$/.test(line.trim()); // Check for the alignment row (| --- |)

  content.forEach((line, index) => {
    if (isTableRow(line) && currentTableLines.length === 0) {
      // Start of a potential table block
      currentTableLines.push(line);
      startLine = index;
    } else if (currentTableLines.length === 1 && isAlignmentRow(line)) {
      // Confirmed table with header and alignment row
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1 && isTableRow(line)) {
      // Continuation of the table rows after header and alignment
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1) {
      // End of the table block
      const tableText = currentTableLines.join("\n");
      const startPos = doc.posFromIndex(doc.indexFromPos({ line: startLine, ch: 0 }));
      const endPos = doc.posFromIndex(doc.indexFromPos({ line: index - 1, ch: content[index - 1].length }));

      tableBlocks.push({ start: startPos, end: endPos, text: tableText });

      // Reset for next potential table
      currentTableLines = [];
      startLine = -1;
    }
  });

  // Handle any remaining table block at the end of the content
  if (currentTableLines.length > 1) {
    const tableText = currentTableLines.join("\n");
    const startPos = doc.posFromIndex(doc.indexFromPos({ line: startLine, ch: 0 }));
    const endPos = doc.posFromIndex(doc.indexFromPos({ line: content.length - 1, ch: content[content.length - 1].length }));

    tableBlocks.push({ start: startPos, end: endPos, text: tableText });
  }

  // Now, we replace each detected table with an HTML table widget
  tableBlocks.forEach(({ start, end, text }) => {
    replaceMarkdownTableWithHtml(cm, start, end, text);
  });
};

const replaceMarkdownTableWithHtml = (
  cm: CodeMirror.Editor,
  start: CodeMirror.Position,
  end: CodeMirror.Position,
  tableText: string
) => {
  // Split the table text by lines
  const lines = tableText.split("\n");

  // Extract header, separator, and rows
  const header = lines[0];
  const separator = lines[1];
  const rows = lines.slice(2);

  // Determine the expected number of columns from the header row
  const columnCount = (header.match(/\|/g) || []).length - 1;

  // Create an HTML table element
  const table = document.createElement("table");
  table.classList.add("markdown-table");

  // Helper function to parse a row line into <td> elements
  const parseRow = (line: string, cellTag: "th" | "td") => {
    const row = document.createElement("tr");
    const cells = line.split("|").slice(1, -1); // Split by '|' and remove empty ends

    // Add cells to the row, ensuring correct column count
    for (let i = 0; i < columnCount; i++) {
      const cell = document.createElement(cellTag);
      cell.textContent = cells[i] ? cells[i].trim() : ""; // Fill with empty string if undefined
      row.appendChild(cell);
    }
    return row;
  };

  // Add the header row
  table.appendChild(parseRow(header, "th"));

  // Add data rows
  rows.forEach((rowLine) => {
    table.appendChild(parseRow(rowLine, "td"));
  });

  // Insert the table into CodeMirror as a widget
  const widget = document.createElement("div");
  widget.appendChild(table);

  // Replace the Markdown table with the HTML table widget
  cm.getDoc().markText(start, end, {
    replacedWith: widget,
    clearOnEnter: true,
  });
};


// Register the table renderer for CodeMirror

  CodeMirror.defineOption("advancedTable", null, (cm: CodeMirror.Editor) => {
    getFoldCode(cm).clear("advancedTable");
    getFold(cm).startFold();
    
    // Listen to the change event to detect Markdown tables and replace them
    cm.on('change', handleChange);
  });

  // Register the advanced table renderer with markdown matching pattern
  registerRenderer({
    name: "advancedTable",
    pattern: /^\|.*\|$/i, // Match markdown table rows (lines starting and ending with pipes)
    renderer: AdvancedTableRenderer,
    suggested: true,
  }, true);
