// code.js
import * as CodeMirror from "codemirror";
import { Addon, FlipFlop, debounce, suggestedEditorConfig, normalVisualConfig, cm_t } from '../core'
import "codemirror/mode/markdown/markdown.js";
import "codemirror/addon/runmode/runmode.js";
export type OptionValueType = Partial<Options> | boolean;

export interface Options extends Addon.AddonOptions {
  /** Enable TableAlign */
  enabled: boolean
}


export const defaultOption: Options = {
  enabled: false,
}

/** Advanced Table Plugin */
const manageAdvancedTableLang = (code, info) => {
  return code; // Placeholder for any advanced processing
};

// Focus tracking
let focusedCellInfo = null;

export class TableView implements Addon.Addon, Options /* if needed */ {
  enabled: boolean;

  constructor(public cm: cm_t) {
    // options will be initialized to defaultOption (if exists)
    // add your code here

    new FlipFlop(
      /* ON  */() => {
        // cm.on("renderLine", this._procLine)
        cm.on("change", handleTableChange)
        cm.refresh()
        // document.head.appendChild(this.styleEl)
      },
      /* OFF */() => {
        // cm.off("renderLine", this._procLine)
        // cm.off("update", this.updateStyle)
        // document.head.removeChild(this.styleEl)
      }
    ).bind(this, "enabled", true)
  }
  private _procLine = (cm: cm_t, line: CodeMirror.LineHandle, el: HTMLPreElement) => {
    handleTableChange(cm, null, line);
  }
}

const handleTableChange = (cm, changeObj, lineHandle = null) => {
  if (changeObj?.origin === '+cellEdit') {
    return;
  }

  const doc = cm.getDoc();
  const content = doc.getValue().split("\n");

  const tableBlocks = [];
  let currentTableLines = [];
  let startLineHandle = null;

  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line.trim());
  const isAlignmentRow = (line) => /^\s*\|\s*(:?-+:?)(\s*\|\s*:?-+:?)*\s*\|\s*$/.test(line.trim());

  content.forEach((line, index) => {
    const lineHandle = doc.getLineHandle(index);

    if (isTableRow(line) && currentTableLines.length === 0) {
      currentTableLines.push(line);
      startLineHandle = lineHandle;
    } else if (currentTableLines.length === 1 && isAlignmentRow(line)) {
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1 && isTableRow(line)) {
      currentTableLines.push(line);
    } else if (currentTableLines.length > 1) {
      tableBlocks.push({
        startHandle: startLineHandle,
        endHandle: doc.getLineHandle(index - 1),
        lines: currentTableLines.slice(),
      });
      currentTableLines = [];
      startLineHandle = null;
    } else {
      currentTableLines = [];
      startLineHandle = null;
    }
  });

  if (currentTableLines.length > 1) {
    tableBlocks.push({
      startHandle: startLineHandle,
      endHandle: doc.getLineHandle(content.length - 1),
      lines: currentTableLines.slice(),
    });
  }

  tableBlocks.forEach(({ startHandle, endHandle, lines }) => {
    markTableForEdit(cm, startHandle, endHandle, lines);
  });
};

const markTableForEdit = (cm, startHandle, endHandle, lines) => {
  const headerLine = lines[0];
  const alignmentLine = lines[1];
  const bodyLines = lines.slice(2);

  const tableData = {
    cm,
    startHandle,
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

      // Attach markdown editing behavior
      handleMarkdownEditing(cell, cm, tableData, rowIndex, colIndex);

      // cell.addEventListener("focus", () => {
      //   focusedCellInfo = { tableStartHandle: tableData.startHandle, rowIndex, colIndex };
      // });

      // cell.addEventListener("input", () => {
      //   updateCellDirectlyInState(tableData, rowIndex, colIndex, cell);
      // });

      // cell.addEventListener("keydown", (e) => {
      //   e.stopPropagation();
      // });
      row.appendChild(cell);
    });

    return row;
  };

  const widget = document.createElement("div");
  const table = document.createElement("table");
  table.classList.add("qf-custom-table");
  table.style.borderCollapse = "collapse";
  widget.appendChild(table);

  table.appendChild(parseRow(headerLine, 0, "th"));
  bodyLines.forEach((line, index) => table.appendChild(parseRow(line, index + 2, "td")));

  cm.getDoc().markText(
    { line: cm.getDoc().getLineNumber(startHandle), ch: 0 },
    { line: cm.getDoc().getLineNumber(endHandle), ch: endHandle.text.length },
    {
      replacedWith: widget,
      clearOnEnter: false,
      inclusiveLeft: true,
      inclusiveRight: true,
      selectLeft: false,
      selectRight: true,
      collapsed: true,
      atomic: true,
    }
  );
};

