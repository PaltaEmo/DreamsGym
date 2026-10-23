const PDFDocument = require('pdfkit');

function generarPDFReservas(res, reservas) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=reservas_gimnasio_dreams.pdf');
    doc.pipe(res);

    doc.fillColor('#0b132b').rect(0, 0, 595.28, 70).fill();
    doc.fillColor('#d4af37').fontSize(16).text('GIMNASIO CASINO DREAMS - RESERVAS ACTIVAS', 40, 24);
    doc.fillColor('#ffffff').fontSize(9).text('Control de aforo: máximo 4 personas por turno', 40, 46);

    let y = 100;
    doc.fillColor('#141e3c').rect(40, y, 515, 24).fill();
    doc.fillColor('#d4af37').fontSize(10).font('Helvetica-Bold')
       .text('DÍA / FECHA', 50, y + 7)
       .text('HORA', 180, y + 7)
       .text('NOMBRE DE QUIEN TOMÓ LA HORA', 340, y + 7);

    y += 26;
    doc.font('Helvetica').fontSize(9).fillColor('#111827');

    reservas.forEach((r, idx) => {
        if (y > 760) {
            doc.addPage();
            y = 50;
        }

        if (idx % 2 === 0) {
            doc.fillColor('#f8fafc').rect(40, y, 515, 20).fill();
        }

        const fStr = r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : String(r.fecha);
        const hStr = `${String(r.hora_inicio).padStart(2, '0')}:00 - ${String((r.hora_inicio + 1) % 24).padStart(2, '0')}:00`;

        doc.fillColor('#111827')
           .text(fStr, 50, y + 5)
           .text(hStr, 180, y + 5)
           .text(r.nombre_completo, 340, y + 5);

        y += 22;
    });

    doc.end();
}

module.exports = { generarPDFReservas };