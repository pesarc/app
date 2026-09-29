// Screen-space country tooltip surfaced on hover, following the cursor.

import { fmtPop, fmtUSD } from "./helpers";
import type { HoverInfo } from "./types";

export default function HoverTooltip({ hover }: { hover: HoverInfo }) {
  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{ left: hover.x, top: hover.y, transform: "translate(-50%, calc(-100% - 12px))" }}
    >
      <div className="rounded-xl bg-[#06162a]/90 border border-sky/40 px-3 py-2 shadow-pop min-w-[130px] whitespace-nowrap">
        <div className="text-[12px] font-extrabold text-white leading-tight">{hover.name}</div>
        <div className="mt-1 flex items-center gap-3 text-[10.5px] font-bold">
          <span className="text-[#8fbcff]">
            Pop <span className="text-white">{fmtPop(hover.stat?.pop)}</span>
          </span>
          <span className="text-[#8fbcff]">
            GDP <span className="text-white">{fmtUSD(hover.stat?.gdp)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
