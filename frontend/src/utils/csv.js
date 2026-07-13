/**
 * Parse a raw CSV string into an array of objects.
 * First row is treated as the header.
 * Handles quoted fields with commas inside.
 */
export const parseCsv = (text) => {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .split("\n");
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

  return lines
    .slice(1)
    .map((line) => {
      const values = splitCsvLine(line);
      const row = {};
      headers.forEach((header, i) => {
        row[header] = (values[i] || "").trim();
      });
      return row;
    })
    .filter((row) => Object.values(row).some((v) => v !== ""));
};

/**
 * Split a single CSV line respecting quoted fields.
 */
const splitCsvLine = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
};

/**
 * Convert results array to a downloadable CSV string.
 */
export const resultsToCsv = (results) => {
  const headers = ["Original URL", "Short URL", "Short Code", "Status"];
  const rows = results.map((r) => [
    r.originalUrl || "",
    r.shortUrl || "",
    r.shortCode || "",
    r.error
      ? `Error: ${r.error}`
      : r.isExisting
        ? "Already existed"
        : "Created",
  ]);

  const escape = (val) => `"${String(val).replace(/"/g, '""')}"`;

  return [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");
};

/**
 * Trigger a CSV file download in the browser.
 */
export const downloadCsv = (content, filename = "lynq-results.csv") => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
