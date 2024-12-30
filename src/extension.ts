// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';


interface FilePathResult {
	lineIndex: number;
	relativePath: string;
}

function extractFilePath(input: string): FilePathResult[] {
	const result: FilePathResult[] = [];

	// Split the input into lines
	const lines = input.split('\n');

	/* `### <relative_path>`*/
	const pathRegex1 = /###\s+(\S+)/;
	const pathRegex2 = /###\s+\S+\s+`([^`]+)`/;

	const pathRegex3 = /\*\*\s+(\S+)/;
	const pathRegex4 = /\*\*\s+\S+\s+`([^`]+)`/;

	// Iterate through each line and check for the pattern `### <relative_path>`
	lines.forEach((line, index) => {
		let pathMatch1 = pathRegex1.exec(line.trim());
		if (pathMatch1) {
			// If a match is found, record the line number (1-based index)
			if (pathMatch1[1].includes('.')) {
				if (pathMatch1[1].includes('`')) {
					result.push({
						lineIndex: index,
						relativePath: pathMatch1[1].substring(pathMatch1[1].indexOf('`') + 1, pathMatch1[1].lastIndexOf('`'))
					});
				} else {
					result.push({ lineIndex: index, relativePath: pathMatch1[1] });
				}
			}
		}

		let pathMatch2 = pathRegex2.exec(line.trim());
		if (pathMatch2) {
			if (!pathMatch2[1].includes('`') && pathMatch2[1].includes('.')) {
				result.push({ lineIndex: index, relativePath: pathMatch2[1] });
			}
		}

		let pathMatch3 = pathRegex3.exec(line.trim());
		if (pathMatch3) {
			if (pathMatch3[1].includes('.')) {
				if (pathMatch3[1].includes('`')) {
					result.push({
						lineIndex: index,
						relativePath: pathMatch3[1].substring(pathMatch3[1].indexOf('`') + 1, pathMatch3[1].lastIndexOf('`'))
					});
				} else {
					result.push({ lineIndex: index, relativePath: pathMatch3[1] });
				}
			}
		}

		let pathMatch4 = pathRegex4.exec(line.trim());
		if (pathMatch4) {
			if (!pathMatch4[1].includes('`') && pathMatch4[1].includes('.')) {
				result.push({ lineIndex: index, relativePath: pathMatch4[1] });
			}
		}
	});

	return result;
}


interface CodeBlockIndex {
	startIndex: number;
	endIndex: number;
}

function extractCodeBlockIndices(input: string): CodeBlockIndex[] {
	const result: CodeBlockIndex[] = [];

	// Split the input into lines
	const lines = input.split('\n');

	// Regex to match start of code block (either cpp or cmake)
	const startRegex = /^```(cpp|cmake)$/;

	// Iterate through each line and find the start and end of code blocks
	let insideBlock = false;
	let startIndex = -1;

	lines.forEach((line, index) => {
		// Check for start of code block
		if (startRegex.test(line.trim()) && !insideBlock) {
			insideBlock = true;
			startIndex = index;  // Capture the start line index
		}

		// Check for end of code block (```)
		if (insideBlock && line.trim() === '```') {
			result.push({ startIndex: startIndex + 1, endIndex: index - 1 });  // Capture the end line index
			insideBlock = false;  // Reset block flag
			startIndex = -1;  // Reset start index
		}
	});

	return result;
}


function writeCodeBlockToFile(input: string, outputPath: string, filePaths: FilePathResult[], codeBlockIndices: CodeBlockIndex[]): void {
	// Ensure the output directory exists
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	for (const filePath of filePaths) {
		for (let iBlock = 0; iBlock < codeBlockIndices.length; iBlock++) {
			if (codeBlockIndices[iBlock].startIndex > filePath.lineIndex) {
				const { startIndex, endIndex } = codeBlockIndices[iBlock];
				const codeBlock = input.split('\n').slice(startIndex, endIndex + 1);

				/** chose this block for this filepath and break */
				// Combine the outputPath with the relative path to get the full file path
				const fullPath = path.join(outputPath, filePath.relativePath);
				const fileDir = path.dirname(fullPath);

				// Ensure the directory exists
				if (!fs.existsSync(fileDir)) {
					fs.mkdirSync(fileDir, { recursive: true });
				}

				// Write the code block to the file
				fs.writeFileSync(fullPath, codeBlock.join('\n'), 'utf8');
				console.log(`Written to file: ${fullPath}`);

				break;
			}
		}

	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Registar a chat participant
	vscode.chat.createChatParticipant("GCParticipant", async (request, context, response, token) => {
		const userQuery = request.prompt;

		/* 1. Get config file path from prompt */
		const configFilePath = userQuery;
		console.log('configFilePath');
		console.log(configFilePath);
		const contentOfFile = fs.readFileSync(configFilePath, 'utf8');
		const config = JSON.parse(contentOfFile);
		const inputFilePath = config.input_file_path;
		const outputPath = config.output_path;

		let generated_promp = "";
		generated_promp += "Generate C++ project from PlantUML\n";
		generated_promp += "Split into sub files (header files in /include/ directory + source files in /source/ directory)";
		generated_promp += "and have cmakelists.txt and main.cpp:";
		generated_promp += "The relative path of file must have format is `relative_path`";
		generated_promp += fs.readFileSync(inputFilePath, 'utf8');

		console.log("generated_promp");
		console.log(generated_promp);

		const chatModels = await vscode.lm.selectChatModels({ family: 'gpt-4o' });

		const messages = [
			vscode.LanguageModelChatMessage.User(generated_promp)
		];

		const chatRequest = await chatModels[0].sendRequest(messages, undefined, token);
		let data = '';
		for await (const token of chatRequest.text) {
			response.markdown(token);
			data += token;
		}
		console.log('data');
		console.log(data);

		const filePath = extractFilePath(data);
		console.log('filePath');
		console.log(filePath);

		const codeBlockIndices = extractCodeBlockIndices(data);
		console.log('codeBlockIndices');
		console.log(codeBlockIndices);

		writeCodeBlockToFile(data, outputPath, filePath, codeBlockIndices);



		// for (const { relativePath, content } of fileData) {
		// 	const filePath = path.join(outputPath, relativePath);
		// 	/* write content to file */
		// 	fs.writeFileSync(filePath, content);

		// }
	});
}

// This method is called when your extension is deactivated
export function deactivate() { }
