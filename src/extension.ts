import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { capitalize } from 'lodash';

const iconSvg = require('../resources/icon.svg');

class YarnProvider implements vscode.TreeDataProvider<Project | Script> {
    private _onDidChangeTreeData: vscode.EventEmitter<Project | Script | undefined> = new vscode.EventEmitter<Project | Script | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Project | Script | undefined> = this._onDidChangeTreeData.event;

	constructor(private readonly ctx: vscode.ExtensionContext) { }

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
                    return Promise.resolve(this.getScripts(proj));
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
        const projs = projects
            .map(project => new Project(project))
            .filter(project => !!project.packagePath);

        const packagesJsonPaths = projs.map(project => project.packagePath);

        this.ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(e => {
            if (packagesJsonPaths.includes(e.fileName)) {
                this.refresh();
            }
        }));

        return projs;
    }

    private getScripts(project: Project): Script[] {
        if (!project.packagePath) { return []; }

        const packageJson = JSON.parse(fs.readFileSync(project.packagePath, 'utf-8'));
        const scripts = packageJson.scripts;
        if (!scripts) { return []; }

        let command = vscode.workspace.getConfiguration().get('yarn-ui.setting.choose-yarn-or-npm') == 'yarn' ? 'yarn' : 'npm run';
        return Object.keys(scripts).map(scriptName => new Script(this.ctx, capitalize(scriptName), vscode.TreeItemCollapsibleState.None, {
            "title": scriptName,
            "command": "extension.runCommand",
            "arguments": [
                {
                    terminal: project.terminal,
                    command: `${command} ${scriptName}`,
                    project
                } as RunInTerminalOptions
            ]
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
    private _terminal?: vscode.Terminal = undefined;
    public terminalReuseMessageShown: boolean = false;

    constructor(
        workspaceFolder: vscode.WorkspaceFolder,
    ) {
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
    
    public get terminal() {
        if (!this.packagePath) {
            throw new Error('Trying to launch a terminal for a project with no package.json');
        }
        if (typeof this._terminal === 'undefined') {
            this._terminal = vscode.window.createTerminal({
                name: `Yarn UI - ${this.label}`,
                cwd: path.dirname(this.packagePath)
            });
        }
        return this._terminal;
    }
}

interface RunInTerminalOptions {
    terminal: vscode.Terminal,
    command: string,
    project: Project
}

function runInTerminal({ terminal, command, project }: RunInTerminalOptions) {
    try {
        terminal.show();
        terminal.sendText(command);
        if (!project.terminalReuseMessageShown) {
            terminal.sendText(`"This terminal will be re-used for yarn scripts of this project (${project.label})."`);
            project.terminalReuseMessageShown = true;
        }
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
    context.subscriptions.push(vscode.commands.registerCommand('extension.runCommand', (command: RunInTerminalOptions) => {
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
