// HyperMD, copyright (c) by laobubu
// Distributed under an MIT license: http://laobubu.net/HyperMD/LICENSE
//
// DESCRIPTION: Fold Image Markers `![](xxx)`
//

import { FolderFunc, registerFolder, RequestRangeResult, breakMark } from "./fold";
import { Position } from "codemirror";
import { splitLink } from "./read-link";
import interact from 'interactjs';
import { getElementTopRelativeToParent } from "../core";

const DEBUG = false

const mediaToken = /!\[.*?\]\(([^()\s]+)(\s*=\s*[^)]*)?\)/i  // used for testing whether the string contains the required pattern
const youtubeUrlRE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})(.*)?$/;
const imgRE = /\bimage-marker\b/;
const urlRE = /\bformatting-link-string\b/;   // matches the parentheses
const sizeAlignRE = /(?: =(\d+)?\*?(\d+)?\s*(left|center|right)?)?$/;  // matches the size " =width*height align"
const enableResizeAndDrag = true;
let  prevWidget = null;
const widgetClassRef = 'hmd-fold-image-line-widget';

function removePopover() {
  const elements = document.getElementsByClassName('hmd-alignment-popover');
  while (elements.length > 0) {
      elements[0].remove(); // Remove the first element in the collection
  }
}

function removeIfWidgetPresentWithClass(cm, lineNumber, className) {
  // Get the line handle for the given line number
  const lineHandle = cm.getLineHandle(lineNumber);
  if (!lineHandle) {
      return null; // Line doesn't exist
  }

  // Get the widgets associated with the line (if any)
  const lineInfo = cm.lineInfo(lineHandle);
  if (lineInfo && lineInfo.widgets) {
      // Loop through the widgets and check if any of them have the class 'do-not-show-token'
      for (const widget of lineInfo.widgets) {
          if (widget.className && widget.className.indexOf(widgetClassRef)!==-1) {
            widget.clear();
            cm.removeLineWidget(widget);
              // return true; // Found the widget with the required class
          }
      }
  }
  return false; // No widget with the required class found
}

