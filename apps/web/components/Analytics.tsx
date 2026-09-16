import Script from "next/script";

/**
 * Microsoft Clarity — free heatmaps, session recordings, and traffic analytics.
 * Loads only when NEXT_PUBLIC_CLARITY_ID is set (so dev/preview stay clean and
 * the site works with no analytics configured). Get a project id at
 * https://clarity.microsoft.com (free) → Settings → the 10-char id in the tag.
 */
export default function Analytics() {
  const id = process.env.NEXT_PUBLIC_CLARITY_ID;
  if (!id) return null;
  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${id}");`}
    </Script>
  );
}
