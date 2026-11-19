# TableBase Plus for Obsidian

> **Transform standard Markdown tables into interactive Notion-like databases and Kanban boards — with 100% plain Markdown and zero vendor lock-in.**

[![Release](https://img.shields.io/github/v/release/emilsmSWO/obsidian-tablebase-plus?color=orange&label=Release&logo=github)](https://github.com/emilsmSWO/obsidian-tablebase-plus/releases)
[![Tests](https://img.shields.io/badge/Tests-338%20Passed-brightgreen.svg?logo=vitest&logoColor=white)](https://github.com/emilsmSWO/obsidian-tablebase-plus)
[![Obsidian](https://img.shields.io/badge/Obsidian-v1.5.0+-7C3AED.svg?logo=obsidian&logoColor=white)](https://obsidian.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📦 Installation

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [Latest Release](https://github.com/emilsmSWO/obsidian-tablebase-plus/releases).
2. In your vault folder, navigate to `.obsidian/plugins/` and create a folder named `obsidian-tablebase-plus`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/obsidian-tablebase-plus/`.
4. In Obsidian, go to **Settings** → **Community plugins**, click **Reload plugins**, and enable **TableBase Plus**.

---

## 🚀 How It Works

TableBase Plus reads and writes standard, human-readable Markdown tables — no proprietary files or hidden databases:

### 1. Standard Markdown Tables (Reading View)
Create normal Markdown tables anywhere in your notes:

```markdown
| Task | Status [select] | Tags [multi-select] | Due [date] | Budget ($) [number:sum] | Done [checkbox] |
| :--- | :---: | :--- | :---: | :---: | :---: |
| Redesign landing page | In Progress | Design, UI | 2026-09-25 | 1200 | [ ] |
| Implement auth API | Done | Backend | 2026-09-18 | 800 | [x] |
```

Press **`Cmd + E`** (switch to **Reading View**) — TableBase Plus automatically renders the table as an interactive database.

### 2. Interactive Code Blocks (Live Preview & Reading View)
To view and edit an interactive database directly in **Live Preview** (Edit mode), wrap your table in a ```` ```tablebase ```` code block:

````markdown
```tablebase
| Task | Status [select] | Priority [select] | Due [date] | Done [checkbox] |
| Launch website | In Progress | High | 2026-09-25 | [ ] |
| Security audit | Done | Critical | 2026-09-18 | [x] |
```
````

### 3. Column Width (`w=`)
Add `w=<pixels>` to a column header to fix its width (60–2000 px). Long text wraps inside the column, and the width is saved with the note:

```markdown
| Task [text:w=300] | Notes [text:w=420] | Budget ($) [number:sum,w=120] |
| :--- | :--- | :---: |
| Redesign landing page | A long description that wraps onto several lines inside the column | 1200 |
```

Drag a column's right edge in the interactive view and `w=` is written to the header for you. Columns without `w=` use the **Default column width** setting.

### 4. Last-Change Timestamp (`datetime:autoupdate`)
Add `autoupdate` to a `datetime` column header and the column is set to the current time whenever a row is changed in TableBase Plus:

```markdown
| Task [text] | Status [select] | Updated [datetime:YYYY-MM-DD HH:mm,autoupdate,w=160] |
| :--- | :---: | :---: |
| Redesign landing page | In Progress | 2026-11-19 16:05 |
| Implement auth API | Done | 2026-11-18 09:30 |
```

Edits made outside Obsidian are not tracked. See **Datetime & Last-Modified Columns** below for details.

### 5. Dictionaries (`dict=`)
A dictionary is a named, ordered list of options with colors, defined once in the settings and shared by many `select` and `multi-select` columns. Bind a column to it in the header:

```markdown
| Task [text] | Status [select:dict=Statusy] | Tags [multi-select:dict=Tagi,w=200] |
| :--- | :--- | :--- |
| Redesign landing page | In Progress | Frontend, Bug |
```

1. Create dictionaries under **Settings → TableBase Plus → Dictionaries**: add items, pick a color per item, reorder with the arrows, then press **Save** (or **Revert** to drop the edit). A dictionary cannot be renamed; use **Clone** to copy it under a new name.
2. Names are unique ignoring case and cannot contain `, [ ] =`. Item names are unique within a dictionary and cannot contain `, ;`.
3. In the column header menu, **List source** switches a column between **Custom** (options come from the values in the table) and any dictionary.
4. In a bound column only dictionary items can be picked, in the dictionary order and with the dictionary colors. A color comes from the dictionary, else from the global tag color, else it is automatic.
5. Values in the table that are not in the dictionary are shown in red and bold; the Markdown is not changed. The Kanban board shows one group per dictionary item, plus a group for each such value.
6. Deleting a dictionary turns its columns back into custom lists.

---

## 🌟 Features & How to Use

### 📋 Interactive Table View

![Interactive Table View](assets/table-demo.gif)

* **Edit Cells**: Double-click any cell or press `Enter` to edit text, numbers, dates, or tags.
* **Clickable Links**: Click `[Markdown links](url)` (also to notes: `[text](Note.md)`, `[text](#Heading)`, `[text](<My Note.md>)`; `obsidian://`, `mailto:` and `tel:` work too), raw URLs (`https://...`), or `[[WikiLinks]]` (with `#Heading`, `^block` and `[[Page\|alias]]`) to open them in your browser or notes. Ctrl/Cmd+click opens a note in a new tab, hovering shows the preview, and links to missing notes are dimmed.
* **Reorder Rows**: Hover over any row and drag the floating handle (`⠿`) in the left gutter to move rows up or down.
* **Reorder Columns**: Drag any column header left or right with live drop indicators (`before` / `after`).
* **Centered Controls**: Centered row index numbers and a centered `+ New` button at the bottom for quick row insertion.
* **Scroll Memory**: Automatically preserves your horizontal scroll position across edits, searches, and re-renders.

### 🗂️ 1-Click Kanban Board

![Kanban Board View](assets/board-demo.gif)

* **Switch Views**: Click the **Board** tab on the top-left toolbar to transform your table into a Kanban board grouped by your status column.
* **Drag-and-Drop Cards**: Move cards between columns to update status values in your note in real time.
* **Card Properties**: Shows colored tags, dates, formatted numeric badges (`# Amount`), and clickable links directly on cards.
* **Quick Add**: Click `+ New` at the bottom of any column to create a card pre-assigned to that status.

### 🏷️ Colored Tags & Multi-Select
* **Single-Select Dropdowns**: Select a status (*Todo*, *In Progress*, *Done*) from a Notion-style dropdown menu.
* **Multi-Select Badges**: Add multiple tags per cell with instant search-as-you-type and badge creation.
* **Color Palettes**: Choose from 10 Notion-inspired palette colors or pick custom colors.
* **Reload list**: The option list is built from the values in the table. Use **Reload list** (below *Clear selection*) to rebuild it after you removed or renamed values. The saved option order is keyed by note, table position and column name; it follows renamed notes, is dropped for deleted ones, and options no longer in the table are removed after a restart.

### 📅 Visual Date Picker
* Click any date cell to open an interactive calendar popover.
* Pick dates in one click or navigate across months and years.
* Supports common formats (`YYYY-MM-DD`, `DD.MM.YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`).

### 🕒 Datetime & Last-Modified Columns
A `[datetime]` column stores a date and/or time, and can record when a row was last changed.

1. Mark a column with `[datetime]`, e.g. `Updated [datetime:YYYY-MM-DD HH:mm]`. Without a format the **Default datetime format** setting is used; when you pick the type in the UI the format is written to the header.
2. Formats are built from the tokens `YYYY`, `MM` (month), `DD`, `HH` (24-hour, `hh` works too), `mm` (minutes) and `ss`. Use only part of them for a date-only (`YYYY-MM-DD`) or time-only (`HH:mm:ss`) column; the picker then shows just that part. Time is local, with no time zone.
3. Add `autoupdate` to the header, e.g. `Updated [datetime:YYYY-MM-DD HH:mm,autoupdate,w=160]`, to have the column set to the current time whenever its row is saved. Several columns can carry it. In the column header menu, **Property Type → Datetime auto-update** switches it on; click it again to switch it off. **Datetime** is the same type without the flag.
4. Auto-update is on when **Auto-update last update datetime column** is enabled (default). It fires on cell edits (including checkboxes, tags and Kanban edits), new rows and duplicated rows. It does not fire on moving, deleting or re-sorting rows, or on column changes.
5. An `autoupdate` column can still be edited by hand. That edit does not re-stamp the same column, but it does stamp the other `autoupdate` columns of the row. Saving an unchanged value changes nothing.
6. Changes made outside Obsidian (another editor, sync tools, source mode on a device without this plugin) are not tracked, so their timestamps stay as they were.
7. Changing the default format does not rewrite existing cells; a column keeps the format written in its header.

### 🔍 Search, Filter & Sort
* **Live Search**: Type into the **Search** box on the toolbar to instantly filter rows across all columns.
* **Visual Filters**: Click **Filter** to create rules with `AND` / `OR` logic (e.g. *Status is "In Progress" AND Due date is not empty*).
* **Multi-Column Sort**: Click **Sort** or click column headers to sort ascending or descending.
* **Properties Menu**: Click **Properties** to toggle visibility of any columns.

### 🧮 Summary Calculations
* Enable **Calculation row** for a table from its **Properties** menu, then hover over the footer row and click a column to pick a summary:
  * **Numbers**: `Sum`, `Average`, `Min`, `Max`, `Count`
  * **Tags & Text**: `Count all`, `Unique count`, `Empty`, `Not empty`
  * **Checkboxes**: `Checked count`, `Unchecked count`, `Percent completed`
* The calculation is saved in the header (e.g. `[number:sum]`), so your choice persists when reopening the note.

### 🖨️ Clean Print & PDF Export
* When printing notes or exporting to PDF, interactive UI controls (handles, toolbars, buttons) are automatically stripped, leaving clean, standard tables.

### 📤 CSV Export
* Open the table menu to **Copy as CSV** (for Excel, Google Sheets) or **Download CSV** file with a single click.

---

## 📝 Column Type Syntax

TableBase Plus automatically detects column types based on content, or you can explicitly tag headers in your Markdown:

| Syntax | Column Type | Description |
| :--- | :--- | :--- |
| `Task [text]` | Text | Text cell with clickable links and wikilinks |
| `Status [select]` | Single-Select | Single-choice colored tag dropdown |
| `Tags [multi-select]` | Multi-Select | Multiple colored tag badges |
| `Due [date]` | Date | Visual calendar picker (`YYYY-MM-DD`) |
| `Due [date:DD.MM.YYYY]` | Date | Calendar picker with custom date format |
| `Updated [datetime:YYYY-MM-DD HH:mm]` | Datetime | Date and/or time picker with a custom format |
| `Updated [datetime:YYYY-MM-DD HH:mm,autoupdate]` | Datetime + auto-update | Set to the current time on every change of the row |
| `Amount [number]` | Number | Strict numeric formatting (right-aligned) |
| `Amount [number:sum]` | Number + Calc | Auto-calculates column Sum in footer |
| `Done [checkbox]` | Checkbox | Centered interactive checkbox |
| `Status [select:dict=Statusy]` | Dictionary | Options, order and colors come from the dictionary `Statusy` (settings) |
| `Task [text:w=300]` | Column width | Width in pixels (60–2000), combinable with other parameters: `Amount [number:sum,w=120]` |

*Type tags like `[select]` and `:sum` are automatically hidden in visual mode for a clean appearance.*

Columns without `w=` use the **Default column width** (240 px). Drag a column's right edge to resize it; the width is written to the header, so it stays with the note and long text wraps inside the column.

Tables taller than the **Maximum table height** (60% of the window height by default, 0 for no limit) scroll inside their own area with a sticky header, so the horizontal scrollbar stays on screen. Shorter tables keep their natural height.

Tables start flush with the note text. The **Table left offset** setting (0 px by default) adds space on the left; use about 26 px to keep the row drag handle inside the note. Long select and multi-select options wrap inside the column.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| **`Arrow Keys`** | Navigate between cells |
| **`Tab`** / **`Shift + Tab`** | Move to next / previous cell (wraps to next row; `Tab` on last cell adds a row) |
| **`Enter`** | Edit cell, toggle checkbox, or open date/tag picker |
| **`Any letter / digit`** | Start typing immediately to edit the focused cell |
| **`Escape`** | Close editor, close popover, or cancel selection |
| **`Right Click`** | Open row or column context menu |

---

## ⚙️ Settings

Configure under **Obsidian Settings → TableBase Plus**:
* **Default Date Format**: Set preferred date display (`YYYY-MM-DD`, `DD.MM.YYYY`, etc.).
* **Default Datetime Format** and **Auto-update last update datetime column**: see [Datetime & Last-Modified Columns](#-datetime--last-modified-columns).
* **Default Tag Format**: Format tags as comma-separated, `#hashtags`, or `[[wikilinks]]`.
* **Row Numbers**: Toggle row numbers globally.
* **Default Column Width**: Width in pixels for columns without an explicit `w=` (default `240`).
* **Calculation Row**: Show or hide the bottom summary row.
* **Empty Board Properties**: Show placeholders (`+ Property`) for empty fields on Kanban cards.
* **Dictionaries**: Named option lists with colors for select and multi-select columns, see [Dictionaries](#5-dictionaries-dict).
* **Global Tag Colors**: Add tags with a color (and remove or recolor them) to give them the same color across your vault. A dictionary color wins over a global one; tags without either get an automatic color.

---

## 🔒 100% Plain Markdown & Zero Lock-In

* All data is stored directly in your `.md` files as standard GitHub-Flavored Markdown tables.
* No hidden database files, no proprietary formats, no remote servers.
* If you disable or remove TableBase Plus, all your notes and tables remain completely intact and readable anywhere.

---

## 📄 License

MIT License © 2026 Emil Smolinski

---

## 🙏 Credits

This plugin is based on the work of Aleksei Chekodanov ([a269ch](https://github.com/a269ch)) and his [obsidian-tablebase](https://github.com/a269ch/obsidian-tablebase), released under the MIT license. His copyright notice is kept in [LICENSE](LICENSE).
