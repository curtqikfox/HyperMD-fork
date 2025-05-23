import { cm_t } from "./type"
import { Token, Position, cmpPos } from "codemirror"
import { HyperMDState, HashtagType } from "../mode/hypermd";
import { makeSymbol } from "./utils";

// this enum is recreated and removed the export in hypermd since 
// importing and using with conditional check like LinkType?.NORMAL" is creating unexpected hypermd_1.LinkType in the final build. 
// removing the condition is throwing script error at times when copy pasting or working with links(thought it is not affecting the UX)
const enum LinkType {
  NONE = 0,
  BARELINK,  // [link]
  FOOTREF,   // [^ref]
  NORMAL,    // [text](url) or [text][doc]
  FOOTNOTE,  // [footnote]:
  MAYBE_FOOTNOTE_URL, // things after colon
  BARELINK2, // [some-name][]  except latter []
  FOOTREF2,  // [text][doc]  the [doc] part
  CUSTOMLINK,  // [[custom link]]
  HIGHLIGHT_TEXT,  // ==Highlight Text content==
  SUPERSCRIPT,
  SUBSCRIPT,
  UNDERLINE
  // BULLETS
}

export interface Span {
  type: string
  text: string

  head: Token; head_i: number
  tail?: Token; tail_i?: number

  /** the first char's index */
  begin: number

  /** the index after last char */
  end: number
}

type SpanType = "em" | "strong" | "strikethrough" | "code" | "linkText" | "linkHref" | "task" | "hashtag" | "customLink" | "indent" | "highlightText" | "superscript" | "subscript" | "underline";

const enum SpanAction {
  NOTHING = 0,
  IS_THIS_TYPE = 1,
  LEAVING_THIS_TYPE = 2,
}

/**
 * Post-process CodeMirror-mode-parsed lines, find the ranges
 *
 * for example, a parsed line `[**Hello** World](xxx.txt)` will gives you:
 *
 * 1. link from `[` to `)`
 * 2. bold text from `**` to another `**`
 */
class LineSpanExtractor {
  constructor(public cm: cm_t) {
    cm.on("change", (cm, change) => {
      let line = change.from.line
      if (this.caches.length > line) this.caches.splice(line)
    })
  }

  public caches: Span[][] = new Array() // cache for each lines

  getTokenTypes(token: Token, prevToken?: Token): Record<SpanType, SpanAction> {
    let prevState: HyperMDState = prevToken ? prevToken.state : {}

    let state = token.state as HyperMDState
    let styles = ' ' + token.type + ' '
    let ans: Record<SpanType, SpanAction> = {
      // em
      em: (state.em ? SpanAction.IS_THIS_TYPE
        : prevState.em ? SpanAction.LEAVING_THIS_TYPE : SpanAction.NOTHING),

      // strikethrough
      strikethrough: (state.strikethrough ? SpanAction.IS_THIS_TYPE
        : prevState.strikethrough ? SpanAction.LEAVING_THIS_TYPE : SpanAction.NOTHING),

      // strong
      strong: (state.strong ? SpanAction.IS_THIS_TYPE
        : prevState.strong ? SpanAction.LEAVING_THIS_TYPE : SpanAction.NOTHING),

      // code
      code: (state.code ? SpanAction.IS_THIS_TYPE
        : prevState.code ? SpanAction.LEAVING_THIS_TYPE : SpanAction.NOTHING),

      // linkText
      linkText:
        (state.linkText ?
          (state.hmdLinkType === LinkType?.NORMAL || state.hmdLinkType === LinkType?.BARELINK2 ? SpanAction.IS_THIS_TYPE : SpanAction.NOTHING) :
          (prevState.linkText ? SpanAction.LEAVING_THIS_TYPE : SpanAction.NOTHING)
        ),

      // linkHref
      linkHref:
        ((state.linkHref && !state.linkText) ?
          SpanAction.IS_THIS_TYPE :
          (!state.linkHref && !state.linkText && prevState.linkHref && !prevState.linkText) ? SpanAction.LEAVING_THIS_TYPE : SpanAction.NOTHING
        ),

      // task checkbox
      task: (styles.indexOf(' formatting-task ') !== -1)
        ? (SpanAction.IS_THIS_TYPE | SpanAction.LEAVING_THIS_TYPE)
        : (SpanAction.NOTHING),

      // hashtag
      hashtag: (state.hmdHashtag ? SpanAction.IS_THIS_TYPE :
        prevState.hmdHashtag ? SpanAction.LEAVING_THIS_TYPE : SpanAction.NOTHING),

      // customLink
      customLink: ((token.type !== null && token.type != undefined ? token.type.indexOf("hmd-customlink-begin") != -1 : 0) ? 1 /* SpanAction.IS_THIS_TYPE */
      : ((token.type !== null && token.type != undefined ? token.type.indexOf("hmd-customlink-end") != -1 : 0)) ? 2 /* SpanAction.LEAVING_THIS_TYPE */ : 0 /* SpanAction.NOTHING */),

      //Highlight Text
      highlightText: ((token.type !== null && token.type != undefined ? token.type.indexOf("hmd-highlightText-begin") != -1 : 0) ? 1 /* SpanAction.IS_THIS_TYPE */
      : ((token.type !== null && token.type != undefined ? token.type.indexOf("hmd-highlightText-end") != -1 : 0)) ? 2 /* SpanAction.LEAVING_THIS_TYPE */ : 0 /* SpanAction.NOTHING */),

      // subscript
      subscript: ((token.type !== null && token.type != undefined ? token.type.indexOf("hmd-subscript-begin") != -1 : 0) ? 1 /* SpanAction.IS_THIS_TYPE */
      : ((token.type !== null && token.type != undefined ? token.type.indexOf("hmd-subscript-end") != -1 : 0)) ? 2 /* SpanAction.LEAVING_THIS_TYPE */ : 0 /* SpanAction.NOTHING */),

      // superscript
      superscript: ((token.type !== null && token.type != undefined ? token.type.indexOf("hmd-superscript-begin") != -1 : 0) ? 1 /* SpanAction.IS_THIS_TYPE */
      : ((token.type !== null && token.type != undefined ? token.type.indexOf("hmd-superscript-end") != -1 : 0)) ? 2 /* SpanAction.LEAVING_THIS_TYPE */ : 0 /* SpanAction.NOTHING */),
      
      // underline
      underline: ((token.type !== null && token.type != undefined ? token.type.indexOf("hmd-underline-begin") != -1 : 0) ? 1 /* SpanAction.IS_THIS_TYPE */
      : ((token.type !== null && token.type != undefined ? token.type.indexOf("hmd-underline-end") != -1 : 0)) ? 2 /* SpanAction.LEAVING_THIS_TYPE */ : 0 /* SpanAction.NOTHING */),

      // Indent
      indent: (token.type !== null && token.type != undefined && token.type.indexOf('hmd-indent') !== -1) ? 1 /* SpanAction.IS_THIS_TYPE */
      : (0 /* SpanAction.NOTHING */),
    }
    return ans
  }



