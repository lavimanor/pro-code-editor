# Pro Code Editor

A lightweight Electron-based code editor and file explorer built for local development and quick language execution.

## Features

- Open and browse a folder workspace
- View and edit files with a custom editor interface
- Built-in file explorer, tabs, terminal panel, settings, and minimap
- Launch a local HTTP server for web previews
- Run supported code languages directly from the editor

## Installation

1. Install Node.js and npm if you don't already have them.
2. Install dependencies:

```bash
npm install
```

## Running the app

```bash
npm start
```

This launches the Electron application.

## Project structure

- `index.html` — main UI markup
- `main.js` — Electron app startup and IPC handlers
- `run-config.js` — runnable language configuration
- `package.json` — app metadata and scripts
- `style.css` — main styles
- `js/` — editor logic, file handling, terminal, syntax, themes, and autocomplete

## Notes

- The editor is configured as a CommonJS Electron app.

## License

This project uses the MIT license.
