const PDFDocument = require('pdfkit');

function generateAccessLogsPdf(logs) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const document = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: false });

    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    const pageWidth = 595 - 80; // A4 width minus margins
    const pageHeight = 842; // A4 height
    const maxY = 790; // Higher limit for more content per page (footer starts at 812)
    const topMargin = 40;
    const startYPage1 = 180; // Y position untuk page 1 setelah statistik
    const startYPageN = 108; // Y position untuk page 2+ (closer to header)
    
    const now = new Date();
    const generatedDate = now.toLocaleString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let pageNumber = 1;
    
    // Function untuk tambah header halaman
    function addPageHeader() {
      document.fontSize(18).font('Helvetica-Bold').fillColor('#000000');
      document.text('SMART GATE PORTAL', 40, 40, { align: 'center' });
      
      document
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#000000')
        .text('Sistem Manajemen Akses Kendaraan Terintegrasi', 40, 64, { align: 'center' });
      
      document
        .fontSize(8)
        .fillColor('#666666')
        .text('Laporan Riwayat Validasi Akses Kendaraan', 40, 79, { align: 'center' });
      
      // Garis pemisah horizontal
      document
        .moveTo(40, 95)
        .lineTo(555, 95)
        .strokeColor('#cccccc')
        .stroke();
    }

    // Function untuk add footer dengan page number
    function addPageFooter(currentPageNum) {
      document.fontSize(7).font('Helvetica').fillColor('#999999');
      document.text(`Halaman ${currentPageNum}`, 40, pageHeight - 30, { align: 'center' });
      document.text(`${generatedDate}`, 40, pageHeight - 20, { align: 'center' });
    }

    // ============ HALAMAN 1: HEADER & STATISTIK ============
    document.addPage();
    addPageHeader();
    
    // Info laporan  
    let y = startYPage1;
    document.fontSize(8).font('Helvetica').fillColor('#000000');
    document.text(`Tanggal Laporan : ${generatedDate}`, 45, y);
    y += 12;
    
    const validLogs = logs.filter(l => l.status === 'VALID').length;
    const invalidLogs = logs.filter(l => l.status === 'INVALID').length;
    const manualLogs = logs.filter(l => l.status === 'MANUAL_OPEN').length;

    // ============ STATISTIK ============
    const statBoxY = y;
    document.rect(40, statBoxY, pageWidth, 60).fill('#f0f4ff');
    
    document.fontSize(8).font('Helvetica-Bold').fillColor('#1046b8');
    document.text('STATISTIK RINGKAS', 50, statBoxY + 5);

    document.fontSize(7).font('Helvetica').fillColor('#000000');
    const col1Stat = 50;
    const col2Stat = 200;
    const col3Stat = 350;
    
    document.text(`Total Entri`, col1Stat, statBoxY + 22);
    document.text(`Entry Valid`, col2Stat, statBoxY + 22, { continued: false });
    document.text(`Entry Invalid`, col3Stat, statBoxY + 22);
    
    document.fontSize(12).font('Helvetica-Bold');
    document.fillColor('#1046b8').text(String(logs.length), col1Stat, statBoxY + 33);
    document.fillColor('#00875a').text(String(validLogs), col2Stat, statBoxY + 33);
    document.fillColor('#c84d11').text(String(invalidLogs), col3Stat, statBoxY + 33);
    
    document.fontSize(7).font('Helvetica').fillColor('#666666');
    document.text(`Manual: ${manualLogs}`, col1Stat, statBoxY + 49);

    y = statBoxY + 70;

    if (!logs.length) {
      document.fontSize(11).fillColor('#999999').text('Tidak ada data riwayat akses yang tersedia.', 40, y, { align: 'center' });
      addPageFooter(pageNumber);
      document.end();
      return;
    }

    // ============ TABEL DATA dengan MULTI-PAGE SUPPORT ============
    const col1 = 45;   // No
    const col2 = 85;   // Client
    const col3 = 145;  // Driver Name
    const col4 = 215;  // Plat BLE
    const col5 = 280;  // Plat OCR
    const col6 = 345;  // Status
    const col7 = 400;  // Waktu
    const col8 = 480;  // Muatan

    const rowHeight = 15;
    
    // Function untuk draw table header dengan fixed positioning
    function drawTableHeader(yPos) {
      document.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
      document.rect(40, yPos - 4, pageWidth, rowHeight).fill('#1046b8');
      
      document.fillColor('#ffffff').text('No', col1, yPos + 2, { width: 35 });
      document.text('Client', col2, yPos + 2, { width: 55 });
      document.text('Driver', col3, yPos + 2, { width: 45 });
      document.text('Plat BLE', col4, yPos + 2, { width: 60 });
      document.text('Plat OCR', col5, yPos + 2, { width: 60 });
      document.text('Status', col6, yPos + 2, { width: 50 });
      document.text('Waktu Masuk', col7, yPos + 2, { width: 75 });
      document.text('Muatan', col8, yPos + 2, { width: 75 });
      
      return yPos + rowHeight;
    }

    y = drawTableHeader(y);
    document.font('Helvetica').fontSize(6.5).fillColor('#000000');

    // Draw data rows with smart pagination
    logs.forEach((log, index) => {
      // Check if row fits on current page
      if (y + rowHeight > maxY) {
        // Add footer for current page
        addPageFooter(pageNumber);
        
        // Add new page
        document.addPage();
        pageNumber++;
        addPageHeader();
        
        // Start table on new page (more compact for page 2+)
        y = startYPageN;
        y = drawTableHeader(y);
        document.font('Helvetica').fontSize(6.5).fillColor('#000000');
      }

      // Alternating row colors
      if (index % 2 === 0) {
        document.rect(40, y - 3, pageWidth, rowHeight).fill('#f9f9f9');
      }

      document.fillColor('#000000');
      
      const noStr = String(index + 1);
      const clientStr = (log.client_id || '-').substring(0, 10);
      const driverStr = (log.driver_name || '-').substring(0, 8);
      const platBleStr = (log.plat_ble || '-').substring(0, 10);
      const platOcrStr = (log.plat_ocr || '-').substring(0, 10);
      const statusStr = log.status || '-';
      const waktuStr = log.waktu_masuk 
        ? new Date(log.waktu_masuk).toLocaleString('id-ID', { 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        : '-';
      const muatanStr = (log.muatan || '-').substring(0, 18);

      document.text(noStr, col1, y, { width: 35 });
      document.text(clientStr, col2, y, { width: 55 });
      document.text(driverStr, col3, y, { width: 45 });
      document.text(platBleStr, col4, y, { width: 60 });
      document.text(platOcrStr, col5, y, { width: 60 });
      
      const statusColor = 
        statusStr === 'VALID' ? '#00875a' : 
        statusStr === 'INVALID' ? '#c84d11' : 
        statusStr === 'MANUAL_OPEN' ? '#0066cc' : '#666666';
      
      document.fillColor(statusColor).text(statusStr, col6, y, { width: 50 });
      document.fillColor('#000000');
      document.text(waktuStr, col7, y, { width: 75 });
      document.text(muatanStr, col8, y, { width: 75 });

      y += rowHeight;
      document.font('Helvetica').fontSize(6.5).fillColor('#000000');
    });

    // Add final page footer
    addPageFooter(pageNumber);

    document.end();
  });
}

module.exports = {
  generateAccessLogsPdf
};
