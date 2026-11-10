import React, { useEffect, useRef } from 'react';

interface AdsterraBannerProps {
  index: number;
  adKey?: string;
  scriptHost?: string;
}

const DEFAULT_AD_KEY = '911ee250303f0d466e6e2cab58b077e0';
const DEFAULT_SCRIPT_HOST = 'https://bauval.org/22';

export const AdsterraBanner = React.memo(function AdsterraBanner({
  index,
  adKey = DEFAULT_AD_KEY,
  scriptHost = DEFAULT_SCRIPT_HOST
}: AdsterraBannerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const cleanHost = (scriptHost || DEFAULT_SCRIPT_HOST).replace(/\/+$/, '');
  const cleanKey = (adKey || DEFAULT_AD_KEY).trim();

  // Self-contained, isolated HTML document for the 300x250 Adsterra banner
  const adHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base target="_blank">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  </style>
</head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key' : '${cleanKey}',
      'format' : 'iframe',
      'height' : 250,
      'width' : 300,
      'params' : {}
    };
  </script>
  <script type="text/javascript" src="${cleanHost}/${cleanKey}"></script>
</body>
</html>`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(adHtml);
        doc.close();
      }
    } catch {
      // Fallback relies on srcDoc if doc.write fails in strict sandboxes
    }
  }, [adHtml]);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 flex w-[300px] items-center justify-between px-1 text-[9.5px] font-bold uppercase tracking-wider text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
          স্পন্সরড অ্যাড #{index}
        </span>
        <span>300×250</span>
      </div>

      <div className="relative flex h-[252px] w-[302px] items-center justify-center overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xs">
        <iframe
          ref={iframeRef}
          srcDoc={adHtml}
          title={`Adsterra Banner ${index}`}
          width={300}
          height={250}
          scrolling="no"
          className="border-0 overflow-hidden"
          style={{ width: '300px', height: '250px', border: 0 }}
        />
      </div>
    </div>
  );
});
