import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

function getTemplatesDir(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return null;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const templatesDir = path.join(workspaceRoot, '.vscode', 'prompt-my-repo-templates');

    if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
    }
    return templatesDir;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "prompt-my-repo" is now active!');

    const treeDataProvider = new TemplateTreeDataProvider();
    vscode.window.registerTreeDataProvider('prompt-my-repo.view', treeDataProvider);

    const createTemplateCommand = vscode.commands.registerCommand('prompt-my-repo.createTemplate', async () => {
        const templatesDir = getTemplatesDir();
        if (!templatesDir) {
            vscode.window.showErrorMessage('You must have a workspace folder open to create a project-specific template.');
            return;
        }

        const templateName = await vscode.window.showInputBox({
            prompt: 'Enter a name for the new template',
            placeHolder: 'Template name'
        });

        if (templateName) {
            const templatePath = path.join(templatesDir, templateName);
            const initialContent = `# Project-specific template for Prompt My Repo\n# Include directories or files you want to copy relative to the workspace root.\n# Append "*" to a directory for a recursive search (e.g., src*).\n# Exclude files or directories by prefixing them with "-" (e.g., -node_modules*).\n`;
            fs.writeFileSync(templatePath, initialContent);
            treeDataProvider.refresh();
        }
    });

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

    // NUEVO COMANDO: Para renombrar una plantilla
    const renameTemplateCommand = vscode.commands.registerCommand('prompt-my-repo.renameTemplate', async (templateItem: TemplateItem) => {
        if (!templateItem?.filePath) {
            vscode.window.showErrorMessage('No template selected for renaming.');
            return;
        }

        const newName = await vscode.window.showInputBox({
            prompt: 'Enter the new name for the template',
            value: templateItem.label, // Pre-fill with the current name
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Name cannot be empty.';
                }
                if (/[\\/:"*?<>|]/.test(value)) {
                    return 'Name contains invalid characters.';
                }
                return null; // Input is valid
            }
        });

        if (newName && newName.trim() !== templateItem.label) {
            const templatesDir = getTemplatesDir();
            if (!templatesDir) return; // Should not happen if item exists

            const newFilePath = path.join(templatesDir, newName.trim());

            if (fs.existsSync(newFilePath)) {
                vscode.window.showErrorMessage(`A template with the name "${newName.trim()}" already exists.`);
                return;
            }

            try {
                fs.renameSync(templateItem.filePath, newFilePath);
                treeDataProvider.refresh();
                vscode.window.showInformationMessage(`Template renamed to "${newName.trim()}".`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to rename template: ${error}`);
            }
        }
    });

    const deleteTemplateCommand = vscode.commands.registerCommand('prompt-my-repo.deleteTemplate', (templateItem: TemplateItem) => {
        if (templateItem && templateItem.filePath) {
            fs.unlinkSync(templateItem.filePath);
            treeDataProvider.refresh();
        } else {
            vscode.window.showErrorMessage('No template path provided.');
        }
    });

    const copyTemplateCommand = vscode.commands.registerCommand('prompt-my-repo.copyTemplate', async (templateItem: TemplateItem) => {
        if (!templateItem?.filePath) {
            vscode.window.showErrorMessage('No template path provided.');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const templateContent = fs.readFileSync(templateItem.filePath, 'utf-8');
        const templateLines = templateContent.split('\n');
        const fileHelpers = new TemplateTreeDataProvider();

        const resolvePathSpec = (spec: string): string[] => {
            const isRecursive = spec.endsWith('*');
            const normalizedSpec = isRecursive ? spec.slice(0, -1).trim() : spec;
            const fullPath = path.join(workspaceRoot, normalizedSpec);

            if (!fs.existsSync(fullPath)) {
                console.warn(`Path not found: ${fullPath}`);
                return [];
            }

            if (fs.statSync(fullPath).isDirectory()) {
                return isRecursive
                    ? fileHelpers.getAllFiles(fullPath)
                    : fileHelpers.getFilesInDirectory(fullPath);
            } else {
                return [fullPath];
            }
        };

        const excludedFiles = new Set<string>();
        for (const line of templateLines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('-')) {
                const spec = trimmedLine.substring(1).trim();
                const filesToExclude = resolvePathSpec(spec);
                filesToExclude.forEach(file => excludedFiles.add(file));
            }
        }

        let formattedContent = '';
        const processedFiles = new Set<string>();
        
        for (const line of templateLines) {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('#') || trimmedLine === '') {
                formattedContent += line + '\n';
                continue;
            }

            if (trimmedLine.startsWith('-')) {
                continue;
            }

            const filesToInclude = resolvePathSpec(trimmedLine);
            for (const file of filesToInclude) {
                if (excludedFiles.has(file) || processedFiles.has(file)) {
                    continue;
                }
                processedFiles.add(file);
                const relativePath = path.relative(workspaceRoot, file);
                const fileContent = fs.readFileSync(file, 'utf-8');
                formattedContent += `${relativePath}:\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;
            }
        }

        vscode.env.clipboard.writeText(formattedContent.trimEnd());
        vscode.window.showInformationMessage('Template content copied to clipboard!');
    });

    // No olvides añadir el nuevo comando a las suscripciones
    context.subscriptions.push(
        createTemplateCommand,
        openTemplateCommand,
        renameTemplateCommand,
        deleteTemplateCommand,
        copyTemplateCommand
    );
}

class TemplateTreeDataProvider implements vscode.TreeDataProvider<TemplateItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TemplateItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TemplateItem): vscode.TreeItem {
        return element;
    }

    getChildren(): Thenable<TemplateItem[]> {
        const templatesDir = getTemplatesDir();
        if (!templatesDir) {
            return Promise.resolve([]);
        }

        const templateFiles = fs.readdirSync(templatesDir).filter(file => 
            !fs.statSync(path.join(templatesDir, file)).isDirectory()
        );
        const templateItems = templateFiles.map(file => {
            const filePath = path.join(templatesDir, file);
            return new TemplateItem(file, filePath);
        });

        return Promise.resolve(templateItems);
    }

    getAllFiles(dirPath: string): string[] {
        let files: string[] = [];
        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                if (fs.statSync(fullPath).isDirectory()) {
                    files = files.concat(this.getAllFiles(fullPath));
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
        }
        return files;
    }

    getFilesInDirectory(dirPath: string): string[] {
        let files: string[] = [];
        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                if (!fs.statSync(fullPath).isDirectory()) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
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
            arguments: [this]
        };
    }
}

export function deactivate() {}