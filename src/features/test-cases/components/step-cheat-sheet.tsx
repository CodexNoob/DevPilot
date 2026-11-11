const ROWS: [syntax: string, meaning: string][] = [
  ["goto /path", "Open a page (relative to the project URL)"],
  ['click "selector"', "Click an element"],
  ['fill "selector" "value"', "Type into an input"],
  ['press "selector" "Enter"', "Press a key in an element"],
  ['select "selector" "value"', "Pick an option in a <select>"],
  ['check "selector"', "Tick a checkbox or radio"],
  ['hover "selector"', "Hover an element"],
  ["wait 500", "Pause (milliseconds, max 30000)"],
  ['expect-visible "selector"', "Element is visible"],
  ['expect-hidden "selector"', "Element is hidden or absent"],
  ['expect-text "selector" "text"', "Element contains text"],
  ["expect-url /path", "Current URL contains this"],
  ['expect-title "text"', "Page title contains text"],
];

/** Collapsible reference for the step language (no JS needed). */
export function StepCheatSheet() {
  return (
    <details className="rounded-lg border bg-muted/30 text-sm">
      <summary className="cursor-pointer px-3 py-2 font-medium select-none">Step syntax</summary>
      <div className="space-y-3 border-t px-3 py-3">
        <p className="text-muted-foreground">
          Selectors are Playwright selectors: CSS (<code className="font-mono">#email</code>,{" "}
          <code className="font-mono">button[type=submit]</code>), text (
          <code className="font-mono">text=Sign in</code>), roles (
          <code className="font-mono">role=button[name=&quot;Save&quot;]</code>) or chains with{" "}
          <code className="font-mono">&gt;&gt;</code>. Put arguments with spaces in double quotes; escape quotes as{" "}
          <code className="font-mono">\&quot;</code>.
        </p>
        <table className="w-full text-left text-xs">
          <tbody className="divide-y">
            {ROWS.map(([syntax, meaning]) => (
              <tr key={syntax}>
                <td className="py-1.5 pr-4 font-mono whitespace-nowrap">{syntax}</td>
                <td className="py-1.5 text-muted-foreground">{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
