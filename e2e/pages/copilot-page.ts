import { expect, type Locator, type Page } from "@playwright/test";
import { copilotName } from "@/lib/copilot/name";

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
 * Page object for the BV-BRC Copilot. Cards and the composer live inside
 * `panel`, the open chat whichever surface shows it (the side panel is a
 * landmark, the floating window a dialog); backend mocks stay in the spec.
 */
export class CopilotPage {
  readonly page: Page;

  /** The page's own content, which the side panel pushes aside on a desktop. */
  readonly main: Locator;
  /** The navbar button while the chat is closed. */
  readonly launcher: Locator;
  readonly panel: Locator;
  readonly floating: Locator;
  readonly newChatDialog: Locator;
  readonly sidePanel: Locator;
  /** The minimized chat's tab on the window edge. */
  readonly edgeTab: Locator;
  readonly chatList: Locator;
  readonly emptyChatList: Locator;
  readonly emptyState: Locator;

  readonly layoutButton: Locator;
  readonly menu: Locator;
  readonly minimizeButton: Locator;
  readonly closeButton: Locator;

  readonly composer: Locator;
  readonly sendButton: Locator;
  readonly fileInput: Locator;
  readonly attachedFiles: Locator;
  readonly executeNotice: Locator;

  readonly whatIDidTrigger: Locator;
  readonly goodAnswerButton: Locator;

  readonly clarificationIntro: Locator;
  readonly sendAnswersButton: Locator;
  /** Found by its text: Next's route announcer is an alert too. */
  readonly missingAnswerAlert: Locator;

  readonly preparedNotice: Locator;
  readonly submitQuestion: Locator;
  readonly submitButton: Locator;
  readonly declineButton: Locator;
  readonly notSubmittedNotice: Locator;
  readonly changePrompt: Locator;
  readonly changeBox: Locator;

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

    this.main = page.locator("main");
    this.launcher = this.navbarButton("Open");
    this.sidePanel = page.getByRole("complementary", {
      name: copilotName,
      exact: true,
    });
    this.panel = this.sidePanel.or(page.getByRole("dialog"));
    this.floating = page.locator('[role="dialog"][aria-modal="false"]');
    this.newChatDialog = page.getByRole("dialog", { name: /New chat/ });
    this.edgeTab = page
      .getByRole("button", { name: `Restore ${copilotName}` })
      .and(page.getByTitle(/Drag to move\./));
    this.chatList = page.getByRole("complementary", { name: "Your chats" });
    this.emptyChatList = page.getByText("No chats yet.");
    this.emptyState = page.getByText(`Ask ${copilotName}`);

    this.layoutButton = page.getByRole("button", {
      name: `Change ${copilotName} layout`,
    });
    this.menu = page.getByRole("menu");
    this.minimizeButton = this.panel.getByRole("button", {
      name: `Minimize ${copilotName}`,
    });
    this.closeButton = this.panel.getByRole("button", {
      name: `Close ${copilotName}`,
    });

    const panel = this.panel;
    this.composer = panel.getByRole("textbox", { name: `Ask ${copilotName}` });
    this.sendButton = panel.getByRole("button", { name: "Send" });
    this.fileInput = panel.locator('input[type="file"]');
    this.attachedFiles = panel.getByRole("list", { name: "Attached files" });
    this.executeNotice = panel.getByText(
      new RegExp(`Execute mode: ${copilotName} may submit jobs`),
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

  async goto(path = "/jobs"): Promise<void> {
    await this.page.goto(path);
  }

  async open(): Promise<void> {
    await this.launcher.click();
  }

  async gotoAndOpen(path = "/jobs"): Promise<void> {
    await this.goto(path);
    await this.open();
  }

  /** The width of the page's content, which shrinks while the side panel pushes it. */
  async mainWidth(): Promise<number> {
    return this.main.evaluate((element) => element.getBoundingClientRect().width);
  }

  /** The width of the window's viewport, without a scrollbar. */
  async pageWidth(): Promise<number> {
    return this.page.evaluate(() => document.documentElement.clientWidth);
  }

  async openFullPage(): Promise<void> {
    await this.goto("/copilot");
  }

  /** The navbar's AskClark button: Open while closed, Minimize while open, Restore while minimized. */
  navbarButton(action: "Open" | "Minimize" | "Restore"): Locator {
    return this.page
      .locator("#navbar-container")
      .getByRole("button", { name: `${action} ${copilotName}` });
  }

  async openLayoutMenu(): Promise<void> {
    await this.layoutButton.click();
  }

  async moveToFloating(): Promise<void> {
    await this.openLayoutMenu();
    await this.page.getByRole("menuitem", { name: "Floating window" }).click();
  }

  async moveToSidePanel(): Promise<void> {
    await this.openLayoutMenu();
    await this.page.getByRole("menuitem", { name: "Side panel" }).click();
  }

  /** Waits so a press cannot land on the closing layout menu. */
  async waitForFloatingSettled(): Promise<void> {
    await expect(this.floating).toBeVisible();
    await expect(this.menu).toBeHidden();
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }

  suggestion(text: string): Locator {
    return this.panel.getByRole("button", { name: text });
  }

  async ask(text: string): Promise<void> {
    await this.composer.fill(text);
    await this.composer.press("Enter");
  }

  async send(): Promise<void> {
    await this.sendButton.click();
  }

  /** The composer's mode menu button; it names the current mode. */
  modeButton(mode: "Plan" | "Execute"): Locator {
    return this.panel.getByRole("button", { name: `${copilotName} mode: ${mode}` });
  }

  async chooseMode(from: "Plan" | "Execute", to: "Plan" | "Execute"): Promise<void> {
    await this.modeButton(from).click();
    await this.page.getByRole("menuitemradio", { name: new RegExp(to) }).click();
  }

  async attach(file: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<void> {
    await this.fileInput.setInputFiles(file);
  }

  answerText(text: string): Locator {
    return this.panel.getByText(text);
  }

  get boldAnswer(): Locator {
    return this.panel.getByRole("strong");
  }

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

  async answerQuestion(label: string, text: string): Promise<void> {
    await this.panel
      .getByRole("textbox", { name: `Your answer to: ${label}` })
      .fill(text);
  }

  option(label: string): Locator {
    return this.panel.getByRole("button", { name: label });
  }

  async decline(): Promise<void> {
    await this.declineButton.click();
  }

  async describeChange(text: string): Promise<void> {
    await this.changeBox.fill(text);
    await this.changeBox.press("Enter");
  }

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
