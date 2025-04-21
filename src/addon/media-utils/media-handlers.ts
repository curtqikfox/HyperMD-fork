// ================================
// mediaHandlers.js
// Separate processing for video and image
// ================================

import { 
  widgetClassRef, enableResizeAndDrag, removeWidgetIfPresent, setElementAlignment,
  updateMarkdownAlignment, setupResizableAndDraggable, deleteElement, handleWidgetDisplay,
  createAlignmentPopover, removePopover
} from "./general-utils";

// Regular expressions (could be imported from a constants module)
const youtubeUrlRE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})(.*)?$/;

export function processVideo(cm, lineNo, from, to, rawurl, width, height, align) {
  const youtubeMatch = youtubeUrlRE.exec(rawurl);
  if (!youtubeMatch) return null;
  const videoID = youtubeMatch[4];

  // Create video container elements
  const videoHolder = document.createElement("div");
  const youtubeIframe = document.createElement("iframe");
  const mask = document.createElement("div");
  const emptyReplacement = document.createElement("div");

  videoHolder.appendChild(youtubeIframe);
  videoHolder.appendChild(mask);

  removeWidgetIfPresent(cm, from.line);
  const lineWidget = cm.addLineWidget(to.line, videoHolder, {
    above: false,
    coverGutter: false,
    noHScroll: false,
    showIfHidden: true,
    className: widgetClassRef + ' show-above'
  });

  const youtubeMarker = cm.markText(from, to, {
    atomic: true,
    inclusiveLeft: true,
    inclusiveRight: true,
    collapsed: true,
    replacedWith: emptyReplacement,
  });

  // Configure mask
  mask.style.position = "absolute";
  mask.style.top = "0";
  mask.style.left = "0";
  mask.style.width = "100%";
  mask.style.height = "100%";
  mask.style.zIndex = "9999";
  mask.style.display = "none";

  // Configure iframe (YouTube embed)
  youtubeIframe.src = `https://www.youtube.com/embed/${videoID}?rel=0`;
  youtubeIframe.width = "100%";
  youtubeIframe.height = "100%";
  youtubeIframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  youtubeIframe.allowFullscreen = true;
  youtubeIframe.title = "";

  // Container styles
  videoHolder.className = "hmd-ytube";
  videoHolder.style.border = "solid 2px transparent";
  videoHolder.style.width = width ? width + "px" : "560px";
  videoHolder.style.height = height ? height + "px" : "315px";
  videoHolder.style.display = "inline-block";
  videoHolder.style.padding = "5px";
  videoHolder.style.zIndex = "99";
  videoHolder.style.maxWidth = "100%";

  // Event listeners to add drag/resize & popover
  videoHolder.addEventListener('mouseenter', () => {
    if (cm.getOption('readOnly')) return;
    if (enableResizeAndDrag) {
      setupResizableAndDraggable(videoHolder, enableResizeAndDrag, cm, from, to, false, mask);
      videoHolder.style.border = "2px dotted #000";
    }
    createAlignmentPopover(videoHolder, lineWidget, from, to, cm);
  });
  videoHolder.addEventListener('mouseleave', () => {
    videoHolder.style.border = "2px dotted transparent";
  });
  
  setElementAlignment(videoHolder, align);
  const lineHandle = cm.getLineHandle(from.line);
  lineHandle.off('change', () => handleWidgetDisplay(cm, lineWidget));
  lineHandle.on('change', () => handleWidgetDisplay(cm, lineWidget));
  return youtubeMarker;
}

export function processImage(cm, lineNo, from, to, rawurl, width, height, align, title) {
  // Create image element and its holder
  const img = document.createElement("img");
  const holder = document.createElement("div");
  
  removeWidgetIfPresent(cm, to.line);
  const lineWidget = cm.addLineWidget(to.line, img, {
    above: false,
    coverGutter: false,
    noHScroll: false,
    showIfHidden: true,
    className: widgetClassRef + ' do-not-show-token show-above'
  });

  const marker = cm.markText(from, to, {
      clearOnEnter: true,
      collapsed: true,
    // replacedWith: holder,
    // atomic: true,
    // inclusiveLeft: true,
    // inclusiveRight: true,
    // collapsed: true,
    // replacedWith: holder,
  });

  // Set up the image attributes
  img.src = cm.hmdResolveURL(rawurl);
  img.title = title;
  img.className = "hmd-image hmd-image-loading";
  img.style.border = "solid 2px transparent";
  img.style.padding = "5px";
  img.style.objectFit = "contain";
  if (width) img.width = width;
  if (height) {
    img.height = height;
  } else {
    img.style.height = '250px';
  }

  // Image load and error handlers
  img.addEventListener('load', () => {
    if (img.naturalHeight < 250 && !img.getAttribute('height')) {
      img.style.height = img.naturalHeight < 100 ? '100px' : img.naturalHeight + 'px';
    }
    img.classList.remove("hmd-image-loading");
    marker.changed();
  });
  img.addEventListener('error', () => {
    img.classList.add("hmd-image-error");
    marker.changed();
  });

  // Add event listeners for resizing & alignment popover
  img.addEventListener('mouseenter', () => {
    if (cm.getOption('readOnly')) return;
    if (enableResizeAndDrag) {
      setupResizableAndDraggable(img, enableResizeAndDrag, cm, from, to);
      img.style.border = "2px dotted #000";
    }
    createAlignmentPopover(img, lineWidget, from, to, cm);
  });
  img.addEventListener('mouseleave', () => {
    img.style.border = "2px dotted transparent";
  });
  
  setElementAlignment(img, align);
  const lineHandle = cm.getLineHandle(from.line);
  lineHandle.off('change', () => handleWidgetDisplay(cm, lineWidget));
  lineHandle.on('change', () => handleWidgetDisplay(cm, lineWidget));
  return marker;
}
