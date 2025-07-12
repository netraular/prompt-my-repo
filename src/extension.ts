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
            // Updated initial content to mention the exclusion feature
            const initialContent = `# Include directories or files you want to copy relative to the workspace root.\n# Append "*" to a directory for a recursive search (e.g., src*).\n# Exclude files or directories by prefixing them with "-" (e.g., -node_modules*).\n`;
            fs.writeFileSync(templatePath, initialContent);
            treeDataProvider.refresh();
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
            fs.unlinkSync(templateItem.filePath);
            treeDataProvider.refresh();
        } else {
            vscode.window.showErrorMessage('No template path provided.');
        }
    });

    // Register a command to copy the contents of a template
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
        const fileHelpers = new TemplateTreeDataProvider(context);

        // Helper function to resolve a path spec (like 'src*' or 'file.txt') to a list of file paths
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

        // --- PASS 1: Build the set of excluded files ---
        const excludedFiles = new Set<string>();
        console.log("--- Starting exclusion pass ---");
        for (const line of templateLines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('-')) {
                const spec = trimmedLine.substring(1).trim();
                const filesToExclude = resolvePathSpec(spec);
                filesToExclude.forEach(file => {
                    console.log(`Excluding file: ${file}`);
                    excludedFiles.add(file);
                });
            }
        }
        console.log(`Total files to exclude: ${excludedFiles.size}`);

        // --- PASS 2: Build the final output, respecting inclusions, exclusions, and order ---
        let formattedContent = '';
        const processedFiles = new Set<string>(); // Avoid duplicating file content
        
        console.log("--- Starting inclusion pass ---");
        for (const line of templateLines) {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('#') || trimmedLine === '') {
                formattedContent += line + '\n';
                continue;
            }

            // Exclusion rules are ignored in this pass, they were handled in pass 1
            if (trimmedLine.startsWith('-')) {
                continue;
            }

            // This is an inclusion rule
            const filesToInclude = resolvePathSpec(trimmedLine);
            for (const file of filesToInclude) {
                // Check against three conditions:
                // 1. Is it explicitly excluded?
                // 2. Has it already been processed?
                if (excludedFiles.has(file)) {
                    console.log(`Skipping excluded file: ${file}`);
                    continue;
                }
                if (processedFiles.has(file)) {
                    console.log(`Skipping already processed file: ${file}`);
                    continue;
                }

                // If all checks pass, process the file
                processedFiles.add(file);
                const relativePath = path.relative(workspaceRoot, file);
                const fileContent = fs.readFileSync(file, 'utf-8');
                formattedContent += `${relativePath}:\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;
            }
        }

        vscode.env.clipboard.writeText(formattedContent.trimEnd());
        vscode.window.showInformationMessage('Template content copied to clipboard!');
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
                // console.log(`Entering subdirectory: ${fullPath}`);
                const subFiles = this.getAllFiles(fullPath); // Llamada recursiva
                files = files.concat(subFiles);
            } else {
                // console.log(`Found file: ${fullPath}`);
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
                // console.log(`Found file: ${fullPath}`);
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