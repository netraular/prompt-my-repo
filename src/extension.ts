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
            const templatePath = path.join(context.globalStorageUri.fsPath, templateName);
            fs.writeFileSync(templatePath, ''); // Create an empty file
            treeDataProvider.refresh(); // Refresh the sidebar view
        }
    });

    // Register a command to open a template for editing
    const openTemplateCommand = vscode.commands.registerCommand('prompt-my-repo.openTemplate', (arg: string | TemplateItem) => {
        let templatePath: string;
        if (typeof arg === 'string') {
            templatePath = arg;
        } else if (arg instanceof TemplateItem) {
            templatePath = arg.filePath;
        } else {
            vscode.window.showErrorMessage('Invalid argument provided to openTemplate command.');
            return;
        }

        if (templatePath) {
            vscode.window.showTextDocument(vscode.Uri.file(templatePath));
        } else {
            vscode.window.showErrorMessage('No template path provided.');
        }
    });

    // Register a command to delete a template
    const deleteTemplateCommand = vscode.commands.registerCommand('prompt-my-repo.deleteTemplate', (templateItem: TemplateItem) => {
        if (templateItem && templateItem.filePath) {
            fs.unlinkSync(templateItem.filePath); // Delete the file
            treeDataProvider.refresh(); // Refresh the sidebar view
        } else {
            vscode.window.showErrorMessage('No template path provided.');
        }
    });

    // Register a command to copy the contents of a template
    const copyTemplateCommand = vscode.commands.registerCommand('prompt-my-repo.copyTemplate', async (templateItem: TemplateItem) => {
        if (templateItem && templateItem.filePath) {
            const templateContent = fs.readFileSync(templateItem.filePath, 'utf-8');
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder is open.');
                return;
            }

            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const lines = templateContent
                .split('\n')
                .map(line => line.trim()) // Trim whitespace
                .filter(line => line !== ''); // Ignore empty lines

            let allFiles: string[] = [];
            const treeDataProvider = new TemplateTreeDataProvider(context);

            for (const line of lines) {
                // Check if the line ends with "*" (recursive directory search)
                const isRecursive = line.endsWith('*');
                const normalizedLine = isRecursive ? line.slice(0, -1).trim() : line; // Remove the "*" and trim
                const fullPath = path.join(workspaceRoot, path.normalize(normalizedLine));

                console.log(`Checking path: ${fullPath}`); // Debugging

                if (fs.existsSync(fullPath)) {
                    if (fs.statSync(fullPath).isDirectory()) {
                        // Handle directory
                        console.log(`Processing directory: ${fullPath}`);
                        const files = isRecursive
                            ? treeDataProvider.getAllFiles(fullPath) // Recursive search
                            : treeDataProvider.getFilesInDirectory(fullPath); // Non-recursive search
                        console.log(`Files found: ${files.length}`);
                        allFiles = allFiles.concat(files);
                    } else {
                        // Handle file
                        console.log(`Found file: ${fullPath}`);
                        allFiles.push(fullPath);
                    }
                } else {
                    console.warn(`Path not found: ${fullPath}`);
                }
            }

            console.log(`Total files found: ${allFiles.length}`); // Debugging
            const fileList = allFiles.join('\n');
            vscode.env.clipboard.writeText(fileList);
            vscode.window.showInformationMessage('File list copied to clipboard!');
        } else {
            vscode.window.showErrorMessage('No template path provided.');
        }
    });

    context.subscriptions.push(createTemplateCommand, openTemplateCommand, deleteTemplateCommand, copyTemplateCommand);
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

        const templateFiles = fs.readdirSync(templatesDir).filter(file => !fs.statSync(path.join(templatesDir, file)).isDirectory());
        const templateItems = templateFiles.map(file => {
            const filePath = path.join(templatesDir, file);
            return new TemplateItem(file, filePath);
        });

        return Promise.resolve(templateItems);
    }

    // Función para obtener todos los archivos en un directorio y sus subdirectorios (recursivo)
    getAllFiles(dirPath: string): string[] {
        let files: string[] = [];
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            if (fs.statSync(fullPath).isDirectory()) {
                console.log(`Entering subdirectory: ${fullPath}`);
                const subFiles = this.getAllFiles(fullPath); // Llamada recursiva
                files = files.concat(subFiles);
            } else {
                console.log(`Found file: ${fullPath}`);
                files.push(fullPath);
            }
        }

        return files;
    }

    // Función para obtener solo los archivos en un directorio (no recursivo)
    getFilesInDirectory(dirPath: string): string[] {
        let files: string[] = [];
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            if (!fs.statSync(fullPath).isDirectory()) {
                console.log(`Found file: ${fullPath}`);
                files.push(fullPath);
            }
        }

        return files;
    }
}

class TemplateItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly filePath: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);

        this.tooltip = this.filePath;
        this.contextValue = 'templateItem';
        this.iconPath = new vscode.ThemeIcon('file');
        this.command = {
            command: 'prompt-my-repo.openTemplate',
            title: 'Open Template',
            arguments: [this.filePath]
        };
    }
}

export function deactivate() {}