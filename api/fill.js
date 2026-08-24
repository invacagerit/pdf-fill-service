// ============================================================
// Función serverless de Vercel: rellena campos AcroForm de un PDF
// Reemplaza la llamada a PDF.co, sin costo y sin tarjeta.
// ============================================================
// Recibe (POST): { pdfBase64: "...", fields: [{ fieldName, value }, ...] }
// Devuelve: { pdfBase64: "...", notFound: ["campo1", ...] }
// ============================================================

import { PDFDocument } from 'pdf-lib';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb'
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido, usa POST' });
    return;
  }

  try {
    const { pdfBase64, fields } = req.body;

    if (!pdfBase64 || !Array.isArray(fields)) {
      res.status(400).json({ error: 'Faltan "pdfBase64" o "fields" en el body.' });
      return;
    }

    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    const notFound = [];

    for (const { fieldName, value } of fields) {
      try {
        const field = form.getField(fieldName);
        const type = field.constructor.name;

        if (type === 'PDFTextField') {
          field.setText(value === undefined || value === null ? '' : String(value));
        } else if (type === 'PDFCheckBox') {
          const truthy = ['true', '1', 'yes', 'si', 'sí', 'x'].includes(String(value).toLowerCase());
          truthy ? field.check() : field.uncheck();
        } else if (type === 'PDFDropdown' || type === 'PDFOptionList') {
          field.select(String(value));
        } else if (field.setText) {
          field.setText(String(value ?? ''));
        }
      } catch (e) {
        notFound.push(fieldName);
      }
    }

    form.updateFieldAppearances();

    const outBytes = await pdfDoc.save();

    res.status(200).json({
      pdfBase64: Buffer.from(outBytes).toString('base64'),
      notFound
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
