import { jsPDF } from 'jspdf';

export function generateReport(candidateName, jobTitle, conversation, evaluation) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let y = 20;

  function addText(text, fontSize = 10, isBold = false) {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += fontSize * 0.45;
    }
    y += 3;
  }

  function addDivider() {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  // Header
  addText('AI Interview Practice Report', 20, true);
  y += 2;
  addText(`Candidate: ${candidateName}`, 12);
  addText(`Position: ${jobTitle}`, 12);
  addText(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 11);
  addDivider();

  // Transcript
  addText('Interview Transcript', 14, true);
  y += 2;
  for (const msg of conversation) {
    const label = msg.role === 'interviewer' ? 'Alex (Interviewer)' : candidateName;
    addText(`${label}:`, 10, true);
    addText(msg.text, 9);
    y += 2;
  }
  addDivider();

  // Evaluation
  addText('Evaluation', 14, true);
  y += 2;
  // Split evaluation into lines and render
  const evalLines = evaluation.split('\n');
  for (const line of evalLines) {
    if (line.startsWith('## ')) {
      y += 3;
      addText(line.replace('## ', ''), 12, true);
    } else if (line.startsWith('- ')) {
      addText(`  ${line}`, 9);
    } else if (line.trim()) {
      addText(line, 9);
    }
  }

  doc.save(`Interview_Report_${candidateName.replace(/\s+/g, '_')}.pdf`);
}
