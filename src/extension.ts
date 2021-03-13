// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as path from "path";
import * as http from "http";
import * as fs from "fs";

import * as serverStatic from "serve-static";
import * as finalhandler from "finalhandler";

import * as vscode from "vscode";
import { AddressInfo } from "net";

import { ExcalidrawInstance } from "./ExcalidrawInstance";

const CREATE_REACT_DEV_SERVER_PORT =
  process.env.CREATE_REACT_DEV_SERVER_PORT || 3000;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

type ExcalidrawServer = http.Server | undefined;

function startServer(): ExcalidrawServer {
  const root = path.resolve(__dirname, "../build");
  if (fs.existsSync(root)) {
    const serve = serverStatic(root);
    return http.createServer(function (req, res) {
      serve(req as any, res as any, finalhandler(req, res));
    });
  }
  return;
}

function setupWebview(webview: vscode.Webview, port: number) {
  webview.options = {
    enableScripts: true,
  };
  webview.html = `<!DOCTYPE html><html>
  	<head>
  	<meta charset="UTF-8">
  	<meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline'; worker-src * data: 'unsafe-inline' 'unsafe-eval'; font-src * 'unsafe-inline' 'unsafe-eval';">
  	<style>
  		html { height: 100%; width: 100%; padding: 0; margin: 0; }
  		body { height: 100%; width: 100%; padding: 0; margin: 0; }
  		iframe { height: 100%; width: 100%; padding: 0; margin: 0; border: 0; display: block; }
  	</style>
  	</head>
  	<body onLoad="window.frames[0].focus();">
  		<iframe src="http://localhost:${port}/"></iframe>
  		<script>
      console.log("@@@@@@@@@@@@@@@@@ http://localhost:${port}/")
  			const api = acquireVsCodeApi();

  			window.addEventListener('message', event => {
  				console.log('# post message proxy ');
  				if (event.source === window.frames[0]) {
  					api.postMessage(event.data);
  				} else {
            const eventData = event.data;
  					window.frames[0].postMessage(eventData, 'http://localhost:${port}');
  				}
  			});
  		</script>
  	</body>
  	</html>`;

  return new ExcalidrawInstance({
    sendMessage: (msg) => webview.postMessage(msg),
    registerMessageHandler: (handler) => webview.onDidReceiveMessage(handler),
  });
}

class ExcalidrawEditorProvider
  implements vscode.CustomTextEditorProvider, vscode.Disposable {
  server: ExcalidrawServer;
  serverReady: Promise<number>;

  instances: {
    excalidrawInstance: ExcalidrawInstance;
    panel: vscode.WebviewPanel;
  }[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.server = startServer();
    this.serverReady = new Promise((resolve) => {
      this.server
        ? this.server.listen(undefined, "localhost", () => {
            resolve((this.server?.address() as AddressInfo).port);
          })
        : resolve(Number(CREATE_REACT_DEV_SERVER_PORT));
    });
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ) {
    let localDisposables: vscode.Disposable[] = [];
    let initialized = false;
    let firstChange = false;
    const port = await this.serverReady;
    const excalidrawInstance = setupWebview(webviewPanel.webview, port);

    let isEditorSaving = false;

    localDisposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (
          event.document !== document ||
          isEditorSaving ||
          event.contentChanges.length === 0
        ) {
          return;
        }

        excalidrawInstance.loadData(event.document.getText());
      })
    );

    localDisposables.push(
      excalidrawInstance.onChange(async (data) => {
        if (!firstChange) {
          firstChange = true;
          return;
        }

        if (!data || data.newData === document.getText()) {
          return;
        }

        const edit = new vscode.WorkspaceEdit();
        edit.replace(
          document.uri,
          new vscode.Range(0, 0, document.lineCount, 0),
          data.newData
        );
        isEditorSaving = true;
        try {
          await vscode.workspace.applyEdit(edit);
        } finally {
          isEditorSaving = false;
        }
      })
    );

    localDisposables.push(
      excalidrawInstance.onSave(async () => {
        await document.save();
      })
    );
    webviewPanel.onDidDispose(() => {
      localDisposables.forEach((d) => d.dispose());
      localDisposables = [];
      this.instances = this.instances.filter((i) => i.panel !== webviewPanel);
    });

    excalidrawInstance.onInit(() => {
      if (initialized) {
        return;
      }
      initialized = true;
      excalidrawInstance.loadData(document.getText());
    });

    this.instances.push({
      excalidrawInstance,
      panel: webviewPanel,
    });
  }

  dispose() {
    if (this.server) {
      this.server.close();
    }

    this.instances = [];
  }
}

export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  const provider = new ExcalidrawEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "brijeshb42-excalidraw.texteditor",
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  vscode.commands.registerCommand("brijeshb42-excalidraw.import", async () => {
    vscode.window
      .showOpenDialog({
        canSelectMany: false,
        filters: { "Excalidraw library": ["excalidrawlib"] },
      })
      .then((uri) => {
        if (!uri || !uri.length) {
          return;
        }
        // vscode.window.showInformationMessage(uri[0].path);
        fs.readFile(uri[0].path, (err, data) => {
          if (err) {
            return vscode.window.showErrorMessage(err.message);
          }
          // provider.instances.forEach((instance) => {
          provider.instances.length &&
            provider.instances[0].excalidrawInstance.messageStream.sendMessage({
              type: "import:lib",
              source: "vscode-excalidraw",
              data: data.toString(),
            });
          // });
        });
      });
  });
  context.subscriptions.push(provider);
}
