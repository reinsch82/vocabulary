/* global module, require, Buffer */
const PDFDocument = require('pdfkit');

// A4 in pt
const MARGIN = 40;
const FOOTER = 30;
const PAD = 6;
const LINE_GAP = 24; // distance between writing lines (~8.5 mm)
const HANDWRITING = 1.8; // handwriting is wider than the printed font
const FONT_SIZE = 10.5;

const COL_NR = 26;
const COL_DE = 220;

module.exports = {
  // withSolutions = false: worksheet with empty lines to write on
  // withSolutions = true: same layout, with the english phrase filled in
  toPDF: (buffer, withSolutions = false) => {
    // copy-webpack-plugin passes a buffer
    const data = JSON.parse(buffer.toString());
    // entries without an example sentence are phrases themselves ("Good idea."), so use those directly
    const rows = data.words
      .map((word) =>
        word.example && word.example_de
          ? { de: word.example_de, en: word.example }
          : { de: word.de, en: word.en },
      )
      .filter((row) => row.de && row.en);

    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      bufferPages: true,
      info: { Title: data.name },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const left = MARGIN;
    const width = doc.page.width - 2 * MARGIN;
    const colEn = width - COL_NR - COL_DE;
    const xDe = left + COL_NR;
    const xEn = xDe + COL_DE;
    const bottom = doc.page.height - MARGIN - FOOTER;

    // title
    doc.font('Helvetica-Bold').fontSize(16).text(data.name, left, MARGIN);
    doc
      .font('Helvetica')
      .fontSize(10)
      .moveDown(0.3)
      .text(
        withSolutions
          ? 'Lösungen'
          : 'Übersetze die Sätze ins Englische.          ' +
              'Name: ______________________   Datum: ____________',
      );
    let y = doc.y + 12;

    const tableHeader = () => {
      doc.rect(left, y, width, 20).fill('#e6e6e6');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(FONT_SIZE);
      doc.text('Nr.', left + PAD, y + 5, { width: COL_NR - PAD, lineBreak: false });
      doc.text('Deutsch', xDe + PAD, y + 5, { lineBreak: false });
      doc.text('Englisch', xEn + PAD, y + 5, { lineBreak: false });
      y += 20;
    };

    tableHeader();
    doc.font('Helvetica').fontSize(FONT_SIZE);

    rows.forEach((row, i) => {
      const textW = colEn - 2 * PAD;
      const deH = doc.heightOfString(row.de, { width: COL_DE - 2 * PAD });
      // estimate how much room the handwritten answer needs
      const lines = Math.max(
        1,
        Math.ceil((doc.widthOfString(row.en) * HANDWRITING) / textW),
      );
      const rowH = Math.max(deH + 2 * PAD, lines * LINE_GAP + PAD);

      if (y + rowH > bottom) {
        doc.addPage();
        y = MARGIN;
        tableHeader();
        doc.font('Helvetica').fontSize(FONT_SIZE);
      }

      // cell borders
      doc.lineWidth(0.5).strokeColor('#999999');
      doc.rect(left, y, width, rowH).stroke();
      doc.moveTo(xDe, y).lineTo(xDe, y + rowH).stroke();
      doc.moveTo(xEn, y).lineTo(xEn, y + rowH).stroke();

      doc.fillColor('black');
      doc.text(`${i + 1}`, left + PAD, y + PAD, { width: COL_NR - PAD });
      doc.text(row.de, xDe + PAD, y + PAD, { width: COL_DE - 2 * PAD });

      if (withSolutions) {
        doc.text(row.en, xEn + PAD, y + PAD, { width: textW });
      } else {
        // writing lines
        doc.strokeColor('#bbbbbb').dash(1, { space: 2 });
        for (let l = 1; l <= lines; l++) {
          const ly = y + l * LINE_GAP;
          doc.moveTo(xEn + PAD, ly).lineTo(xEn + colEn - PAD, ly).stroke();
        }
        doc.undash();
      }

      y += rowH;
    });

    // footer with page numbers
    const range = doc.bufferedPageRange();
    for (let p = 0; p < range.count; p++) {
      doc.switchToPage(p);
      doc.page.margins.bottom = 0;
      doc
        .fillColor('#666666')
        .fontSize(8)
        .text(
          `${data.name}${withSolutions ? ' – Lösungen' : ''} · Seite ${p + 1} von ${range.count}`,
          left,
          doc.page.height - MARGIN - 10,
          { width, align: 'center', lineBreak: false },
        );
    }

    doc.end();
    return done;
  },
};
