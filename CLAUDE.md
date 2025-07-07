# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Elevator Saga is an educational programming game where players write JavaScript code to control elevators and complete transportation challenges. It runs entirely in the browser using vanilla JavaScript without a build system.

## Common Development Commands

### Running the Application
- Open `index.html` in a web browser to run the game locally
- No build step required - this is a vanilla JavaScript application

### Running Tests
- Open `test/index.html` in a web browser to run the Jasmine test suite
- All tests are in `test/tests.js`
- Performance tests available at `test/performance.html`

## Architecture Overview

### Core Game Engine
The game simulation is built around these key components:

- **World** (`world.js`): Main game loop and simulation controller
- **Elevator** (`elevator.js`): Elevator logic, movement, and passenger handling
- **Floor** (`floor.js`): Floor management and user spawning
- **User** (`user.js`): Passenger behavior and pathfinding
- **Interfaces** (`interfaces.js`): Public API exposed to player code

### UI and Presentation
- **App** (`app.js`): Main application controller, handles UI state and code execution
- **Presenters** (`presenters.js`): Visual rendering using Riot.js for reactive updates
- Uses CodeMirror for the in-browser code editor

### Challenge System
- **Challenges** (`challenges.js`): Defines all game levels with objectives and constraints
- **Fitness** (`fitness.js`, `fitnessworker.js`): Evaluates player solutions using web workers

### Player Code Execution
Players implement two functions that control elevator behavior:
- `init(elevators, floors)`: Called once at start
- `update(dt, elevators, floors)`: Called each frame

The player's code is evaluated in a sandboxed environment with access only to the public elevator/floor APIs.

## Key Development Patterns

### No Build System
- Direct script imports in HTML files
- Dependencies vendored in `libs/` directory
- No transpilation or bundling

### Testing Approach
- Browser-based Jasmine tests
- Test by opening `test/index.html`
- Focus on unit tests for core game logic

### Code Style
- Vanilla ES5/ES6 JavaScript
- jQuery for DOM manipulation
- Lodash for utilities
- Object-oriented design with prototypal inheritance

## Important Notes

- The project is not actively maintained per README
- All game assets and libraries are self-contained (no CDN dependencies except fonts)
- The game saves player code to localStorage for persistence

## Development

- use todo tools to keep track of work that needs to be done
- use tasks tools for research
