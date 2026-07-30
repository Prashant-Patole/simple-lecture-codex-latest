import { useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { V5Player, type V5Language } from '@/components/learning/v5';

const DEFAULT_JOB = 'Maths_20260728071144575_6H41NS_2ed2722b';

export default function V5PlayerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeJob = searchParams.get('job') || '';
  const initialLanguage =
    searchParams.get('lang')?.toLowerCase() === 'kannada' ? 'kannada' : 'english';
  const [jobInput, setJobInput] = useState(activeJob || DEFAULT_JOB);

  if (activeJob) {
    return (
      <V5Player
        initialLanguage={initialLanguage}
        jobId={activeJob}
        onExit={() => {
          setJobInput(activeJob);
          setSearchParams({});
        }}
        onLanguageChange={(language: V5Language) => {
          setSearchParams({ job: activeJob, lang: language });
        }}
      />
    );
  }

  return (
    <main className="v5-launcher">
      <div className="v5-launcher__glow" />
      <section className="v5-launcher__card">
        <span className="v5-launcher__badge">
          <Sparkles size={14} />
          V5 merged presentation lab
        </span>
        <h1>One video.<br />A living layer of key ideas.</h1>
        <p>
          Load an English or Kannada merged presentation. V5 adds only synchronized
          text key points over the finished video.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const job = jobInput.trim();
            if (job) setSearchParams({ job, lang: 'english' });
          }}
        >
          <label htmlFor="v5-job">Presentation job ID</label>
          <div>
            <input
              autoFocus
              id="v5-job"
              onChange={(event) => setJobInput(event.target.value)}
              placeholder="Enter a completed job ID"
              value={jobInput}
            />
            <button disabled={!jobInput.trim()} type="submit">
              <Play size={18} fill="currentColor" />
              Open V5
            </button>
          </div>
        </form>
        <small>No login required / Text overlays only / No separate media layers</small>
      </section>
      <style>{`
        .v5-launcher {
          min-height: 100dvh;
          position: relative;
          display: grid;
          place-items: center;
          overflow: hidden;
          padding: 24px;
          color: #eaf8f4;
          background:
            linear-gradient(rgba(124,224,195,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,224,195,.035) 1px, transparent 1px),
            #07100f;
          background-size: 34px 34px;
        }
        .v5-launcher__glow {
          position: absolute;
          width: min(70vw, 760px);
          aspect-ratio: 1;
          border-radius: 50%;
          background: rgba(35, 139, 110, .2);
          filter: blur(110px);
        }
        .v5-launcher__card {
          position: relative;
          width: min(720px, 100%);
          padding: clamp(28px, 6vw, 64px);
          border: 1px solid rgba(124,224,195,.2);
          border-radius: 24px;
          background: rgba(8, 24, 21, .84);
          box-shadow: 0 36px 100px rgba(0,0,0,.42);
          backdrop-filter: blur(22px);
        }
        .v5-launcher__badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border: 1px solid rgba(124,224,195,.24);
          border-radius: 999px;
          color: #7ce0c3;
          font: 700 10px/1 "Cascadia Mono", monospace;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .v5-launcher h1 {
          margin: 24px 0 16px;
          color: #f3fbf8;
          font-family: Georgia, serif;
          font-size: clamp(38px, 7vw, 70px);
          font-weight: 400;
          line-height: .98;
          letter-spacing: -.045em;
        }
        .v5-launcher p {
          max-width: 580px;
          margin: 0 0 34px;
          color: #9bb1ac;
          font-size: 16px;
          line-height: 1.65;
        }
        .v5-launcher form label {
          display: block;
          margin-bottom: 9px;
          color: #7ce0c3;
          font: 700 10px/1 "Cascadia Mono", monospace;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .v5-launcher form > div {
          display: flex;
          gap: 9px;
        }
        .v5-launcher input {
          min-width: 0;
          flex: 1;
          padding: 14px 15px;
          border: 1px solid rgba(124,224,195,.2);
          border-radius: 11px;
          outline: 0;
          color: #eaf8f4;
          background: rgba(0,0,0,.28);
          font-family: "Cascadia Mono", monospace;
        }
        .v5-launcher input:focus {
          border-color: #7ce0c3;
          box-shadow: 0 0 0 3px rgba(124,224,195,.1);
        }
        .v5-launcher button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 18px;
          border: 0;
          border-radius: 11px;
          color: #062019;
          background: #7ce0c3;
          font-weight: 800;
        }
        .v5-launcher button:disabled { opacity: .45; }
        .v5-launcher small {
          display: block;
          margin-top: 15px;
          color: #657d78;
        }
        @media (max-width: 580px) {
          .v5-launcher form > div { flex-direction: column; }
          .v5-launcher button { min-height: 48px; justify-content: center; }
        }
      `}</style>
    </main>
  );
}