const handleMarkdownEditing = (cell, cm, tableData, rowIndex, colIndex) => {
  let currentTokens = []; // Track the tokens being displayed

  const toggleTokenVisibility = (show, tokenElement) => {
    if (tokenElement) {
      const tokenText = tokenElement.getAttribute("data-token");
      const closingTokenText = tokenElement.getAttribute("data-closing-token");
      if (show) {
        tokenElement.textContent = `${tokenText}${tokenElement.textContent}${closingTokenText}`;
      } else {
        tokenElement.textContent = tokenElement.textContent
          .replace(new RegExp(`^${tokenText}`), "")
          .replace(new RegExp(`${closingTokenText}$`), "");
      }
    }
  };

  const findTokenElementAtCursor = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    const range = selection.getRangeAt(0);

    let node = range.startContainer;
    while (node && node !== cell) {
      if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute("data-token")) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  };

  const saveCursorPosition = (element) => {
    // const selection = window.getSelection();
    // if (!selection.rangeCount) return null;
    // const range = selection.getRangeAt(0);

    // const startOffset = range.startOffset;
    // const node = range.startContainer;
    // return { node, startOffset };

    var selection = window.getSelection();
    var range = selection.getRangeAt(0);  // Get the range of the selection
    var preCaretRange = range.cloneRange();  // Clone the range
    preCaretRange.selectNodeContents(element);  // Select the content of the element
    preCaretRange.setEnd(range.endContainer, range.endOffset);  // Set end to the cursor's position
    
    return preCaretRange.toString().length;  // Return the cursor position as length of the string
    
  };

  // Function to set the cursor position to the new position
  // Function to set the cursor position to the new position
  function setCursorPosition(element, position) {
    // position = position - 1;
    position = position < 0? 0: position;
    var range = document.createRange();
    var selection = window.getSelection();
    
    // Traverse the nodes in the element and get the correct text node
    const {textNode, positionInNode} = getTextNodeAtPosition(element, position);
    

    if (textNode) {
      range.setStart(textNode, positionInNode);  // Set the start of the range to the text node at the position
      range.setEnd(textNode, positionInNode);    // Set the end to the same position (cursor should be placed here)
      selection.removeAllRanges();        // Clear any existing selection
      selection.addRange(range);          // Add the new range (with the cursor position)
    }
  }

  // Helper function to get the correct text node at a given position
  // Helper function to get the correct text node at a given position
  function getTextNodeAtPosition(element, position) {
    var walker = document.createTreeWalker(
      element, 
      NodeFilter.SHOW_TEXT,  // Only show text nodes
      null, 
      false
    );

    var currentNode;
    var currentPos = 0;

    // Traverse all text nodes and find the one that contains the given position
    while (currentNode = walker.nextNode()) {
      var nodeLength = currentNode.length;
      
      // If the position is within the range of the current node
      if (currentPos + nodeLength >= position) {
        // Calculate the exact position within the text node
        return {
          textNode: currentNode,
          positionInNode: position - currentPos
        };
      }
      currentPos += nodeLength;
    }

    return null;  // Return null if no text node is found at the position
  }



  const restoreCursorPosition = (savedPosition) => {
    if (!savedPosition || !savedPosition.node) return;

    const selection = window.getSelection();
    const range = document.createRange();
    const maxOffset = savedPosition.node.textContent.length;

    range.setStart(savedPosition.node, Math.min(savedPosition.startOffset, maxOffset));
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);
  };

  cell.addEventListener("focus", () => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    // Initially hide all tokens
    const tokenElements = cell.querySelectorAll("[data-token]");
    tokenElements.forEach((tokenElement) => toggleTokenVisibility(false, tokenElement));
  });

  cell.addEventListener("blur", () => {
    // Parse the raw markdown content to rendered HTML
    const markdownContent = cell.textContent || "";
    const parsedHtml = parseMarkdownToHtml(markdownContent);
    cell.innerHTML = parsedHtml;

    // Update the state
    // updateCellDirectlyInState(tableData, rowIndex, colIndex, cell);

    // Clear token tracking
    currentTokens = [];
  });

  cell.addEventListener("input", (e) => {
    // Save cursor position before update
    const savedPosition = saveCursorPosition(e.target);

    // Dynamically update the rendered HTML while typing
    const markdownContent = cell.textContent || "";
    const parsedHtml = parseMarkdownToHtml(markdownContent);
    cell.innerHTML = parsedHtml;

    // Restore cursor position after update
    // restoreCursorPosition(savedPosition);
    setCursorPosition(e.target, savedPosition);

    // Toggle token visibility based on cursor position
    // const tokenElement = findTokenElementAtCursor();
    // if (currentTokens.length && !currentTokens.includes(tokenElement)) {
    //   currentTokens.forEach((token) => toggleTokenVisibility(false, token));
    //   currentTokens = [];
    // }
    // if (tokenElement && !currentTokens.includes(tokenElement)) {
    //   toggleTokenVisibility(true, tokenElement);
    //   currentTokens.push(tokenElement);
    // }
  });

  cell.addEventListener("keydown", (e) => {
    e.stopPropagation();
    // Handle cursor behavior around markdown tokens
    // const tokenElement = findTokenElementAtCursor();
    // if (tokenElement) {
    //   const selection = window.getSelection();
    //   const cursorPosition = selection.getRangeAt(0).startOffset;
      
    //   if (cursorPosition === 0 || cursorPosition === tokenElement.textContent.length) {
    //     e.preventDefault();
    //   }
    // }
  });
};


