/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as net from "net";
import { workspace, ExtensionContext } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	StreamInfo,
} from 'vscode-languageclient/node';

const serverPort = 9865;

let client: LanguageClient;
let socket: net.Socket;

export function activate(context: ExtensionContext) {

	const serverOptions: ServerOptions = () => {
		return new Promise<StreamInfo>((resolve, reject) => {
			console.log("Connecting server");
			socket = net.connect({port: serverPort});
			resolve({writer: socket, reader: socket});
		});
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'zenscript' }],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	client = new LanguageClient('languageClientExample','Language Client Example', serverOptions, clientOptions);
	const disposable = client.start();
	context.subscriptions.push(disposable);
}

export function deactivate(): Thenable<void> | undefined {
	console.log("Closing connection");
	socket.end();

	if (!client) {
		return undefined;
	}
	return client.stop();
}
