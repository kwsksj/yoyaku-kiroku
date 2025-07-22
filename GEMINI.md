# Gemini Project Configuration

This file helps Gemini understand the specifics of this project to provide more accurate and context-aware assistance.

## Project Overview

This project is a reservation management system built on Google Apps Script (GAS). It manages reservations for multiple classrooms, student information, and sales data using Google Sheets as a database. It also provides a web application (WebApp) for users to make reservations, view their history, and for administrators to manage accounting.

- **Core Functionality:**
  - Reservation management (create, cancel, view)
  - Student roster management
  - Automated sales data logging
  - Data caching for performance optimization
  - WebApp for user interaction and administration
- **Technology Stack:**
  - **Backend:** Google Apps Script (.gs files)
  - **Frontend:** HTML, CSS, JavaScript (within .html files for GAS WebApp)
  - **Database:** Google Sheets
  - **External Services:** Google Forms, Google Calendar

## Coding Style & Conventions

- **Naming:**
  - Use camelCase for variables and functions (e.g., `myVariable`, `handleEdit`).
  - Use PascalCase for classes (if any).
  - Use UPPER_SNAKE_CASE for global constants (e.g., `HEADER_RESERVATION_ID`).
- **Comments:**
  - Use JSDoc-style comments for all major functions, especially in backend files, to explain their purpose, parameters, and return values.
- **Formatting:**
  - Adhere to standard JavaScript/GAS formatting conventions.
- **Error Handling:**
  - Use the centralized `handleError` utility for displaying user-facing errors.
  - Log detailed error information for debugging purposes using `logActivity`.

## Common Commands

- **Deploy:** This project is deployed as a Google Apps Script project. Deployment is managed through the Google Apps Script editor or using a tool like `clasp`.
  - `clasp push`: Pushes the local code to the Google Apps Script project.
  - `clasp deploy`: Deploys a new version of the project.

## Key Files

- **`docs/00_Project_Structure.md`**: Defines the responsibility of each file in the project. This is the primary map for understanding the overall architecture.
- **`docs/00-1_Function_Map.md`**: Details the relationships and dependencies between all major functions in the backend. Crucial for assessing the impact of changes.
- **`docs/00-2_Data_Model.md`**: Describes the structure of the Google Sheets used as a database, including column definitions and relationships between sheets.
- **`docs/roadmap.md`**: Outlines the development and maintenance tasks for the project, including bug fixes, new features, and architectural improvements.
- **`src/01_Code.js`**: The main entry point of the application, containing global constants, UI setup (menus), and the primary event triggers (`onEdit`, `onChange`).
- **`src/09_Backend_Endpoints.js`**: Consolidates functions called from the WebApp to reduce the number of server calls and improve user experience.
- **`src/12_WebApp_Core.html`**: Contains the core logic for the frontend WebApp, including state management, UI component generation, and utility functions.
- **`appsscript.json`**: The manifest file for the Google Apps Script project, defining necessary permissions, libraries, and other settings.

## AI Behavior Principles

To ensure effective and predictable collaboration, Gemini will adhere to the following principles:

- **Clarification of Ambiguity**: If a user's instruction is ambiguous, multi-faceted, or contains multiple tasks, Gemini will first structure its interpretation of the tasks and ask for the user's approval before proceeding. For clear, direct instructions, this confirmation step will be skipped.
- **Honesty in Capability**: Gemini will not pretend to perform tasks that are beyond its capabilities. It will honestly state its limitations, explain the reason, and propose alternative solutions.
- **Primacy of Current Facts**: Gemini will always prioritize the latest information (code, instructions) provided by the user over its own past interpretations or responses. It will refer to the current state of files, not its memory of them.

## Rules for Generating Artifacts

All generated outputs, such as code, plans, or documents, must follow these rules to ensure clarity, consistency, and effective version control.

- **Primary Principle: Propose as a Diff**:
  - All modifications to existing files or creation of new files must be presented as a diff (patch) proposal within the project's file system.
  - This ensures that all changes are explicit, reviewable, and maintainable.
  - The proposed diff must be self-contained and not break the syntactic or logical integrity of the project.
  - Conceptual code snippets are an exception, but only when explicitly requested by the user. Placeholders (`...` etc.) are forbidden.
- **The Law of Single Responsibility for Diffs**:
  - A single diff patch must address only one single, logically complete task.
  - Multiple unrelated changes must not be bundled into a single patch. If multiple tasks are requested, Gemini will ask for prioritization and address them in separate, sequential diffs.
- **Protocol for Code Modifications**:
  1. **Internal Generation**: Gemini will first internally generate the complete, modified version of the code.
  2. **Diff Proposal**: It will then compare the new code with the original and present the difference as a patch, following a strict unified diff format. This includes context lines and `+`/`-` prefixes for changes, while ignoring meaningless whitespace changes.

## Project Management Strategy (Git-Flow Synchronized)

This project follows a systematic, file-based management strategy to ensure clarity and overcome the limitations of AI memory across sessions. The `docs/roadmap.md` file is the single source of truth for all project tasks.

### Session Roles

- **Master Session (`main` branch):** The primary, long-term chat for overall project management. Its responsibilities include:
  - Defining and updating the project roadmap (`roadmap.md`).
  - Instructing the user to create new branches and sessions for specific tasks.
  - Merging completed task branches.
- **Task Session (`feature/task-id` branch):** A temporary, short-term chat dedicated to a single task. Its responsibilities include:
  - Understanding the assigned task by reading `roadmap.md`.
  - Executing the task and proposing changes as diffs.
  - Reporting completion and updating its own task status in `roadmap.md`.

### Workflow Protocol

1. **Planning (Master Session)**: Gemini will first create or update the `roadmap.md` file, assigning a unique ID to each task (e.g., `NF-01`, `BUG-02`).
2. **Initiating a Task (User & Master Session)**: For the next task, Gemini will instruct the user: "Please create a new branch (`git switch -c feature/[Task-ID]`) and start a new chat. Then, instruct me: 'Begin task [Task-ID] based on `roadmap.md`.'"
3. **Execution (Task Session)**: In the new chat, upon receiving the instruction, Gemini will read `roadmap.md`, understand the task, and begin execution.
4. **Completion (Task Session)**: Upon completion, Gemini will propose a final diff to mark the task as complete in `roadmap.md` and report back to the user to merge the branch.
5. **Integration (Master Session)**: Once the branch is merged, the master session will reflect the changes and proceed to the next task cycle.
