import { FolderFunc, registerFolder, RequestRangeResult, breakMark } from "./fold";
import { Position } from "codemirror";
import { splitLink } from "./read-link";

const DEBUG = false;

// Regular expression to match YouTube URLs
export const youtubeUrlRE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})(.*)?$/;

// Define a YouTube folder function
export const YouTubeFolder: FolderFunc = function (stream, token) {
  const cm = stream.cm;
  const youtubeMarkerRE = /\bimage-marker\b/;  // We could rename "image-marker" to "youtube-marker" here
  const urlRE = /\bformatting-link-string\b/;  // matches the parentheses

  if (youtubeMarkerRE.test(token.type) && token.string === "!") {
    var lineNo = stream.lineNo;

    // find the begin and end of url part
    var url_begin = stream.findNext(urlRE);
    var url_end = stream.findNext(urlRE, url_begin.i_token + 1);

    let from: Position = { line: lineNo, ch: token.start };
    let to: Position = { line: lineNo, ch: url_end.token.end };
    let rngReq = stream.requestRange(from, to, from, from);

    if (rngReq === RequestRangeResult.OK) {
      var url: string;
      var title: string;
      var videoID: string;

      // extract the URL
      let rawurl = cm.getRange( // get the URL or footnote name in the parentheses
        { line: lineNo, ch: url_begin.token.start + 1 },
        { line: lineNo, ch: url_end.token.start }
      );
      if (url_end.token.string === "]") {
        let tmp = cm.hmdReadLink(rawurl, lineNo);
        if (!tmp) return null; // Yup! bad URL?!
        rawurl = tmp.content;
      }

      // Use splitLink to parse the URL
      url = splitLink(rawurl).url;
      url = cm.hmdResolveURL(url);

      // Extract YouTube ID using regex
      const youtubeMatch = youtubeUrlRE.exec(url);
      if (!youtubeMatch) return null; // If not a valid YouTube URL, skip

      videoID = youtubeMatch[4]; // Extract the video ID

      // extract the title (text before the URL)
      title = cm.getRange(
        { line: lineNo, ch: from.ch + 2 },
        { line: lineNo, ch: url_begin.token.start - 1 }
      );

      // Create the iframe element for embedding YouTube video
      var youtubeIframe = document.createElement("iframe");
      var youtubeMarker = cm.markText(
        from, to,
        {
          clearOnEnter: true,
          collapsed: true,
          replacedWith: youtubeIframe,
        }
      );

      youtubeIframe.src = `https://www.youtube.com/embed/${videoID}`;
      youtubeIframe.width = "560";
      youtubeIframe.height = "315";
      youtubeIframe.frameBorder = "0";
      youtubeIframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      youtubeIframe.allowFullscreen = true;
      youtubeIframe.title = title;

      // Add click event to break the marker
      youtubeIframe.addEventListener('click', () => breakMark(cm, youtubeMarker), false);

      return youtubeMarker;
    } else {
      if (DEBUG) {
        console.log("[YouTube] FAILED TO REQUEST RANGE: ", rngReq);
      }
    }
  }
  return null;
};

// Register the folder function for YouTube
registerFolder("youtube", YouTubeFolder, true);