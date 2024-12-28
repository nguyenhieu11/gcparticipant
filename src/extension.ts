// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Registar a chat participant
	vscode.chat.createChatParticipant("GCParticipant", async (request, context, response, token) => {
		const userQuery = request.prompt;
		console.log("userQuery");
		console.log(userQuery);

		const chatModels = await vscode.lm.selectChatModels({ family: 'gpt-4o' });

		// const messages = [
		// 	vscode.LanguageModelChatMessage.User(userQuery)
		// ];

		/** I think the input message in Copilot chat should be:
		 * @gc-participant-name path_to_sequence_diagram_file_path
		 * After that:
		 * 	1/ Use fs to read data from this file
		 * 	2/ Parse information
		 * 	3/ Create request message for copilot
		 * 	4/ Send to Copilot use `chatModels[0].sendRequest`
		 * 	5/ Get response
		 * 	6/ Repeat send/get....
		 * 
		 */

		const messages = [
			vscode.LanguageModelChatMessage.User("How the best way to create code " +
				"from sequence diagram with Github Copilot?")
		];

		const chatRequest = await chatModels[0].sendRequest(messages, undefined, token);
		let data = '';
		for await (const token of chatRequest.text) {
			response.markdown(token);
			data += token;
		}
		console.log('data');
		console.log(data);
	});
}

// This method is called when your extension is deactivated
export function deactivate() { }
