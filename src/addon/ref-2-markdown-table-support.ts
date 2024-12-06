// code.js
import * as CodeMirror from "codemirror";
import "codemirror/mode/markdown/markdown.js";
import "codemirror/addon/runmode/runmode.js";

// Focus tracking
let focusedCellInfo = null;

const handleTableChange = (cm, changeObj) => {
  // Ignore changes made by our own cell edit to prevent re-rendering
  if (changeObj.origin === '+cellEdit') {
    return;
  }

  // React to changes only if it's a Markdown table change
  const doc = cm.getDoc();
  const content = doc.getValue().split("\n");

  const tableBlocks = [];
  let currentTableLines = [];
  let startLine = -1;

  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line.trim());
  const isAlignmentRow = (line) =>
    /^\s*\|\s*(:?-+:?)(\s*\|\s*:?-+:?)*\s*\|\s*$/.test(line.trim());

  content.forEach((line, index) => {
    if (isTableRow(line) && currentTableLines.length === 0) {
      currentTableLines.push(line);
      startLine = index;
    } else if (currentTableLines.length === 1 && isAlignmentRow(line)) {
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1 && isTableRow(line)) {
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1) {
      tableBlocks.push({
        start: { line: startLine, ch: 0 },
        end: { line: index - 1, ch: content[index - 1].length },
        lines: currentTableLines.slice(),
      });
      currentTableLines = [];
      startLine = -1;
    } else {
      currentTableLines = [];
      startLine = -1;
    }
  });

  if (currentTableLines.length > 1) {
    tableBlocks.push({
      start: { line: startLine, ch: 0 },
      end: { line: content.length - 1, ch: content[content.length - 1].length },
      lines: currentTableLines.slice(),
    });
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

  // Parse the alignment line
  const alignments = parseAlignmentRow(alignmentLine);

  const parseRow = (line, rowIndex, cellTag) => {
    const row = document.createElement("tr");
    const cells = parseMarkdownRow(line);

    cells.forEach((cellText, colIndex) => {
      const cell = document.createElement(cellTag);
      cell.contentEditable = "true";
      cell.style.whiteSpace = "pre-wrap"; // Preserve whitespace and line breaks

      // Initially render the markdown to HTML
      cell.innerHTML = parseMarkdownToHtml(cellText);

      // Apply alignment
      const alignment = alignments[colIndex] || 'left';
      cell.style.textAlign = alignment;

      cell.addEventListener("focus", () => {
        focusedCellInfo = { tableStartLine: tableData.startLine, rowIndex, colIndex };
        // When cell gains focus, show raw markdown
        const currentLine = tableData.lines[rowIndex];
        const currentCells = parseMarkdownRow(currentLine);
        const rawText = currentCells[colIndex] || "";
        cell.textContent = rawText; // Use textContent to avoid HTML parsing
        // Place cursor at the end
        placeCursorAtEnd(cell);
      });

      cell.addEventListener("blur", () => {
        // When cell loses focus, render markdown to HTML
        const text = cell.textContent || "";
        updateCellDirectlyInState(tableData, rowIndex, colIndex, text);

        // Get the latest cell content from lines
        const currentLine = tableData.lines[rowIndex];
        const currentCells = parseMarkdownRow(currentLine);
        const rawText = currentCells[colIndex] || "";

        // Render the cell content
        const htmlContent = parseMarkdownToHtml(rawText);
        cell.innerHTML = htmlContent;
      });

      cell.addEventListener("input", () => {
        const text = cell.textContent || "";
        updateCellDirectlyInState(tableData, rowIndex, colIndex, text);
      });

      cell.addEventListener("keydown", (e) => {
        // Handle Enter key to insert <br>
        if (e.key === 'Enter') {
          e.preventDefault();
          insertTextAtCursor(cell, '<br>');
          updateCellDirectlyInState(tableData, rowIndex, colIndex, cell.textContent || "");
        } else {
          e.stopPropagation();
        }
      });

      row.appendChild(cell);
    });

    return row;
  };

  const widget = document.createElement("div");
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  widget.appendChild(table);

  // Create table header and body rows
  table.appendChild(parseRow(headerLine, 0, "th"));
  bodyLines.forEach((line, index) =>
    table.appendChild(parseRow(line, index + 2, "td"))
  );

  cm.getDoc().markText(start, end, {
    replacedWith: widget,
    clearOnEnter: false,
    atomic: true,
  });
};

const updateCellDirectlyInState = (tableData, rowIndex, colIndex, text) => {
  const { cm, startLine, lines } = tableData;
  const escapedText = escapeMarkdownCellContent(text);

  const lineIndex = rowIndex;
  const cells = parseMarkdownRow(lines[lineIndex]);
  cells[colIndex] = escapedText;

  const reconstructedLine = "| " + cells.join(" | ") + " |";
  lines[lineIndex] = reconstructedLine;

  const doc = cm.getDoc();
  const from = { line: startLine + lineIndex, ch: 0 };
  const to = {
    line: startLine + lineIndex,
    ch: doc.getLine(startLine + lineIndex).length,
  };

  // Update the document directly without causing re-rendering
  doc.replaceRange(reconstructedLine, from, to, "+cellEdit");
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
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

// Function to escape pipe characters in markdown cell content
function escapeMarkdownCellContent(text) {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

const parseMarkdownToHtml = (markdown) => {
  // Replace <br> with actual line breaks in the HTML output
  const mdWithLineBreaks = markdown.replace(/<br>/g, '\n');

  let html = '';
  CodeMirror.runMode(mdWithLineBreaks, 'markdown', (text, style) => {
    if (style) {
      html += `<span class="cm-${style.replace(/ +/g, " cm-")}">${text}</span>`;
    } else {
      html += text;
    }
  });

  // Replace newlines with <br> in the final HTML
  html = html.replace(/\n/g, '<br>');

  return html;
};

// Function to place cursor at the end of contentEditable element
function placeCursorAtEnd(el) {
  el.focus();
  if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } else if (typeof document.body.createTextRange != "undefined") {
    const textRange = document.body.createTextRange();
    textRange.moveToElementText(el);
    textRange.collapse(false);
    textRange.select();
  }
}

// Function to insert text at the cursor position in a contentEditable element
function insertTextAtCursor(el, text) {
  const sel = window.getSelection();
  if (sel.rangeCount) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

// Register the table renderer for CodeMirror
CodeMirror.defineOption("advancedTable", null, (cm) => {
  cm.on("change", handleTableChange);
  // Initial rendering of tables
  handleTableChange(cm, {});
});
