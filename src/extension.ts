/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ 
 */

import * as fs from "fs";
import * as net from 'net';
import * as path from 'path';
import * as vscode from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	Executable,
	ServerOptions,
	StreamInfo
} from 'vscode-languageclient/node';

const LABEL_RELOAD_WINDOW = "Reload Window";
const RELOAD_WINDOW_MESSAGE = "Please reload the window.";

const serverPort = 9865;
let socket: net.Socket;

let extensionContext: vscode.ExtensionContext;
let client: LanguageClient | null;

export function activate(context: vscode.ExtensionContext) {
	extensionContext = context;
    vscode.commands.registerCommand(
        "zenscript.restartServer",
        restartLanguageServer
    );
	socket = net.connect({port: serverPort}, () => {
		connectLanguageServer();
	})
	.setTimeout(1)
	.on("error", () =>{
		startLanguageServer();
	})
}

export function deactivate(): Thenable<void> | undefined {
	client = null;
	return;
}

function startLanguageServer() {
	vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (progress) => {
		return new Promise<void>((resolve, reject) => {
			const clientOptions: LanguageClientOptions = {
				documentSelector: [{ scheme: "file", language: "zenscript" }],
				synchronize: {
					fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
				},
			};
			const args = [
				"-jar",
				path.resolve(extensionContext.extensionPath, "server", "zenserver-1.0.jar"),
			];
			const executable: Executable = {
				command: findJavaExecutable('java'),
				args: args,
			};
			client = new LanguageClient(
				"zenscript",
				"ZenScript Language Client",
				executable,
				clientOptions
			);
			client.onReady().then(resolve, (reason: any) => {
				resolve();
			});
			const disposable = client.start();
			extensionContext.subscriptions.push(disposable);
		});
	});
}

function connectLanguageServer() {
	const serverOptions: ServerOptions = () => {
		return new Promise<StreamInfo>((resolve, reject) => {
			resolve({writer: socket, reader: socket});
		});
	};
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'zenscript' }],
		synchronize: {
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	};
	client = new LanguageClient(
		'zenscript',
		'ZenScript Language Client', 
		serverOptions,
		clientOptions
	);
	const disposable = client.start();
	extensionContext.subscriptions.push(disposable);
}

function restartLanguageServer() {
	socket = net.connect({port: serverPort}, () => {
		connectLanguageServer();
	})
	.setTimeout(1)
	.on("error", () =>{
		startLanguageServer();
	})
	if (!client) {

        return;
	}
	const oldLanguageClient = client;
	client = null;
	oldLanguageClient.stop().then(() => {
		startLanguageServer();
    },
        () => {
		//something went wrong restarting the language server...
		//this shouldn't happen, but if it does, the user can manually restart
		vscode.window
            .showWarningMessage(RELOAD_WINDOW_MESSAGE, LABEL_RELOAD_WINDOW)
            .then((action) => {
			if (action === LABEL_RELOAD_WINDOW) {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
			}
            });
        }
	);
}

// MIT Licensed code from: https://github.com/georgewfraser/vscode-javac
function findJavaExecutable(binname: string) {
	binname = correctBinname(binname);

	// First search each JAVA_HOME bin folder
	if (process.env['JAVA_HOME']) {
		const workspaces = process.env['JAVA_HOME'].split(path.delimiter);
		for (let i = 0; i < workspaces.length; i++) {
			const binpath = path.join(workspaces[i], 'bin', binname);
			if (fs.existsSync(binpath)) {
				return binpath;
			}
		}
	}

	// Then search PATH parts
	if (process.env['PATH']) {
		const pathparts = process.env['PATH'].split(path.delimiter);
		for (let i = 0; i < pathparts.length; i++) {
			const binpath = path.join(pathparts[i], binname);
			if (fs.existsSync(binpath)) {
				return binpath;
			}
		}
	}

	// Else return the binary name directly (this will likely always fail downstream) 
	return "";
}

function correctBinname(binname: string) {
	if (process.platform === 'win32')
		return binname + '.exe';
	else
		return binname;
}
