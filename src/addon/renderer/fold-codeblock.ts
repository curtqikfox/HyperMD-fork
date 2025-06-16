import * as CodeMirror from "codemirror"
import "codemirror/mode/javascript/javascript"
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/python/python';
import 'codemirror/mode/rust/rust';
import 'codemirror/mode/go/go';
import "codemirror/addon/fold/foldcode"
import "codemirror/addon/fold/foldgutter"
import { registerRenderer, CodeRenderer } from "../fold-code"
import { getAddon as getFoldCode } from "../fold-code"
import { getAddon as getFold } from "../fold"

// This code is to reuse codemirror to set the internal codemirror block to render programming language.
// Open issue: codemirror style customization creates UI issue so commenting for time being.
export const CodeMirrorRenderer: CodeRenderer = (code, info) => {
  const el = document.createElement("div")
  el.setAttribute("class", "hmd-fold-code-editor")

  const editor = CodeMirror(el, {
    value: code,
    mode: info.lang || "javascript",
    readOnly: true,
    lineNumbers: false,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    viewportMargin: Infinity,
  })

  // 🔄 Force layout once DOM is ready
  setTimeout(() => {
    editor.refresh()
  }, 0)

  return el
}

// export const CodeMirrorRenderer: CodeRenderer = (code, info) => {
//   const el = document.createElement("div")
//   el.className = "hmd-fold-code-editor"
//   // const lang = info.lang==="cpp"?"clike":info.lang
//   let lang = (info.lang || "").toLowerCase()
//   if (lang === "cpp") lang = "text/x-c++src"

//   const pre = document.createElement("pre")
//   pre.className = `language-${lang || "plain"}`
//   pre.textContent = code.trim()

//   el.appendChild(pre)
//   return el
// }

CodeMirror.defineOption("codeblock", null, (cm: CodeMirror.Editor) => {
  getFoldCode(cm).clear("codeblock")
  getFold(cm).startFold()
})

// Register this renderer for code blocks like ```js, javascript, typescript
registerRenderer({
  name: "codeblock",
  pattern: /^js|javascript|typescript|java|cpp|clike|rust|golang|go|ts$/i,
  renderer: CodeMirrorRenderer,
  suggested: true,
}, true)
