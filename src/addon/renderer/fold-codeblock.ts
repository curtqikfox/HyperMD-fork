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
  const cm = info.editor; // the parent editor or the original editor
  const el = document.createElement("div")
  el.setAttribute("class", "hmd-fold-code-editor")

  let lang = (info.lang || "").toLowerCase()

  // Normalize lang to CodeMirror-compatible modes
  if (lang === "cpp" || lang === "c++") lang = "text/x-c++src"
  else if (lang === "c") lang = "text/x-csrc"
  else if (lang === "java") lang = "text/x-java"
  else if (lang === "ts" || lang === "typescript") lang = "application/typescript"
  else if (lang === "go" || lang === "golang") lang = "go"
  else if (lang === "js") lang = "javascript"


  const editor = CodeMirror(el, {
    value: code,
    mode: lang || "javascript",
    readOnly: true,
    lineNumbers: false,
    foldGutter: false,
    gutters: [], // ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    viewportMargin: Infinity,
  })

  // 🔄 Force layout once DOM is ready
  setTimeout(() => {
    editor.refresh()
  }, 0)

  // 📌 Trigger `info.break()` when editor is focused
  editor.on("focus", () => {
    if (cm.getOption('readOnly')) return;
    if (typeof info.break === "function") {
      info.break()
    }
  })

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
  pattern: /^(js|javascript|typescript|java|c|clang|cpp|c\+\+|clike|rust|golang|go|ts)$/i,
  renderer: CodeMirrorRenderer,
  suggested: true,
}, true)
