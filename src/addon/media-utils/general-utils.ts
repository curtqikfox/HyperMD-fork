// ================================
// mediaUtils.js
// Common utility functions for images & videos
// ================================

import interact from "interactjs";
import { getElementTopRelativeToParent } from "../../core";

export const widgetClassRef = 'hmd-fold-media-widget';
export const enableResizeAndDrag = true;

// Remove any existing alignment popovers
export function removePopover() {
  const elements = document.getElementsByClassName('hmd-alignment-popover');
  while (elements.length > 0) {
    elements[0].remove();
  }
}

// Remove any widget already added to the given line
export function removeWidgetIfPresent(cm, lineNumber) {
  const lineHandle = cm.getLineHandle(lineNumber);
  if (!lineHandle) return;
  const lineInfo = cm.lineInfo(lineHandle);
  if (lineInfo && lineInfo.widgets) {
    lineInfo.widgets.forEach(widget => {
      if (widget.className && widget.className.includes(widgetClassRef)) {
        widget.clear();
        cm.removeLineWidget(widget);
      }
    });
  }
}

// Create the alignment popover with icons and event listeners
export function createAlignmentPopover(element, lineWidget, from, to, cm) {
  const popover = document.createElement("div");
  popover.className = "hmd-alignment-popover";

  // Create icons for left, center, right and delete
  const icons = {
    left: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M160-160v-40h640v40H160Zm0-150v-40h400v40H160Zm0-150v-40h640v40H160Zm0-150v-40h400v40H160Zm0-150v-40h640v40H160Z"/></svg>',
    center: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M184-184v-32h592v32H184Zm144-140v-32h304v32H328ZM184-464v-32h592v32H184Zm144-140v-32h304v32H328ZM184-744v-32h592v32H184Z"/></svg>',
    right: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M160-760v-40h640v40H160Zm240 150v-40h400v40H400ZM160-460v-40h640v40H160Zm240 150v-40h400v40H400ZM160-160v-40h640v40H160Z"/></svg>',
    delete: '<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#EA3323"><path d="M326.73-172.08q-24.96 0-42.61-17.65-17.66-17.66-17.66-42.62v-461.23h-47.19v-47.89h166.35v-41.84h189.57v41.77h166.35v47.96h-47.2v460.89q0 25.78-17.56 43.2-17.57 17.41-42.7 17.41H326.73Zm319.65-521.5H314.42v461.23q0 5.39 3.46 8.85 3.47 3.46 8.85 3.46h307.35q4.61 0 8.46-3.84 3.84-3.85 3.84-8.47v-461.23ZM404.19-290.92h47.96v-331.96h-47.96v331.96Zm104.46 0h47.96v-331.96h-47.96v331.96ZM314.42-693.58v473.54-473.54Z"/></svg>'
  };

  // Create span elements for each icon
  const createIcon = (name) => {
    const span = document.createElement("span");
    span.innerHTML = icons[name];
    span.className = name==="delete"? "hmd-del-ele" : `hmd-${name}-align`;
    span.style.cursor = "pointer";
    return span;
  };

  const alignLeft = createIcon("left");
  const alignCenter = createIcon("center");
  const alignRight = createIcon("right");
  const delItem = createIcon("delete");

  // Mark the selected alignment based on element style
  if (element.style.float === "left") {
    alignLeft.classList.add("selected");
  } else if (element.style.float === "right") {
    alignRight.classList.add("selected");
  } else {
    alignCenter.classList.add("selected");
  }

  // Prevent popover from interfering with drag/resize
  popover.addEventListener("mousedown", e => e.preventDefault());

  // Alignment event listeners
  alignLeft.addEventListener("click", () => {
    setElementAlignment(element, "left");
    updateMarkdownAlignment(cm, from, to, element, "left");
    removePopover();
  });
  alignCenter.addEventListener("click", () => {
    setElementAlignment(element, "center");
    updateMarkdownAlignment(cm, from, to, element, "center");
    removePopover();
  });
  alignRight.addEventListener("click", () => {
    setElementAlignment(element, "right");
    updateMarkdownAlignment(cm, from, to, element, "right");
    removePopover();
  });
  delItem.addEventListener("click", () => {
    deleteElement(cm, lineWidget);
  });

  // Append icons to popover
  [alignLeft, alignCenter, alignRight, delItem].forEach(icon => popover.appendChild(icon));

  // Append popover to document (adjusted to CodeMirror's sizer or document)
  (document.getElementsByClassName('CodeMirror-sizer')[0] || document.body).appendChild(popover);

  // Position the popover relative to the element
  const rect = element.getBoundingClientRect();
  const parent = element.closest('.CodeMirror-scroll') || document.body;
  const parentRect = parent.getBoundingClientRect();
  const elementRelativeTop = getElementTopRelativeToParent(element);
  let popoverTop = elementRelativeTop - parentRect.top - 42;
  if (elementRelativeTop - 100 < parent.scrollTop) {
    popoverTop = parent.scrollTop + 10;
  }
  popover.style.top = `${Math.max(0, popoverTop)}px`;

  const gutterElement = cm.getGutterElement();
  const gutterWidth = gutterElement ? gutterElement.offsetWidth : 0;
  popover.style.left = `${Math.min(parentRect.right - popover.offsetWidth, rect.left - parentRect.left - gutterWidth + 5)}px`;

  // Hide popover on mouse leave with a slight delay
  let timeoutId;
  element.onmouseleave = () => {
    timeoutId = setTimeout(() => {
      popover.style.display = "none";
      removePopover();
    }, 300);
  };
  popover.addEventListener("mouseenter", () => clearTimeout(timeoutId));
  popover.addEventListener("mouseleave", () => {
    popover.style.display = "none";
    removePopover();
  });
}

