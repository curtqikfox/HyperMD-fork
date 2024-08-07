// HyperMD, copyright (c) by laobubu
// Distributed under an MIT license: http://laobubu.net/HyperMD/LICENSE
//
// DESCRIPTION: Fold Image Markers `![](xxx =width*height align)`
//

import { FolderFunc, registerFolder, RequestRangeResult, breakMark } from "./fold";
import { Position } from "codemirror";
import { splitLink } from "./read-link";

const DEBUG = false

export const ImageFolder: FolderFunc = function (stream, token) {
  const cm = stream.cm
  const imgRE = /\bimage-marker\b/
  const urlRE = /\bformatting-link-string\b/   // matches the parentheses
  const sizeAlignRE = /(?: =(\d+)?\*?(\d+)?\s*(left|center|right)?)?$/;  // matches the size " =width*height align"

  if (imgRE.test(token.type) && token.string === "!") {
    var lineNo = stream.lineNo

    // find the begin and end of url part
    var url_begin = stream.findNext(urlRE)
    var url_end = stream.findNext(urlRE, url_begin.i_token + 1)

    let from: Position = { line: lineNo, ch: token.start }
    let to: Position = { line: lineNo, ch: url_end.token.end }
    let rngReq = stream.requestRange(from, to, from, from)

    if (rngReq === RequestRangeResult.OK) {
      var url: string
      var title: string
      var width: number = null
      var height: number = null
      var align: string = null

      { // extract the URL
        let rawurl = cm.getRange(    // get the URL or footnote name in the parentheses
          { line: lineNo, ch: url_begin.token.start + 1 },
          { line: lineNo, ch: url_end.token.start }
        )
        if (url_end.token.string === "]") {
          let tmp = cm.hmdReadLink(rawurl, lineNo)
          if (!tmp) return null // Yup! bad URL?!
          rawurl = tmp.content
        }
        url = splitLink(rawurl).url
        url = cm.hmdResolveURL(url)

        // Check if there is size or alignment information
        const sizeAlignMatch = sizeAlignRE.exec(rawurl)
        if (sizeAlignMatch) {
          width = sizeAlignMatch[1] ? parseInt(sizeAlignMatch[1], 10) : null
          height = sizeAlignMatch[2] ? parseInt(sizeAlignMatch[2], 10) : null
          align = sizeAlignMatch[3] || null
          url = rawurl.replace(sizeAlignRE, '').trim() // Remove size and alignment info from the URL
        }
      }

      { // extract the title
        title = cm.getRange(
          { line: lineNo, ch: from.ch + 2 },
          { line: lineNo, ch: url_begin.token.start - 1 }
        )
      }

      var img = document.createElement("img")
      var marker = cm.markText(
        from, to,
        {
          clearOnEnter: true,
          collapsed: true,
          replacedWith: img,
        }
      )

      img.addEventListener('load', () => {
        img.classList.remove("hmd-image-loading")
        marker.changed()
      }, false)
      img.addEventListener('error', () => {
        img.classList.remove("hmd-image-loading")
        img.classList.add("hmd-image-error")
        marker.changed()
      }, false)
      img.addEventListener('click', () => breakMark(cm, marker), false)

      img.className = "hmd-image hmd-image-loading"
      img.src = url
      img.title = title
      if (width) img.width = width
      if (height) img.height = height
      if (align) {
        if (align === "left") {
          img.style.float = "left"
          img.style.paddingRight = "20px"
        } else if (align === "right") {
          img.style.float = "right"
          img.style.paddingLeft = "20px"
        } else if (align === "center") {
          img.style.display = "block"
          img.style.marginLeft = "auto"
          img.style.marginRight = "auto"
        }
      }

      return marker
    } else {
      if (DEBUG) {
        console.log("[image]FAILED TO REQUEST RANGE: ", rngReq)
      }
    }
  }

  return null
}

registerFolder("image", ImageFolder, true)
