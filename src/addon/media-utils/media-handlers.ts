// ================================
// mediaHandlers.js
// Separate processing for video and image
// ================================

import { 
  widgetClassRef, enableResizeAndDrag, removeWidgetIfPresent, setElementAlignment,
  updateMarkdownAlignment, setupResizableAndDraggable, deleteElement, handleWidgetDisplay,
  createAlignmentPopover, removePopover, setupTokenVisibility
} from "./general-utils";

// Regular expressions (could be imported from a constants module)
// const youtubeUrlRE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})(.*)?$/;
const youtubeUrlRE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)(.*)?$/;
const DEFAULT_IMG_HEIGHT = 250;
const MIN_IMG_HEIGHT = 100;
const DEFAULT_ALIGN = "left";
const DEFAULT_VIDEO_WIDTH = 560;
const DEFAULT_VIDEO_HEIGHT = 315;

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

  const resolvedUrl = `https://www.youtube.com/embed/${videoID}?rel=0`;

  // Check if a video widget already exists with same parameters
  const lineHandleRef = cm.getLineHandle(to.line);
  const existingWidgets = lineHandleRef.widgets || [];

  for (const widget of existingWidgets) {
    const widgetNode = widget.node;
    if (widgetNode.className.includes("hmd-ytube")) {
      const iframe = widgetNode.querySelector("iframe");
      const vidWidth = parseInt(widgetNode.style.width) || DEFAULT_VIDEO_WIDTH;
      const vidHeight = parseInt(widgetNode.style.height) || DEFAULT_VIDEO_HEIGHT;
      
      console.log(
        iframe,
        iframe.src === resolvedUrl,
        vidWidth === (width || DEFAULT_VIDEO_WIDTH),
        vidHeight === (height || DEFAULT_VIDEO_HEIGHT),
        (widgetNode.dataset.align || DEFAULT_ALIGN) === (align || DEFAULT_ALIGN)
      )
      if (
        iframe &&
        iframe.src === resolvedUrl &&
        vidWidth === (width || DEFAULT_VIDEO_WIDTH) &&
        vidHeight === (height || DEFAULT_VIDEO_HEIGHT) &&
        (widgetNode.dataset.align || DEFAULT_ALIGN) === (align || DEFAULT_ALIGN)
      ) {
        const marker = cm.markText(from, to, {
          clearOnEnter: true,
          collapsed: false,
          className: `youtube-token youtube-token-line-${from.line}`
        });
        // Setup token visibility based on cursor position
        // setupTokenVisibility(cm, widget, lineNo);
        return marker; // Already rendered — skip reprocessing
      }
    }
  }

  removeWidgetIfPresent(cm, from.line);
  const lineWidget = cm.addLineWidget(to.line, videoHolder, {
    above: false,
    coverGutter: false,
    noHScroll: false,
    showIfHidden: true,
    className: widgetClassRef + ' show-above'
  });

  const youtubeMarker = cm.markText(from, to, {
    clearOnEnter: true,
    collapsed: false,
    className: `youtube-token youtube-token-line-${from.line}`
    // atomic: true,
    // inclusiveLeft: true,
    // inclusiveRight: true,
    // collapsed: true,
    // replacedWith: emptyReplacement,
  });
  
  // Set up visibility toggling
  setupTokenVisibility(cm, lineWidget, from.line);

  // Configure mask
  mask.style.position = "absolute";
  mask.style.top = "0";
  mask.style.left = "0";
  mask.style.width = "100%";
  mask.style.height = "100%";
  mask.style.zIndex = "9999";
  mask.style.display = "none";

  // Configure iframe (YouTube embed)
  youtubeIframe.src = resolvedUrl;
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
  const resolvedUrl = cm.hmdResolveURL(rawurl);

  // ✅ Check if an image widget already exists with same parameters
  const lineHandleRef = cm.getLineHandle(to.line);
  const existingWidgets = lineHandleRef.widgets || [];

  let imgWidth = null, imgHeight = null;
  

  /***** the below code is to check for existing widget and its propers to avoid rerendering of images *****/ 
  for (const widget of existingWidgets) {
    const widgetNode = widget.node;
    if(widgetNode.tagName === "IMG") {
      if (widgetNode.getAttribute('width')) {
        imgWidth = parseInt(widgetNode.getAttribute('width'));
      }
    
      if (widgetNode.getAttribute('height')) {
        imgHeight = parseInt(widgetNode.getAttribute('height'));
      } else {
        imgHeight = DEFAULT_IMG_HEIGHT;
      }
    }
    
    if (
      widgetNode.tagName === "IMG" &&
      widgetNode.src === resolvedUrl &&
      imgWidth === width &&
      (!height || imgHeight === height) &&
      (widgetNode.dataset.align || DEFAULT_ALIGN) === (align || DEFAULT_ALIGN)
    ) {
      const marker = cm.markText(from, to, {
        clearOnEnter: true,
        collapsed: true,
    });
      return marker; // 🧠 Already rendered — skip reprocessing
    }
  }
  /**********/ 
  
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
  img.style.opacity = '0';
  img.dataset.align = align || DEFAULT_ALIGN;
  if (width) img.width = width;
  if (height) {
    img.height = height;
  } else {
    img.style.height = DEFAULT_IMG_HEIGHT+'px';
  }

  // Image load and error handlers
  img.addEventListener('load', () => {
    if (img.naturalHeight < DEFAULT_IMG_HEIGHT && !img.getAttribute('height')) {
      img.style.height = img.naturalHeight < 100 ? (MIN_IMG_HEIGHT+'px') : img.naturalHeight + 'px';
    }
    img.style.opacity = '1';
    img.classList.remove("hmd-image-loading");
    marker.changed();
  });
  img.addEventListener('error', () => {
    img.style.opacity = '1';
    img.src = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAEAAAAAAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAC7APoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD90KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKXaQM4OKAEoqrea5Z6f8A666t48dd0grNufiLpNueLhpv+uaE5oA3KK5K8+LMEYPkWcshH99wv8s1m3HxW1C5JWC3t4z2wpdqAO/orzSfxnrEV1Cbm5njG5WKbRGCM+mOlelg7hnseR9KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAMZ6da4fUfipdRzMkVpDGVJX5yW9vau4zjn0rzuPbo/xR2sAEF0VxjjD/AP7VACt4r8Q6ucQibB/542+P1x/WhPCfiLVwDMZgp/57z/0ya7++lMFnM4wTHGzD0OATXBD4saht/wBRZhf91v8AGgCxafCadx++u4IweoRSx/pWha/CmyiIMs9zKR2BCj+RrH/4W3f/APPGy/I/40f8Lbv/APnjZfkf8aAOss/BOl2RDLZxu4/ikJc/rxWjBaQ2q4iiiiH+wgX+VcF/wtu//wCeNl+R/wAaP+Ft3/8AzxsvyP8AjQBa+LtjtubKcYy6NGTn3yB+prq/D92L7QrOUHO+FSfrjFec+IvG1x4lt4o50t0ET71KZBz+dWNI+I95o2nR20aWrxxZ2lgc8nPrQB6VRXAQ/FS/nmjQw2gDuFJCnufrXfjoPpQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAB6V578SIDYeLEuF6vGkn4qcf0FehVxvxdtCYrK4HABaIn1zgj+tAHVXsgm0eZwch4GYfiprivhPGsmo3AZVYCAHBGf4q6XQ7v7b4GjkyCfsjKT7hSP6Vzfwk/5CNz/17/8As1ADpvieVlIGl2pxx97/AOtUt14+urGJHl0SKNH+6XUgH/x2sPwtPb2/iq2e5wI1lOSw4U84J/Gu+8Y3VvH4bu/tDoySRkKMg727Y9ee9AHK/wDC0j/0C7T/AL6/+tR/wtI/9Au0/wC+v/rVypxnjpUlpZyXs6RRKXkkbaqjqxoA6b/haR/6Bdp/31/9arGkfEb+0dUt7dtNtVWeQISDkjJ+lZ+u/DqfRtKW5WQTsgzMirjZ7j1A71l+Gl2+JLD/AK7p/OgDT8fIIvHO1QFH7k4AwO1ejdh9K86+IP8AyPn4Q/yFei9h9KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArn/AImWn2nwq7DkwSq4/PB/nXQVS8SWv23w/exd3hbH1AyP5UAYPw/vDceB7uI9bfzV/Arn/Gs74Sf8hG5/69//AGak+HN9m11aHkbrcy4+gIP86X4S8alc/wDXv/7NQBy1x/rm+p/nTSxIGSTjpz0re8O+CLnxFOZW/cWu45kYct/ujv8AXpXT33wz02ewWKISQSx9Js7mb/eHegDzpVLsFUFmY4AHJJ9K9G8C+DhoFoJ7hVa9lHPcQj+6Pf1NR+DfAY0G6e4uTHLOCRHt6IPXnuf0rpaADGeoB9c964vV/B39j+KrG7tlJtJblNwH/LFs/wAj+ldpR+tAHnXxB/5HsfSH+lei9h9K868f/wDI8D/tj/SvRew+lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUjKHUg8huDS0UAeT2l5ceHtQukhxvIeBht3cZwf5Vr/DG+g07UrgzzRQqYcAuwAJ3V3U1jG9vMiJGjTKy7goByR1rjv+FRSAD/TkP/bI/wCNAHVr4h09Rj7da4HT96OKX/hI9P8A+f60/wC/ork/+FRSf8/sf/fo/wCNH/CopP8An9j/AO/R/wAaAOs/4SPT/wDn+tP+/oo/4SPT/wDn+tP+/ork/wDhUUn/AD+x/wDfo/40f8Kik/5/Y/8Av0f8aAOs/wCEj0//AJ/rT/v6KP8AhI9P/wCf60/7+iuT/wCFRSf8/sf/AH6P+NH/AAqKT/n9j/79H/GgDO8b3Ud540DxSJKh8oBlOQenevSew+lcTD8J5Ipkf7anyMG/1R7H612wzgZ64oAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9k=';
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
