import React, { useEffect, useRef } from 'react';

/**
 * Adsterra Native Banner Component (Responsive Native Ad Widget)
 * Container ID: container-3359dfb49d3904ef22e968fbd601bd0f
 * Script: https://bauval.org/21/3359dfb49d3904ef22e968fbd601bd0f
 */
export const AdsterraNativeBanner = React.memo(function AdsterraNativeBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scriptSrc = 'https://bauval.org/21/3359dfb49d3904ef22e968fbd601bd0f';

    // Inject script into body or container
    const existing = document.querySelector(`script[src="${scriptSrc}"]`);
    if (!existing) {
      const script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div className="w-full my-3 overflow-hidden rounded-2xl border border-black/5 bg-white p-3 shadow-card">
      <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          স্পন্সরড নেটিভ ব্যানার
        </span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-600 border border-emerald-200/60">
          Native Banner
        </span>
      </div>

      {/* Target Container for Adsterra Native Banner */}
      <div
        ref={containerRef}
        id="container-3359dfb49d3904ef22e968fbd601bd0f"
        className="w-full min-h-[120px] overflow-hidden"
      />
    </div>
  );
});
