# Project Guidelines & Rules

## Communication Rules
- **Status Updates**: Provide a status update every minute or as soon as a technical issue is understood/resolved.
- **Direct Feedback**: Be direct and avoid over-explaining. Focus on the fix and the current state of the application.

## Development Rules
- **Next.js Version**: Pay close attention to version 16.2.4 (Turbopack) changes.
- **State Selection**: Always ensure 'type' parameters from the URL correctly select the active tab and preserve state.
- **Model Integrity**: When database issues occur, verify primitives vs objects (Boolean vs boolean) immediately.
- **Export Safety**: Never have multiple 'default' exports in a single file. Each page should have a single 'WithSuspense' export if using search parameters.