function escapePipe(input) {
  return input.replace(/([^\\])\|/g, '$1\\|');
}


const updateCellDirectlyInState = (tableData, rowIndex, colIndex, cell) => {
  const { cm, startHandle, lines } = tableData;

  const doc = cm.getDoc();
  const startLine = doc.getLineNumber(startHandle);

  const text = cell.innerHTML.replace(/\n/g, '<br>').trim();
  const escapedText = escapeMarkdownCellContent(text);

  const lineIndex = rowIndex;
  let cells = parseMarkdownRow(lines[lineIndex]);

  cells[colIndex] = escapedText;

  cells = cells.map(cell => escapePipe(cell));
  const reconstructedLine = "| " + cells.join(" | ") + " |";
  lines[lineIndex] = reconstructedLine;

  const from = { line: startLine + lineIndex, ch: 0 };
  const to = { line: startLine + lineIndex, ch: doc.getLine(startLine + lineIndex).length };

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
  
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  let tempEl = document.createElement('div');
  tempEl.innerHTML = markdown;
  markdown = tempEl.textContent;

  let escapedMarkdown = markdown
    .replace(/\\\|/g, '|')    // Unescape escaped pipes
    .replace(/\\\\/g, '\\');  // Unescape double backslashes
  
  let html = '';
  const ref = CodeMirror.runMode(escapedMarkdown, 'hypermd', (text, style) => {
    if (style) {
      console.log(style, text);
      html += `<span class="cm-${style.replace(/ +/g, " cm-")}">${text}</span>`;
    } else {
      html += text;
    }
  });
  
  // // If runMode treats '<' as a special character, it might have converted <br> into &lt;br&gt;
  // // Convert back any escaped <br> tags to actual <br> tags
  html = html.replace(/&lt;br&gt;/g, '<br>');
  // If you have a custom function to handle other tags or transformations
  html = replaceCustomTags(html);

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
// CodeMirror.defineOption("advancedTable", null, (cm) => {
//   cm.on("change", handleTableChange);
//   // Initial rendering of tables
//   handleTableChange(cm, {});
// });
CodeMirror.defineOption("hmdTableView", defaultOption, function (cm: cm_t, newVal: OptionValueType) {
  
  const enabled = true; // !!newVal //replace this hardcoded with the !!newVal

  ///// convert newVal's type to `Partial<Options>`, if it is not.

  if (!enabled || typeof newVal === "boolean") {
    newVal = { enabled: enabled }
  }
  newVal.enabled = true;  // remvoe this line
  ///// apply config and write new values into cm

  var inst = getAddon(cm)
  for (var k in defaultOption) {
    inst[k] = (k in newVal) ? newVal[k] : defaultOption[k]
  }
})

/** ADDON GETTER (Singleton Pattern): a editor can have only one TableAlign instance */
export const getAddon = Addon.Getter("TableAlign", TableView, defaultOption)
declare global { namespace HyperMD { interface HelperCollection { TableView?: TableView } } }

/********** STOP HERE **************************/