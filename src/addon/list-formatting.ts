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

    // the below condition is to handle when there is a list text but user move the cursor to start of the text and try to give space
    // as a workaround it will add only &nbsp; after '*' but it will not affect since it wont allow more spaces at the start of the txt in the list
    if (change.origin === "+input") {
      const cursor = cm.getCursor();
      const line = cm.getLine(cursor.line);
      if(/^\s*(?:[*\-+]|[0-9]+[.)])\s+(?!\[)/.test(line) && change.text[0] === " ") {

        // check the change index from the bullet token or number token
        // it will work for numbers only for 1 digit, more than 1 digit is not handled now
        const index = line.search(/[*\-+]|[0-9]+[.)]/);
        // max allowed index for bullets is index + 3 else it is index + 4;
        let max_allowed_index = line.trim().search(/[*\-+]/)===0?index+3:index+4;
        
        if(change.from.ch<=(max_allowed_index)) {
          
          // Check for lines starting with tabs/spaces, followed by 'token'
          const match = line.match(/^\t*([*\-+]|[0-9]+[.)])\s{2,}/);
          const isSingleSpace = line.match(/^\t*([*\-+]|[0-9]+[.)])\s\S/);
          
          if (match && !isSingleSpace) {
            // Prevent default behavior for lines with multiple spaces after '*'
            change.update(change.from, change.to, [""]);

            // Add your custom handling here
            console.log("Multiple spaces after '*', handling triggered.");
          }
        }
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
