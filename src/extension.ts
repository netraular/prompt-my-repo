import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// NUEVA FUNCIÓN: Obtiene la ruta del directorio de plantillas para el workspace actual.
// Devuelve null si no hay ningún workspace abierto.
function getTemplatesDir(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return null;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    // Las plantillas se guardarán en .vscode/prompt-my-repo-templates/ dentro del proyecto.
    const templatesDir = path.join(workspaceRoot, '.vscode', 'prompt-my-repo-templates');

    // Asegurarse de que el directorio existe.
    if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
    }
    return templatesDir;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "prompt-my-repo" is now active!');

    // MODIFICADO: El TreeDataProvider ya no necesita el 'context' para la ruta.
    const treeDataProvider = new TemplateTreeDataProvider();
    vscode.window.registerTreeDataProvider('prompt-my-repo.view', treeDataProvider);

    // MODIFICADO: El comando ahora guarda las plantillas en el directorio del proyecto.
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

    // Sin cambios en openTemplateCommand, ya que opera sobre el filePath proporcionado.
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

    // Sin cambios en deleteTemplateCommand.
    const deleteTemplateCommand = vscode.commands.registerCommand('prompt-my-repo.deleteTemplate', (templateItem: TemplateItem) => {
        if (templateItem && templateItem.filePath) {
            fs.unlinkSync(templateItem.filePath);
            treeDataProvider.refresh();
        } else {
            vscode.window.showErrorMessage('No template path provided.');
        }
    });

    // MODIFICADO: La instancia de TemplateTreeDataProvider ya no necesita 'context'.
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
        const fileHelpers = new TemplateTreeDataProvider(); // Instancia sin 'context'

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

    context.subscriptions.push(createTemplateCommand, openTemplateCommand, deleteTemplateCommand, copyTemplateCommand);
}


class TemplateTreeDataProvider implements vscode.TreeDataProvider<TemplateItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TemplateItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    // MODIFICADO: El constructor ya no es necesario.
    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TemplateItem): vscode.TreeItem {
        return element;
    }

    // MODIFICADO: Lee las plantillas desde el directorio del proyecto.
    getChildren(): Thenable<TemplateItem[]> {
        const templatesDir = getTemplatesDir();
        if (!templatesDir) {
            // No hay workspace abierto, así que no mostramos plantillas.
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

    // El resto de los métodos de esta clase no necesitan cambios.
    getAllFiles(dirPath: string): string[] {
        let files: string[] = [];
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            if (fs.statSync(fullPath).isDirectory()) {
                files = files.concat(this.getAllFiles(fullPath));
            } else {
                files.push(fullPath);
            }
        }
        return files;
    }

    getFilesInDirectory(dirPath: string): string[] {
        let files: string[] = [];
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            if (!fs.statSync(fullPath).isDirectory()) {
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