// ============================================================
// Servicio gratuito de relleno de PDF (reemplaza a PDF.co)
// ============================================================
// Recibe: { pdfBase64: "...", fields: [{ fieldName, value }, ...] }
// Devuelve: { pdfBase64: "...", notFound: ["campo1", ...] }
// ============================================================

import express from 'express';
import bodyParser from 'body-parser';
import { PDFDocument } from 'pdf-lib';

const app = express();

// Los PDFs en base64 pueden pesar varios MB, subimos el límite del body
app.use(bodyParser.json({ limit: '50mb' }));

app.post('/fill', async (req, res) => {
  try {
    const { pdfBase64, fields } = req.body;

    if (!pdfBase64 || !Array.isArray(fields)) {
      return res.status(400).json({ error: 'Faltan "pdfBase64" o "fields" en el body.' });
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
          // Fallback por si aparece un tipo no contemplado arriba
          field.setText(String(value ?? ''));
        }
      } catch (e) {
        // El campo no existe en este PDF (o no es rellenable) — lo anotamos
        // pero seguimos con los demás en vez de abortar todo el proceso.
        notFound.push(fieldName);
      }
    }

    // Regenera la apariencia visual de los campos para que el texto se
    // vea correctamente en cualquier lector de PDF (Adobe, navegador, etc.)
    form.updateFieldAppearances();

    const outBytes = await pdfDoc.save();

    res.json({
      pdfBase64: Buffer.from(outBytes).toString('base64'),
      notFound
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint simple para confirmar que el servicio está vivo
app.get('/', (req, res) => res.send('PDF Fill Service OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Escuchando en el puerto ${PORT}`));