export const ImageFolder: FolderFunc = function (stream, token) {
  const cm = stream.cm;
  removePopover();
  // Helper to create the alignment popover
  function createAlignmentPopover(element, lineWidget, from, to) {
    const popover = document.createElement("div");
    popover.className = "hmd-alignment-popover";
    
    // Create the alignment icons (Left, Center, Right)
    const alignLeft = document.createElement("span");
    alignLeft.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M160-160v-40h640v40H160Zm0-150v-40h400v40H160Zm0-150v-40h640v40H160Zm0-150v-40h400v40H160Zm0-150v-40h640v40H160Z"/></svg>';
    // alignLeft.innerHTML = "⬅️"; // Left icon
    const alignCenter = document.createElement("span");
    // alignCenter.innerHTML = "⬆️"; // Center icon
    alignCenter.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M184-184v-32h592v32H184Zm144-140v-32h304v32H328ZM184-464v-32h592v32H184Zm144-140v-32h304v32H328ZM184-744v-32h592v32H184Z"/></svg>'; // Center icon
    const alignRight = document.createElement("span");
    // alignRight.innerHTML = "➡️"; // Right icon
    alignRight.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M160-760v-40h640v40H160Zm240 150v-40h400v40H400ZM160-460v-40h640v40H160Zm240 150v-40h400v40H400ZM160-160v-40h640v40H160Z"/></svg>'; // Right icon
    const delItem = document.createElement("span");
    // alignRight.innerHTML = "➡️"; // Right icon
    delItem.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#EA3323"><path d="M326.73-172.08q-24.96 0-42.61-17.65-17.66-17.66-17.66-42.62v-461.23h-47.19v-47.89h166.35v-41.84h189.57v41.77h166.35v47.96h-47.2v460.89q0 25.78-17.56 43.2-17.57 17.41-42.7 17.41H326.73Zm319.65-521.5H314.42v461.23q0 5.39 3.46 8.85 3.47 3.46 8.85 3.46h307.35q4.61 0 8.46-3.84 3.84-3.85 3.84-8.47v-461.23ZM404.19-290.92h47.96v-331.96h-47.96v331.96Zm104.46 0h47.96v-331.96h-47.96v331.96ZM314.42-693.58v473.54-473.54Z"/></svg>'; // Right icon
    
    alignLeft.className = "hmd-left-align";
    alignCenter.className = "hmd-center-align";
    alignRight.className = "hmd-right-align";
    delItem.className = "hmd-del-ele";
    if(element.style.float == 'left') {
      alignLeft.className += ' selected';
    } else if(element.style.float == 'right') {
      alignRight.className += ' selected';
    } else {
      alignCenter.className += ' selected';
    }
    
    alignLeft.style.cursor = 'pointer';
    alignCenter.style.cursor = 'pointer';
    alignRight.style.cursor = 'pointer';
    delItem.style.cursor = 'pointer';

    popover.addEventListener("mousedown", (e) => {e.preventDefault();});
    alignRight.addEventListener("mousedown", (e) => {e.preventDefault();});

    // Add event listeners for alignment
    alignLeft.addEventListener("click", () => {
      prevWidget = lineWidget
      setElementAlignment(element, "left");
      updateMarkdownAlignment(cm, from, to, element, 'left');
      removePopover();
      // popover.style.display = "none";
      // marker.changed();
    });
    alignCenter.addEventListener("click", () => {
      prevWidget = lineWidget
      setElementAlignment(element, "center");
      updateMarkdownAlignment(cm, from, to, element, 'center');
      popover.style.display = "none";
      removePopover();
      // marker.changed();
    });
    alignRight.addEventListener("click", () => {
      prevWidget = lineWidget
      setElementAlignment(element, "right");
      updateMarkdownAlignment(cm, from, to, element, 'right');
      popover.style.display = "none";
      removePopover();
      // marker.changed();
    });
    delItem.addEventListener("click", () => {
      prevWidget = lineWidget
      deleteElement(cm, lineWidget);
      // popover.style.display = "none";
      // marker.changed();
    });

    // Append icons to popover
    popover.appendChild(alignLeft);
    popover.appendChild(alignCenter);
    popover.appendChild(alignRight);
    popover.appendChild(delItem);

    // Append the popover to the document body, but we'll adjust it relative to the scrollable parent
    (document.getElementsByClassName('CodeMirror-sizer')[0] || document).appendChild(popover);

    // Positioning logic
    let timeoutId;

    // element.addEventListener("mouseenter", () => {
    const rect = element.getBoundingClientRect();
    const parent = element.closest('.CodeMirror-scroll') || document.body; // Get scrollable parent container
    const parentRect = parent.getBoundingClientRect();
    const elementRelativeTop = getElementTopRelativeToParent(element);

    /************** Adjust top position of popover to ensure it's visible within the parent **************/
    let popoverTop = elementRelativeTop - parentRect.top - 42;
    // Ensure popover is within the visible bounds of the parent container
    if ((elementRelativeTop-100) < parent.scrollTop) {
      // If the element is scrolled out of the top, stick to top of visible region
      popoverTop = parent.scrollTop + 10;
    }
    popover.style.top = `${Math.max(0, popoverTop)}px`; // Ensure it's within visible area
    // Adjust left to prevent overflow on the right
    
    // get the gutter to display the position accordingly
    const gutterElement = cm.getGutterElement();
    // Check if the gutter element exists (i.e., it is visible)
    const gutterWidth = gutterElement ? gutterElement.offsetWidth : 0;
    
    popover.style.left = `${Math.min(parentRect.right - popover.offsetWidth, (rect.left-parentRect.left - gutterWidth + 5))}px`;
    /*********** End: Adjust top position of popover to ensure it's visible within the parent ************/
    
    element.onmouseleave = () => {
      // Hide the popover with a delay
      timeoutId = setTimeout(() => {
        popover.style.display = "none";
        removePopover();
      }, 300);
    }

    // Event listeners for popover itself
    popover.addEventListener("mouseenter", () => {
      clearTimeout(timeoutId); // Prevent hiding when hovering over popover
    });

    popover.addEventListener("mouseleave", () => {
      // Hide the popover when mouse leaves the popover
      popover.style.display = "none";
      removePopover();
    });
  }

  // stream.findNext(urlRE) => will be null if running the editor in different mode
  if (imgRE.test(token.type) && token.string === "!" && stream.findNext(urlRE)) {
    var lineNo = stream.lineNo;

    // find the begin and end of url part
    var url_begin = stream.findNext(urlRE);
    var url_end = stream.findNext(urlRE, url_begin?.i_token + 1);

    let from = { line: lineNo, ch: token.start };
    let to = { line: lineNo, ch: url_end?.token.end };
    let rngReq = stream.requestRange(from, to, from, from);

    if (rngReq === RequestRangeResult.OK) {
      var url;
      var title;
      var width = null;
      var height = null;
      var align = null;
      const linehandle = cm.getLineHandle(from.line);
      
      // extract the URL
      let rawurl = cm.getRange(
        { line: lineNo, ch: url_begin.token.start + 1 },
        { line: lineNo, ch: url_end.token.start }
      );
      if (url_end.token.string === "]") {
        let tmp = cm.hmdReadLink(rawurl, lineNo);
        if (!tmp) return null;
        rawurl = tmp.content;
      }
      url = splitLink(rawurl).url;
      url = cm.hmdResolveURL(url);

      // Check if there is size or alignment information
      const sizeAlignMatch = sizeAlignRE.exec(rawurl);
      if (sizeAlignMatch) {
        width = sizeAlignMatch[1] ? parseInt(sizeAlignMatch[1], 10) : null;
        height = sizeAlignMatch[2] ? parseInt(sizeAlignMatch[2], 10) : null;
        align = sizeAlignMatch[3] || null;
        url = rawurl.replace(sizeAlignRE, '').trim(); // Remove size and alignment info from the URL
      }

      // YouTube embedding
      if (youtubeUrlRE.test(rawurl)) {
        const youtubeMatch = youtubeUrlRE.exec(url);
        if (!youtubeMatch) return null;
        var videoID = youtubeMatch[4];
        var youtubeIframe = document.createElement("iframe");
        var videoHolder = document.createElement("div");
        var mask = document.createElement("div");
        var emptyReplacement = document.createElement("div");
        videoHolder.appendChild(youtubeIframe);
        videoHolder.appendChild(mask);
        
        removeIfWidgetPresentWithClass(cm, from.line, widgetClassRef)
        let lineWidget = cm.addLineWidget(to.line, videoHolder, {
          above: false,
          coverGutter: false,
          noHScroll: false,
          showIfHidden: true,
          className: widgetClassRef+' show-above'
        })
        prevWidget = lineWidget;
        var youtubeMarker = cm.markText(
          from, to,
          {
            atomic: true,
            inclusiveLeft: true,
            inclusiveRight: true,
            collapsed: true,
            replacedWith: emptyReplacement,
          }
        );

        // mask
        mask.style.position = "absolute";
        mask.style.top = "0";
        mask.style.left = "0";
        mask.style.width = "100%";
        mask.style.height = "100%";
        mask.style.zIndex = "9999";
        mask.style.display = "none";
        
        // player
        youtubeIframe.src = `https://www.youtube.com/embed/${videoID}?rel=0`;
        youtubeIframe.width = "100%";
        youtubeIframe.height = "100%";
        youtubeIframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        youtubeIframe.allowFullscreen = true;
        youtubeIframe.title = title;

        // container
        videoHolder.className = "hmd-ytube";
        videoHolder.style.border = "solid 2px transparent";
        videoHolder.style.width = width ? (width.toString()+"px") : "560px";
        videoHolder.style.height = height ? (height.toString()+"px") : "315px";
        videoHolder.style.display = "inline-block";
        videoHolder.style.padding = "5px";
        videoHolder.style.zIndex = "99";
        videoHolder.style.maxWidth = "100%";  // to avoid overflowing and creating a horizontal scroll 

        videoHolder.addEventListener('mouseenter', () => {
          if(cm.getOption('readOnly')) return;
          if (enableResizeAndDrag) {
            setupResizableAndDraggable(videoHolder, enableResizeAndDrag, cm, from, to, false, mask);
            videoHolder.style.border = "2px dotted #000";  
          }

          createAlignmentPopover(videoHolder, lineWidget, from, to);
        }, false);
  
        videoHolder.addEventListener('mouseleave', () => {
          videoHolder.style.border = "2px dotted transparent";
        });
        
        setElementAlignment(videoHolder, align);
        
        linehandle.off('change', ()=>handleWidgetDisplay(cm, lineWidget));
        linehandle.on('change', ()=>handleWidgetDisplay(cm, lineWidget));
        return youtubeMarker;
      }

      // Extract the title for image
      title = cm.getRange(
        { line: lineNo, ch: from.ch + 2 },
        { line: lineNo, ch: url_begin.token.start - 1 }
      );
      
      // Create and handle image element
      var img = document.createElement("img");
      var holder = document.createElement("div");
      removeIfWidgetPresentWithClass(cm, to.line, widgetClassRef)
      let lineWidget = cm.addLineWidget(to.line, img, {
        above: false,
        coverGutter: false,
        noHScroll: false,
        showIfHidden: true,
        className: widgetClassRef+' do-not-show-token show-above'
      })
      prevWidget = lineWidget;
      var marker = cm.markText(
        from, to,
        {
          atomic: true,
          inclusiveLeft: true,
          inclusiveRight: true,
          collapsed: true,
          replacedWith: holder,
        }
      );
      
      // holder.parentNode.appendChild(img);
      img.src = url;
      img.title = title;
      img.className = "hmd-image hmd-image-loading";
      img.style.border = "solid 2px transparent";
      img.style.padding = "5px";
      img.style.objectFit = "contain";
      if (width) img.width = width;
      if (height) {
        img.height = height;
      } else {
        img.style.height = '250px';   // set the default height of the image(is adjusted in img load event)
      }

      // Add load and error handling
      img.addEventListener('load', () => {
        // adjust the default height of the image based on it's own natural height
        if(img.naturalHeight<250) {
          if(img.naturalHeight<100) {
            img.style.height = '100px';  
          } else {
            img.style.height = img.naturalHeight+'px';
          }
        }
        img.classList.remove("hmd-image-loading");
        marker.changed();
      }, false);
      img.addEventListener('error', () => {
        img.classList.add("hmd-image-error");
        marker.changed();
      }, false);

      // Mouse events for resizing and showing popover
      img.addEventListener('mouseenter', () => {
        if(cm.getOption('readOnly')) return;
        if (enableResizeAndDrag) {
          setupResizableAndDraggable(img, enableResizeAndDrag, cm, from, to);
          img.style.border = "2px dotted #000";  
        }

        createAlignmentPopover(img, lineWidget, from, to);
      }, false);

      img.addEventListener('mouseleave', () => {
        img.style.border = "2px dotted transparent";
      });

      setElementAlignment(img, align);
       // Update the widget when the document changes
      linehandle.off('change', ()=>handleWidgetDisplay(cm, lineWidget));
      linehandle.on('change', (e)=>{
        handleWidgetDisplay(cm, lineWidget)
      });
      return marker;
    }
  }
  return null;
};