  /** get spans from a line and update the cache */
  extract(lineNo: number, precise?: boolean) {
    if (!precise) { // maybe cache is valid?
      let cc = this.caches[lineNo]
      if (cc) return cc
    }

    const tokens = this.cm.getLineTokens(lineNo)
    const lineText = this.cm.getLine(lineNo)
    const lineLength = lineText.length

    let ans: Span[] = []
    let unclosed: Partial<Record<SpanType, Span>> = {}

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      const types = this.getTokenTypes(token, tokens[i - 1])

      for (let type in types) {
        let span = unclosed[type] as Span
        if (types[type] & SpanAction.IS_THIS_TYPE) { // style is active
          if (!span) { // create a new span if needed
            span = {
              type,
              begin: token.start,
              end: lineLength,
              head: token,
              head_i: i,
              tail: tokens[tokens.length - 1],
              tail_i: tokens.length - 1,
              text: lineText.slice(token.start),
            }
            ans.push(span)
            unclosed[type] = span
          }
        }

        if (types[type] & SpanAction.LEAVING_THIS_TYPE) { // a style is exiting
          if (span) { // close an unclosed span
            span.tail = token
            span.tail_i = i
            span.end = token.end
            span.text = span.text.slice(0, span.end - span.begin)
            unclosed[type] = null
          }
        }
      }
    }

    this.caches[lineNo] = ans
    return ans
  }

  findSpansAt(pos: Position) {
    let spans = this.extract(pos.line)
    let ch = pos.ch
    let ans = [] as Span[]
    for (let i = 0; i < spans.length; i++) {
      let span = spans[i]
      if (span.begin > ch) break
      if (ch >= span.begin && span.end >= ch) ans.push(span)
    }

    return ans
  }

  findSpanWithTypeAt(pos: Position, type: SpanType) {
    let spans = this.extract(pos.line)
    let ch = pos.ch
    for (let i = 0; i < spans.length; i++) {
      let span = spans[i]
      if (span.begin > ch) break
      if (ch >= span.begin && span.end >= ch && span.type === type) return span
    }

    return null
  }
}

const extractor_symbol = makeSymbol("LineSpanExtractor")

/**
 * Get a `LineSpanExtractor` to extract spans from CodeMirror parsed lines
 *
 * for example, a parsed line `[**Hello** World](xxx.txt)` will gives you:
 *
 * 1. link from `[` to `)`
 * 2. bold text from `**` to another `**`
 */
export function getLineSpanExtractor(cm: cm_t): LineSpanExtractor {
  if (extractor_symbol in cm) return cm[extractor_symbol] as LineSpanExtractor
  let inst = cm[extractor_symbol] = new LineSpanExtractor(cm)
  return inst
}
