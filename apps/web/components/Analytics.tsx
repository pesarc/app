import Script from "next/script";

/**
 * Analytics loaders — each renders only when its env is set, so dev/preview and
 * un-configured deploys stay clean and the site works with none of them.
 *
 * - Umami (self-hosted, privacy-friendly, the one we run): set
 *   NEXT_PUBLIC_UMAMI_URL (e.g. https://analytics.pesarc.xyz) and
 *   NEXT_PUBLIC_UMAMI_WEBSITE_ID (from the Umami dashboard → website settings).
 * - Microsoft Clarity (optional, hosted): set NEXT_PUBLIC_CLARITY_ID.
 */
export default function Analytics() {
  const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL;
  const umamiId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

  return (
    <>
      {umamiUrl && umamiId && (
        <Script
          src={`${umamiUrl.replace(/\/$/, "")}/script.js`}
          data-website-id={umamiId}
          strategy="afterInteractive"
        />
      )}
      {clarityId && (
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${clarityId}");`}
        </Script>
      )}
    </>
  );
}
