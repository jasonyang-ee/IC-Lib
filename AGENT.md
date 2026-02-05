
## Reference Repo

- I have a reference code base located in /reference that contains a code structure andy style guidelines that should be followed.

## Terminal Commands

- There is a bug where the first character entered in the terminal is not registered. To work around this, always enter a space before typing your actual command.

## Server Log Style

- Always use ascii characters for server logs.
- Avoid using unicode characters in server logs to ensure compatibility and readability across different systems.
- Use fastify log levels in server logs.
- Use this format: [FastifyLogLevel] [ServiceName] Message
- Example: [FastifyLogLevel] [AuthService] User login successful

## Server Setup

- The database server is running on seperate hardware from the development environment.
- Please always try to use postgresql extension to directly connect to the database server (Home-Servers/iclib) from your development environment to get information about the database server.
- To start the server, use the command `./local-start.sh` from the root directory.


## Versioning

- Please update CHANGELOG.md for every new feature or bug fix implemented in the ## [Unreleased] section, following the format used in previous entries. This helps maintain a clear history of changes and improvements made to the project.