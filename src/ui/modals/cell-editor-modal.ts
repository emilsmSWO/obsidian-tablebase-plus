import { App, Modal, Setting } from "obsidian";

interface CellEditorModalOptions {
  app: App;
  value: string;
  onSave: (value: string) => void | Promise<void>;
  /** Called when the modal is closed without saving. */
  onCancel: () => void;
}

export class CellEditorModal extends Modal {
  private options: CellEditorModalOptions;
  private saved = false;

  constructor(options: CellEditorModalOptions) {
    super(options.app);
    this.options = options;
  }

  override onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ms-modal-cell-editor");
    this.titleEl.setText("Edit cell");

    const area = contentEl.createEl("textarea", {
      cls: "ms-cell-editor-area",
      attr: { rows: "10", spellcheck: "false" },
    });
    area.value = this.options.value;
    contentEl.createDiv({
      cls: "ms-modal-section-desc",
      text: "Enter adds a new line (stored as <br>). Ctrl/Cmd+Enter saves.",
    });

    const save = (): void => {
      this.saved = true;
      void this.options.onSave(area.value);
      this.close();
    };
    area.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save();
      }
    });
    window.setTimeout(() => area.focus(), 50);

    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText("Save").setCta().onClick(save))
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()));
  }

  override onClose(): void {
    this.contentEl.empty();
    if (!this.saved) this.options.onCancel();
  }
}
