export class TableUtilities {
  private cm: CodeMirror.Editor;
  private tableData: { cm: CodeMirror.Editor; startHandle: CodeMirror.LineHandle; lines: string[] };
  private tableElement: HTMLTableElement;
  private parseMarkdownRow: (line: string) => string[];

  constructor(
    cm: CodeMirror.Editor,
    tableData: { cm: CodeMirror.Editor; startHandle: CodeMirror.LineHandle; lines: string[] },
    tableElement: HTMLTableElement,
    parseMarkdownRow: (line: string) => string[],
    handleTableChange: (cm: CodeMirror.Editor, changeObj: any, lineHandle?: CodeMirror.LineHandle) => void
  ) {
    this.cm = cm;
    this.tableData = tableData;
    this.tableElement = tableElement;
    this.parseMarkdownRow = parseMarkdownRow;
  }

  public addRow(): void {
    const rowCount = this.tableElement.rows.length;
    const referenceRow = this.tableElement.rows[rowCount - 1]; // Use the last row as a reference
    const newRow = this.tableElement.insertRow();
  
    for (let i = 0; i < referenceRow.cells.length; i++) {
      const referenceCell = referenceRow.cells[i];
      const newCell = newRow.insertCell();
  
      // Copy attributes, styles, and classes from the reference cell
      newCell.className = referenceCell.className;
      newCell.contentEditable = referenceCell.contentEditable;
      newCell.style.cssText = referenceCell.style.cssText;
      newCell.textContent = ""; // Empty content for the new cell
    }
  
    // Update tableData
    const newRowMarkdown = "|   ".repeat(referenceRow.cells.length) + " |";
    this.tableData.lines.push(newRowMarkdown);
  }
  
  public addColumn(): void {
    const columnCount = this.tableElement.rows[0]?.cells.length || 0;
  
    for (const row of Array.from(this.tableElement.rows)) {
      const referenceCell = row.cells[columnCount - 1]; // Use the last cell in the row as a reference
      const newCell = row.insertCell();
  
      // Copy attributes, styles, and classes from the reference cell
      newCell.className = referenceCell.className;
      newCell.contentEditable = referenceCell.contentEditable;
      newCell.style.cssText = referenceCell.style.cssText;
      newCell.textContent = ""; // Empty content for the new cell
    }
  
    // Update tableData
    const { lines } = this.tableData;
    lines.forEach((line, index) => {
      const cells = this.parseMarkdownRow(line);
      cells.push(index === 1 ? ":--:" : "   ");
      this.tableData.lines[index] = "| " + cells.join(" | ") + " |";
    });
  }
  
  public insertRowAt(rowIndex: number): void {
    const referenceRow = this.tableElement.rows[rowIndex]; // Use the row at the specified index as a reference
    const newRow = this.tableElement.insertRow(rowIndex);
  
    for (let i = 0; i < referenceRow.cells.length; i++) {
      const referenceCell = referenceRow.cells[i];
      const newCell = newRow.insertCell();
  
      // Copy attributes, styles, and classes from the reference cell
      newCell.className = referenceCell.className;
      newCell.contentEditable = referenceCell.contentEditable;
      newCell.style.cssText = referenceCell.style.cssText;
      newCell.textContent = ""; // Empty content for the new cell
    }
  
    // Update tableData
    const newRowMarkdown = "|   ".repeat(referenceRow.cells.length) + " |";
    this.tableData.lines.splice(rowIndex, 0, newRowMarkdown);
  }
  
  public insertColumnAt(colIndex: number): void {
    for (const row of Array.from(this.tableElement.rows)) {
      const referenceCell = row.cells[colIndex]; // Use the cell at the specified index as a reference
      const newCell = row.insertCell(colIndex);
  
      // Copy attributes, styles, and classes from the reference cell
      newCell.className = referenceCell.className;
      newCell.contentEditable = referenceCell.contentEditable;
      newCell.style.cssText = referenceCell.style.cssText;
      newCell.textContent = ""; // Empty content for the new cell
    }
  
    // Update tableData
    const { lines } = this.tableData;
    lines.forEach((line, index) => {
      const cells = this.parseMarkdownRow(line);
      cells.splice(colIndex, 0, index === 1 ? ":--:" : "   ");
      this.tableData.lines[index] = "| " + cells.join(" | ") + " |";
    });
  }
  


  public removeRow(): void {
    if (this.tableElement.rows.length > 1) {
      this.tableElement.deleteRow(this.tableElement.rows.length - 1);

      // Update tableData
      if (this.tableData.lines.length > 2) {
        this.tableData.lines.pop();
      }
    }
  }

  public removeColumn(): void {
    const columnCount = this.tableElement.rows[0]?.cells.length || 0;

    if (columnCount > 1) {
      for (const row of Array.from(this.tableElement.rows)) {
        row.deleteCell(columnCount - 1);
      }

      // Update tableData
      const { lines } = this.tableData;
      lines.forEach((line, index) => {
        const cells = this.parseMarkdownRow(line);
        if (cells.length > 1) {
          cells.pop();
          this.tableData.lines[index] = "| " + cells.join(" | ") + " |";
        }
      });
    }
  }

  public removeRowAt(rowIndex: number): void {
    if (rowIndex >= 0 && rowIndex < this.tableElement.rows.length) {
      this.tableElement.deleteRow(rowIndex);

      // Update tableData
      this.tableData.lines.splice(rowIndex, 1);
    }
  }

  public removeColumnAt(colIndex: number): void {
    const columnCount = this.tableElement.rows[0]?.cells.length || 0;

    if (colIndex >= 0 && colIndex < columnCount) {
      for (const row of Array.from(this.tableElement.rows)) {
        row.deleteCell(colIndex);
      }

      // Update tableData
      const { lines } = this.tableData;
      lines.forEach((line, index) => {
        const cells = this.parseMarkdownRow(line);
        if (cells.length > colIndex) {
          cells.splice(colIndex, 1);
          this.tableData.lines[index] = "| " + cells.join(" | ") + " |";
        }
      });
    }
  }
}
