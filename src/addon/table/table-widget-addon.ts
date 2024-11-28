import { TableWidget } from './table-widget'; // Adjust the path as necessary

export class TableWidgetAddon {
  private tableWidget: TableWidget;
  private editor: any; // Type of the editor instance (e.g., HyperMD editor)

  constructor(editor: any) {
    this.editor = editor;
    this.tableWidget = new TableWidget(editor);
    
    // Hook into editor changes to render tables
    this.editor.on('changes', () => {
      this.renderTables();
    });
  }

  /**
   * Detects tables in the document and renders the table using TableWidget
   */
  public renderTables(): void {
    const markdownText: string = this.editor.getDoc().getValue(); // Get the full markdown content
    const tableMarkdown: string | null = this.extractTableMarkdown(markdownText);

    if (tableMarkdown) {
      this.tableWidget.render(); // Render the table widget
    }
  }

  /**
   * Extracts only the table markdown from the editor's full markdown content
   * @param markdown - The markdown string from the editor
   * @returns Extracted table markdown
   */
  private extractTableMarkdown(markdown: string): string | null {
    const lines: string[] = markdown.split('\n');
    let isInTable = false;
    let tableMarkdown = '';

    lines.forEach(line => {
      if (line.startsWith('|')) {
        isInTable = true;
        tableMarkdown += line + '\n';
      } else if (isInTable) {
        isInTable = false;
      }
    });

    return tableMarkdown || null;
  }

  /**
   * Inserts a new row at the specified position in the active table.
   * @param position - The index where the row should be inserted
   */
  public insertRow(position: number): void {
    this.tableWidget.insertRow(position);
  }

  /**
   * Inserts a new column at the specified position in the active table.
   * @param position - The index where the column should be inserted
   */
  public insertColumn(position: number): void {
    this.tableWidget.insertColumn(position);
  }
}

// /** ADDON GETTER (Singleton Pattern): a editor can have only one TableWidgetAddon instance */
// export const getAddon = (editor: any): TableWidgetAddon => {
//   return new TableWidgetAddon(editor);
// };

// declare global {
//   namespace HyperMD {
//     interface HelperCollection {
//       TableWidgetAddon?: TableWidgetAddon;
//     }
//   }
// }
