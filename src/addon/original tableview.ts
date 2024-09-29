/** CodeMirror renderLine event handler */
  private _procLine = (cm: cm_t, line: LineHandle, el: HTMLPreElement) => {
    if (!el.querySelector('.cm-hmd-table-sep')) return
    const lineSpan = el.firstElementChild
    const lineSpanChildren = Array.prototype.slice.call(lineSpan.childNodes, 0) as Node[]

    const eolState = cm.getStateAfter(line.lineNo()) as HyperMDState
    const columnStyles = eolState.hmdTableColumns
    const tableID = eolState.hmdTableID

    var columnIdx = eolState.hmdTable === TableType.NORMAL ? -1 : 0
    var columnSpan = this.makeColumn(columnIdx, columnStyles[columnIdx] || "dummy", tableID)
    var columnContentSpan = columnSpan.firstElementChild
    for (const el of lineSpanChildren) {
      const elClass = el.nodeType === Node.ELEMENT_NODE && (el as HTMLElement).className || ""
      if (/cm-hmd-table-sep/.test(elClass)) {
        // found a "|", and a column is finished
        columnIdx++
        columnSpan.appendChild(columnContentSpan)
        lineSpan.appendChild(columnSpan)
        lineSpan.appendChild(el)

        columnSpan = this.makeColumn(columnIdx, columnStyles[columnIdx] || "dummy", tableID)
        columnContentSpan = columnSpan.firstElementChild
      } else {
        columnContentSpan.appendChild(el)
      }
    }
    columnSpan.appendChild(columnContentSpan)
    lineSpan.appendChild(columnSpan)
  }

  /**
   * create a <span> container as column,
   * note that put content into column.firstElementChild
   */
  makeColumn(index: number, style: string, tableID: string): HTMLSpanElement {
    var span = document.createElement("span")
    span.className = `hmd-table-column hmd-table-column-${index} hmd-table-column-${style}`
    span.setAttribute("data-column", "" + index)
    span.setAttribute("data-table-id", tableID)

    var span2 = document.createElement("span")
    span2.className = "hmd-table-column-content"
    span2.setAttribute("data-column", "" + index)

    span.appendChild(span2)
    return span
  }
