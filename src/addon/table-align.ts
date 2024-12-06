// code.js
import * as CodeMirror from "codemirror";
import "codemirror/mode/markdown/markdown.js";
import "codemirror/addon/runmode/runmode.js";

/** Advanced Table Plugin */
const manageAdvancedTableLang = (code, info) => {
  return code; // Placeholder for any advanced processing
};

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

      cell.addEventListener("keydown", (e) => {
        e.stopPropagation();
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
  bodyLines.forEach((line, index) => table.appendChild(parseRow(line, index + 2, "td")));

  cm.getDoc().markText(start, end, {
    replacedWith: widget,
    clearOnEnter: false,
    atomic: true,
  });
};

function escapePipe(input) {
  return input.replace(/([^\\])\|/g, '$1\\|');
}

const updateCellDirectlyInState = (tableData, rowIndex, colIndex, cell) => {
  const { cm, startLine, lines } = tableData;
  // let text = cell.textContent || "";
  console.log(cell.textContent)
  console.log(cell.innerHTML);
  const outputElement = document.createElement("div");
  CodeMirror.runMode(cell.innerHTML, "html", outputElement);
  // this text is text of each cell
  // need to use textContent but \n should be replaced with <br> tag.
  let text = (outputElement.innerHTML || "").replace(/\n/gi, '<br>')
                                              .replace(/&lt;br&gt;/g, '<br>');;
  
  
  const escapedText = escapeMarkdownCellContent(text.trim());

  const lineIndex = rowIndex;
  let cells = parseMarkdownRow(lines[lineIndex]);
  
  cells[colIndex] = escapedText;
  
  cells = cells.map(cell => escapePipe(cell));
  
  const reconstructedLine = "| " + cells.join(" | ") + " |";
  lines[lineIndex] = reconstructedLine;
  

  const doc = cm.getDoc();
  const from = { line: startLine + lineIndex, ch: 0 };
  const to = { line: startLine + lineIndex, ch: doc.getLine(startLine + lineIndex).length };

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
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
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

// Function to escape pipe characters in markdown cell content
function escapeMarkdownCellContent(text) {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

const parseMarkdownToHtml = (markdown) => {
  // Directly handle the markdown string
  // Avoid using innerHTML and innerText to prevent losing <br> tags
  // let escapedMarkdown = markdown
  //   .replace(/\\\|/g, '|')    // Unescape escaped pipes
  //   .replace(/\\\\/g, '\\');  // Unescape double backslashes

  let html = '';
  // CodeMirror.runMode(escapedMarkdown, 'markdown', (text, style) => {
  //   if (style) {
  //     html += `<span class="cm-${style.replace(/ +/g, " cm-")}">${text}</span>`;
  //   } else {
  //     html += text;
  //   }
  // });
  
  // // If runMode treats '<' as a special character, it might have converted <br> into &lt;br&gt;
  // // Convert back any escaped <br> tags to actual <br> tags
  // html = html.replace(/&lt;br&gt;/g, '<br>');
  // If you have a custom function to handle other tags or transformations
  html = replaceCustomTags(markdown);

  return html;
};


function replaceCustomTags(content) {
  // console.log("Original Content:", content);

  // Step 1: Replace all elements with class 'cm-bracket' with their inner content
const replaceBrackets = (str) => {
  // Regex Explanation:
  // <\w+[^>]*\bcm-bracket\b[^>]*> : Matches any opening tag with class 'cm-bracket' (among others)
  // ([<>])                        : Captures the inner content which should be '<' or '>'
  // <\/\w+>                       : Matches the corresponding closing tag
  return str.replace(/<\w+[^>]*\bcm-bracket\b[^>]*>([<>])<\/\w+>/g, '$1');
};

// Step 2: Replace all elements with class 'cm-tag' with their inner content
const replaceTags = (str) => {
  // Regex Explanation:
  // <\w+[^>]*\bcm-tag\b[^>]*> : Matches any opening tag with class 'cm-tag' (among others)
  // ([^<]+)                   : Captures the inner content (e.g., 'br', 'a href="url"', '/a')
  // <\/\w+>                   : Matches the corresponding closing tag
  return str.replace(/<\w+[^>]*\bcm-tag\b[^>]*>([^<]+)<\/\w+>/g, '$1');
};

// Perform the replacements in order
const afterBrackets = replaceBrackets(content);
const converted = replaceTags(afterBrackets);

  // Return the final content (should be a valid HTML tag)
  return converted;
}



// Register the table renderer for CodeMirror
CodeMirror.defineOption("advancedTable", null, (cm) => {
  cm.on("change", handleTableChange);
  // Initial rendering of tables
  handleTableChange(cm, {});
});


/********** STOP HERE **************************/