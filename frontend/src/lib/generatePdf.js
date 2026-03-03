
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';

// Main function to generate the tournament regulation PDF
export const generateDocument = async (tournamentData, athletes) => {
  if (!tournamentData || typeof tournamentData.name === 'undefined') {
    alert('PDF генерациясы үшін турнир деректері толық емес. Мәліметтерді сақтап, қайталап көріңіз.');
    console.error("generateDocument was called with invalid tournamentData:", tournamentData);
    return;
  }

  // --- PDF & FONT SETUP ---
  const pdfDoc = await PDFDocument.create();
  const customFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  let page = pdfDoc.addPage();
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const margin = 50;
  let y = pageHeight - margin;

  const black = rgb(0, 0, 0);

  // --- HELPER FUNCTIONS ---
  const addPageIfNeeded = (requiredHeight) => {
    if (y - requiredHeight < margin) {
      page = pdfDoc.addPage();
      y = pageHeight - margin;
    }
  };

  const drawCenteredText = (text, fontSize) => {
    const textWidth = customFont.widthOfTextAtSize(text, fontSize);
    addPageIfNeeded(fontSize * 2);
    page.drawText(text, {
      x: (pageWidth - textWidth) / 2,
      y: y,
      font: customFont,
      size: fontSize,
      color: black,
    });
    y -= fontSize * 1.5;
  };

  const drawSectionTitle = (text) => {
    const fontSize = 12;
    addPageIfNeeded(fontSize * 2.5);
    y -= fontSize * 0.5; // Extra space before title
    page.drawText(text, {
      x: margin,
      y: y,
      font: customFont,
      size: fontSize,
      color: black,
    });
    y -= fontSize * 1.5;
  };
  
  const drawText = (text) => {
    const fontSize = 10;
    const maxWidth = pageWidth - margin * 2;
    
    const words = text.split(' ');
    let line = '';
    
    for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = customFont.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth) {
            addPageIfNeeded(fontSize * 1.5);
            page.drawText(line, { x: margin, y: y, font: customFont, size: fontSize, color: black });
            y -= fontSize * 1.2;
            line = word + ' ';
        } else {
            line = testLine;
        }
    }
    addPageIfNeeded(fontSize * 1.5);
    page.drawText(line, { x: margin, y: y, font: customFont, size: fontSize, color: black });
    y -= fontSize * 1.5;
  };


  // --- 1. PDF Header ---
  drawCenteredText('ПОЛОЖЕНИЕ', 16);
  drawCenteredText(`о проведении открытого турнира по дзюдо`, 12);
  drawCenteredText(`"${tournamentData.name || ''}"`, 14);
  y -= 10;

  // --- 2. Date and Location ---
  const dateText = tournamentData.date ? new Date(tournamentData.date).toLocaleDateString('ru-RU') : '';
  const dateTextWidth = customFont.widthOfTextAtSize(dateText, 11);
  addPageIfNeeded(20);
  page.drawText(tournamentData.location || '', { x: margin, y: y, font: customFont, size: 11, color: black });
  page.drawText(dateText, { x: pageWidth - margin - dateTextWidth, y: y, font: customFont, size: 11, color: black });
  y -= 25;

  // --- 3. Main Content Sections ---
  if (tournamentData.goals) {
    drawSectionTitle('1. Мақсаттар мен міндеттер');
    drawText(tournamentData.goals);
  }

  if (tournamentData.participants) {
    drawSectionTitle('2. Қатысушылар мен талаптар');
    drawText(tournamentData.participants);
  }

  drawSectionTitle('3. Бағдарлама және салмақ дәрежелері');
  if (tournamentData.program) {
    drawText(tournamentData.program);
  }
  
  if (tournamentData.divisions && tournamentData.divisions.length > 0) {
      y -= 10;
      for (const division of tournamentData.divisions) {
          const header = `${division.gender}, ${division.ageGroup} (Белдесу уақыты: ${division.duration} мин.)`;
          const weights = division.weights.join(', ');
          
          addPageIfNeeded(40);

          page.drawRectangle({
              x: margin,
              y: y - 18,
              width: pageWidth - margin * 2,
              height: 20,
              color: rgb(0.08, 0.2, 0.34),
          });
          const headerWidth = customFont.widthOfTextAtSize(header, 11);
          page.drawText(header, { x: (pageWidth - headerWidth)/2 , y: y - 14, font: customFont, size: 11, color: rgb(1, 1, 1) });

          page.drawRectangle({
              x: margin,
              y: y - 38,
              width: pageWidth - margin * 2,
              height: 20,
              borderColor: rgb(0.8, 0.8, 0.8),
              borderWidth: 1,
          });
          const weightsWidth = customFont.widthOfTextAtSize(weights, 10);
           page.drawText(weights, { x: (pageWidth - weightsWidth)/2 , y: y - 32, font: customFont, size: 10, color: black });
          
          y -= 45;
      }
  } else {
      drawText("Салмақ дәрежелері анықталмаған.");
  }


  if (tournamentData.awarding) {
    drawSectionTitle('4. Марапаттау');
    drawText(tournamentData.awarding);
  }

  if (tournamentData.financing) {
    drawSectionTitle('5. Қаржыландыру');
    drawText(tournamentData.financing);
  }
  
    if (athletes && athletes.length > 0) {
    page = pdfDoc.addPage();
    y = pageHeight - margin;
    drawSectionTitle('Тіркелген спортшылар');
    
    const tableTop = y;
    const rowHeight = 20;
    const tableBottom = margin;
    const tableWidth = pageWidth - margin * 2;
    
    // Draw table header
    page.drawRectangle({ x: margin, y: y - rowHeight, width: tableWidth, height: rowHeight, color: rgb(0.08, 0.2, 0.34) });
    page.drawText('Аты-жөні', { x: margin + 5, y: y - 15, font: customFont, size: 10, color: rgb(1,1,1) });
    page.drawText('Туған жылы', { x: margin + 200, y: y - 15, font: customFont, size: 10, color: rgb(1,1,1) });
    page.drawText('Клуб', { x: margin + 400, y: y - 15, font: customFont, size: 10, color: rgb(1,1,1) });
    y -= rowHeight;

    // Draw table rows
    for (const athlete of athletes) {
      addPageIfNeeded(rowHeight);
      page.drawRectangle({ x: margin, y: y - rowHeight, width: tableWidth, height: rowHeight, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
      page.drawText(athlete.name, { x: margin + 5, y: y - 15, font: customFont, size: 10, color: black });
      page.drawText(athlete.yob, { x: margin + 200, y: y - 15, font: customFont, size: 10, color: black });
      page.drawText(athlete.club || '', { x: margin + 400, y: y - 15, font: customFont, size: 10, color: black });
      y -= rowHeight;
    }
  }

  // --- 4. Signatures ---
  addPageIfNeeded(80);
  y = margin + 60;

  const leftText = tournamentData.presidentTitle || 'Бекітілді';
  const rightText = tournamentData.secretaryTitle || 'Келісілді';
  const presName = tournamentData.presidentName || '';
  const secName = tournamentData.secretaryName || '';

  const leftTextWidth = customFont.widthOfTextAtSize(leftText, 10);
  page.drawText(leftText, { x: margin + 30 - (leftTextWidth/2), y: y, font: customFont, size: 10, color: black });

  const rightTextWidth = customFont.widthOfTextAtSize(rightText, 10);
  page.drawText(rightText, { x: pageWidth - margin - 30 - (rightTextWidth/2), y: y, font: customFont, size: 10, color: black });

  y -= 20;
  page.drawLine({ start: { x: margin, y: y }, end: { x: margin + 120, y: y }, thickness: 1, color: black });
  const presNameWidth = customFont.widthOfTextAtSize(presName, 10);
  page.drawText(presName, { x: margin + 60 - (presNameWidth/2), y: y - 12, font: customFont, size: 10, color: black });

  page.drawLine({ start: { x: pageWidth - margin - 120, y: y }, end: { x: pageWidth - margin, y: y }, thickness: 1, color: black });
  const secNameWidth = customFont.widthOfTextAtSize(secName, 10);
  page.drawText(secName, { x: pageWidth - margin - 60 - (secNameWidth/2), y: y - 12, font: customFont, size: 10, color: black });


  // --- Save the PDF ---
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  saveAs(blob, `polozhenie-${tournamentData.name.replace(/\s/g, '_')}.pdf`);
};
