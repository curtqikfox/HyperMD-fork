import * as CodeMirror from 'codemirror'
import { Addon, FlipFlop, debounce, suggestedEditorConfig, normalVisualConfig } from '../core'
import { cm_t } from '../core/type'

export interface Options extends Addon.AddonOptions {
    /** Enable TableAlign */
    enabled: boolean
}
export const defaultOption: Options = {
  enabled: true,
}

export type OptionValueType = Partial<Options> | boolean;

// Addon Name: ListFormatting
export class ListFormatting implements Addon.Addon, Options {
  enabled: boolean;
  cm:cm_t;

  constructor(cm: cm_t) {
    this.cm = cm;
    new FlipFlop(
        /* ON  */() => {
          cm.on("beforeChange", this.handleBeforeChange)
        },
        /* OFF */() => {
          cm.off("beforeChange", this.handleBeforeChange)
        }
      ).bind(this, "enabled", true)
  }

  private handleBeforeChange = (cm: cm_t, change: any) => {
    // Check if the change involves typing after '* ' in a list
    if (change.origin === "+input" && change.text.length === 1) {
      const cursor = cm.getCursor();
      const line = cm.getLine(cursor.line);

      const match = line.match(/^[ \t]*\*\s$/);
       if (match && match[0].trimStart()=== "* " && change.text[0] === " ") {
        // Replace the space with a non-breaking space (&nbsp;)
        change.update(change.from, change.to, [""]);

        // Use markText to insert a styled span with non-breaking space
        // Add a space with a span using direct text replacement
        const newLineContent = "\t"+this.replaceSpacesWithTabs(line.trimEnd()) + " "; // Add non-breaking space
        console.log(newLineContent)
        cm.replaceRange(newLineContent, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: line.length });
      } else if(line.length>1 && line.trimStart() === "*" && change.text[0] === " ") {
        const newLine = this.replaceSpacesWithTabs(line).trimEnd() + " ";
        change.update(change.from, change.to, [""]);
        cm.replaceRange(newLine, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: line.length });
        setTimeout(() => {
          cm.setCursor({
            line: cursor.line,
            ch: newLine.length + 1, // Move cursor to just after the span
          });
        }, 0);
      }
    }
  }

  replaceSpacesWithTabs (text) {
    return text.replace(/^ +/gm, (match) => {
      const spaceCount = match.length;
      const tabCount = Math.ceil(spaceCount / 4);
      return '\t'.repeat(tabCount);
    });
  };
}

// Register the Addon
CodeMirror.defineOption("ListFormatting", defaultOption, function (cm: cm_t, newVal: OptionValueType) {
  const enabled = !!newVal

  ///// convert newVal's type to `Partial<Options>`, if it is not.

  if (!enabled || typeof newVal === "boolean") {
    newVal = { enabled: enabled }
  }

  ///// apply config and write new values into cm

  var inst = getAddon(cm)
  for (var k in defaultOption) {
    inst[k] = (k in newVal) ? newVal[k] : defaultOption[k]
  }
});


/** ADDON GETTER (Singleton Pattern): a editor can have only one TableAlign instance */
export const getAddon = Addon.Getter("ListFormatting", ListFormatting, defaultOption)
declare global { namespace HyperMD { interface HelperCollection { ListFormatting?: ListFormatting } } }
