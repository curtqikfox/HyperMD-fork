// HyperMD, copyright (c) by laobubu
// Distributed under an MIT license: http://laobubu.net/HyperMD/LICENSE
//
// DESCRIPTION: Fold Image Markers `![](xxx)`
//

import { FolderFunc, registerFolder, RequestRangeResult, breakMark } from "./fold";
import { Position } from "codemirror";
import { splitLink } from "./read-link";
import interact from 'interactjs';

const DEBUG = false


const youtubeUrlRE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})(.*)?$/;
const imgRE = /\bimage-marker\b/;
const urlRE = /\bformatting-link-string\b/;   // matches the parentheses
const sizeAlignRE = /(?: =(\d+)?\*?(\d+)?\s*(left|center|right)?)?$/;  // matches the size " =width*height align"

export const ImageFolder: FolderFunc = function (stream, token, enableResizeAndDrag = true) {
  const cm = stream.cm;


  function removePopover() {
    const elements = document.getElementsByClassName('hmd-alignment-popover');
    while (elements.length > 0) {
        elements[0].remove(); // Remove the first element in the collection
    }
  }

  // Helper to create the alignment popover
  function createAlignmentPopover(element, marker, from, to) {
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

    
    alignLeft.className = "hmd-left-align";
    alignCenter.className = "hmd-center-align";
    alignRight.className = "hmd-right-align";
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

    popover.addEventListener("mousedown", (e) => {e.preventDefault();});
    alignRight.addEventListener("mousedown", (e) => {e.preventDefault();});

    // Add event listeners for alignment
    alignLeft.addEventListener("click", () => {
      setElementAlignment(element, "left");
      updateMarkdownAlignment(cm, from, to, element, 'left');
      removePopover();
      // popover.style.display = "none";
      // marker.changed();
    });
    alignCenter.addEventListener("click", () => {
      setElementAlignment(element, "center");
      updateMarkdownAlignment(cm, from, to, element, 'center');
      popover.style.display = "none";
      removePopover();
      // marker.changed();
    });
    alignRight.addEventListener("click", () => {
      setElementAlignment(element, "right");
      updateMarkdownAlignment(cm, from, to, element, 'right');
      popover.style.display = "none";
      removePopover();
      // marker.changed();
    });

    // Append icons to popover
    popover.appendChild(alignLeft);
    popover.appendChild(alignCenter);
    popover.appendChild(alignRight);

    // Append the popover to the document body, but we'll adjust it relative to the scrollable parent
    (document.getElementsByClassName('CodeMirror-sizer')[0] || document.body).appendChild(popover);

    // Positioning logic
    let timeoutId;

    // element.addEventListener("mouseenter", () => {
      const rect = element.getBoundingClientRect();
      const parentRect = element.closest('.scrollable-container')?.getBoundingClientRect() || document.body.getBoundingClientRect(); // Get scrollable parent container
      popover.style.top = Math.max(parentRect.top, rect.top - 35) + "px"; // Stick to the top of the parent container
      popover.style.left = Math.min(parentRect.right - popover.offsetWidth, rect.left) + "px"; // Prevent overflow on the right
      // popover.style.display = "block"; // Show popover
      // clearTimeout(timeoutId); // Cancel hiding if it's being hovered again
    // });

    
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

  if (imgRE.test(token.type) && token.string === "!") {
    var lineNo = stream.lineNo;

    // find the begin and end of url part
    var url_begin = stream.findNext(urlRE);
    var url_end = stream.findNext(urlRE, url_begin.i_token + 1);

    let from = { line: lineNo, ch: token.start };
    let to = { line: lineNo, ch: url_end.token.end };
    let rngReq = stream.requestRange(from, to, from, from);

    if (rngReq === RequestRangeResult.OK) {
      var url;
      var title;
      var width = null;
      var height = null;
      var align = null;

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
        videoHolder.appendChild(youtubeIframe);
        videoHolder.appendChild(mask);
        var youtubeMarker = cm.markText(
          from, to,
          {
            clearOnEnter: true,
            collapsed: true,
            replacedWith: videoHolder,
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

        videoHolder.addEventListener('mouseenter', () => {
          if(cm.getOption('readOnly')) return;
          if (enableResizeAndDrag) {
            setupResizableAndDraggable(videoHolder, enableResizeAndDrag, cm, from, to, false, mask);
            videoHolder.style.border = "2px dotted #000";  
          }

          createAlignmentPopover(videoHolder, youtubeMarker, from, to);
        }, false);
  
        videoHolder.addEventListener('mouseleave', () => {
          videoHolder.style.border = "2px dotted transparent";
        });
        
        setElementAlignment(videoHolder, align);

        return youtubeMarker;
      }

      // Extract the title for image
      title = cm.getRange(
        { line: lineNo, ch: from.ch + 2 },
        { line: lineNo, ch: url_begin.token.start - 1 }
      );

      // Create and handle image element
      var img = document.createElement("img");
      var marker = cm.markText(
        from, to,
        {
          clearOnEnter: true,
          collapsed: true,
          replacedWith: img,
        }
      );

      img.src = url;
      img.title = title;
      img.className = "hmd-image hmd-image-loading";
      img.style.border = "solid 2px transparent";
      img.style.padding = "5px";
      
      if (width) img.width = width;
      if (height) img.height = height;

      // Add load and error handling
      img.addEventListener('load', () => {
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

        createAlignmentPopover(img, marker, from, to);
      }, false);

      img.addEventListener('mouseleave', () => {
        img.style.border = "2px dotted transparent";
      });

      setElementAlignment(img, align);

      return marker;
    }
  }

  return null;
};

registerFolder("image", ImageFolder, true);



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

// Utility function to update the size in the markdown
function updateMarkdownSize(cm, from, to, width, height, align=null) {
  let prevWidth = 0;
  let prevHeight = 0;
  let prevAlign = '';
  // Get the current content in the marked range
  const content = cm.getRange(from, to);
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
    updatedMarkdown += ` ${prevAlign}`;
  }

  // Close the markdown with a closing parenthesis
  updatedMarkdown += ")\n";
  // Replace the existing content with the updated markdown
  cm.replaceRange(updatedMarkdown, from, to);
}

function setElementAlignment(element, alignment="center") {
  if(alignment==="left") {
    alignment = 'left';
    element.style.float = 'left';
    element.style.marginRight = "20px";
    element.style.marginLeft = "0";
  } else if(alignment==="right") {
    alignment = 'right';
    element.style.float = 'right';
    element.style.marginLeft = "20px";
    element.style.marginRight = "0";
  } else {
    alignment = 'center';
    element.style.display = 'block';
    element.style.marginLeft = 'auto';
    element.style.marginRight = 'auto';
  }
}


// // Utility function to update alignment in the markdown
// this is a working function but the alignment is based on the positions and it will go wrong when the image size is larger
// function updateMarkdownAlignment(cm, from, to, element, position) {
//   const parentWidth = element.closest('pre').offsetWidth;
//   let alignment;

//   // Determine current float alignment
//   const float = getComputedStyle(element).float;
//   let left = position.x;
//   if (float === 'right') {
//     if(position.x < 0) {  
//       left = -1 * position.x;
//       alignment = "right";
//     }
//     if(left>parentWidth*0.66) {
//       alignment = "left";
//     } else if(left>parentWidth*0.33) {
//       alignment = "center";
//     } else {
//       // if it is dragged to right, nothing to be done
//       alignment = "right"
//     }
//   } else if (float === 'left') {
//     if (position.x > parentWidth * 0.66) {
//       alignment = "right"
//     } else if(position.x > parentWidth * 0.33) {
//       alignment = "center"
//     } else {
//       alignment = "left"
//     }
//   } else if (float === 'none') {
//     // Calculate alignment when float is none
//     if (position.x < 0) {
//       alignment = 'left';
//     } else if (position.x > 0) {
//       alignment = 'right';
//     } else {
//       alignment = 'center';
//     }
//   }
  
//   updateMarkdownSize(cm, from, to, null, null, alignment);
// }

// Utility function to update alignment in the markdown
function updateMarkdownAlignment(cm, from, to, element, align=null) {
  const parentWidth = element.closest('pre').offsetWidth;
  const elementWidth = element.offsetWidth;
  let alignment;

  // Get element's actual position relative to the parent
  const elementLeft = element.getBoundingClientRect().left;
  const parentLeft = element.closest('pre').getBoundingClientRect().left;
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
