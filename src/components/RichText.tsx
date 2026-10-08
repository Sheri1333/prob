import type { ReactNode } from "react";

/**
 * Text from imported tests: plain lines, "## heading", Markdown-style tables
 * ("| a | b |") and program code (SQL / Python) kept with its indentation.
 */
const CODE_LINE =
  /^(\s{2,}\S|def |for |while |if |elif |else:|return\b|print\(|import |class |SELECT\b|FROM\b|WHERE\b|JOIN\b|GROUP BY|HAVING\b|ORDER BY|INSERT\b|UPDATE\b|DELETE\b|CREATE\b|DROP\b|ALTER\b|[a-z_]\w*\s*=\s*[[({\d'"a-z])/;

type Block =
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "code"; lines: string[] }
  | { kind: "table"; rows: string[][] };

function cells(line: string): string[] {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
}

export function parseRichText(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    const last = blocks[blocks.length - 1];
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (/^\s*\|(\s*-{3,}\s*\|)+\s*$/.test(line)) continue;
      if (last?.kind === "table") last.rows.push(cells(line));
      else blocks.push({ kind: "table", rows: [cells(line)] });
    } else if (line.startsWith("## ")) {
      blocks.push({ kind: "heading", text: line.slice(3).trim() });
    } else if (CODE_LINE.test(line)) {
      if (last?.kind === "code") last.lines.push(line);
      else blocks.push({ kind: "code", lines: [line] });
    } else if (line.trim()) {
      blocks.push({ kind: "para", text: line });
    }
  }
  return blocks;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const out: ReactNode[] = parseRichText(text).map((block, i) => {
    switch (block.kind) {
      case "heading":
        return (
          <h3 key={i} className="rich-text__heading">
            {block.text}
          </h3>
        );
      case "code":
        return (
          <pre key={i} className="rich-text__code">
            {block.lines.join("\n")}
          </pre>
        );
      case "table": {
        const [head, ...body] = block.rows;
        return (
          <div key={i} className="rich-text__table-wrap">
            <table className="rich-text__table">
              <thead>
                <tr>
                  {head.map((c, j) => (
                    <th key={j}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, r) => (
                  <tr key={r}>
                    {row.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return (
          <p key={i} className="rich-text__p">
            {block.text}
          </p>
        );
    }
  });
  return <div className={`rich-text${className ? ` ${className}` : ""}`}>{out}</div>;
}
