import { writeFileSync } from "fs";
import { window, Disposable, EventEmitter, commands } from "vscode";

export interface MessageStream {
  registerMessageHandler(handler: (message: any) => void): Disposable;
  sendMessage(message: any): void;
}

export interface ExcalidrawEvent {
  type:
    | "init"
    | "update-vscode-document"
    | "save"
    | "save-dialog"
    | "execute-command";
  data: string;
  opts: any;
  actionId?: string;
}

export interface ExcalidrawAction {
  type: "load" | "save";
  data?: string;
  scale?: number;
}

export class ExcalidrawInstance implements Disposable {
  private disposables: Disposable[] = [];
  private readonly onInitEmitter = new EventEmitter<void>();
  public readonly onInit = this.onInitEmitter.event;
  private readonly onChangeEmitter = new EventEmitter<{
    newData: string;
    oldData: string | undefined;
  } | void>();
  public readonly onChange = this.onChangeEmitter.event;
  private readonly onSaveEmitter = new EventEmitter<string | void>();
  public readonly onSave = this.onSaveEmitter.event;

  private currentData: string | undefined = undefined;
  private currentActionId = 0;
  private responseHandlers = new Map<
    string,
    { resolve: (response: ExcalidrawEvent) => void; reject: Function }
  >();

  constructor(public readonly messageStream: MessageStream) {
    this.disposables.push(
      messageStream.registerMessageHandler((msg) =>
        this.handleEvent(msg as ExcalidrawEvent)
      )
    );
  }

  private async handleEvent(event: ExcalidrawEvent) {
    switch (event.type) {
      case "init":
        this.onInitEmitter.fire();
        break;
      case "update-vscode-document":
        const newData = JSON.stringify(event.data, null, 2);
        const oldData = this.currentData;
        this.currentData = newData;
        this.onChangeEmitter.fire({
          newData,
          oldData,
        });
        break;

      case "execute-command":
        await commands.executeCommand("brijeshb42-excalidraw.import");
        break;
      case "save-dialog":
        if (!event.opts) {
          window.showErrorMessage("File options are missing");
        }
        window
          .showSaveDialog({
            saveLabel: `Export as ${event.opts.suggestedName}`,
          })
          .then((uri) => {
            if (!uri) {
              return;
            }
            let modUri = uri.path;
            if (
              !modUri.endsWith(`.${event.opts.suggestedName.split(".")[1]}`)
            ) {
              modUri += `.${event.opts.suggestedName.split(".")[1]}`;
            }
            if (event.opts.suggestedName.split(".")[1] === "png") {
              writeFileSync(
                modUri,
                event.data.replace(/^data:image\/\w+;base64,/, ""),
                { encoding: "base64" }
              );
            } else {
              writeFileSync(modUri, event.data);
            }
          });
        break;
      case "save":
        this.onSaveEmitter.fire();
        break;
      default:
        // console.log(event);
        break;
    }

    if ("actionId" in event && event.actionId) {
      const responseHandler = this.responseHandlers.get(event.actionId);
      this.responseHandlers.delete(event.actionId);
      if (responseHandler) {
        responseHandler.resolve(event);
      }
    }
  }

  private sendAction(
    action: ExcalidrawAction,
    expectResponse: boolean = false
  ): Promise<ExcalidrawEvent> {
    return new Promise((resolve, reject) => {
      const actionId = `${this.currentActionId++}`;
      if (expectResponse) {
        this.responseHandlers.set(actionId, {
          resolve: (response) => resolve(response),
          reject,
        });
      }
      this.messageStream.sendMessage({
        ...action,
        actionId,
        source: "vscode-excalidraw",
      });

      if (!expectResponse) {
        resolve({} as ExcalidrawEvent);
      }
    });
  }

  public loadData(data: string) {
    this.currentData = undefined;
    this.sendAction({
      type: "load",
      data,
    });
  }

  dispose() {
    this.onInitEmitter.dispose();
    this.onChangeEmitter.dispose();
    this.onSaveEmitter.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
