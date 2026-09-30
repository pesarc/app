"use client";

// A tiny, dependency-free renderer for the markdown subset the agent emits:
// **bold**, `code`, bullet lists, and pipe tables. It builds real React nodes
// (never dangerouslySetInnerHTML), so agent output can lay data out as tables and
// highlight the numbers that matter without any risk from the text content.

import type { ReactNode } from "react";

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

/** Render inline **bold** and `code` spans inside one line of text. */
function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={i} className="font-bold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <span
          key={i}
          className="rounded bg-black/[0.05] px-1 py-0.5 font-mono text-[12.5px] text-harbor"
        >
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
}

function splitRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function Table({ rows }: { rows: string[] }) {
  const cells = rows.map(splitRow);
  const header = cells[0] ?? [];
  // A "| --- | --- |" separator row (if present) sits just under the header.
  const hasSep = cells[1]?.every((c) => c === "" || /^:?-{2,}:?$/.test(c));
  const body = cells.slice(hasSep ? 2 : 1);
  const headerEmpty = header.every((c) => c === "");

  return (
    <table className="my-1.5 w-full border-collapse text-[13.5px]">
      {!headerEmpty && (
        <thead>
          <tr>
            {header.map((c, j) => (
              <th
                key={j}
                className="border-b border-black/10 py-1.5 pr-3 text-left font-bold text-slate"
              >
                {inline(c)}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {body.map((row, r) => (
          <tr key={r} className="border-b border-black/[0.06] last:border-0">
            {row.map((c, j) => (
              <td key={j} className="py-1.5 pr-3 align-top">
                {inline(c)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    // Table: consecutive lines starting with "|".
    if (line.trim().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++]);
      blocks.push(<Table key={key++} rows={rows} />);
      continue;
    }

    // Bullet list: consecutive "- " / "* " lines.
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      }
      blocks.push(
        <ul key={key++} className="my-1 list-disc space-y-1 pl-4">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraph: run of plain lines.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("|") &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push(
      <p key={key++} className="whitespace-pre-wrap">
        {inline(para.join("\n"))}
      </p>,
    );
  }

  return <div className="space-y-1.5 leading-relaxed">{blocks}</div>;
}
