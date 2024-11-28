// Define the interface for a cell object
interface CellObject {
    row: number;
    col: number;
    start: number; // start position in the document
    end: number;   // end position in the document
  }
  
  export class TableWidget {
    private editor: any;                  // Editor instance (e.g., HyperMD editor)
    private doc: any;                     // Document from the editor
    private containerEl: HTMLElement | null; // The container where tables are rendered
    private rows: CellObject[][];         // Array to hold the rows of the table
    private alignments: string[];         // Alignment for each column (left, right, center)
    private colWidths: number[];          // Width of each column
    private tableEl: HTMLTableElement | null; // Holds the HTML Table element
  
    constructor(editor: any) {
      this.editor = editor;
      this.doc = editor.getDoc();
      this.containerEl = null;
      this.rows = [];
      this.alignments = [];
      this.colWidths = [];
      this.tableEl = null;
    }
  
    /**
     * Render the table in the editor based on markdown content
     */
    public render(): void {
      this.clear(); // Clear previous table if any
  
      const n = this.doc;
      const container = this.containerEl || document.createElement('div');
      container.classList.add('table-container');
      this.containerEl = container;
  
      const markdownText: string = n.getValue();  // Get the editor's text content (markdown)
      const tableMarkdown: string | null = this.extractTableMarkdown(markdownText);  // Extract the markdown for table
  
      if (tableMarkdown) {
        const parsedTable: string[][] = this.parseTable(tableMarkdown);  // Parse the markdown to extract rows and cells
        this.buildTable(parsedTable);
      }
  
      this.editor.getWrapperElement().appendChild(container);  // Append to the editor container
    }

    // Add this method to the TableWidget class

/**
 * Renders a markdown table line into an HTML table.
 * 
 * @param markdown - A single line of markdown representing a table row.
 * @returns The generated HTML table as a string.
 */
public renderTableFromMarkdown(markdown: string): string {
    // Create a new table element
    const table = document.createElement('table');
    table.classList.add('table-editor'); // Add a class for styling

    // Parse the markdown string to extract cells
    const cells = markdown.split('|').filter(cell => cell.trim() !== ''); // Split by pipe and remove empty cells

    // Create a row for the table
    const row = document.createElement('tr');

    // Populate the row with cells
    cells.forEach((cellContent) => {
        const cell = document.createElement('td');
        cell.textContent = cellContent.trim(); // Set cell text content
        cell.setAttribute('contenteditable', 'true'); // Make cell editable
        row.appendChild(cell); // Append cell to the row
    });

    // Append the row to the table
    table.appendChild(row);

    // Return the outer HTML of the table
    return table.outerHTML; // Return the HTML string of the table
}

  
    /**
     * Clear previous table or container content
     */
    private clear(): void {
      if (this.containerEl) {
        this.containerEl.innerHTML = '';  // Clear the inner HTML content
      }
      this.rows = [];  // Reset the rows array
    }
  
    /**
     * Parse the markdown text to create the table structure
     * @param markdownText - table markdown
     * @returns Parsed table structure
     */
    private parseTable(markdownText: string): string[][] {
      const lines: string[] = markdownText.split('\n');
      const tableData: string[][] = [];
  
      lines.forEach(line => {
        if (line.startsWith('|')) {
          const cells: string[] = line.split('|').filter(Boolean).map(cell => cell.trim());
          tableData.push(cells);
        }
      });
  
      return tableData;
    }
  
    /**
     * Build the HTML table from the parsed data
     * @param tableData - Parsed table rows and cells
     */
    private buildTable(tableData: string[][]): void {
      const table: HTMLTableElement = document.createElement('table');
      table.classList.add('table-editor');
      const tbody: HTMLTableSectionElement = document.createElement('tbody');
  
      tableData.forEach((rowData, rowIndex) => {
        const row: HTMLTableRowElement = document.createElement('tr');
        this.rows.push([]);
  
        rowData.forEach((cellData, colIndex) => {
          const cell: HTMLTableCellElement = document.createElement('td');
          cell.textContent = cellData;
  
          // Create the cell object to track start and end positions
          const cellObject: CellObject = {
            row: rowIndex,
            col: colIndex,
            start: -1,  // To be replaced with the actual positions
            end: -1,
          };
  
          this.rows[rowIndex].push(cellObject);
          row.appendChild(cell);
        });
  
        tbody.appendChild(row);
      });
  
      table.appendChild(tbody);
      this.tableEl = table;
      this.containerEl.appendChild(table);
    }
  
    /**
     * Insert a row at the specified position
     * @param rowIndex - Index where the row should be inserted
     */
    public insertRow(rowIndex: number): void {
      const table: HTMLTableElement = this.tableEl!;
      const tbody: HTMLTableSectionElement = table.querySelector('tbody')!; // Non-null assertion
  
      const row: HTMLTableRowElement = document.createElement('tr');
      const colCount: number = this.rows[0].length;
  
      for (let i = 0; i < colCount; i++) {
        const cell: HTMLTableCellElement = document.createElement('td');
        cell.textContent = '';  // Empty new row cells
        row.appendChild(cell);
  
        // Add the new cell object
        const cellObject: CellObject = {
          row: rowIndex,
          col: i,
          start: -1,  // To be calculated
          end: -1,
        };
        this.rows[rowIndex].push(cellObject);
      }
  
      tbody.insertBefore(row, tbody.childNodes[rowIndex] || null);  // Insert at the specified index
    }
  
    /**
     * Insert a column at the specified position
     * @param colIndex - Index where the column should be inserted
     */
    public insertColumn(colIndex: number): void {
      const table: HTMLTableElement = this.tableEl!;
      const rows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll('tr');
  
      rows.forEach((row: HTMLTableRowElement, rowIndex: number) => {
        const cell: HTMLTableCellElement = document.createElement('td');
        cell.textContent = '';  // Empty new column cells
        row.insertBefore(cell, row.childNodes[colIndex] || null);
  
        // Add the new cell object
        const cellObject: CellObject = {
          row: rowIndex,
          col: colIndex,
          start: -1,  // To be calculated
          end: -1,
        };
        this.rows[rowIndex].splice(colIndex, 0, cellObject);  // Insert into the rows array
      });
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
  }
  