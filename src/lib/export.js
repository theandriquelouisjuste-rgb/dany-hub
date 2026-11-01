import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportCSV(filename, columns, rows) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [columns.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportPDF(filename, title, columns, rows, subtitle = '') {
  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.text(title, 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(subtitle || `DANY HUB — ${new Date().toLocaleDateString('fr-FR')}`, 14, 25)
  autoTable(doc, {
    startY: 31,
    head: [columns],
    body: rows.map((r) => r.map((c) => String(c ?? ''))),
    headStyles: { fillColor: [8, 145, 178] },
    styles: { fontSize: 9 },
  })
  doc.save(filename)
}

// Montants simples pour PDF (évite les espaces insécables non supportés)
export const plain = (n) => (Number(n) || 0).toFixed(2)
