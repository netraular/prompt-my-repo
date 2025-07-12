# Change Log

All notable changes to the "prompt-my-repo" extension will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.1.0] - 2025-07-12

This is the first major feature release, introducing a complete workflow for creating, managing, and using powerful templates.

### Added

- **Project-Specific Templates**: Templates are now stored locally within your workspace in the `.vscode/prompt-my-repo-templates` directory. This makes them easy to share and version-control with your project.
- **File & Directory Exclusion**: You can now exclude specific files or directories from being processed by prefixing the line in your template with a hyphen (`-`). For example: `-node_modules*`.
- **Powerful File Extension Filtering**: Added the ability to filter files by extension when scanning directories. This allows for precise selections, such as including only source code files. Example syntax: `src* [.ts, .tsx]`.
- **Rename Command**: A new "Rename" command has been added to the context menu (and is triggered by the pencil icon) to easily rename templates directly from the sidebar.

### Changed

- **UI/UX Improvement**: The "Edit" (pencil) icon in the sidebar now triggers the new "Rename" functionality for a more intuitive user experience. To edit the content of a template, simply click on its name.
- **Comment Preservation**: Comments (`#`) within your template files are now preserved and included in the final copied output. This allows you to add context or instructions directly into your generated prompt.

## [0.0.1] - 2025-01-04

- Initial release of the extension with basic functionality to create and copy content from a single global template.