// code.js
import * as CodeMirror from "codemirror";

/** Advanced Table Plugin */
const manageAdvancedTableLang = (code, info) => {
  return code; // Placeholder for any advanced processing
};

export const AdvancedTableRenderer = (code, info) => {
  const el = document.createElement("div");
  el.setAttribute("class", "hmd-fold-code-advanced-table");

  code = manageAdvancedTableLang(code, info);

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.margin = "10px 0";

  const rows = code.split("\n");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const cells = parseMarkdownRow(row);

    cells.forEach((cell) => {
      const td = document.createElement("td");
      td.style.border = "1px solid #ccc";
      td.style.padding = "5px";
      td.style.textAlign = "center";
      td.innerHTML = parseMarkdownToHtml(cell);
      tr.appendChild(td);
    });

    table.appendChild(tr);
  });

  el.appendChild(table);
  return el;
};

// Focus tracking
let focusedCellInfo = null;

const handleTableChange = (cm, changeObj) => {
  // Ignore changes made by our own cell edit
  if (changeObj.origin === "+cellEdit") {
    return;
  }

  // React to changes only if it's a Markdown table change
  const doc = cm.getDoc();
  const content = doc.getValue().split("\n");

  const tableBlocks = [];
  let currentTableLines = [];
  let startLine = -1;

  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line.trim());
  const isAlignmentRow = (line) => /^\s*\|\s*(:?-+:?)(\s*\|\s*:?-+:?)*\s*\|\s*$/.test(line.trim());

  content.forEach((line, index) => {
    if (isTableRow(line) && currentTableLines.length === 0) {
      currentTableLines.push(line);
      startLine = index;
    } else if (currentTableLines.length === 1 && isAlignmentRow(line)) {
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1 && isTableRow(line)) {
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1) {
      tableBlocks.push({ start: { line: startLine, ch: 0 }, end: { line: index - 1, ch: content[index - 1].length }, lines: currentTableLines.slice() });
      currentTableLines = [];
      startLine = -1;
    } else {
      currentTableLines = [];
      startLine = -1;
    }
  });

  if (currentTableLines.length > 1) {
    tableBlocks.push({ start: { line: startLine, ch: 0 }, end: { line: content.length - 1, ch: content[content.length - 1].length }, lines: currentTableLines.slice() });
  }

  tableBlocks.forEach(({ start, end, lines }) => {
    markTableForEdit(cm, start, end, lines);
  });
};

const markTableForEdit = (cm, start, end, lines) => {
  const headerLine = lines[0];
  const alignmentLine = lines[1];
  const bodyLines = lines.slice(2);

  const tableData = {
    cm,
    startLine: start.line,
    lines,
  };

  const alignments = parseAlignmentRow(alignmentLine);

  const parseRow = (line, rowIndex, cellTag) => {
    const row = document.createElement("tr");
    const cells = parseMarkdownRow(line);

    cells.forEach((cellText, colIndex) => {
      const cell = document.createElement(cellTag);
      cell.contentEditable = "true";
      cell.innerHTML = parseMarkdownToHtml(cellText);

      // Apply alignment
      const alignment = alignments[colIndex] || 'left';
      cell.style.textAlign = alignment;

      cell.addEventListener("focus", () => {
        focusedCellInfo = { tableStartLine: tableData.startLine, rowIndex, colIndex };
      });

      cell.addEventListener("input", () => {
        updateCellDirectlyInState(tableData, rowIndex, colIndex, cell);
      });

      cell.addEventListener("keydown", (e) => e.stopPropagation());
      row.appendChild(cell);
    });

    return row;
  };

  const widget = document.createElement("div");
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  widget.appendChild(table);

  table.appendChild(parseRow(headerLine, 0, "th"));
  bodyLines.forEach((line, index) => table.appendChild(parseRow(line, index + 2, "td")));

  cm.getDoc().markText(start, end, {
    replacedWith: widget,
    clearOnEnter: false,
    atomic: true
  });
};

const updateCellDirectlyInState = (tableData, rowIndex, colIndex, cell) => {
  const { cm, startLine, lines } = tableData;
  const text = cell.textContent || "";
  const escapedText = escapeMarkdownCellContent(text.trim());

  const lineIndex = rowIndex;
  const cells = parseMarkdownRow(lines[lineIndex]);
  cells[colIndex] = escapedText;

  const reconstructedLine = "| " + cells.join(" | ") + " |";
  lines[lineIndex] = reconstructedLine;

  const doc = cm.getDoc();
  const from = { line: startLine + lineIndex, ch: 0 };
  const to = { line: startLine + lineIndex, ch: doc.getLine(startLine + lineIndex).length };

  cm.replaceRange(reconstructedLine, from, to, "+cellEdit");
};

// Function to parse the alignment row
function parseAlignmentRow(line) {
  const alignments = [];
  const cells = parseMarkdownRow(line);

  cells.forEach((cell) => {
    cell = cell.trim();
    let alignment = 'left'; // default is left

    if (cell.startsWith(':') && cell.endsWith(':')) {
      alignment = 'center';
    } else if (cell.startsWith(':')) {
      alignment = 'left';
    } else if (cell.endsWith(':')) {
      alignment = 'right';
    } else {
      alignment = 'left';
    }
    alignments.push(alignment);
  });
  return alignments;
}

// Function to parse a markdown table row, handling escaped pipes
function parseMarkdownRow(line) {
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
function escapeMarkdownCellContent(text) {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

const parseMarkdownToHtml = (markdown) => {
  // Basic Markdown parsing for various markdown elements
  const escapedMarkdown = markdown.replace(/\\\|/g, '|').replace(/\\\\/g, '\\');
  return escapedMarkdown
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(#+)\s*(.+)/g, (match, hashes, title) => `<h${hashes.length}>${title}</h${hashes.length}>`)
    .replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>")
    .replace(/(\*|_)(.*?)\1/g, "<em>$2</em>")
    .replace(/~~(.*?)~~/g, "<del>$1</del>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/^\> (.*)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\n/g, "<br />");
};

// Register the table renderer for CodeMirror
CodeMirror.defineOption("advancedTable", null, (cm) => {
  cm.on("change", handleTableChange);
});