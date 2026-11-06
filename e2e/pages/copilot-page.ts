import { expect, type Locator, type Page } from "@playwright/test";

/** The edges and corners a floating window can be resized from. */
export type CopilotResizeDirection =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

/**
 * Page object for the BV-BRC Copilot: the navbar launcher, the three surfaces
 * (side panel, floating window, full page), the options menu, the composer, the
 * transcript, the floating window's resize handles, and the clarification,
 * execution and plan cards. Cards and the composer live inside `panel`, which
 * is the open Copilot dialog whichever surface shows it. Backend mocks and
 * request capture stay in the spec.
 */
export class CopilotPage {
  readonly page: Page;

  // Surfaces
  readonly launcher: Locator;
  /** The open Copilot dialog: the side panel or the floating window. */
  readonly panel: Locator;
  /** The floating window only; it is a non-modal dialog. */
  readonly floating: Locator;
  readonly newChatDialog: Locator;
  readonly sideSheet: Locator;
  readonly sideSheetOverlay: Locator;
  readonly chatList: Locator;
  readonly emptyChatList: Locator;
  readonly emptyState: Locator;

  // Options menu
  readonly optionsButton: Locator;
  readonly menu: Locator;
  readonly closeButton: Locator;

  // Composer
  readonly composer: Locator;
  readonly sendButton: Locator;
  readonly fileInput: Locator;
  readonly attachedFiles: Locator;
  readonly executeNotice: Locator;

  // Transcript
  readonly whatIDidTrigger: Locator;
  readonly goodAnswerButton: Locator;

  // Clarification card
  readonly clarificationIntro: Locator;
  readonly sendAnswersButton: Locator;
  /** The inline validation alert, found by its text (Next's route announcer is an alert too). */
  readonly missingAnswerAlert: Locator;

  // Execution card
  readonly preparedNotice: Locator;
  readonly submitQuestion: Locator;
  readonly submitButton: Locator;
  readonly declineButton: Locator;
  readonly notSubmittedNotice: Locator;
  readonly changePrompt: Locator;
  readonly changeBox: Locator;

  // Plan card
  readonly draftBadge: Locator;
  readonly runPlanButton: Locator;
  readonly continuePlanButton: Locator;
  readonly editPlanButton: Locator;
  readonly saveChangesButton: Locator;
  readonly addStepButton: Locator;
  readonly allStepsDone: Locator;
  readonly planStepQuestion: Locator;

  constructor(page: Page) {
    this.page = page;

    this.launcher = page.getByRole("button", { name: "Open AskClark" });
    this.panel = page.getByRole("dialog");
    this.floating = page.locator('[role="dialog"][aria-modal="false"]');
    this.newChatDialog = page.getByRole("dialog", { name: /New chat/ });
    this.sideSheet = page.locator('[data-slot="sheet-content"]');
    this.sideSheetOverlay = page.locator('[data-slot="sheet-overlay"]');
    this.chatList = page.getByRole("complementary", { name: "Your chats" });
    this.emptyChatList = page.getByText("No chats yet.");
    this.emptyState = page.getByText("Ask AskClark");

    this.optionsButton = page.getByRole("button", { name: "AskClark options" });
    this.menu = page.getByRole("menu");
    this.closeButton = page
      .getByRole("button", { name: "Close AskClark" })
      .first();

    const panel = this.panel;
    this.composer = panel.getByRole("textbox", { name: "Ask AskClark" });
    this.sendButton = panel.getByRole("button", { name: "Send" });
    this.fileInput = panel.locator('input[type="file"]');
    this.attachedFiles = panel.getByRole("list", { name: "Attached files" });
    this.executeNotice = panel.getByText(
      /Execute mode: AskClark may submit jobs/,
    );

    this.whatIDidTrigger = panel.getByText("What I did (1 step)");
    this.goodAnswerButton = panel.getByRole("button", { name: "Good answer" });

    this.clarificationIntro = panel.getByText(
      "Before I create a plan, I have a few questions",
    );
    this.sendAnswersButton = panel.getByRole("button", {
      name: "Send answers",
    });
    this.missingAnswerAlert = panel
      .getByRole("alert")
      .filter({ hasText: /^Please answer/ });

    this.preparedNotice = panel.getByText("Prepared — nothing submitted yet");
    this.submitQuestion = panel.getByText("Submit this job?");
    this.submitButton = panel.getByRole("button", { name: "Yes, submit it" });
    this.declineButton = panel.getByRole("button", { name: "No", exact: true });
    this.notSubmittedNotice = panel.getByText("Not submitted.");
    this.changePrompt = panel.getByText("Should anything be changed?");
    this.changeBox = panel.getByRole("textbox", { name: "Describe the change" });

    this.draftBadge = panel.getByText("Draft");
    this.runPlanButton = panel.getByRole("button", { name: "Run plan" });
    this.continuePlanButton = panel.getByRole("button", {
      name: "Continue plan",
    });
    this.editPlanButton = panel.getByRole("button", { name: "Edit" });
    this.saveChangesButton = panel.getByRole("button", {
      name: "Save changes",
    });
    this.addStepButton = panel.getByRole("button", { name: "Add a step" });
    this.allStepsDone = panel.getByText("All steps are done.");
    this.planStepQuestion = panel.getByText("Execute plan step:");
  }

