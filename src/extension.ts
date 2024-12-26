import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "prompt-my-repo" is now active!');

    // Register a Tree Data Provider for the sidebar view
    const treeDataProvider = new TemplateTreeDataProvider(context);
    vscode.window.registerTreeDataProvider('prompt-my-repo.view', treeDataProvider);

    // Register a command to create a new template
    const createTemplateCommand = vscode.commands.registerCommand('prompt-my-repo.createTemplate', async () => {
        const templateName = await vscode.window.showInputBox({
            prompt: 'Enter a name for the new template',
            placeHolder: 'Template name'
        });

        if (templateName) {
            const templatePath = path.join(context.globalStorageUri.fsPath, templateName); // No file extension
            fs.writeFileSync(templatePath, ''); // Create an empty file
            treeDataProvider.refresh(); // Refresh the sidebar view
        }
    });

    // Register a command to open a template for editing
    const openTemplateCommand = vscode.commands.registerCommand('prompt-my-repo.openTemplate', (templatePath: string) => {
        if (templatePath) {
            vscode.window.showTextDocument(vscode.Uri.file(templatePath));
        } else {
            vscode.window.showErrorMessage('No template path provided.');
        }
    });

    // Register a command to delete a template
    const deleteTemplateCommand = vscode.commands.registerCommand('prompt-my-repo.deleteTemplate', (templatePath: string) => {
        if (templatePath) {
            fs.unlinkSync(templatePath); // Delete the file
            treeDataProvider.refresh(); // Refresh the sidebar view
        } else {
            vscode.window.showErrorMessage('No template path provided.');
        }
    });

    context.subscriptions.push(createTemplateCommand, openTemplateCommand, deleteTemplateCommand);
}

class TemplateTreeDataProvider implements vscode.TreeDataProvider<TemplateItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TemplateItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TemplateItem): vscode.TreeItem {
        return element;
    }

    getChildren(): Thenable<TemplateItem[]> {
        const templatesDir = this.context.globalStorageUri.fsPath;
        if (!fs.existsSync(templatesDir)) {
            fs.mkdirSync(templatesDir, { recursive: true });
        }

        // Read all files in the directory (without filtering for extensions)
        const templateFiles = fs.readdirSync(templatesDir).filter(file => !fs.statSync(path.join(templatesDir, file)).isDirectory());
        const templateItems = templateFiles.map(file => {
            const filePath = path.join(templatesDir, file);
            return new TemplateItem(file, filePath);
        });

        return Promise.resolve(templateItems);
    }
}

class TemplateItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);

        // Add buttons for opening and deleting the file
        this.tooltip = this.filePath;
        this.contextValue = 'templateItem'; // Used for context menus
        this.iconPath = new vscode.ThemeIcon('file'); // Add an icon to the item

        // Set the command to open the file
        this.command = {
            command: 'prompt-my-repo.openTemplate',
            title: 'Open Template',
            arguments: [this.filePath]
        };
    }
}

export function deactivate() {}