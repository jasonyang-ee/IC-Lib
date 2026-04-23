
## Local Development

### Setup Environment

- Setup your test database for local development.
- Copy `.env.example` to `.env` and update the values as needed.

### Start Service Locally

```bash
./start.sh
```

### Lint and Unit Test

```bash
./check.sh
```

### Commit Style

Please follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification when making commits. This helps maintain a clear and consistent commit history.

Example commit prefixes include:
- `feat`: A new feature
- `fix`: A bug fix
- `doc`: Documentation changes
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code refactoring without adding features or fixing bugs
- `ci`: Changes to CI configuration files and scripts
- `test`: Adding missing tests or correcting existing tests


### Change Log
Please update the `CHANGELOG.md` file with a summary of your changes in the `Unreleased` section. Follow the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format for consistency.


### Pull Request

When your changes are ready, create a pull request (PR) against the `main` branch. Provide a clear description of the changes you made and reference any related issues.