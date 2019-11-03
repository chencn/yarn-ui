import {
    ExtensionContext,
    TreeDataProvider,
    Event,
    EventEmitter,
    TreeItem,
    workspace,
    window,
    TreeItemCollapsibleState,
    Command,
    WorkspaceFolder,
    ThemeIcon,
    Terminal,
    commands,
} from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { capitalize } from 'lodash';

const iconSvg = require('../resources/icon.svg');

class YarnProvider implements TreeDataProvider<Project | Script> {
    private _onDidChangeTreeData: EventEmitter<Project | Script | undefined> = new EventEmitter<Project | Script | undefined>();
    readonly onDidChangeTreeData: Event<Project | Script | undefined> = this._onDidChangeTreeData.event;

    constructor(private readonly ctx: ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Project | Script): TreeItem {
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

    private getProjects(): TreeItem[] {
        const projects = workspace.workspaceFolders;
        if (!projects || projects.length === 0) {
            window.showInformationMessage('Workspace has no folder containing package.json');
            return [new TreeItem('No workspace folder contain a package.json.', TreeItemCollapsibleState.None)];
        }
        const projs = projects.map(project => new Project(this.ctx, project)).filter(project => !!project.packagePath);

        const packagesJsonPaths = projs.map(project => project.packagePath);

        this.ctx.subscriptions.push(
            workspace.onDidSaveTextDocument(e => {
                if (packagesJsonPaths.includes(e.fileName)) {
                    this.refresh();
                }
            }),
        );

        return projs;
    }

    private getScripts(project: Project): Script[] {
        if (!project.packagePath) {
            return [];
        }

        const packageJson = JSON.parse(fs.readFileSync(project.packagePath, 'utf-8'));
        const scripts = packageJson.scripts;
        if (!scripts) {
            return [];
        }

        let command = workspace.getConfiguration().get('yarn-ui.setting.choose-yarn-or-npm') == 'yarn' ? 'yarn' : 'npm run';
        return Object.keys(scripts).map(
            scriptName =>
                new Script(this.ctx, capitalize(scriptName), TreeItemCollapsibleState.None, {
                    title: scriptName,
                    command: 'extension.runCommand',
                    arguments: [
                        {
                            command: `${command} ${scriptName}`,
                            project,
                        } as RunInTerminalOptions,
                    ],
                }),
        );
    }
}

class Script extends TreeItem {
    constructor(ctx: ExtensionContext, label: string, collapsibleState: TreeItemCollapsibleState, commandToRun: Command) {
        super(label, collapsibleState);
        this.command = commandToRun;
        this.iconPath = ctx.asAbsolutePath(iconSvg);
        this.contextValue = 'script';
    }
}

class Project extends TreeItem {
    public readonly packagePath?: string;
    private _terminal?: Terminal = undefined;
    private terminalReuseMessageShown: boolean = false;

    constructor(private ctx: ExtensionContext, workspaceFolder: WorkspaceFolder) {
        super(workspaceFolder.name, TreeItemCollapsibleState.Expanded);
        super.iconPath = ThemeIcon.Folder;
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

    private get terminal() {
        if (!this.packagePath) {
            throw new Error('Trying to launch a terminal for a project with no package.json');
        }
        if (typeof this._terminal === 'undefined') {
            this._terminal = window.createTerminal({
                name: `Yarn UI - ${this.label}`,
                cwd: path.dirname(this.packagePath),
            });
        }
        this.ctx.subscriptions.push(
            window.onDidCloseTerminal(t => {
                if (t === this._terminal) {
                    this._terminal.dispose();
                    this._terminal = undefined;
                }
            }),
        );
        return this._terminal;
    }

    public runInTerminal(command: string) {
        try {
            this.terminal.show();
            this.terminal.sendText(command);
            if (!this.terminalReuseMessageShown) {
                this.terminal.sendText(`"This terminal will be re-used for yarn scripts of this project (${this.label})."`);
                this.terminalReuseMessageShown = true;
            }
        } catch (err) {
            window.showErrorMessage(`Failed to run ${command}`);
        }
    }
}

interface RunInTerminalOptions {
    command: string;
    project: Project;
}

function runInTerminal({ command, project }: RunInTerminalOptions) {
    project.runInTerminal(command);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
/**
 * @param {ExtensionContext} context
 */
function activate(context: ExtensionContext) {
    context.subscriptions.push(window.registerTreeDataProvider('yarn-ui-scripts', new YarnProvider(context)));
    context.subscriptions.push(
        commands.registerCommand('extension.runCommand', (command: RunInTerminalOptions) => {
            runInTerminal(command);
        }),
    );
}

exports.activate = activate;

// 插件被释放是的命令
function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