  /** Load a page (any route that shows the navbar launcher). */
  async goto(path = "/jobs"): Promise<void> {
    await this.page.goto(path);
  }

  /** Click the navbar launcher. */
  async open(): Promise<void> {
    await this.launcher.click();
  }

  /** Load `path` and open the Copilot from the navbar. */
  async gotoAndOpen(path = "/jobs"): Promise<void> {
    await this.goto(path);
    await this.open();
  }

  /** The full-page chat. */
  async openFullPage(): Promise<void> {
    await this.goto("/copilot");
  }

  // Options menu

  async openOptions(): Promise<void> {
    await this.optionsButton.click();
  }

  async moveToFloating(): Promise<void> {
    await this.openOptions();
    await this.page.getByRole("menuitem", { name: "Floating window" }).click();
  }

  async moveToSidePanel(): Promise<void> {
    await this.openOptions();
    await this.page.getByRole("menuitem", { name: "Side panel" }).click();
  }

  /** Wait for the side panel's closing animation and menu to clear, so a press cannot land on the backdrop. */
  async waitForFloatingSettled(): Promise<void> {
    await expect(this.floating).toBeVisible();
    await expect(this.sideSheetOverlay).toHaveCount(0);
    await expect(this.menu).toBeHidden();
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }

  // Composer

  suggestion(text: string): Locator {
    return this.panel.getByRole("button", { name: text });
  }

  /** Type into the composer and press Enter. */
  async ask(text: string): Promise<void> {
    await this.composer.fill(text);
    await this.composer.press("Enter");
  }

  async send(): Promise<void> {
    await this.sendButton.click();
  }

  modeRadio(mode: "Plan" | "Execute"): Locator {
    return this.panel.getByRole("radio", { name: mode });
  }

  async attach(file: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<void> {
    await this.fileInput.setInputFiles(file);
  }

  // Transcript

  answerText(text: string): Locator {
    return this.panel.getByText(text);
  }

  get boldAnswer(): Locator {
    return this.panel.getByRole("strong");
  }

  // Resize

  resizeHandle(direction: CopilotResizeDirection): Locator {
    return this.floating.locator(`[data-resize-handle="${direction}"]`);
  }

  async floatingBox(): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> {
    const box = await this.floating.boundingBox();
    if (!box) throw new Error("floating window has no box");
    return box;
  }

  /** Press on a handle's centre and drag it by (dx, dy). */
  async dragHandle(
    direction: CopilotResizeDirection,
    dx: number,
    dy: number,
  ): Promise<void> {
    const box = await this.resizeHandle(direction).boundingBox();
    if (!box) throw new Error(`no ${direction} handle`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x + dx, y + dy, { steps: 5 });
    await this.page.mouse.up();
  }

  // Clarification card

  async answerQuestion(label: string, text: string): Promise<void> {
    await this.panel
      .getByRole("textbox", { name: `Your answer to: ${label}` })
      .fill(text);
  }

  option(label: string): Locator {
    return this.panel.getByRole("button", { name: label });
  }

  // Execution card

  async decline(): Promise<void> {
    await this.declineButton.click();
  }

  async describeChange(text: string): Promise<void> {
    await this.changeBox.fill(text);
    await this.changeBox.press("Enter");
  }

  // Plan card

  planHeading(title: string): Locator {
    return this.panel.getByRole("heading", { name: title });
  }

  stepBox(number: number): Locator {
    return this.panel.getByRole("textbox", {
      name: `Step ${String(number)}: what to do`,
    });
  }

  moveStepUp(number: number): Locator {
    return this.panel.getByRole("button", {
      name: `Move step ${String(number)} up`,
    });
  }
}
