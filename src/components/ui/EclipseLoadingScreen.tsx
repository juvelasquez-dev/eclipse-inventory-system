import { useState } from "react";

import Button from "./Button";

interface EclipseLoadingScreenProps {
  error?: string | null;
  onRetry?: () => Promise<void>;
}

export default function EclipseLoadingScreen({
  error,
  onRetry,
}: EclipseLoadingScreenProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const hasError = Boolean(error) || retryFailed;

  async function handleRetry() {
    if (!onRetry || isRetrying) {
      return;
    }

    setIsRetrying(true);
    setRetryFailed(false);

    try {
      await onRetry();
    } catch {
      setRetryFailed(true);
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <main
      className="eclipse-loading-screen"
      data-error={hasError}
      role={hasError ? "alert" : "status"}
      aria-live={hasError ? "assertive" : "polite"}
      aria-busy={!hasError}
    >
      <style>{`
        .eclipse-loading-screen {
          display: grid;
          min-height: 100vh;
          place-items: center;
          overflow: hidden;
          padding: 1.75rem 1.25rem 2rem;
          color: #493b32;
          background:
            radial-gradient(ellipse at 50% 40%, #fffdf8 0%, #fff8eb 72%),
            #fff8eb;
          text-align: center;
        }

        .eclipse-loading-screen__content {
          width: min(100%, 27rem);
        }

        .eclipse-loading-screen__art {
          display: block;
          width: min(22rem, 82vw);
          height: auto;
          margin: 0 auto .25rem;
          overflow: visible;
        }

        .eclipse-loading-screen__brand {
          margin: 0;
          color: #7f604c;
          font-size: .92rem;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .eclipse-loading-screen__title {
          margin: .5rem 0 0;
          color: #493b32;
          font-size: clamp(1.05rem, 4vw, 1.2rem);
          font-weight: 650;
          letter-spacing: -.015em;
        }

        .eclipse-loading-screen__message {
          margin: .4rem 0 0;
          color: #9a8574;
          font-size: .86rem;
        }

        .eclipse-loading-screen__error-title {
          margin: .55rem 0 0;
          color: #493b32;
          font-size: 1.08rem;
          font-weight: 700;
        }

        .eclipse-loading-screen__error-message {
          max-width: 20rem;
          margin: .45rem auto 0;
          color: #9a8574;
          font-size: .88rem;
          line-height: 1.5;
        }

        .eclipse-loading-screen__retry {
          min-width: 7rem;
          margin-top: 1.1rem;
        }

        .eclipse-loading-screen__stream {
          transform-origin: 180px 100px;
          animation: eclipse-serve-flow 2.8s ease-in-out infinite;
        }

        .eclipse-loading-screen__swirl {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: eclipse-swirl-base 2.8s cubic-bezier(.2,.75,.25,1) infinite;
        }

        .eclipse-loading-screen__swirl--base {
          animation-name: eclipse-swirl-base;
        }

        .eclipse-loading-screen__swirl--middle {
          animation-name: eclipse-swirl-middle;
        }

        .eclipse-loading-screen__swirl--top {
          animation-name: eclipse-swirl-top;
        }

        .eclipse-loading-screen__serve {
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: eclipse-serve-settle 2.8s ease-in-out infinite;
        }

        .eclipse-loading-screen__sparkle {
          animation: eclipse-soft-glint 2.8s ease-in-out infinite;
        }

        .eclipse-loading-screen[data-error="true"] .eclipse-loading-screen__stream,
        .eclipse-loading-screen[data-error="true"] .eclipse-loading-screen__swirl,
        .eclipse-loading-screen[data-error="true"] .eclipse-loading-screen__serve,
        .eclipse-loading-screen[data-error="true"] .eclipse-loading-screen__sparkle {
          animation: none;
        }

        .eclipse-loading-screen[data-error="true"] .eclipse-loading-screen__swirl {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        @keyframes eclipse-serve-flow {
          0%, 6% { opacity: 0; transform: scaleY(.35); }
          12%, 69% { opacity: .9; transform: scaleY(1); }
          77%, 100% { opacity: 0; transform: scaleY(.4); }
        }

        @keyframes eclipse-swirl-base {
          0%, 15% { opacity: 0; transform: translateY(9px) scale(.82); }
          23%, 83% { opacity: 1; transform: translateY(0) scale(1); }
          94%, 100% { opacity: 0; transform: translateY(-2px) scale(.98); }
        }

        @keyframes eclipse-swirl-middle {
          0%, 32% { opacity: 0; transform: translateY(8px) scale(.82); }
          40%, 83% { opacity: 1; transform: translateY(0) scale(1); }
          94%, 100% { opacity: 0; transform: translateY(-2px) scale(.98); }
        }

        @keyframes eclipse-swirl-top {
          0%, 50% { opacity: 0; transform: translateY(7px) scale(.82); }
          58%, 83% { opacity: 1; transform: translateY(0) scale(1); }
          94%, 100% { opacity: 0; transform: translateY(-2px) scale(.98); }
        }

        @keyframes eclipse-serve-settle {
          0%, 77%, 100% { transform: translateY(0); }
          82% { transform: translateY(2px); }
          88% { transform: translateY(-1px); }
          93% { transform: translateY(0); }
        }

        @keyframes eclipse-soft-glint {
          0%, 79%, 100% { opacity: .55; }
          86% { opacity: .95; }
        }

        @media (prefers-reduced-motion: reduce) {
          .eclipse-loading-screen__stream,
          .eclipse-loading-screen__swirl,
          .eclipse-loading-screen__serve,
          .eclipse-loading-screen__sparkle {
            animation: none;
          }

          .eclipse-loading-screen__swirl {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>

      <section className="eclipse-loading-screen__content">
        <svg
          className="eclipse-loading-screen__art"
          viewBox="0 0 360 380"
          role="img"
          aria-label={hasError ? "Ice cream cone" : "Animated ice cream cone being filled"}
        >
          <defs>
            <linearGradient id="eclipse-cone-gradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#e7bc82" />
              <stop offset=".55" stopColor="#d99d62" />
              <stop offset="1" stopColor="#bd8150" />
            </linearGradient>
            <linearGradient id="eclipse-serve-gradient" x1="0" x2=".8" y1="0" y2="1">
              <stop offset="0" stopColor="#fffef9" />
              <stop offset=".72" stopColor="#fff0d9" />
              <stop offset="1" stopColor="#f2d6b4" />
            </linearGradient>
            <clipPath id="eclipse-cone-clip">
              <path d="M128 231 Q180 246 232 231 L190 344 Q180 355 170 344 Z" />
            </clipPath>
            <filter id="eclipse-soft-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="5" />
              <feOffset dy="5" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.36 0 0 0 0 0.25 0 0 0 0 0.17 0 0 0 .14 0" />
              <feBlend in="SourceGraphic" />
            </filter>
          </defs>

          <ellipse cx="180" cy="353" rx="83" ry="13" fill="#a8876c" opacity=".1" />
          <rect x="35" y="99" width="86" height="20" rx="10" fill="#f1cbc8" opacity=".8" />
          <rect x="239" y="75" width="83" height="17" rx="8.5" fill="#c8e8e3" opacity=".9" />
          <circle cx="81" cy="169" r="9" fill="#e6bd8b" opacity=".75" />
          <circle cx="285" cy="173" r="7" fill="#e9b9b3" opacity=".72" />
          <path d="M47 248c17-17 36-17 53 0" fill="none" stroke="#c8e8e3" strokeWidth="8" strokeLinecap="round" opacity=".8" />
          <path d="M260 252c14-14 29-14 43 0" fill="none" stroke="#edc9a3" strokeWidth="7" strokeLinecap="round" opacity=".8" />

          <g className="eclipse-loading-screen__dispenser" filter="url(#eclipse-soft-shadow)">
            <path d="M148 45a12 12 0 0 1 12-12h40a12 12 0 0 1 12 12v43h-64z" fill="#c8e8e3" />
            <path d="M148 70h64v20h-64z" fill="#a8d4ce" />
            <path d="M158 42h44a6 6 0 0 1 6 6v14h-56V48a6 6 0 0 1 6-6z" fill="#eaf6ef" />
            <circle cx="169" cy="52" r="3" fill="#e8aaa5" />
            <circle cx="180" cy="52" r="3" fill="#e7bd88" />
            <circle cx="191" cy="52" r="3" fill="#a5cfc8" />
            <path d="M168 90h24v9a12 12 0 0 1-24 0z" fill="#9a6847" />
            <path d="M174 96h12v9h-12z" fill="#76513d" />
            <path d="M180 103v17" stroke="#9a6847" strokeWidth="7" strokeLinecap="round" />
          </g>

          <g className="eclipse-loading-screen__serve">
            <path d="M126 230 Q180 247 234 230 L190 344 Q180 355 170 344 Z" fill="url(#eclipse-cone-gradient)" stroke="#a96f49" strokeWidth="2.5" strokeLinejoin="round" />
            <g clipPath="url(#eclipse-cone-clip)" fill="none" strokeLinecap="round">
              <path d="m119 238 76 76m-60-91 77 77m-52-91 65 65m-81 8 76-76m-62 92 78-78m-50 87 67-67" stroke="#f2d2a9" strokeWidth="5" opacity=".8" />
              <path d="m118 247 69 69m-48-88 72 72m-72 8 69-69m-51 83 73-73" stroke="#b7774d" strokeWidth="2" opacity=".45" />
            </g>

            <path d="M126 230 Q180 246 234 230 Q180 254 126 230z" fill="#b7774d" opacity=".55" />
            <path d="M128 228 Q180 242 232 228" fill="none" stroke="#f0cc9c" strokeWidth="5" strokeLinecap="round" />

            <g className="eclipse-loading-screen__swirl eclipse-loading-screen__swirl--base" filter="url(#eclipse-soft-shadow)">
              <path d="M128 229c2-16 14-27 31-29 2-17 15-28 32-27 17 1 29 14 30 31 8 4 13 12 13 23-33 12-73 13-106 2z" fill="url(#eclipse-serve-gradient)" stroke="#e8ceb0" strokeWidth="2" />
              <path d="M141 224c2-9 9-15 19-16 1-11 10-18 21-17 11 1 18 9 19 20 7 2 11 7 12 13" fill="none" stroke="#ead4b8" strokeWidth="3.5" strokeLinecap="round" />
            </g>

            <g className="eclipse-loading-screen__swirl eclipse-loading-screen__swirl--middle" filter="url(#eclipse-soft-shadow)">
              <path d="M140 204c1-14 11-24 25-26 1-14 11-23 25-22 14 1 23 11 24 25 7 3 11 10 11 20-26 9-58 10-85 3z" fill="url(#eclipse-serve-gradient)" stroke="#e8ceb0" strokeWidth="2" />
              <path d="M151 199c2-8 8-13 16-14 1-9 8-15 18-14 9 1 15 7 16 17 5 2 8 6 9 11" fill="none" stroke="#ead4b8" strokeWidth="3.5" strokeLinecap="round" />
            </g>

            <g className="eclipse-loading-screen__swirl eclipse-loading-screen__swirl--top" filter="url(#eclipse-soft-shadow)">
              <path d="M153 178c1-12 9-20 21-22 1-12 9-19 21-18 11 1 18 9 19 21 6 3 9 8 10 16-21 8-48 9-71 3z" fill="url(#eclipse-serve-gradient)" stroke="#e8ceb0" strokeWidth="2" />
              <path d="M162 173c2-7 7-11 14-12 1-8 7-13 15-12 8 1 13 6 14 14 4 2 7 5 8 9" fill="none" stroke="#ead4b8" strokeWidth="3.2" strokeLinecap="round" />
            </g>

            <g className="eclipse-loading-screen__sparkle" fill="#df9d91">
              <path d="M116 193l4-8 4 8 8 4-8 4-4 8-4-8-8-4z" />
              <path d="M237 175l3-6 3 6 6 3-6 3-3 6-3-6-6-3z" />
              <circle cx="242" cy="210" r="3" fill="#d8a66f" />
            </g>
          </g>

          <g className="eclipse-loading-screen__stream" fill="none" stroke="#fffdf7" strokeLinecap="round">
            <path d="M180 121v28" strokeWidth="9" />
            <path d="M180 121v28" stroke="#efd8bb" strokeWidth="2" />
          </g>
        </svg>

        <p className="eclipse-loading-screen__brand">Eclipse EIDMS</p>

        {hasError ? (
          <>
            <h1 className="eclipse-loading-screen__error-title">
              Unable to load system data.
            </h1>
            <p className="eclipse-loading-screen__error-message">
              Please check your connection and try again.
            </p>
            {onRetry && (
              <Button
                type="button"
                className="eclipse-loading-screen__retry"
                onClick={() => void handleRetry()}
                disabled={isRetrying}
              >
                {isRetrying ? "Retrying..." : "Retry"}
              </Button>
            )}
          </>
        ) : (
          <>
            <h1 className="eclipse-loading-screen__title">
              Preparing Eclipse...
            </h1>
            <p className="eclipse-loading-screen__message">
              Loading system data...
            </p>
          </>
        )}
      </section>
    </main>
  );
}