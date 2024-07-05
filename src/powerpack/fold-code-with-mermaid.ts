// HyperMD, copyright (c) by laobubu
// Distributed under an MIT license: http://laobubu.net/HyperMD/LICENSE
//
// POWERPACK for "addon/fold-code"
//
// This module provides `MermaidRenderer` for FoldCode addon
// so that you can render flowchart / diagram with powerful [mermaid](https://mermaidjs.github.io/)
//
// By default the renderer is enabled. You may disable it by setting `hmdFoldCode.mermaid` to `false`
//
// **Example**: https://laobubu.net/HyperMD/docs/examples/mermaid.html
//
// :hint: to change mermaid configuration

import * as _mermaid_module from "mermaid"
import * as CodeMirror from "codemirror"
import { registerRenderer, CodeRenderer, getAddon as getFoldCode } from "../addon/fold-code"
import { getAddon as getFold } from "../addon/fold"

/** mermaid */
var mermaid: typeof _mermaid_module = _mermaid_module || this['mermaid'] || window['mermaid']

export const MermaidRenderer: CodeRenderer = (code, info) => {
  var el = document.createElement('div')
  el.setAttribute('class', 'hmd-fold-code-image hmd-fold-code-mermaid')
  el.innerHTML = code;

  mermaid.default.run({nodes: [el], suppressErrors: true})
  mermaid.default.parseError = (err:any) => {
    // If there is an error, display the original code block with a warning sign
    // If there is an error, switch to code view mode
    el.innerHTML = ''; // Clear the current content
    const pre = document.createElement('pre');
    const warningDiv = document.createElement('div');
    warningDiv.setAttribute('style', 'border: 1px solid red; padding: 10px;border-radius: 3px');
    warningDiv.innerHTML = `<strong>⚠️ Error:</strong> Invalid syntax.<br>`;
    pre.textContent = code;
    warningDiv.appendChild(pre);
    el.className = 'mermaid-error'
    el.appendChild(warningDiv);
    // el.innerHTML = `<div style="border: 1px solid red; padding: 10px;">
    //                   <strong>Warning:</strong> Invalid Mermaid syntax.<br>
    //                   <pre>${code}</pre>
    //                 </div>`;
  }

  return el;
}

if (typeof mermaid === "object") {
  CodeMirror.defineOption("mermaid", null, (cm: CodeMirror.Editor) => {
    getFoldCode(cm).clear("mermaid")
    getFold(cm).startFold()
  });

  registerRenderer({
    name: "mermaid",
    pattern: /^mermaid|diagram|sequence|sequence-diagram|sequenceDiagram|flowchart|chart|graph|mindmap$/i,
    renderer: MermaidRenderer,
    suggested: true,
  }, true); // updated to set it to true due to conflict in integrating with web component where it is used
} else {
  console.error("[HyperMD] PowerPack fold-code-with-mermaid loaded, but mermaid not found.")
}
