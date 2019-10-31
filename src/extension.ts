import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { capitalize } from 'lodash';

const iconSvg = require('../resources/icon.svg');

class YarnProvider implements vscode.TreeDataProvider<Project | Script> {
    private _onDidChangeTreeData: vscode.EventEmitter<Project | Script | undefined> = new vscode.EventEmitter<Project | Script | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Project | Script | undefined> = this._onDidChangeTreeData.event;

	constructor(private readonly ctx: vscode.ExtensionContext) {
        console.log("Yarn UI provider initialized.");
     }

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Project | Script): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Project | Script): Thenable<Project[] | Script[]> {
        if (!element) {
            // Return childrens of root (Projects)
            return Promise.resolve(this.getProjects());
        } else {
            // element should be a Project
            if (element.contextValue === 'project') {
                const proj = element as Project;
                if (proj.packagePath) {
                    return Promise.resolve(this.getScripts(proj.packagePath));
                }
                return Promise.resolve([]);
            }
            return Promise.resolve([]);
        }

    }
    
    private getProjects(): vscode.TreeItem[] {
        const projects = vscode.workspace.workspaceFolders;
        if (!projects || projects.length === 0) {
            vscode.window.showInformationMessage('Workspace has no folder containing package.json');
            return [new vscode.TreeItem('No workspace folder contain a package.json.', vscode.TreeItemCollapsibleState.None)];
        }
        return projects
            .map(project => new Project(project))
            .filter(project => !!project.packagePath);
    }

    private getScripts(packageJsonPath: string): Script[] {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const scripts = packageJson.scripts;
        let command = vscode.workspace.getConfiguration().get('yarn-ui.setting.choose-yarn-or-npm') == 'yarn' ? 'yarn' : 'npm run';
        return Object.keys(scripts || {}).map((scriptName) => new Script(this.ctx, capitalize(scriptName), vscode.TreeItemCollapsibleState.None, {
            "title": "<unused>",
            "command": "extension.runCommand",
            "arguments": scripts ? [`${command} ${scriptName}`] : [""]
        }));
    }
}

class Script extends vscode.TreeItem {
    constructor(ctx: vscode.ExtensionContext, label: string, collapsibleState: vscode.TreeItemCollapsibleState, commandToRun: vscode.Command) {
        super(label, collapsibleState);
        this.command = commandToRun;
        this.iconPath = ctx.asAbsolutePath(iconSvg);
        this.contextValue = 'script';
    }
}

class Project extends vscode.TreeItem {
    public readonly packagePath?: string;

    constructor(workspaceFolder: vscode.WorkspaceFolder) {
        super(workspaceFolder.name, vscode.TreeItemCollapsibleState.Expanded);
        super.iconPath = vscode.ThemeIcon.Folder;
        this.contextValue = 'project';
        
        const pkg = path.join(workspaceFolder.uri.fsPath, 'package.json');
        this.packagePath = this.pathExists(pkg) ? pkg : undefined;
    }

    private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}

		return true;
	}
}

function runInTerminal(command: any) {
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
function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.window.registerTreeDataProvider("yarn-ui-scripts", new YarnProvider(context)));
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
