// src/hooks/useBomParser.js
// Parsea el Excel exportado por SolidWorks usando SheetJS.
// Excluye las columnas que el ERP maneja internamente.

import * as XLSX from 'xlsx'

const EXCLUDED = ['procesos', 'tratamientos', 'configuración', 'configuracion', 'ubicación', 'ubicacion']
const FIXED_COLS = {
  item:        ['item', 'ítem', 'pos', 'nro item', 'nro. item'],
  codigo:      ['codigo', 'código', 'part number', 'part no'],
  descripcion: ['descripcion', 'descripción', 'description'],
  cantidad:    ['cantidad', 'qty', 'cant'],
  tipo:        ['tipo'],
  material:    ['material', 'mat', 'materiales'],
  peso:        ['peso', 'weight', 'masa'],
}

function findCol(headers, aliases) {
  const lower = headers.map(h => h.toLowerCase().trim())
  for (const alias of aliases) {
    const idx = lower.indexOf(alias)
    if (idx !== -1) return headers[idx]
  }
  return null
}

export function parseBomExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
        if (!rows.length) return reject(new Error('El archivo está vacío'))

        const allHeaders = Object.keys(rows[0])
        const headers = allHeaders.filter(
          h => !EXCLUDED.includes(h.toLowerCase().trim())
        )

        const colMap = {}
        for (const [key, aliases] of Object.entries(FIXED_COLS)) {
          colMap[key] = findCol(headers, aliases)
        }

        const extraHeaders = headers.filter(
          h => !Object.values(colMap).includes(h)
        )

        const items = rows.slice(0, 300).map((row, idx) => {
          const extra = {}
          extraHeaders.forEach(h => { if (row[h] !== '') extra[h] = row[h] })

          return {
            _tempId:     crypto.randomUUID(),
            numero_item: parseInt(row[colMap.item] ?? idx + 1) || idx + 1,
            codigo_pieza: String(row[colMap.codigo] ?? '').trim(),
            descripcion:  String(row[colMap.descripcion] ?? '').trim(),
            cantidad:     parseFloat(row[colMap.cantidad] ?? 1) || 1,
            tipo:         colMap.tipo ? String(row[colMap.tipo] ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '') : '',
            material:     colMap.material ? String(row[colMap.material] ?? '').trim() : '',
            peso:         colMap.peso ? String(row[colMap.peso] ?? '').trim() : '',
            columnas_extra: extra,
            operaciones:  [],
            dwg_file:     null,
            dwg_vigente:  null,
          }
        })

        resolve({ items, extraHeaders })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}
