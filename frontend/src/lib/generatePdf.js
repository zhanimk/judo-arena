
import { jsPDF } from "jspdf";
import "jspdf-autotable"; // Ensure this is imported for autoTable to work

// Main function to generate the tournament regulation PDF
export const generateDocument = (tournamentData) => {
  const doc = new jsPDF();
  const margin = 15;
  let y = 20; // Initial Y position

  // --- Helper functions for drawing ---
  const drawCenteredText = (text, fontSize, isBold = false) => {
    if (isBold) doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    const textWidth = doc.getStringUnitWidth(text) * doc.getFontSize() / doc.internal.scaleFactor;
    const x = (doc.internal.pageSize.getWidth() - textWidth) / 2;
    doc.text(text, x, y);
    if (isBold) doc.setFont('helvetica', 'normal');
    y += (fontSize / 2) + 2;
  };

  const drawSectionTitle = (text) => {
    y += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
  };

  const drawText = (text) => {
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - margin * 2);
    doc.text(splitText, margin, y);
    y += (splitText.length * 4) + 4; // Adjust spacing based on number of lines
  };

  // --- PDF Content Generation ---

  // Title
  drawCenteredText('ПОЛОЖЕНИЕ', 14, true);
  y += 2;
  drawCenteredText(`о проведении открытого турнира по дзюдо`, 12);
  drawCenteredText(`"${tournamentData.name}"`, 12, true);
  y += 10;

  // Date and Location
  doc.setFontSize(11);
  doc.text(`${tournamentData.location}`, margin, y);
  const dateTextWidth = doc.getStringUnitWidth(tournamentData.date) * doc.getFontSize() / doc.internal.scaleFactor;
  doc.text(tournamentData.date, doc.internal.pageSize.getWidth() - margin - dateTextWidth, y);
  y += 10;

  // 1. Goals and Objectives
  if (tournamentData.goals) {
    drawSectionTitle('1. Цели и задачи');
    drawText(tournamentData.goals);
  }

  // 2. Participants
  if (tournamentData.participants) {
    drawSectionTitle('2. Участники соревнований');
    drawText(tournamentData.participants);
  }

  // 3. Program and Categories (NEW LOGIC)
  drawSectionTitle('3. Программа и весовые категории');
  if (tournamentData.program) {
      drawText(tournamentData.program);
  }
  
  if (tournamentData.divisions && tournamentData.divisions.length > 0) {
      tournamentData.divisions.forEach(division => {
        const header = `${division.gender}, ${division.ageGroup} (время схватки: ${division.duration} мин.)`;
        const weights = division.weights.join(', ');

        doc.autoTable({
            startY: y,
            head: [[{ content: header, styles: { fillColor: [22, 53, 87], fontStyle: 'bold' } }]],
            body: [[weights]],
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 10,
                cellPadding: 2,
                lineColor: [44, 62, 80],
                lineWidth: 0.2
            },
            headStyles: {
                fontSize: 11,
            }
        });
        y = doc.autoTable.previous.finalY + 6;
      });
  } else {
      drawText("Категории не определены.");
  }

  // 4. Awarding
  if (tournamentData.awarding) {
    drawSectionTitle('4. Награждение');
    drawText(tournamentData.awarding);
  }

  // 5. Financing
  if (tournamentData.financing) {
    drawSectionTitle('5. Финансирование');
    drawText(tournamentData.financing);
  }

  // --- Signature placeholder ---
  y += 20;
  doc.text('Главный судья соревнований: __________________', margin, y);
  y += 10;
  doc.text('Главный секретарь: __________________', margin, y);

  // --- Save the PDF ---
  doc.save(`polozhenie-${tournamentData.name.replace(/\s/g, '_')}.pdf`);
};
