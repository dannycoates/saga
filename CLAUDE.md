# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Elevator Saga is an elevator programming game where users write JavaScript code to control elevators efficiently. The game is built with Vite, uses CodeMirror for the code editor, and runs in the browser.

## Commands

### Development
- `npm run dev` - Start development server on port 3000 with hot reloading
- `npm run build` - Build for production (outputs to `dist/`)
- `npm run preview` - Preview production build

### Testing
- `npm run test:run` - Run tests once

## Architecture

### Key Directories
- `/src/core/` - Core game engine components (Elevator, Floor, User, World, etc.)
- `/src/game/` - Game logic including challenges and fitness evaluation
- `/src/ui/` - UI presentation layer
- `/tests/` - Test files mirroring src structure

### Core Components

1. **World System** (`src/core/World.js`)
   - `WorldCreator` - Creates floors and elevators
   - `WorldController` - Manages game state, user spawning, and time progression
   - Handles the main game loop and physics

2. **Game Entities**
   - `Elevator` - Elevator state and behavior (capacity, movement, queue management)
   - `Floor` - Floor state and user queues
   - `User` - Individual users with destinations and wait times
   - All entities extend `Movable` for position/animation handling

3. **Player Code Interface** (`src/core/interfaces.js`)
   - Players implement `init(elevators, floors)` and `update(dt, elevators, floors)`
   - Elevator and floor objects are wrapped with safe interfaces before exposure

4. **Challenge System** (`src/game/challenges.js`)
   - Defines success criteria for each level
   - Evaluates performance metrics (transported users, wait times, moves)

5. **UI Layer** (`src/app.js`, `src/ui/presenters.js`)
   - CodeMirror integration for code editing
   - Real-time visualization of elevator state
   - Challenge selection and progress tracking

## Testing Approach

The project uses Vitest with JSDOM for testing. Test files are in `/tests/` and follow the naming pattern `*.test.js`. Tests focus on core game mechanics, entity behaviors, and utility functions.
