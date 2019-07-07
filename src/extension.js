// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require('vscode');
const capitalize = require("lodash.capitalize");
class ScriptsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            const rootPath = vscode.workspace.rootPath;

            const scripts = require(rootPath + "\\package.json").scripts;

            return Promise.resolve(Object.keys(scripts || {}).map((scriptName) => new Script(capitalize(scriptName), vscode.TreeItemCollapsibleState.None, {
                "title": "<unused>",
                "command": "extension.runCommand",
                "arguments": scripts ? [`yarn ${scriptName}`] : [""]
            })));
        }
        return Promise.resolve([]);
    }
}
class Script extends vscode.TreeItem {
    constructor(label, collapsibleState, commandToRun) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.command = commandToRun;
        this.iconPath = {
            light: 'resources/icon.svg',
            dark: 'resources/icon.svg'
        };
        this.contextValue = 'script';
    }
}
function runInTerminal(command) {
    try {
        const terminal = vscode.window.createTerminal("yarn_ui");
        terminal.show();
        terminal.sendText(command);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Failed to run ${command}`);
    }
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "yarn-ui" is now active!');


    // 注册扩展命令
    let disposable = vscode.commands.registerCommand('extension.yarnUi', function () {
        // The code you place here will be executed every time your command is executed

        //在右下角弹窗
        vscode.window.showInformationMessage('欢迎使用yran-ui');

    });
    context.subscriptions.push(disposable);
    context.subscriptions.push(vscode.window.registerTreeDataProvider("yarn-ui-scripts", new ScriptsProvider()))
    context.subscriptions.push(vscode.commands.registerCommand('extension.runCommand', (command) => {
        runInTerminal(command);
    }));
}



exports.activate = activate;

// 插件被释放是的命令
function deactivate() {

}

module.exports = {
    activate,
    deactivate
}