registerFolder("image", ImageFolder, true, true);

function handleWidgetDisplay(cm, lineWidget) {
    lineWidget = prevWidget;
    if(lineWidget) {
      // Get the line handle from the widget
      const lineHandle = lineWidget.line;
      // Fetch the line number from the line handle
      const lineNumber = cm.getLineNumber(lineHandle);
      // Get the updated text of that line
      const text = cm.getLine(lineNumber);
      const isValidString = mediaToken.test(text);
      if(!isValidString) {
        lineWidget.clear();
        cm.removeLineWidget(lineWidget);
      }
    }
}

function setupResizableAndDraggable(element, enableResizeAndDrag, cm, from, to, maintainAspectRatio=true, mask=null) {
  if (!enableResizeAndDrag) return;

  // Set the image style for resizing and dragging
  element.style.position = "relative";
  element.style.cursor = "move";
  element.style.border = "2px dotted transparent";  // Default border, visible on click

  // Add click event to show dotted border for resizing/dragging
  element.addEventListener('mouseover', () => {
    element.style.border = "2px dotted rgba(0, 0, 0, 0.6)"; // Show dotted border when clicked
  }, false);

  // Initialize interactjs for resizing
  interact(element)
    .resizable({
      edges: { left: true, right: true, bottom: true, top: false },
      listeners: {
        start(event) {
          removePopover();
          if(mask) {
            mask.style.display = "block";
          }
        },
        move(event) {
          let { width, height } = event.rect;
          width = Math.round(width); 
          height = Math.round(height);
          element.style.width = `${width}px`;
          element.style.height = `${height}px`;
        },
        end(event) {
          if(mask) {
            mask.style.display = "none";
          }
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
        interact.modifiers.aspectRatio({ ratio: 'preserve', enabled: maintainAspectRatio }) // Preserve aspect ratio
      ],
      inertia: true
    })
    .draggable({
      lockAxis: 'x',
      listeners: {
        start(event) {
          removePopover();
          if(mask) {
            mask.style.display = "block";
          }
        },
        move(event) {
          
          const position = { x: parseFloat(element.dataset.x) || 0, y: parseFloat(element.dataset.y) || 0 };

          // Update the element position
          position.x += event.dx;
          position.y += event.dy;

          element.style.transform = `translate(${position.x}px, ${position.y}px)`;

          // Save the x and y positions in the dataset
          element.dataset.x = position.x;
          element.dataset.y = position.y;

          // Update the alignment in markdown based on the dragged position
          
        },
        end(event) {
          if(mask) {
            mask.style.display = "none";
          }
          const position = { x: parseFloat(element.dataset.x) || 0, y: parseFloat(element.dataset.y) || 0 };

          // Update the element position
          position.x += event.dx;
          position.y += event.dy;

          element.style.transform = `translate(${position.x}px, ${position.y}px)`;

          // Save the x and y positions in the dataset
          element.dataset.x = position.x;
          element.dataset.y = position.y;
          updateMarkdownAlignment(cm, from, to, element);
        }
      },
      inertia: true
    });
  }

// Delete the image / video widget 
function deleteElement(cm, lineWidget) {
  // Ensure that the widget exists before attempting to delete
  if (!lineWidget) return;
  
  // Remove the line widget from CodeMirror
  cm.removeLineWidget(lineWidget);
  
  // Locate the line number for the widget's position, which can be used if you want to clear content or reset markers
  const lineNumber = cm.getLineNumber(lineWidget.line);
  // prevWidget = null; // Clear reference to the removed widget
  removePopover();
  if (lineNumber !== null) {
    // Optionally, clear the line content or remove markers associated with this line
    cm.replaceRange('', { line: lineNumber, ch: 0 }, { line: lineNumber + 1, ch: 0 }); // Clear content on the line
  }
}


// Utility function to update the size in the markdown
// this has to be handled with line widget as the line number is messing up
function updateMarkdownSize(cm, from, to, width, height, align=null) {
  const lineNumber = cm.getLineNumber(prevWidget.line);
  from.line = lineNumber
  to.line = lineNumber 

  let prevWidth = 0;
  let prevHeight = 0;
  let prevAlign = '';
  // Get the current content in the marked range
  const content = cm.getLine(from.line);
  // existing data
  const regex = /\(([^)]+)\)/;
  const urlMatch = content.match(regex);
  
  // Regular expression to identify and extract the URL within the markdown image syntax
  const urlPattern = /\!\[([^\]]*)\]\(([^)\s]+)(?:\s*=?\d*\*?\d*\s*(?:left|center|right)?)?\)/;
  
  // Match the current markdown syntax to extract the text and the URL
  const match = urlPattern.exec(content);
  if (!match) return; // If no match is found, exit the function

  const altText = match[1]; // Alternative text inside []
  const url = match[2]; // URL inside ()

  if(urlMatch) {
    const sizeAlignMatch = sizeAlignRE.exec(urlMatch[1]);
    if (sizeAlignMatch) {
      prevWidth = sizeAlignMatch[1] ? parseInt(sizeAlignMatch[1], 10) : null;
      prevHeight = sizeAlignMatch[2] ? parseInt(sizeAlignMatch[2], 10) : null;
      prevAlign = sizeAlignMatch[3] || null;
    }
  }
  
  // Rebuild the markdown string with updated size and alignment
  let updatedMarkdown = `![${altText}](${url}`;

  // Append size if provided
  if (width || height) {
    updatedMarkdown += ` =${width || ''}*${height || ''}`;
  } else {
    updatedMarkdown += ` =${prevWidth || ''}*${prevHeight || ''}`;
  }

  // Append alignment if provided
  if (align) {
    updatedMarkdown += ` ${align}`;
  } else {
    updatedMarkdown += ` ${prevAlign || 'left'}`;
  }

  // Close the markdown with a closing parenthesis
  updatedMarkdown += ")";
  // const lineHandle = cm.getLineHandle(from.line);
  // Replace the existing content with the updated markdown
  cm.replaceRange(updatedMarkdown, from, to);
}

