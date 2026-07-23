import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

interface TimetableEntry {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject?: { name: string };
  instructor?: { full_name: string };
  course?: { name: string };
  batch?: { name: string };
  room_number?: string;
}

interface TimetablePDFExportProps {
  entries: TimetableEntry[];
  title: string;
  subtitle?: string;
}

export const TimetablePDFExport = ({ entries, title, subtitle }: TimetablePDFExportProps) => {
  const getEntryForSlot = (day: number, time: string) => {
    return entries.find((entry) => {
      const entryTime = entry.start_time.substring(0, 5);
      return entry.day_of_week === day && entryTime === time;
    });
  };

  const generatePDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    
    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(title, pageWidth / 2, 15, { align: "center" });
    
    if (subtitle) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(subtitle, pageWidth / 2, 22, { align: "center" });
    }
    
    // Table setup
    const tableStartY = subtitle ? 30 : 25;
    const colWidth = (pageWidth - 2 * margin - 20) / 7; // 7 days
    const timeColWidth = 20;
    const rowHeight = 18;
    
    // Draw header row
    doc.setFillColor(59, 130, 246); // Blue
    doc.rect(margin, tableStartY, pageWidth - 2 * margin, 10, "F");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Time", margin + 2, tableStartY + 7);
    
    DAYS.forEach((day, idx) => {
      const x = margin + timeColWidth + idx * colWidth;
      doc.text(day.substring(0, 3), x + colWidth / 2, tableStartY + 7, { align: "center" });
    });
    
    // Draw rows
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    
    TIME_SLOTS.forEach((time, rowIdx) => {
      const y = tableStartY + 10 + rowIdx * rowHeight;
      
      // Alternate row background
      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - 2 * margin, rowHeight, "F");
      }
      
      // Draw grid lines
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, pageWidth - 2 * margin, rowHeight, "S");
      
      // Time column
      doc.setFontSize(8);
      doc.text(time, margin + 2, y + rowHeight / 2 + 2);
      
      // Day columns
      DAYS.forEach((_, dayIdx) => {
        const x = margin + timeColWidth + dayIdx * colWidth;
        const entry = getEntryForSlot(dayIdx, time);
        
        // Vertical grid line
        doc.line(x, y, x, y + rowHeight);
        
        if (entry) {
          // Entry background
          doc.setFillColor(219, 234, 254); // Light blue
          doc.rect(x + 1, y + 1, colWidth - 2, rowHeight - 2, "F");
          
          // Subject name
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          const subjectName = entry.subject?.name || "Class";
          doc.text(subjectName.substring(0, 12), x + 2, y + 5);
          
          // Time range
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.text(`${entry.start_time.substring(0, 5)}-${entry.end_time.substring(0, 5)}`, x + 2, y + 10);
          
          // Instructor
          if (entry.instructor?.full_name) {
            doc.text(entry.instructor.full_name.substring(0, 14), x + 2, y + 14);
          }
        }
      });
    });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, pageHeight - 5);
    
    // Save
    const filename = `timetable_${title.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(filename);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4 mr-2" />
        Print
      </Button>
      <Button variant="outline" size="sm" onClick={generatePDF}>
        <Download className="h-4 w-4 mr-2" />
        Export PDF
      </Button>
    </div>
  );
};
