
# Prompt My Repo VSCode extension

Welcome to **Prompt My Repo**, a VS Code extension designed to help you easily copy the content of multiple files and directories from your project into a text format. This is particularly useful when working with Large Language Models (LLMs) for code analysis, debugging, or documentation generation.

**[Install the Extension from the Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=netraular.prompt-my-repo)**

## Features

- **Select Files and Directories**: Specify files or directories in a template file to include their content.
- **Recursive Directory Search**: Use `\*` at the end of a directory path to include all files in subdirectories.
- **Exclude Comments**: Lines starting with `#` are treated as comments and ignored.
- **Formatted Output**: Copies file content in a structured format, including relative paths and file content.
- **Clipboard Integration**: Automatically copies the formatted output to your clipboard for easy pasting.

### Example

1. Create a template file with the following content:
   ```
   # Include files or directories here
   src\*
   utils\helper.js
   ```

2. Run the `Copy Template` command.
3. The following formatted output will be copied to your clipboard:
   ```
   src\main.js:
   ```
   ```javascript
   console.log("Hello, world!");
   ```

   ```
   utils\helper.js:
   ```
   ```javascript
   function helper() {
       return "Helpful!";
   }
   ```

## Requirements

- **VS Code**: This extension requires Visual Studio Code version 1.96.0 or higher.
- **Workspace**: You must have an open workspace folder in VS Code.

## Extension Settings

This extension does not currently add any specific settings to VS Code.

## Known Issues

- **Large Files**: Extremely large files may cause performance issues when copying content.
- **Non-Text Files**: Binary or non-text files are not supported and will be skipped.

## Release Notes

### 1.0.0

- Initial release of **Prompt My Repo**.
- Supports copying file content from specified paths and directories.
- Includes recursive directory search with `\*`.

### 1.0.1

- Fixed issue with handling paths containing spaces.
- Improved error handling for missing files or directories.

### 1.1.0

- Added support for comments in template files (lines starting with `#`).
- Improved formatting of copied content for better readability.

---

## Following Extension Guidelines

This extension adheres to the [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines). It follows best practices for performance, usability, and maintainability.

**Enjoy using Prompt My Repo!**
