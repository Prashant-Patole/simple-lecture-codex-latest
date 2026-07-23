import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';

interface CourseCertificateProps {
  studentName: string;
  courseName: string;
  completionDate: string;
  enrollmentDate: string;
  subjects: string[];
}

const CourseCertificate = ({
  studentName,
  courseName,
  completionDate,
  enrollmentDate,
  subjects,
}: CourseCertificateProps) => {
  const certRef = useRef<HTMLDivElement>(null);

  const getDuration = () => {
    const start = new Date(enrollmentDate);
    const end = new Date(completionDate);
    const diffMs = end.getTime() - start.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days} days`;
    const months = Math.floor(days / 30);
    return months === 1 ? '1 month' : `${months} months`;
  };

  const handleDownload = useCallback(async () => {
    if (!certRef.current) return;
    try {
      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });
      const link = document.createElement('a');
      link.download = `${courseName.replace(/\s+/g, '_')}_Certificate.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [courseName]);

  return (
    <div className="space-y-3">
      <div
        ref={certRef}
        className="relative w-full overflow-hidden rounded-xl"
        style={{
          background: 'linear-gradient(135deg, #0d4f4f 0%, #1a3a4a 40%, #0f2b3d 100%)',
          aspectRatio: '1.414',
          padding: '5%',
        }}
      >
        {/* Decorative wave top-right */}
        <svg
          className="absolute top-0 right-0 opacity-20"
          width="50%"
          height="40%"
          viewBox="0 0 400 200"
          fill="none"
        >
          <path
            d="M400 0C300 40 250 100 200 120C150 140 100 100 50 130C0 160 0 200 0 200H400V0Z"
            fill="#2dd4bf"
          />
          <path
            d="M400 20C320 60 270 110 220 130C170 150 120 120 70 150C20 180 0 200 0 200H400V20Z"
            fill="#14b8a6"
            opacity="0.5"
          />
        </svg>

        {/* Decorative wave bottom-left */}
        <svg
          className="absolute bottom-0 left-0 opacity-20"
          width="50%"
          height="40%"
          viewBox="0 0 400 200"
          fill="none"
        >
          <path
            d="M0 200C100 160 150 100 200 80C250 60 300 100 350 70C400 40 400 0 400 0H0V200Z"
            fill="#2dd4bf"
          />
          <path
            d="M0 180C80 140 130 90 180 70C230 50 280 80 330 50C380 20 400 0 400 0H0V180Z"
            fill="#14b8a6"
            opacity="0.5"
          />
        </svg>

        {/* Decorative corner dots */}
        <div className="absolute top-[8%] left-[8%] w-2 h-2 rounded-full bg-teal-400/40" />
        <div className="absolute top-[8%] right-[8%] w-2 h-2 rounded-full bg-teal-400/40" />
        <div className="absolute bottom-[8%] left-[8%] w-2 h-2 rounded-full bg-teal-400/40" />
        <div className="absolute bottom-[8%] right-[8%] w-2 h-2 rounded-full bg-teal-400/40" />

        {/* Inner border */}
        <div
          className="relative h-full w-full flex flex-col items-center justify-center text-center"
          style={{
            border: '1px solid rgba(45, 212, 191, 0.25)',
            borderRadius: '8px',
            padding: '6% 8%',
          }}
        >
          {/* Small trophy icon */}
          <div className="text-teal-400 mb-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </div>

          <p className="text-teal-300/70 text-[10px] md:text-xs tracking-[0.3em] uppercase mb-1">
            Certificate
          </p>
          <h2
            className="text-white font-bold tracking-wide mb-1"
            style={{ fontSize: 'clamp(14px, 3vw, 28px)' }}
          >
            CERTIFICATE OF COMPLETION
          </h2>

          <div className="w-16 h-[1px] bg-teal-400/40 my-2" />

          <p className="text-teal-200/60 text-[9px] md:text-xs mb-1">
            This is presented to
          </p>

          <h3
            className="text-teal-300 font-semibold italic mb-2"
            style={{ fontSize: 'clamp(16px, 3.5vw, 32px)', fontFamily: 'Georgia, serif' }}
          >
            {studentName}
          </h3>

          <p className="text-teal-200/60 text-[8px] md:text-[11px] max-w-[80%] leading-relaxed mb-2">
            for successfully completing the <span className="text-teal-200 font-medium">{courseName}</span> course
            {subjects.length > 0 && (
              <>
                {' '}covering{' '}
                <span className="text-teal-200 font-medium">{subjects.join(', ')}</span>
              </>
            )}
          </p>

          <div className="flex items-center gap-4 md:gap-8 mt-2 text-[8px] md:text-[10px]">
            <div className="text-center">
              <p className="text-teal-400/50 uppercase tracking-wider">Completed</p>
              <p className="text-teal-200 font-medium mt-0.5">
                {new Date(completionDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="w-[1px] h-6 bg-teal-400/20" />
            <div className="text-center">
              <p className="text-teal-400/50 uppercase tracking-wider">Duration</p>
              <p className="text-teal-200 font-medium mt-0.5">{getDuration()}</p>
            </div>
          </div>

          <div className="absolute bottom-[6%] text-[7px] md:text-[9px] text-teal-400/30">
            SimpleLecture • Verified Certificate
          </div>
        </div>
      </div>

      <Button
        onClick={handleDownload}
        variant="outline"
        className="w-full gap-2"
      >
        <Download className="h-4 w-4" />
        Download Certificate
      </Button>
    </div>
  );
};

export default CourseCertificate;
