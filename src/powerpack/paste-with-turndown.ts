// HyperMD, copyright (c) by laobubu
// Distributed under an MIT license: http://laobubu.net/HyperMD/LICENSE
//
// POWERPACK for "addon/paste"
//
// This module provides `TurndownConvertor`, which can convert copied HTML into Markdown.
//
// :bulb: **Hint**:
//
// This module also supports GFM extensions (eg. tables) via [turndown-plugin-gfm](https://www.npmjs.com/package/turndown-plugin-gfm).
// Load `turndown-plugin-gfm` after this module and it will be automatically used while pasting.
//
import TurndownService from "turndown";
import * as turndownPluginGfm from "turndown-plugin-gfm"; // Import the plugin
import { PasteConvertor, suggestedOption, defaultOption } from "../addon/paste";

export const TurndownConvertor: PasteConvertor = (html) => {
  console.log('HTML before processing:', html); // Log the HTML before processing

  // Strip <a> without href
  html = html.replace(/<a([^>]*)>(.*?)<\/a>/ig, (s, attrs, content) => {
    if (!/href=/i.test(attrs)) return content;
    return s;
  });

  // Maybe you don't need to convert if there is no relevant HTML
  if (!/\<(?:hr|img|h\d|strong|em|strikethrough|table|a|b|i|del|ol|ul)(?:\s.*?|\/)?\>/i.test(html)) return null;

  const turndownService = getTurndownService();
  if (turndownService) {
    let markdown = turndownService.turndown(html);

    // Convert spaces to tabs for consistency across different editors
    markdown = markdown.replace(/^ {4}/gm, "\t")
                       .replace(/^ {3}/gm, "\t")
                       .replace(/^(?!\t)( {2})/gm, "\t");
    return markdown;
  }

  return null;
};

export const getTurndownService = (function () {
  var service: TurndownService = null;

  return function () {
    if (!service && typeof TurndownService === 'function') {
      var opts = {
        "headingStyle": "atx",
        "hr": "---",
        "bulletListMarker": "*",
        "codeBlockStyle": "fenced",
        "fence": "```",
        "emDelimiter": "*",
        "strongDelimiter": "**",
        "linkStyle": "inlined",
        "linkReferenceStyle": "collapsed"
      };

      service = new TurndownService(opts);

      // Use turndownPluginGfm to enable GFM features including tables
      if (typeof turndownPluginGfm !== 'undefined') {
        var gfm = turndownPluginGfm.gfm;
        var tables = turndownPluginGfm.tables;
        var strikethrough = turndownPluginGfm.strikethrough;

        // Use the gfm plugin
        service.use(gfm);

        // Use the table and strikethrough plugins only
        service.use([tables, strikethrough]);
      }
    }

    return service;
  };
})();

if (typeof TurndownService != "undefined") {
  // Use this convertor as the default convertor
  defaultOption.convertor = TurndownConvertor;
} else {
  console.error("[HyperMD] PowerPack paste-with-turndown loaded, but turndown not found.");
}