// Set the CSS alignment of the element based on the given alignment value
export function setElementAlignment(element, alignment = "left") {
  if (alignment === "center") {
    element.style.float = "none";
    element.style.display = "block";
    element.style.marginLeft = "auto";
    element.style.marginRight = "auto";
  } else if (alignment === "right") {
    element.style.float = "right";
    element.style.marginLeft = "20px";
    element.style.marginRight = "0";
  } else {
    element.style.float = "left";
    element.style.marginRight = "20px";
    element.style.marginLeft = "0";
  }
}

// Update the markdown image/video syntax with new size/alignment
export function updateMarkdownSize(cm, from, to, width, height, align = null) {
  const lineNumber = cm.getLineNumber(cm.getLineHandle(from.line));
  from.line = lineNumber;
  to.line = lineNumber;

  const content = cm.getLine(from.line);
  const regex = /\(([^)]+)\)/;
  const urlMatch = content.match(regex);

  // Regular expression to capture the markdown syntax:
  // ![alt](url [=width*height align])
  const urlPattern = /\!\[([^\]]*)\]\(([^)\s]+)(?:\s*=?\d*\*?\d*\s*(?:left|center|right)?)?\)/;
  const match = urlPattern.exec(content);
  if (!match) return;

  const altText = match[1];
  const url = match[2];

  // Extract previous size and alignment if available
  let prevWidth = "";
  let prevHeight = "";
  let prevAlign = "";
  const sizeAlignRE = /(?: =(\d+)?\*?(\d+)?\s*(left|center|right)?)?$/;
  if (urlMatch) {
    const sizeAlignMatch = sizeAlignRE.exec(urlMatch[1]);
    if (sizeAlignMatch) {
      prevWidth = sizeAlignMatch[1] || "";
      prevHeight = sizeAlignMatch[2] || "";
      prevAlign = sizeAlignMatch[3] || "left";
    }
  }

  // Build updated markdown
  let updatedMarkdown = `![${altText}](${url}`;
  if (width || height) {
    updatedMarkdown += ` =${width || ''}*${height || ''}`;
  } else {
    updatedMarkdown += ` =${prevWidth}*${prevHeight}`;
  }
  updatedMarkdown += ` ${align || prevAlign})`;

  // Redeclare to.ch based on the markdown format ![]()
  to.ch = match.index + match[0].length;
  cm.replaceRange(updatedMarkdown, from, to);
}

// Update alignment based on element position if no explicit alignment is given
export function updateMarkdownAlignment(cm, from, to, element, align = null) {
  if (align) {
    updateMarkdownSize(cm, from, to, null, null, align);
    return;
  }
  const el = element.closest('pre') || element.closest('.CodeMirror-linewidget');
  if (!el) return;
  const parentWidth = el.offsetWidth;
  const elementWidth = element.offsetWidth;
  const elementLeft = element.getBoundingClientRect().left;
  const parentLeft = el.getBoundingClientRect().left;
  const relativePosition = elementLeft - parentLeft;
  const leftThreshold = 50;
  const rightThreshold = parentWidth - elementWidth - 50;
  if (relativePosition <= leftThreshold) {
    align = "left";
  } else if (relativePosition >= rightThreshold) {
    align = "right";
  } else if (Math.abs(parentWidth / 2 - (relativePosition + elementWidth / 2)) < 50) {
    align = "center";
  }
  updateMarkdownSize(cm, from, to, null, null, align);
}

