const repeat = (value: string, count: number): string => {
  return Array.from({ length: count }).fill(value).join("");
};

export const toMarkdownTable = (headers: string[], rows: Array<Array<string | number>>): string => {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `|${repeat(" --- |", headers.length)}`;
  const bodyLines = rows.map((row) => {
    const cells = row.map((cell) => String(cell));
    return `| ${cells.join(" | ")} |`;
  });

  return [headerLine, separatorLine, ...bodyLines].join("\n");
};
