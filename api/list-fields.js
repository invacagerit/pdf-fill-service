// ============================================================
// Función serverless de Vercel: lista TODOS los campos AcroForm
// de un PDF (nombre técnico + tipo + página). Solo para depuración.
// ============================================================
// Recibe (POST): { pdfBase64: "..." }
// Devuelve: { total: N, fields: [{ name, type, page }, ...] }
// ============================================================

import { PDFDocument } from 'pdf-lib';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb'
    }
  }
};

function getFieldPage(pdfDoc, field, pageRefToIndex) {
  try {
    const widgets = field.acroField.getWidgets();
    for (const widget of widgets) {
      const pageRef = widget.P();
      if (pageRef && pageRefToIndex.has(pageRef)) {
        return pageRefToIndex.get(pageRef);
      }
    }
  } catch (e) {
    // ignorar, devolvemos null
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido, usa POST' });
    return;
  }

  try {
    const { pdfBase64 } = req.body;

    if (!pdfBase64) {
      res.status(400).json({ error: 'Falta "pdfBase64" en el body.' });
      return;
    }

    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    const pages = pdfDoc.getPages();
    const pageRefToIndex = new Map();
    pages.forEach((p, i) => pageRefToIndex.set(p.ref, i + 1));

    const fields = form.getFields().map(f => ({
      name: f.getName(),
      type: f.constructor.name,
      page: getFieldPage(pdfDoc, f, pageRefToIndex)
    }));

    res.status(200).json({ total: fields.length, fields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