function setElementAlignment(element, alignment="left") {
  if(alignment==="center") {
    alignment = 'center';
    element.style.float = 'none';
    element.style.display = 'block';
    element.style.marginLeft = 'auto';
    element.style.marginRight = 'auto';
  } else if(alignment==="right") {
    alignment = 'right';
    element.style.float = 'right';
    element.style.marginLeft = "20px";
    element.style.marginRight = "0";
  } else {
    alignment = 'left';
    element.style.float = 'left';
    element.style.marginRight = "20px";
    element.style.marginLeft = "0";
  }
}

// Utility function to update alignment in the markdown
function updateMarkdownAlignment(cm, from, to, element, align=null) {
  if(align) {
    updateMarkdownSize(cm, from, to, null, null, align);
    return;
  }
  const el = element.closest('pre') || element.closest('.CodeMirror-linewidget');
  if(!el) return;
  const parentWidth = el.offsetWidth;
  const elementWidth = element.offsetWidth;
  let alignment;

  // Get element's actual position relative to the parent
  const elementLeft = element.getBoundingClientRect().left;
  const parentLeft = el.getBoundingClientRect().left;
  const relativePosition = elementLeft - parentLeft; // Relative position inside the parent

  const leftThreshold = 50; // 50px from the left
  const rightThreshold = parentWidth - elementWidth - 50; // 50px from the right
  if(align) {
    alignment = align;
  } else {
    // Align to left if image is within the first 50px from the left
    if (relativePosition <= leftThreshold) {
      alignment = "left";
    } 
    // Align to right if image is within the last 50px from the right
    else if (relativePosition >= rightThreshold) {
      alignment = "right";
    } 
    // Align to center if space on both sides is approximately equal
    else if (Math.abs(parentWidth / 2 - (relativePosition + elementWidth / 2)) < 50) {
      alignment = "center";
    }
  }

  updateMarkdownSize(cm, from, to, null, null, alignment);
}
