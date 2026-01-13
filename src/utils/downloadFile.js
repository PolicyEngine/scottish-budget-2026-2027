/**
 * File download utilities.
 */

/**
 * Trigger a file download in the browser.
 *
 * @param {string} content - The file content
 * @param {string} filename - The filename including extension
 * @param {string} mimeType - The MIME type
 */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download content as an SVG file.
 *
 * @param {string} svgContent - The SVG content string
 * @param {string} filename - The filename without extension
 */
export function downloadSvg(svgContent, filename) {
  downloadFile(svgContent, `${filename}.svg`, "image/svg+xml;charset=utf-8");
}
