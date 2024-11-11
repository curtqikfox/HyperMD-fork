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

const handleTableChange = (cm: CodeMirror.Editor, changeObj: CodeMirror.EditorChange) => {
  const doc = cm.getDoc();
  const content = doc.getValue().split("\n");
  const tableBlocks: { start: CodeMirror.Position; end: CodeMirror.Position; text: string }[] = [];

  let currentTableLines: string[] = [];
  let startLine = -1;

  const isTableRow = (line: string) => /^\|.*\|$/.test(line.trim());
  const isAlignmentRow = (line: string) => /^\|\s*-{3,}.*\|$/.test(line.trim());

  content.forEach((line, index) => {
    if (isTableRow(line) && currentTableLines.length === 0) {
      currentTableLines.push(line);
      startLine = index;
    } else if (currentTableLines.length === 1 && isAlignmentRow(line)) {
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1 && isTableRow(line)) {
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1) {
      const tableText = currentTableLines.join("\n");
      const startPos = doc.posFromIndex(doc.indexFromPos({ line: startLine, ch: 0 }));
      const endPos = doc.posFromIndex(doc.indexFromPos({ line: index - 1, ch: content[index - 1].length }));

      tableBlocks.push({ start: startPos, end: endPos, text: tableText });

      currentTableLines = [];
      startLine = -1;
    }
  });

  if (currentTableLines.length > 1) {
    const tableText = currentTableLines.join("\n");
    const startPos = doc.posFromIndex(doc.indexFromPos({ line: startLine, ch: 0 }));
    const endPos = doc.posFromIndex(doc.indexFromPos({ line: content.length - 1, ch: content[content.length - 1].length }));

    tableBlocks.push({ start: startPos, end: endPos, text: tableText });
  }

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
  const lines = tableText.split("\n");
  const header = lines[0];
  const rows = lines.slice(2);

  const columnCount = (header.match(/\|/g) || []).length - 1;

  const table = document.createElement("table");
  table.classList.add("markdown-table");

  const parseRow = (line: string, cellTag: "th" | "td") => {
    const row = document.createElement("tr");
    const cells = line.split("|").slice(1, -1);

    for (let i = 0; i < columnCount; i++) {
      const cell = document.createElement(cellTag);
      cell.contentEditable = "true";
      cell.innerHTML = parseMarkdownToHtml(cells[i]?.trim() || "");

      // Debounce to prevent excessive rerendering
      const debouncedInput = debounce(() => updateMarkdownTableFromHtml(cm, table, start, end), 300);

      cell.addEventListener("input", () => {
        debouncedInput();
      });
      
      cell.addEventListener("blur", () => {
        // updateMarkdownTableFromHtml(cm, table, start, end);
      });

      row.appendChild(cell);
    }
    return row;
  };

  table.appendChild(parseRow(header, "th"));

  rows.forEach((rowLine) => {
    table.appendChild(parseRow(rowLine, "td"));
  });

  const widget = document.createElement("div");
  widget.appendChild(table);

  cm.getDoc().markText(start, end, {
    replacedWith: widget,
    clearOnEnter: true,
  });
};

const parseMarkdownToHtml = (markdown: string): string => {
  // Basic Markdown parsing for bold and italic text
  return markdown
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
};

const updateMarkdownTableFromHtml = (
  cm: CodeMirror.Editor,
  table: HTMLTableElement,
  start: CodeMirror.Position,
  end: CodeMirror.Position
) => {
  const markdownLines: string[] = [];

  table.querySelectorAll("tr").forEach((row, index) => {
    const cells = Array.from(row.children).map(cell => ` ${cell.textContent?.trim() || ""} `);
    markdownLines.push(`|${cells.join("|")}|`);

    if (index === 0) {
      const alignmentLine = "|" + cells.map(cell => "---").join("|") + "|";
      markdownLines.push(alignmentLine);
    }
  });

  const markdownTable = markdownLines.join("\n");
  cm.replaceRange(markdownTable, start, end);
};

// Utility to debounce functions, especially helpful for input events
function debounce(func: Function, wait: number) {
  let timeout: any;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}


// Register the table renderer for CodeMirror

  CodeMirror.defineOption("advancedTable", null, (cm: CodeMirror.Editor) => {
    // getFoldCode(cm).clear("advancedTable");
    // getFold(cm).startFold();
    
    // Listen to the change event to detect Markdown tables and replace them
    cm.on('change', handleTableChange);
  });
