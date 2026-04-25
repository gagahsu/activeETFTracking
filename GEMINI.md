# Active ETF Holding Tracking (主動式 ETF 持股追蹤)

## Project Overview
This project is a self-contained web application designed for tracking active ETF holdings. It is delivered as a single-file HTML bundle that includes all necessary JavaScript, CSS, fonts, and data.

The application appears to be built using **React** and bundled into a single file using a custom unpacking script.

## Key Files
- `_ETF_ v2.html`: The complete application bundle. It contains a self-unpacking mechanism that uses `DecompressionStream` to extract gzipped assets embedded within the file.
- `GEMINI.md`: Instructional context for the project.

## Usage
To use the application, simply open `_ETF_ v2.html` in any modern web browser. 

### Requirements
- **JavaScript**: Must be enabled.
- **DecompressionStream API**: Required for unpacking the application assets. Modern browsers (Chrome 80+, Firefox 113+, Safari 16.4+) support this natively.

## Development Context
This directory contains the bundled output of a development process. No source code (React components, raw data files, or build scripts) is present in this directory. 

If modification is required, the original source files and build pipeline should be sought. The bundled file is optimized for distribution and direct use rather than active development.
