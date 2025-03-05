// HyperMD, copyright (c) by laobubu
// Distributed under an MIT license: http://laobubu.net/HyperMD/LICENSE
//
// DESCRIPTION: Fold Image Markers `![](xxx)`
//

// ================================
// mediaFolder.js
// Main folder function that registers the media (image/video) handler
// ================================

import { registerFolder, RequestRangeResult } from "./fold";
import { splitLink } from "./read-link";
import { processVideo, processImage } from "./media-utils/media-handlers";
import { removePopover, widgetClassRef } from "./media-utils/general-utils";

const imgRE = /\bimage-marker\b/;
const urlRE = /\bformatting-link-string\b/;
const sizeAlignRE = /(?: =(\d+)?\*?(\d+)?\s*(left|center|right)?)?$/;
const youtubeUrlRE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})(.*)?$/;

export const MediaFolder = function (stream, token) {
  const cm = stream.cm;
  removePopover();

  // Verify token and look ahead for URL
  if (imgRE.test(token.type) && token.string === "!" && stream.findNext(urlRE)) {
    const lineNo = stream.lineNo;
    const url_begin = stream.findNext(urlRE);
    const url_end = stream.findNext(urlRE, url_begin?.i_token + 1);
    const from = { line: lineNo, ch: token.start };
    const to = { line: lineNo, ch: url_end?.token.end };
    const rngReq = stream.requestRange(from, to, from, from);
    if (rngReq !== RequestRangeResult.OK) return null;

    let rawurl = cm.getRange(
      { line: lineNo, ch: url_begin.token.start + 1 },
      { line: lineNo, ch: url_end.token.start }
    );
    if (url_end.token.string === "]") {
      const tmp = cm.hmdReadLink(rawurl, lineNo);
      if (!tmp) return null;
      rawurl = tmp.content;
    }
    let url = splitLink(rawurl).url;
    url = cm.hmdResolveURL(url);

    // Extract optional size/alignment info
    let width = null, height = null, align = null;
    const sizeAlignMatch = sizeAlignRE.exec(rawurl);
    if (sizeAlignMatch) {
      width = sizeAlignMatch[1] ? parseInt(sizeAlignMatch[1], 10) : null;
      height = sizeAlignMatch[2] ? parseInt(sizeAlignMatch[2], 10) : null;
      align = sizeAlignMatch[3] || null;
      rawurl = rawurl.replace(sizeAlignRE, '').trim();
    }

    // If URL is a YouTube link, process as video
    if (youtubeUrlRE.test(rawurl)) {
      return processVideo(cm, lineNo, from, to, rawurl, width, height, align);
    }

    // Otherwise process as image.
    const title = cm.getRange(
      { line: lineNo, ch: from.ch + 2 },
      { line: lineNo, ch: url_begin.token.start - 1 }
    );
    return processImage(cm, lineNo, from, to, rawurl, width, height, align, title);
  }
  return null;
};

registerFolder("image", MediaFolder, true, true);