// Initialize interactjs for resizing and dragging
export function setupResizableAndDraggable(element, enableResize, cm, from, to, maintainAspectRatio = true, mask = null) {
  if (!enableResize) return;

  element.style.position = "relative";
  element.style.cursor = "move";
  element.style.border = "2px dotted transparent";

  element.addEventListener('mouseover', () => {
    element.style.border = "2px dotted rgba(0,0,0,0.6)";
  });

  interact(element)
    .resizable({
      edges: { left: true, right: true, bottom: true, top: false },
      listeners: {
        start() {
          removePopover();
          if (mask) mask.style.display = "block";
        },
        move(event) {
          let { width, height } = event.rect;
          width = Math.round(width);
          height = Math.round(height);
          element.style.width = `${width}px`;
          element.style.height = `${height}px`;
        },
        end(event) {
          if (mask) mask.style.display = "none";
          let { width, height } = event.rect;
          width = Math.round(width);
          height = Math.round(height);
          updateMarkdownSize(cm, from, to, width, height);
        }
      },
      modifiers: [
        interact.modifiers.restrictSize({
          min: { width: 50, height: 50 }
        }),
        interact.modifiers.aspectRatio({
          ratio: 'preserve',
          enabled: maintainAspectRatio
        })
      ],
      inertia: true
    })
    .draggable({
      lockAxis: 'x',
      listeners: {
        start() {
          removePopover();
          if (mask) mask.style.display = "block";
        },
        move(event) {
          const position = { 
            x: parseFloat(element.dataset.x) || 0, 
            y: parseFloat(element.dataset.y) || 0 
          };
          position.x += event.dx;
          position.y += event.dy;
          element.style.transform = `translate(${position.x}px, ${position.y}px)`;
          element.dataset.x = position.x;
          element.dataset.y = position.y;
        },
        end(event) {
          if (mask) mask.style.display = "none";
          const position = { 
            x: parseFloat(element.dataset.x) || 0, 
            y: parseFloat(element.dataset.y) || 0 
          };
          position.x += event.dx;
          position.y += event.dy;
          element.style.transform = `translate(${position.x}px, ${position.y}px)`;
          element.dataset.x = position.x;
          element.dataset.y = position.y;
          updateMarkdownAlignment(cm, from, to, element);
        }
      },
      inertia: true
    });
}

// Delete the media widget (image or video)
export function deleteElement(cm, lineWidget) {
  if (!lineWidget) return;
  cm.removeLineWidget(lineWidget);
  const lineNumber = cm.getLineNumber(lineWidget.line);
  removePopover();
  if (lineNumber !== null) {
    cm.replaceRange('', { line: lineNumber, ch: 0 }, { line: lineNumber + 1, ch: 0 });
  }
}

// Remove widget if content no longer matches a media token
export function handleWidgetDisplay(cm, lineWidget) {
  if (lineWidget) {
    const lineHandle = lineWidget.line;
    const lineNumber = cm.getLineNumber(lineHandle);
    const text = cm.getLine(lineNumber);

    // Check if the text still contains a valid media token
    const mediaToken = /!\[.*?\]\(([^()\s]+)(\s*=\s*[^)]*)?\)/i;
    const youtubeToken = /@\[youtube\]\([^)]+\)/i;

    if (!mediaToken.test(text) && !youtubeToken.test(text)) {
      // Only clear the widget if the token is **completely missing**
      lineWidget.clear();
      cm.removeLineWidget(lineWidget);
    }
    // else: do nothing → no reload if content still valid!
  }
}


export function setupTokenVisibility(cm, lineWidget, lineNo) {
  const tokenClass = `youtube-token-line-${lineNo}`;

  const toggleTokenVisibility = () => {
    const cursor = cm.getCursor();
    const isCursorOnLine = cursor.line === lineNo;
    const tokenElements = cm.getWrapperElement().querySelectorAll(`.${tokenClass}`);

    tokenElements.forEach((el) => {
      if (isCursorOnLine) {
        el.classList.remove('hmd-hidden-token'); // Show token
      } else {
        el.classList.add('hmd-hidden-token');    // Hide token
      }
    });
  };

  // Initial toggle based on current cursor position
  toggleTokenVisibility();

  // Update visibility on cursor movement
  cm.on('cursorActivity', toggleTokenVisibility);

  // Clean up listener when the widget is removed
  lineWidget.on('clear', () => {
    cm.off('cursorActivity', toggleTokenVisibility);
  });
}