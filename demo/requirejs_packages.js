// RequireJS doesn't read package.json
// Please, configure it before loading HyperMD:
//
// requirejs.config({
//   packages: [
//     { name: 'codemirror', main: 'lib/codemirror.js' },
//     { name: 'katex', main: 'dist/katex.min.js' },
//     /* ... and more  */
//   ]
// })
//

// (This configuration is just a example / reference. Feel free to modify it)

var requirejs_packages = [
  { name: 'hypermd', main: 'everything.js' },
  { name: 'codemirror', main: 'lib/codemirror.js' },
  { name: 'mathjax', main: 'MathJax.js' },
  { name: 'katex', main: 'dist/katex.min.js' },
  { name: 'marked', main: 'lib/marked.umd.js' },
  { name: 'turndown', main: 'lib/turndown.browser.umd.js' },
  { name: 'turndown-plugin-gfm', main: 'dist/turndown-plugin-gfm.js' },
  { name: 'emoji-toolkit', main: 'lib/js/joypixels.min.js' },
  { name: 'twemoji', main: '2/twemoji.amd.js' },
  { name: 'flowchart.js', main: '../../submodules/flowchart.js/release/flowchart.min.js' },
  { name: 'Raphael', main: 'raphael.min.js' }, // stupid
  { name: 'raphael', main: 'raphael.min.js' },
  { name: 'mermaid', main: 'dist/mermaid.js' },
  { name: 'interactjs', main: 'dist/interact.min.js' },
]
